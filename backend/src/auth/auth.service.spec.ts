import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Role, User, VerificationPurpose } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

// argon2 est enveloppé, pas remplacé : le VRAI hachage tourne (on veut vérifier
// qu'un mot de passe finit bien haché), mais les appels deviennent comptables.
// `jest.spyOn` ne fonctionne pas ici — le module natif expose des propriétés
// non redéfinissables et lève « Cannot redefine property: verify ».
jest.mock('argon2', () => {
  const vrai = jest.requireActual<typeof import('argon2')>('argon2');
  return {
    ...vrai,
    hash: jest.fn(vrai.hash),
    verify: jest.fn(vrai.verify),
  };
});
import { VerificationCodeService } from './verification-code.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

// Ce fichier ne teste PAS que « la connexion marche » — ça, l'application le
// démontre tous les jours. Il verrouille les défenses **invisibles** du module :
// celles qui ne servent que dans les cas rares, qu'on ne voit jamais à l'usage,
// et qu'un nettoyage bien intentionné peut supprimer sans que rien ne casse.
//
// Aucune mesure de temps ici. Chronométrer donnerait un test qui échoue au
// hasard selon la charge de la machine ; on vérifie le MÉCANISME (le hachage
// factice est bien payé, l'envoi d'email n'est bien pas attendu), ce qui est
// déterministe et échoue pour la bonne raison.

