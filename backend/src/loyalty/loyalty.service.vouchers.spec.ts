import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { LoyaltyTxType, Role, VoucherSource } from '@prisma/client';
import { LoyaltyService } from './loyalty.service';
import { PrismaService } from '../prisma/prisma.service';
import { VOUCHER_CODE_LENGTH } from './voucher-code';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

// Test d'INTÉGRATION, et il ne peut pas être autre chose.
//
// Deux des propriétés vérifiées ici sont des propriétés de la BASE, qu'un
// Prisma mocké ne peut pas montrer :
//
//  - le ROLLBACK : si l'émission du bon échoue, les points doivent revenir.
//    Un mock rejouerait la fonction et rendrait la main en laissant croire que
//    tout va bien (même raison que orders.service.loyalty-credit.spec.ts) ;
//  - la DISPARITION de B6 : réclamer une récompense la faisait sortir de
//    l'écran de la cliente ET de la fiche comptoir. Le prouver demande de
//    relire l'état réel après coup, pas de compter des appels.

const prisma = new PrismaService();
const service = new LoyaltyService(prisma);

// La liste des bons d'une cliente est paginée : ici elle tient largement dans
// une page, ce qu'on veut vérifier est ailleurs.
const PAGE = { page: 1, limit: 25 } as PaginationQueryDto;

const aNettoyer = {
  users: [] as string[],
  milestones: [] as string[],
  rewards: [] as string[],
};

async function creerRecompense(pointsCost: number) {
  const reward = await prisma.reward.create({
    data: { name: `Soin ${randomUUID().slice(0, 8)}`, pointsCost },
  });
  aNettoyer.rewards.push(reward.id);
  return reward;
}

async function creerCliente(pointsBalance = 0) {
  const user = await prisma.user.create({
    data: {
      email: `bon-${randomUUID()}@exemple.test`,
      passwordHash: 'hash-factice',
      firstName: 'Cliente',
      lastName: 'Bon',
      loyaltyAccount: { create: { pointsBalance } },
    },
    include: { loyaltyAccount: true },
  });
  aNettoyer.users.push(user.id);
  return user;
}

async function creerEmployee() {
  const user = await prisma.user.create({
    data: {
      email: `comptoir-${randomUUID()}@exemple.test`,
      passwordHash: 'hash-factice',
      firstName: 'Employée',
      lastName: 'Comptoir',
      role: Role.STAFF,
    },
  });
  aNettoyer.users.push(user.id);
  return user;
}

// Une récompense offerte déjà débloquée, en attente de réclamation.
async function creerGrant(accountId: string, rewardId: string) {
  const milestone = await prisma.loyaltyMilestone.create({
    data: { visitThreshold: 10, rewardId },
  });
  aNettoyer.milestones.push(milestone.id);

  return prisma.milestoneGrant.create({
    data: { accountId, milestoneId: milestone.id, rewardId, cycle: 1 },
  });
}

const soldeDe = async (userId: string) =>
  (await prisma.loyaltyAccount.findUnique({ where: { userId } }))!
    .pointsBalance;

