import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { FindOrdersQueryDto } from './dto/find-orders-query.dto';

/**
 * `GET /orders` renvoyait toutes les commandes depuis l'ouverture, que le
 * backoffice découpait ensuite lui-même : la pagination affichée était donc
 * décorative (I4).
 */
describe('OrdersService — liste paginée', () => {
  let service: OrdersService;
  let prisma: any;

  const query = (over: Partial<FindOrdersQueryDto> = {}) =>
    ({ page: 1, limit: 20, ...over }) as FindOrdersQueryDto;

  beforeEach(async () => {
    prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([
          { status: OrderStatus.PENDING, _count: 7 },
          { status: OrderStatus.COMPLETED, _count: 130 },
        ]),
      },
      $transaction: jest.fn(async (ops: any) =>
        Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: LoyaltyService, useValue: { earnFromOrder: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  const argsListe = () => prisma.order.findMany.mock.calls[0][0];

  it('ne demande à la base que la tranche affichée', async () => {
    await service.findAll(query({ page: 4, limit: 20 }));

    expect(argsListe().skip).toBe(60);
    expect(argsListe().take).toBe(20);
  });

  it('filtre par statut côté serveur, liste ET total', async () => {
    await service.findAll(query({ status: OrderStatus.PENDING }));

    expect(argsListe().where).toEqual({ status: OrderStatus.PENDING });
    // Le total doit décrire le même ensemble que la page, sinon la
    // pagination annoncerait un nombre de pages faux.
    expect(prisma.order.count).toHaveBeenCalledWith({
      where: { status: OrderStatus.PENDING },
    });
  });

  it('sans filtre, ne restreint rien', async () => {
    await service.findAll(query());
    expect(argsListe().where).toEqual({});
  });

  it('compte les onglets sur TOUTES les commandes, filtre courant compris', async () => {
    // On lit la page des commandes terminées…
    const res = await service.findAll(query({ status: OrderStatus.COMPLETED }));

    // …et « À confirmer (7) » reste vrai malgré tout.
    expect(res.counts.PENDING).toBe(7);
    expect(res.counts.COMPLETED).toBe(130);
    expect(res.counts.ALL).toBe(137);
    // Le groupBy ne porte aucune restriction de statut.
    expect(prisma.order.groupBy.mock.calls[0][0].where).toBeUndefined();
  });

  it('annonce le nombre de pages', async () => {
    prisma.order.count.mockResolvedValue(41);
    const res = await service.findAll(query({ limit: 20 }));
    expect(res.totalPages).toBe(3);
  });

  it('garde au moins une page quand il n’y a rien à montrer', async () => {
    // « page 1 sur 0 » n'a pas de sens à l'écran.
    prisma.order.count.mockResolvedValue(0);
    const res = await service.findAll(query());
    expect(res.totalPages).toBe(1);
  });

  // « Mes commandes » côté cliente : liste personnelle, donc courte — mais
  // elle grossit à chaque commande, exactement comme celle du comptoir.
  describe('liste de la cliente', () => {
    it('ne renvoie que ses commandes, paginées', async () => {
      await service.findMine('cliente-1', query({ page: 2, limit: 50 }));

      expect(argsListe().where).toEqual({ userId: 'cliente-1' });
      expect(argsListe().skip).toBe(50);
      expect(argsListe().take).toBe(50);
      expect(prisma.order.count).toHaveBeenCalledWith({
        where: { userId: 'cliente-1' },
      });
    });

    it('met les plus récentes en premier', async () => {
      await service.findMine('cliente-1', query());
      expect(argsListe().orderBy).toEqual({ createdAt: 'desc' });
    });

    it('ne calcule pas les compteurs du comptoir', async () => {
      const res: any = await service.findMine('cliente-1', query());
      expect(res.counts).toBeUndefined();
      expect(prisma.order.groupBy).not.toHaveBeenCalled();
    });
  });
});
