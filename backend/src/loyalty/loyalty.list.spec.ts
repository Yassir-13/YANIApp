import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyTxType } from '@prisma/client';
import { LoyaltyService } from './loyalty.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

/**
 * Deux listes qui ne font que grandir : l'historique de points d'une cliente,
 * et le journal des crédits manuels. Ni l'un ni l'autre n'était borné (I4).
 */
describe('LoyaltyService — listes paginées', () => {
  let service: LoyaltyService;
  let prisma: any;

  const query = (over: Partial<PaginationQueryDto> = {}) =>
    ({ page: 1, limit: 25, ...over }) as PaginationQueryDto;

  beforeEach(async () => {
    prisma = {
      loyaltyAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: 'compte-1' }),
      },
      loyaltyTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { pointsDelta: 0 } }),
      },
      milestoneGrant: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      rewardVoucher: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (ops: any) =>
        Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LoyaltyService);
  });

  const argsListe = () => prisma.loyaltyTransaction.findMany.mock.calls[0][0];

  describe('historique de la cliente', () => {
    it('ne renvoie que la tranche demandée, du plus récent au plus ancien', async () => {
      await service.getHistory('cliente-1', query({ page: 2, limit: 25 }));

      expect(argsListe().where).toEqual({ accountId: 'compte-1' });
      expect(argsListe().skip).toBe(25);
      expect(argsListe().take).toBe(25);
      expect(argsListe().orderBy).toEqual({ createdAt: 'desc' });
    });

    it('joint le nom de la récompense, même retirée du catalogue', async () => {
      // Le catalogue chargé par l'app ne contient que les récompenses
      // ACTIVES : sans cette jointure, les vieilles lignes seraient anonymes.
      await service.getHistory('cliente-1', query());
      expect(argsListe().include).toEqual({
        reward: { select: { name: true } },
      });
    });
  });

  describe('journal des crédits manuels', () => {
    it('ne renvoie que la tranche demandée', async () => {
      await service.auditManualTransactions(query({ page: 3, limit: 20 }));

      expect(argsListe().where).toEqual({ type: LoyaltyTxType.MANUAL });
      expect(argsListe().skip).toBe(40);
      expect(argsListe().take).toBe(20);
    });

    it('cumule les points sur TOUT le journal, pas sur la page', async () => {
      // Un total d'audit qui ne porterait que sur la page serait pire que pas
      // de total du tout : faux, sans en avoir l'air.
      prisma.loyaltyTransaction.aggregate.mockResolvedValue({
        _sum: { pointsDelta: 1250 },
      });

      const res = await service.auditManualTransactions(query({ limit: 20 }));

      expect(res.pointsTotal).toBe(1250);
      expect(prisma.loyaltyTransaction.aggregate).toHaveBeenCalledWith({
        where: { type: LoyaltyTxType.MANUAL },
        _sum: { pointsDelta: true },
      });
    });

    it('affiche 0 plutôt que rien quand le journal est vide', async () => {
      prisma.loyaltyTransaction.aggregate.mockResolvedValue({
        _sum: { pointsDelta: null },
      });
      const res = await service.auditManualTransactions(query());
      expect(res.pointsTotal).toBe(0);
    });
  });

  // Les deux autres listes personnelles de la cliente. Elles grandissent plus
  // lentement que son historique de points — une ligne par palier franchi,
  // une par récompense obtenue — mais rien ne les arrête non plus.
  describe('récompenses offertes débloquées', () => {
    it('ne renvoie que les siennes, paginées, plus récentes en tête', async () => {
      await service.getMyGrants('cliente-1', query({ page: 2, limit: 25 }));

      const args = prisma.milestoneGrant.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ accountId: 'compte-1' });
      expect(args.skip).toBe(25);
      expect(args.take).toBe(25);
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  describe('bons de la cliente', () => {
    it('ne renvoie que les siens, paginés', async () => {
      await service.getMyVouchers('cliente-1', query({ page: 3, limit: 20 }));

      const args = prisma.rewardVoucher.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ accountId: 'compte-1' });
      expect(args.skip).toBe(40);
      expect(args.take).toBe(20);
    });

    it('garde les bons DUS en tête, donc jamais coupés par la pagination', async () => {
      // C'est ce tri qui rend la borne indolore : ce que la cliente vient
      // montrer au comptoir est toujours sur la première page. Seul
      // l'historique des remises peut être tronqué.
      await service.getMyVouchers('cliente-1', query());

      const args = prisma.rewardVoucher.findMany.mock.calls[0][0];
      expect(args.orderBy[0]).toEqual({
        honoredAt: { sort: 'asc', nulls: 'first' },
      });
    });
  });
});
