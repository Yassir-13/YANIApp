import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { LoyaltyTxType } from '@prisma/client';
import { LoyaltyService } from './loyalty.service';
import { PrismaService } from '../prisma/prisma.service';

// Test d'INTÉGRATION : la course se joue entre la lecture du solde et son
// débit. Avec un Prisma mocké, les deux échanges « réussissent » toujours et
// le bug reste invisible. Voir l'en-tête de orders.service.concurrency.spec.ts.

// PrismaService porte les réglages de transaction de l'application.
const prisma = new PrismaService();
const service = new LoyaltyService(prisma);

const aNettoyer = { users: [] as string[], rewards: [] as string[] };

async function creerClienteAvecPoints(pointsBalance: number) {
  const user = await prisma.user.create({
    data: {
      email: `fidelite-${randomUUID()}@exemple.test`,
      passwordHash: 'hash-factice',
      firstName: 'Cliente',
      lastName: 'Fidèle',
      loyaltyAccount: { create: { pointsBalance } },
    },
    include: { loyaltyAccount: true },
  });
  aNettoyer.users.push(user.id);
  return user;
}

async function creerRecompense(pointsCost: number) {
  const reward = await prisma.reward.create({
    data: { name: `Soin offert ${randomUUID()}`, pointsCost },
  });
  aNettoyer.rewards.push(reward.id);
  return reward;
}

describe('LoyaltyService — échanges concurrents (vraie base)', () => {
  // Préchauffage du moteur Prisma : sans lui, la rafale de transactions
  // simultanées fait la queue derrière le démarrage du moteur et dépasse
  // `maxWait`. On mesurerait le banc d'essai, pas la condition de course.
  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$transaction(async (tx) => tx.loyaltyAccount.count());
  }, 30_000);

  afterAll(async () => {
    // Effacer la cliente emporte son compte et ses écritures (CASCADE),
    // ce qui libère la récompense.
    await prisma.user.deleteMany({ where: { id: { in: aNettoyer.users } } });
    await prisma.reward.deleteMany({ where: { id: { in: aNettoyer.rewards } } });
    await prisma.$disconnect();
  });

  it('ne laisse jamais le solde passer sous zéro', async () => {
    const cliente = await creerClienteAvecPoints(100);
    const recompense = await creerRecompense(100); // exactement tout le solde

    // Deux échanges simultanés : ils lisent tous deux « solde = 100 » et se
    // croient chacun autorisés.
    const résultats = await Promise.allSettled([
      service.redeem(cliente.id, recompense.id),
      service.redeem(cliente.id, recompense.id),
    ]);

    expect(résultats.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    // L'invariant : 100 − 100 = 0. Avant le correctif : −100.
    const compte = await prisma.loyaltyAccount.findUnique({
      where: { userId: cliente.id },
    });
    expect(compte!.pointsBalance).toBe(0);

    // Et une seule dépense tracée : pas de récompense offerte en double.
    const dépenses = await prisma.loyaltyTransaction.findMany({
      where: { accountId: compte!.id, type: LoyaltyTxType.REDEEM },
    });
    expect(dépenses).toHaveLength(1);
    expect(dépenses[0].pointsDelta).toBe(-100);
  });

  it('sur cinq échanges simultanés, n’en laisse passer que ce que le solde permet', async () => {
    const cliente = await creerClienteAvecPoints(250);
    const recompense = await creerRecompense(100); // 250 / 100 → 2 échanges max

    const résultats = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.redeem(cliente.id, recompense.id)),
    );

    expect(résultats.filter((r) => r.status === 'fulfilled')).toHaveLength(2);

    const compte = await prisma.loyaltyAccount.findUnique({
      where: { userId: cliente.id },
    });
    expect(compte!.pointsBalance).toBe(50); // 250 − 2 × 100

    // Le solde correspond exactement à la somme des mouvements : aucune
    // dépense n'a été tracée sans être débitée, ni l'inverse.
    const mouvements = await prisma.loyaltyTransaction.findMany({
      where: { accountId: compte!.id },
    });
    const somme = mouvements.reduce((t, m) => t + m.pointsDelta, 0);
    expect(250 + somme).toBe(compte!.pointsBalance);
  });

  it('refuse toujours un échange au-dessus du solde', async () => {
    const cliente = await creerClienteAvecPoints(50);
    const recompense = await creerRecompense(100);

    await expect(service.redeem(cliente.id, recompense.id)).rejects.toThrow(
      /insuffisant/i,
    );

    const compte = await prisma.loyaltyAccount.findUnique({
      where: { userId: cliente.id },
    });
    expect(compte!.pointsBalance).toBe(50);
  });
});
