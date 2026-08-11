import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { VerificationPurpose } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { VerificationCodeService } from './verification-code.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

// Test d'INTÉGRATION, et il ne peut pas être autre chose.
//
// Le fichier voisin (auth.service.spec.ts) vérifie que les bons APPELS sont
// faits. Ici on vérifie le RÉSULTAT, qui est la vraie propriété de sécurité :
// après détection d'un vol, la session est-elle réellement morte ?
//
// Un Prisma mocké répond toujours la même chose et n'a pas de mémoire : il ne
// peut pas montrer qu'un jeton émis à l'étape 2 cesse de fonctionner à cause
// d'un évènement de l'étape 3. Il faut de vraies lignes en base.

const prisma = new PrismaService();
const verificationCodes = new VerificationCodeService(prisma);

// Aucun email ne part : l'envoi n'est pas le sujet de ce fichier.
const mail = {
  sendVerificationCode: () => Promise.resolve(undefined),
  sendPasswordResetCode: () => Promise.resolve(undefined),
} as unknown as MailService;

const service = new AuthService(
  new UsersService(prisma),
  new JwtService({ secret: 'secret-de-test' }),
  prisma,
  new ConfigService({}),
  mail,
  verificationCodes,
);

const MOT_DE_PASSE = 'MotDePasseValide123!';
const aNettoyer: string[] = [];

async function creerCliente() {
  const email = `sessions-${randomUUID()}@exemple.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(MOT_DE_PASSE),
      firstName: 'Cliente',
      lastName: 'Sessions',
      loyaltyAccount: { create: {} },
    },
  });
  aNettoyer.push(user.id);
  return { user, email };
}

const jetonsVivants = (userId: string) =>
  prisma.refreshToken.count({ where: { userId, revokedAt: null } });

describe('AuthService — cycle de vie des sessions (vraie base)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  }, 30_000);

  afterAll(async () => {
    // Effacer les clientes emporte jetons et codes (ON DELETE CASCADE).
    await prisma.user.deleteMany({ where: { id: { in: aNettoyer } } });
    await prisma.$disconnect();
  });

  it('émet un nouveau jeton et révoque l’ancien à chaque rotation', async () => {
    const { user, email } = await creerCliente();
    const session = await service.login({ email, password: MOT_DE_PASSE });

    const rotation = await service.refresh(session.refreshToken);

    expect(rotation.refreshToken).not.toBe(session.refreshToken);

    // Un seul jeton vivant : l'ancien est révoqué, pas empilé à côté du neuf.
    // Sans cette révocation, un jeton intercepté resterait valable pour
    // toujours et le rejeu ne serait même pas détectable.
    expect(await jetonsVivants(user.id)).toBe(1);

    // Et le nouveau fonctionne.
    await expect(
      service.refresh(rotation.refreshToken),
    ).resolves.toHaveProperty('accessToken');

    // NB : on ne rejoue PAS l'ancien jeton ici. Ce serait précisément le
    // scénario de vol, qui tue toute la famille — et ferait échouer les
    // assertions ci-dessus. Il a son propre test, juste en dessous.
  }, 30_000);

  // ═══════════════════════════════════════════════════════════
  //  LE SCÉNARIO QUI COMPTE : un jeton intercepté
  // ═══════════════════════════════════════════════════════════
  it('tue la session ENTIÈRE quand un jeton volé est rejoué', async () => {
    const { user, email } = await creerCliente();

    // La cliente se connecte, puis son app renouvelle normalement.
    const session = await service.login({ email, password: MOT_DE_PASSE });
    const legitime = await service.refresh(session.refreshToken);

    // Un attaquant avait intercepté le PREMIER jeton et le rejoue.
    await expect(service.refresh(session.refreshToken)).rejects.toThrow(
      /déjà utilisé/,
    );

    // Voilà la propriété que seul un vrai test peut montrer : le jeton
    // LÉGITIME, émis avant l'intrusion et détenu par la cliente, ne vaut plus
    // rien non plus. On coupe toute la session au lieu de laisser l'attaquant
    // et la victime cohabiter — la cliente devra se reconnecter, ce qui est
    // exactement le comportement voulu.
    await expect(service.refresh(legitime.refreshToken)).rejects.toThrow();
    expect(await jetonsVivants(user.id)).toBe(0);
  }, 30_000);

  it('coupe les sessions ouvertes quand le mot de passe est réinitialisé', async () => {
    const { user, email } = await creerCliente();

    // Deux appareils connectés : téléphone et tablette.
    const telephone = await service.login({ email, password: MOT_DE_PASSE });
    const tablette = await service.login({ email, password: MOT_DE_PASSE });
    expect(await jetonsVivants(user.id)).toBe(2);

    // La cliente reprend la main sur son compte avec un vrai code.
    const code = await verificationCodes.issue(
      user.id,
      VerificationPurpose.PASSWORD_RESET,
    );
    await service.resetPassword({
      email,
      code: code!,
      newPassword: 'UnAutreMotDePasse456!',
    });

    // Si le compte avait été compromis, l'intrus devait sauter avec.
    expect(await jetonsVivants(user.id)).toBe(0);
    await expect(service.refresh(telephone.refreshToken)).rejects.toThrow();
    await expect(service.refresh(tablette.refreshToken)).rejects.toThrow();

    // Et le nouveau mot de passe fonctionne bien.
    await expect(
      service.login({ email, password: 'UnAutreMotDePasse456!' }),
    ).resolves.toHaveProperty('accessToken');
  }, 60_000);

  it('ne déconnecte que la session concernée à la déconnexion', async () => {
    const { email } = await creerCliente();

    const telephone = await service.login({ email, password: MOT_DE_PASSE });
    const tablette = await service.login({ email, password: MOT_DE_PASSE });

    await service.logout(telephone.refreshToken);

    // Se déconnecter du téléphone ne doit pas éjecter la tablette : chaque
    // connexion ouvre sa propre famille de jetons.
    await expect(service.refresh(telephone.refreshToken)).rejects.toThrow();
    await expect(
      service.refresh(tablette.refreshToken),
    ).resolves.toHaveProperty('accessToken');
  }, 30_000);

  it('refuse un code de réinitialisation déjà consommé', async () => {
    const { user, email } = await creerCliente();

    const code = await verificationCodes.issue(
      user.id,
      VerificationPurpose.PASSWORD_RESET,
    );
    await service.resetPassword({
      email,
      code: code!,
      newPassword: 'PremierChangement123!',
    });

    // Usage unique : rejouer le même code ne doit plus rien donner, sinon un
    // code intercepté resterait une clé permanente sur le compte.
    await expect(
      service.resetPassword({
        email,
        code: code!,
        newPassword: 'SecondChangement123!',
      }),
    ).rejects.toThrow();
  }, 60_000);
});