describe('AuthService — défenses de sécurité', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
  };
  let prisma: any;
  let mail: any;
  let verificationCodes: { issue: jest.Mock; consume: jest.Mock };

  // Haché une seule fois : argon2 est volontairement lent (~100 ms), le refaire
  // à chaque test rendrait la suite pénible sans rien prouver de plus.
  let hashDuBonMotDePasse: string;

  const BON_MOT_DE_PASSE = 'MotDePasseValide123!';

  beforeAll(async () => {
    hashDuBonMotDePasse = await argon2.hash(BON_MOT_DE_PASSE);
  }, 30_000);

  const cliente = (over: Partial<User> = {}): User => ({
    id: 'cliente-1',
    email: 'cliente@exemple.test',
    phone: null,
    passwordHash: hashDuBonMotDePasse,
    role: Role.CLIENT,
    firstName: 'Fati',
    lastName: 'Cliente',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    emailVerifiedAt: null,
    ...over,
  });

  const jetonEnBase = (over: Record<string, unknown> = {}) => ({
    id: 'jeton-1',
    tokenHash: 'peu-importe',
    userId: 'cliente-1',
    familyId: 'famille-1',
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    revokedAt: null,
    createdAt: new Date(),
    user: cliente(),
    ...over,
  });

  beforeEach(async () => {
    // Les mocks issus de `jest.mock` ne sont pas remis à zéro par
    // `restoreAllMocks` : leur historique d'appels survivrait d'un test à
    // l'autre et fausserait les comptages.
    (argon2.verify as jest.Mock).mockClear();

    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };

    prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { update: jest.fn().mockResolvedValue(cliente()) },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    mail = {
      sendVerificationCode: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
    };

    verificationCodes = {
      issue: jest.fn().mockResolvedValue('123456'),
      consume: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('jwt') },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MailService, useValue: mail },
        { provide: VerificationCodeService, useValue: verificationCodes },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════
  //  1. NE PAS RÉVÉLER QUI EST CLIENTE DE L'INSTITUT
  // ═══════════════════════════════════════════════════════════
  //
  // Pour un centre de beauté, la liste des clientes est une donnée privée.
  // Trois routes publiques pourraient la trahir : login, forgot-password et
  // reset-password. Chacune doit se comporter EXACTEMENT pareil que le compte
  // existe ou non — même message, et même coût en temps.
  describe('non-divulgation des comptes existants', () => {
    it('paie le même hachage pour un email inconnu que pour un vrai compte', async () => {
      const verify = argon2.verify as jest.Mock;
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'jamais-vue@exemple.test',
          password: 'peu-importe',
        }),
      ).rejects.toThrow();

      // Le cœur de la défense : sans ce hachage factice, un email inconnu
      // répondait en ~5 ms contre ~100 ms pour un compte réel. En chronométrant
      // les réponses, on obtenait la liste des clientes sans jamais se
      // connecter. Retirer `burnPasswordComparison` fait tomber ce test.
      expect(verify).toHaveBeenCalled();
    });

    it('renvoie le même message pour un email inconnu et un mauvais mot de passe', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const inconnu = await service
        .login({ email: 'jamais-vue@exemple.test', password: 'x' })
        .catch((e: Error) => e);

      usersService.findByEmail.mockResolvedValue(cliente());
      const mauvaisMdp = await service
        .login({ email: 'cliente@exemple.test', password: 'mauvais' })
        .catch((e: Error) => e);

      expect((inconnu as Error).message).toBe((mauvaisMdp as Error).message);
    });

    it('répond la même chose à « mot de passe oublié », compte existant ou non', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const inconnu = await service.forgotPassword('jamais-vue@exemple.test');

      usersService.findByEmail.mockResolvedValue(cliente());
      const connu = await service.forgotPassword('cliente@exemple.test');

      expect(inconnu.message).toBe(connu.message);
      // Et aucun email n'est parti pour le compte inconnu.
      expect(mail.sendPasswordResetCode).toHaveBeenCalledTimes(1);
    });

    it('n’attend pas l’envoi de l’email, sinon le délai trahit le compte', async () => {
      usersService.findByEmail.mockResolvedValue(cliente());
      // Un envoi qui ne se termine JAMAIS. Si la route l'attendait, ce test
      // resterait bloqué jusqu'au timeout de Jest au lieu de passer.
      mail.sendPasswordResetCode.mockReturnValue(new Promise(() => {}));

      await expect(
        service.forgotPassword('cliente@exemple.test'),
      ).resolves.toHaveProperty('message');
    });

    it('renvoie le même message pour un compte inconnu et un code faux', async () => {
      const demande = {
        email: 'cliente@exemple.test',
        code: '000000',
        newPassword: 'NouveauMotDePasse123!',
      };

      usersService.findByEmail.mockResolvedValue(null);
      const compteInconnu = await service
        .resetPassword(demande)
        .catch((e: Error) => e);

      usersService.findByEmail.mockResolvedValue(cliente());
      verificationCodes.consume.mockRejectedValue(
        new Error('Code invalide ou expiré.'),
      );
      const codeFaux = await service
        .resetPassword(demande)
        .catch((e: Error) => e);

      // Distinguer les deux transformerait cette route en annuaire des clientes.
      expect((compteInconnu as Error).message).toBe(
        (codeFaux as Error).message,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  2. UN JETON VOLÉ NE DOIT PAS SURVIVRE À SON USAGE
  // ═══════════════════════════════════════════════════════════
  //
  // Les refresh tokens tournent : chaque usage révoque l'ancien et en émet un
  // nouveau, dans la même « famille ». Si un jeton DÉJÀ utilisé se represente,
  // c'est qu'il en existe une copie — donc que quelqu'un l'a intercepté. On ne
  // se contente alors pas de refuser : on tue toute la famille.
  describe('rotation des jetons et détection de réutilisation', () => {
    it('révoque TOUTE la famille quand un jeton déjà utilisé est rejoué', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        jetonEnBase({ revokedAt: new Date() }),
      );

      await expect(service.refresh('jeton-vole')).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      // Pas seulement « ce jeton est refusé » : toute la session tombe. Sans
      // ça, le voleur restait connecté avec les jetons suivants de la chaîne.
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'famille-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('révoque l’ancien jeton à chaque rotation normale', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(jetonEnBase());

      await service.refresh('jeton-valide');

      // C'est cette révocation qui rend la réutilisation détectable : sans
      // elle, un jeton intercepté resterait valable indéfiniment.
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'jeton-1' },
        data: { revokedAt: expect.any(Date) },
      });
      // Et un nouveau jeton est émis dans la MÊME famille.
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ familyId: 'famille-1' }),
        }),
      );
    });

    it('refuse un jeton inconnu', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('jamais-emis')).rejects.toThrow();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('refuse un jeton expiré sans tuer la famille', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        jetonEnBase({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.refresh('jeton-perime')).rejects.toThrow();
      // Une expiration normale n'est pas une intrusion : rien à révoquer.
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('déconnecte toute la session à la déconnexion', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(jetonEnBase());

      await service.logout('jeton-valide');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'famille-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('répond OK à la déconnexion d’un jeton inconnu, sans rien révéler', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.logout('nimporte-quoi')).resolves.toHaveProperty(
        'message',
      );
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  3. REPRENDRE LA MAIN SUR SON COMPTE DOIT CHASSER L'INTRUS
  // ═══════════════════════════════════════════════════════════
  describe('réinitialisation du mot de passe', () => {
    const demande = {
      email: 'cliente@exemple.test',
      code: '123456',
      newPassword: 'NouveauMotDePasse123!',
    };

    it('coupe les sessions ouvertes en réinitialisant le mot de passe', async () => {
      usersService.findByEmail.mockResolvedValue(cliente());

      await service.resetPassword(demande);

      // Si le compte a été compromis, changer le mot de passe ne suffit pas :
      // sans cette révocation, l'intrus reste connecté avec son refresh token
      // malgré le nouveau mot de passe.
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'cliente-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('écrit le nouveau mot de passe et la révocation dans UNE transaction', async () => {
      usersService.findByEmail.mockResolvedValue(cliente());

      await service.resetPassword(demande);

      // Les deux ensemble, ou aucune : un mot de passe changé sans révocation
      // laisserait l'intrus en place, une révocation sans changement
      // déconnecterait la cliente pour rien.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    });

    it('consomme le code pour l’usage « mot de passe oublié », pas un autre', async () => {
      usersService.findByEmail.mockResolvedValue(cliente());

      await service.resetPassword(demande);

      // Un code de confirmation d'email ne doit pas pouvoir servir à changer
      // un mot de passe.
      expect(verificationCodes.consume).toHaveBeenCalledWith(
        'cliente-1',
        VerificationPurpose.PASSWORD_RESET,
        '123456',
      );
    });

    it('ne stocke jamais le nouveau mot de passe en clair', async () => {
      usersService.findByEmail.mockResolvedValue(cliente());

      await service.resetPassword(demande);

      const donnees = prisma.user.update.mock.calls[0][0].data;
      expect(donnees.passwordHash).not.toBe(demande.newPassword);
      expect(donnees.passwordHash).toMatch(/^\$argon2/);
    });
  });
});