describe('LoyaltyService — bons de récompense (vraie base)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  }, 30_000);

  afterAll(async () => {
    // Les clientes d'abord : leurs comptes fidélité partent en cascade, et
    // avec eux les bons, les grants et les mouvements de points. Les paliers
    // et les récompenses ne se libèrent qu'ensuite (relations Restrict).
    await prisma.user.deleteMany({ where: { id: { in: aNettoyer.users } } });
    await prisma.loyaltyMilestone.deleteMany({
      where: { id: { in: aNettoyer.milestones } },
    });
    await prisma.reward.deleteMany({ where: { id: { in: aNettoyer.rewards } } });
    await prisma.$disconnect();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── B7 : l'échange produit enfin un justificatif ──────────────────────

  it('émet un bon présentable quand la cliente échange ses points', async () => {
    const cliente = await creerCliente(300);
    const recompense = await creerRecompense(300);

    const res = await service.redeem(cliente.id, recompense.id);

    expect(res.voucher.code).toHaveLength(VOUCHER_CODE_LENGTH);
    expect(res.voucher.source).toBe(VoucherSource.REDEEM);
    expect(res.voucher.pointsSpent).toBe(300);
    expect(res.voucher.honoredAt).toBeNull();
    // Rattaché à l'écriture qui a débité les points : la trace est complète
    // dans les deux sens.
    expect(res.voucher.transactionId).toBe(res.transaction.id);
    expect(await soldeDe(cliente.id)).toBe(0);
  });

  it('rend les points si le bon ne peut pas être émis', async () => {
    const cliente = await creerCliente(300);
    const recompense = await creerRecompense(300);

    // Panne au pire moment : les points sont débités, l'émission s'effondre.
    // Sans transaction commune, la cliente aurait payé pour rien — et sans
    // rien à présenter, elle n'aurait même pas de quoi réclamer.
    jest
      .spyOn(service as any, 'issueVoucher')
      .mockRejectedValue(new Error('émission impossible'));

    await expect(service.redeem(cliente.id, recompense.id)).rejects.toThrow(
      'émission impossible',
    );

    expect(await soldeDe(cliente.id)).toBe(300);
    // Pas d'écriture orpheline non plus : l'historique ne montre pas un
    // échange qui n'a pas eu lieu.
    const ecritures = await prisma.loyaltyTransaction.count({
      where: { ownerId: cliente.id, type: LoyaltyTxType.REDEEM },
    });
    expect(ecritures).toBe(0);
  });

  // ── B6 : réclamer ne fait plus disparaître la récompense ──────────────

  it('garde la récompense visible au comptoir après réclamation', async () => {
    const cliente = await creerCliente();
    const recompense = await creerRecompense(0);
    const grant = await creerGrant(
      cliente.loyaltyAccount!.id,
      recompense.id,
    );

    // Avant réclamation : visible au comptoir comme récompense débloquée.
    const avant = await service.getAccountByUserId(cliente.id);
    expect(avant.grants).toHaveLength(1);
    expect(avant.vouchers).toHaveLength(0);

    const res = await service.claimGrant(cliente.id, grant.id);

    // Après réclamation : elle a changé de forme, PAS disparu. C'est
    // exactement le bug B6 — avant, les deux listes étaient vides ici.
    const apres = await service.getAccountByUserId(cliente.id);
    expect(apres.grants).toHaveLength(0);
    expect(apres.vouchers).toHaveLength(1);
    expect(apres.vouchers[0].code).toBe(res.voucher.code);
    expect(apres.vouchers[0].reward.name).toBe(recompense.name);

    // Et côté cliente, elle la voit toujours, avec son code.
    const sesBons = (await service.getMyVouchers(cliente.id, PAGE)).data;
    expect(sesBons).toHaveLength(1);
    expect(sesBons[0].source).toBe(VoucherSource.MILESTONE);
    expect(sesBons[0].pointsSpent).toBe(0);
  });

  it("n'émet qu'un seul bon quand la réclamation est jouée deux fois", async () => {
    const cliente = await creerCliente();
    const recompense = await creerRecompense(0);
    const grant = await creerGrant(cliente.loyaltyAccount!.id, recompense.id);

    // Double tap sur le bouton : les deux appels partent ensemble.
    const résultats = await Promise.allSettled([
      service.claimGrant(cliente.id, grant.id),
      service.claimGrant(cliente.id, grant.id),
    ]);

    expect(résultats.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await service.getMyVouchers(cliente.id, PAGE)).data).toHaveLength(1);
  });

  // ── La remise au comptoir ─────────────────────────────────────────────

  it('sort le bon de la liste à honorer une fois remis, et garde qui l\'a remis', async () => {
    const cliente = await creerCliente(100);
    const recompense = await creerRecompense(100);
    const employee = await creerEmployee();

    const { voucher } = await service.redeem(cliente.id, recompense.id);

    const dus = await service.listPendingVouchers();
    expect(dus.map((v) => v.id)).toContain(voucher.id);

    await service.honorVoucher(voucher.id, employee.id);

    const dusApres = await service.listPendingVouchers();
    expect(dusApres.map((v) => v.id)).not.toContain(voucher.id);

    // La trace : qui, quand. C'est ce qui manquait pour vérifier après coup.
    const remis = await prisma.rewardVoucher.findUnique({
      where: { id: voucher.id },
    });
    expect(remis!.honoredAt).not.toBeNull();
    expect(remis!.honoredById).toBe(employee.id);
  });

  it('refuse une seconde remise et ne réécrit pas la trace', async () => {
    const cliente = await creerCliente(100);
    const recompense = await creerRecompense(100);
    const première = await creerEmployee();
    const seconde = await creerEmployee();

    const { voucher } = await service.redeem(cliente.id, recompense.id);
    await service.honorVoucher(voucher.id, première.id);

    await expect(
      service.honorVoucher(voucher.id, seconde.id),
    ).rejects.toThrow('déjà été remis');

    // La seconde employée n'a pas écrasé le nom de la première : une remise
    // qui change d'auteur au second clic serait une trace inutilisable.
    const remis = await prisma.rewardVoucher.findUnique({
      where: { id: voucher.id },
    });
    expect(remis!.honoredById).toBe(première.id);
  });

  it('ne montre pas à une cliente les bons d\'une autre', async () => {
    const alice = await creerCliente(100);
    const badia = await creerCliente(100);
    const recompense = await creerRecompense(100);

    await service.redeem(alice.id, recompense.id);

    expect((await service.getMyVouchers(badia.id, PAGE)).data).toHaveLength(0);
  });
});
