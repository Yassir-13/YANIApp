import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FulfillmentType, OrderStatus, Prisma } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;
  let tx: any;
  let loyalty: { earnFromOrder: jest.Mock };

  const PRODUIT = {
    id: 'prod-1',
    name: 'Huile d’argan',
    price: new Prisma.Decimal(200),
    stockQty: 10,
    active: true,
  };

  const commande = (over: Partial<any> = {}) => ({
    id: 'cmd-1',
    userId: 'cliente-1',
    status: OrderStatus.PENDING,
    total: new Prisma.Decimal(400),
    items: [
      {
        id: 'l1',
        productId: 'prod-1',
        quantity: 2,
        unitPrice: new Prisma.Decimal(200),
      },
    ],
    ...over,
  });

  beforeEach(async () => {
    // Client de transaction : c'est lui qui reçoit les écritures de stock.
    //
    // `updateMany` simule ce que fait vraiment Postgres avec une écriture
    // conditionnelle : il réévalue la condition et renvoie le NOMBRE de
    // lignes touchées — 0 si la condition n'est plus vraie. C'est ce compteur
    // qui protège le stock, pas une lecture préalable.
    tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({ ...PRODUIT }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn(async ({ where }: any) => {
          const enBase = await tx.product.findUnique({
            where: { id: where.id },
          });
          const passe =
            !!enBase && enBase.active && enBase.stockQty >= where.stockQty.gte;
          return { count: passe ? 1 : 0 };
        }),
      },
      order: {
        update: jest.fn().mockResolvedValue({}),
        // Le statut lu est encore celui en base : la transition est réservée.
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma = {
      product: { findMany: jest.fn(), findUnique: jest.fn() },
      order: {
        findUnique: jest.fn(),
        create: jest.fn(async ({ data }: any) => ({
          id: 'cmd-neuve',
          ...data,
        })),
        update: jest.fn(async ({ data }: any) =>
          commande({ status: data.status }),
        ),
        findMany: jest.fn(),
      },
      // Forme interactive : transitionTo passe une fonction.
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };

    loyalty = { earnFromOrder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: LoyaltyService, useValue: loyalty },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  // ═══════════════════════════════════════════════════════════
  //  GEL DU PRIX — la garantie faite à la cliente
  // ═══════════════════════════════════════════════════════════
  describe('gel du prix à la commande', () => {
    it('fige le prix du moment dans chaque ligne (unitPrice)', async () => {
      prisma.product.findMany.mockResolvedValue([{ ...PRODUIT }]);

      await service.create('cliente-1', {
        items: [{ productId: 'prod-1', quantity: 2 }],
        fulfillment: FulfillmentType.PICKUP,
      });

      const data = prisma.order.create.mock.calls[0][0].data;
      const ligne = data.items.create[0];
      expect(ligne.unitPrice.toString()).toBe('200');
      // Total calculé par le SERVEUR : 200 × 2
      expect(data.total.toString()).toBe('400');
    });

    // Le cœur de la règle métier : une hausse de tarif ne doit pas
    // rattraper une commande déjà passée.
    it("ignore le nouveau tarif : le total reste celui d'origine", async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.READY, total: new Prisma.Decimal(400) }),
      );
      // Fati a doublé le prix depuis : le produit vaut désormais 400.
      tx.product.findUnique.mockResolvedValue({
        ...PRODUIT,
        price: new Prisma.Decimal(400),
      });

      await service.updateStatus('cmd-1', OrderStatus.COMPLETED);

      // Les points sont crédités sur le total FIGÉ (400), pas sur 800.
      const passeALoyalty = loyalty.earnFromOrder.mock.calls[0][0];
      expect(passeALoyalty.total.toString()).toBe('400');
    });

    it('le client ne peut pas imposer de prix : seul le catalogue fait foi', async () => {
      prisma.product.findMany.mockResolvedValue([{ ...PRODUIT }]);

      await service.create('cliente-1', {
        // Un client malveillant ajouterait « price: 1 » — le DTO l'ignore et
        // le service ne lit que le prix du catalogue.
        items: [{ productId: 'prod-1', quantity: 1, price: 1 } as any],
        fulfillment: FulfillmentType.PICKUP,
      });

      expect(prisma.order.create.mock.calls[0][0].data.total.toString()).toBe(
        '200',
      );
    });

    it('refuse un produit inconnu ou désactivé', async () => {
      prisma.product.findMany.mockResolvedValue([]); // aucun produit actif trouvé

      await expect(
        service.create('cliente-1', {
          items: [{ productId: 'prod-inconnu', quantity: 1 }],
          fulfillment: FulfillmentType.PICKUP,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('fusionne les doublons plutôt que de créer deux lignes', async () => {
      prisma.product.findMany.mockResolvedValue([{ ...PRODUIT }]);

      await service.create('cliente-1', {
        items: [
          { productId: 'prod-1', quantity: 2 },
          { productId: 'prod-1', quantity: 3 },
        ],
        fulfillment: FulfillmentType.PICKUP,
      });

      const data = prisma.order.create.mock.calls[0][0].data;
      expect(data.items.create).toHaveLength(1);
      expect(data.items.create[0].quantity).toBe(5);
      expect(data.total.toString()).toBe('1000'); // 200 × 5
    });

    it('exige une adresse pour une livraison', async () => {
      await expect(
        service.create('cliente-1', {
          items: [{ productId: 'prod-1', quantity: 1 }],
          fulfillment: FulfillmentType.DELIVERY,
          address: '   ',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  CONTRÔLE DU STOCK À LA COMMANDE (B8)
  // ═══════════════════════════════════════════════════════════
  //
  // Ce contrôle VÉRIFIE le stock sans le réserver — la réservation reste le
  // geste du personnel, à la confirmation. Ce qu'il empêche : qu'une cliente
  // lise « Commande confirmée » pour une quantité que l'institut ne peut pas
  // servir, et l'apprenne le lendemain par téléphone.
  describe('contrôle du stock à la commande', () => {
    it('refuse une quantité supérieure au stock disponible', async () => {
      prisma.product.findMany.mockResolvedValue([{ ...PRODUIT, stockQty: 1 }]);

      await expect(
        service.create('cliente-1', {
          items: [{ productId: 'prod-1', quantity: 10 }],
          fulfillment: FulfillmentType.PICKUP,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Aucune commande écrite : rien à annuler ni à rattraper ensuite.
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('nomme le produit et ce qu’il en reste', async () => {
      prisma.product.findMany.mockResolvedValue([{ ...PRODUIT, stockQty: 1 }]);

      // « Stock insuffisant » sans dire lequel obligerait la cliente à retirer
      // ses articles un par un pour deviner.
      await expect(
        service.create('cliente-1', {
          items: [{ productId: 'prod-1', quantity: 10 }],
          fulfillment: FulfillmentType.PICKUP,
        }),
      ).rejects.toThrow(/Huile d’argan.*reste 1.*demandé 10/);
    });

    it('dit « épuisé » plutôt que « reste 0 »', async () => {
      prisma.product.findMany.mockResolvedValue([{ ...PRODUIT, stockQty: 0 }]);

      await expect(
        service.create('cliente-1', {
          items: [{ productId: 'prod-1', quantity: 1 }],
          fulfillment: FulfillmentType.PICKUP,
        }),
      ).rejects.toThrow(/épuisé/);
    });

    it('accepte une commande égale au stock, à l’unité près', async () => {
      prisma.product.findMany.mockResolvedValue([{ ...PRODUIT, stockQty: 3 }]);

      await service.create('cliente-1', {
        items: [{ productId: 'prod-1', quantity: 3 }],
        fulfillment: FulfillmentType.PICKUP,
      });

      expect(prisma.order.create).toHaveBeenCalled();
    });

    it('additionne les doublons AVANT de comparer au stock', async () => {
      prisma.product.findMany.mockResolvedValue([{ ...PRODUIT, stockQty: 4 }]);

      // 3 + 2 = 5 pour 4 en stock : chaque ligne prise isolément passerait.
      await expect(
        service.create('cliente-1', {
          items: [
            { productId: 'prod-1', quantity: 3 },
            { productId: 'prod-1', quantity: 2 },
          ],
          fulfillment: FulfillmentType.PICKUP,
        }),
      ).rejects.toThrow(/demandé 5/);
    });

    it('vérifie sans réserver : la création ne touche pas au stock', async () => {
      prisma.product.findMany.mockResolvedValue([{ ...PRODUIT, stockQty: 10 }]);

      await service.create('cliente-1', {
        items: [{ productId: 'prod-1', quantity: 2 }],
        fulfillment: FulfillmentType.PICKUP,
      });

      // Réserver ici obligerait à libérer tout ce qui n'est jamais confirmé —
      // paniers abandonnés, commandes oubliées — donc à écrire une mécanique
      // d'expiration entière.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.product.updateMany).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  MACHINE À ÉTATS
  // ═══════════════════════════════════════════════════════════
  describe('machine à états', () => {
    it('refuse de sauter directement de en attente à terminée', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.PENDING }),
      );

      await expect(
        service.updateStatus('cmd-1', OrderStatus.COMPLETED),
      ).rejects.toThrow(/Transition impossible/);
    });

    it('refuse de ressusciter une commande annulée', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.CANCELLED }),
      );

      await expect(
        service.updateStatus('cmd-1', OrderStatus.CONFIRMED),
      ).rejects.toThrow(/Transition impossible/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuse de sortir de terminée (état final)', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.COMPLETED }),
      );

      await expect(
        service.updateStatus('cmd-1', OrderStatus.CANCELLED),
      ).rejects.toThrow(/Transition impossible/);
    });

    it('accepte le parcours normal en attente → confirmée', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.PENDING }),
      );

      await service.updateStatus('cmd-1', OrderStatus.CONFIRMED);

      expect(tx.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: OrderStatus.CONFIRMED } }),
      );
    });

    // ── Le double clic sur « Confirmer » ──
    // Les deux requêtes lisent le même statut PENDING et passent toutes deux
    // le contrôle de transition. C'est l'écriture conditionnée au statut lu
    // qui départage : la seconde ne touche aucune ligne et échoue.
    it('réserve la transition sur le statut lu, pas à l’aveugle', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.PENDING }),
      );

      await service.updateStatus('cmd-1', OrderStatus.CONFIRMED);

      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'cmd-1', status: OrderStatus.PENDING },
        data: { status: OrderStatus.CONFIRMED },
      });
    });

    it('refuse la 2ᵉ confirmation : le statut a déjà changé', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.PENDING }),
      );
      // La 1ʳᵉ requête a déjà confirmé : plus aucune ligne PENDING à toucher.
      tx.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateStatus('cmd-1', OrderStatus.CONFIRMED),
      ).rejects.toThrow(/changé de statut/);

      // Et surtout : le stock n'est pas décrémenté une seconde fois.
      expect(tx.product.updateMany).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  STOCK
  // ═══════════════════════════════════════════════════════════
  describe('stock', () => {
    // La condition de stock est portée par l'écriture elle-même : Postgres
    // ne décrémente que s'il reste au moins la quantité demandée.
    it('décrémente à la confirmation, sous condition de stock suffisant', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.PENDING }),
      );

      await service.updateStatus('cmd-1', OrderStatus.CONFIRMED);

      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { id: 'prod-1', active: true, stockQty: { gte: 2 } },
        data: { stockQty: { decrement: 2 } },
      });
    });

    it('refuse la confirmation si le stock est insuffisant', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.PENDING }),
      );
      tx.product.findUnique.mockResolvedValue({ ...PRODUIT, stockQty: 1 }); // 1 < 2

      await expect(
        service.updateStatus('cmd-1', OrderStatus.CONFIRMED),
      ).rejects.toThrow(/Stock insuffisant/);

      // L'écriture conditionnelle n'a touché aucune ligne : le stock est intact.
      await expect(
        tx.product.updateMany.mock.results[0].value,
      ).resolves.toEqual({
        count: 0,
      });
      // Le passage à CONFIRMED est annulé avec la transaction (vérifié pour de
      // vrai contre Postgres dans orders.service.concurrency.spec.ts).
    });

    it('refuse la confirmation si un produit a été désactivé entre-temps', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.PENDING }),
      );
      tx.product.findUnique.mockResolvedValue({ ...PRODUIT, active: false });

      await expect(
        service.updateStatus('cmd-1', OrderStatus.CONFIRMED),
      ).rejects.toThrow(/indisponible/);
      expect(tx.product.update).not.toHaveBeenCalled();
    });

    it('restaure le stock à l’annulation d’une commande confirmée', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.CONFIRMED }),
      );

      await service.updateStatus('cmd-1', OrderStatus.CANCELLED);

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stockQty: { increment: 2 } },
      });
    });

    // Le piège : une commande PENDING n'a jamais décrémenté le stock.
    // La restaurer créerait du stock à partir de rien.
    it('ne restaure RIEN à l’annulation d’une commande jamais confirmée', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.PENDING }),
      );

      await service.updateStatus('cmd-1', OrderStatus.CANCELLED);

      expect(tx.product.update).not.toHaveBeenCalled();
      expect(tx.order.updateMany).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  FIDÉLITÉ
  // ═══════════════════════════════════════════════════════════
  describe('crédit fidélité', () => {
    it('crédite les points au passage à terminée', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.READY }),
      );

      await service.updateStatus('cmd-1', OrderStatus.COMPLETED);

      expect(loyalty.earnFromOrder).toHaveBeenCalledTimes(1);
    });

    it('crédite DANS la transaction, pas après le commit', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.READY }),
      );

      await service.updateStatus('cmd-1', OrderStatus.COMPLETED);

      // Le 2ᵉ argument est le client de transaction. C'est lui qui fait que le
      // crédit et le passage en « terminée » réussissent ou échouent ensemble.
      // Sans lui, le crédit se jouait après le commit : une commande pouvait
      // rester COMPLETED — état final — sans jamais recevoir ses points.
      expect(loyalty.earnFromOrder).toHaveBeenCalledWith(expect.anything(), tx);
    });

    it('laisse remonter un crédit en échec au lieu de l’avaler', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.READY }),
      );
      loyalty.earnFromOrder.mockRejectedValue(new Error('base indisponible'));

      // L'erreur doit traverser : c'est elle qui déclenche l'annulation de la
      // transaction côté Postgres. Avalée, la commande resterait terminée sans
      // points. Le rollback lui-même est vérifié sur vraie base, dans
      // orders.service.loyalty-credit.spec.ts — un Prisma mocké ne peut pas
      // le prouver.
      await expect(
        service.updateStatus('cmd-1', OrderStatus.COMPLETED),
      ).rejects.toThrow('base indisponible');
    });

    it('ne crédite rien sur les autres transitions', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.CONFIRMED }),
      );

      await service.updateStatus('cmd-1', OrderStatus.READY);

      expect(loyalty.earnFromOrder).not.toHaveBeenCalled();
    });

    it('ne crédite rien quand la commande est annulée', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.READY }),
      );

      await service.updateStatus('cmd-1', OrderStatus.CANCELLED);

      expect(loyalty.earnFromOrder).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  ANNULATION PAR LA CLIENTE
  // ═══════════════════════════════════════════════════════════
  describe('annulation par la cliente', () => {
    it("refuse d'annuler la commande d'une autre cliente", async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ userId: 'quelqu-un-dautre' }),
      );

      await expect(
        service.cancelByClient('cmd-1', 'cliente-1'),
      ).rejects.toThrow(/introuvable/);
    });

    it('refuse une annulation après remise (COMPLETED)', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.COMPLETED }),
      );

      await expect(
        service.cancelByClient('cmd-1', 'cliente-1'),
      ).rejects.toThrow(/ne peut plus être annulée/);
    });

    it('autorise une annulation jusqu’à prête', async () => {
      prisma.order.findUnique.mockResolvedValue(
        commande({ status: OrderStatus.READY }),
      );

      await service.cancelByClient('cmd-1', 'cliente-1');

      expect(tx.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: OrderStatus.CANCELLED } }),
      );
    });
  });
});
