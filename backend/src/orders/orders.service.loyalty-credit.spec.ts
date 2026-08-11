import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Prisma, OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PrismaService } from '../prisma/prisma.service';

// Test d'INTÉGRATION, et il ne peut pas être autre chose.
//
// Ce qu'on vérifie ici, c'est un ROLLBACK : quand le crédit des points échoue,
// le passage de la commande en « terminée » doit être annulé avec lui. Un
// Prisma mocké ne sait pas annuler quoi que ce soit — il rejouerait la fonction
// et rendrait la main, en laissant croire que tout va bien. Même raison que
// pour orders.service.concurrency.spec.ts : le bug vivait sous des mocks verts.
//
// L'enjeu : COMPLETED est un état FINAL. Une commande qui y arrive sans points
// ne peut plus être rejouée — les points sont perdus définitivement.

const prisma = new PrismaService();
const loyalty = new LoyaltyService(prisma);
const service = new OrdersService(prisma, loyalty);

const aNettoyer = {
  users: [] as string[],
  products: [] as string[],
  categories: [] as string[],
};

async function creerCommandePrete() {
  const categorie = await prisma.productCategory.create({
    data: { name: `Cat crédit ${randomUUID()}` },
  });
  aNettoyer.categories.push(categorie.id);

  const produit = await prisma.product.create({
    data: {
      categoryId: categorie.id,
      name: `Produit crédit ${randomUUID()}`,
      price: new Prisma.Decimal('100.00'),
      stockQty: 50,
    },
  });
  aNettoyer.products.push(produit.id);

  const cliente = await prisma.user.create({
    data: {
      email: `credit-${randomUUID()}@exemple.test`,
      passwordHash: 'hash-factice',
      firstName: 'Cliente',
      lastName: 'Crédit',
      loyaltyAccount: { create: {} },
    },
  });
  aNettoyer.users.push(cliente.id);

  // READY : le dernier état avant « terminée », donc celui d'où part le crédit.
  const commande = await prisma.order.create({
    data: {
      userId: cliente.id,
      status: OrderStatus.READY,
      fulfillment: 'PICKUP',
      total: new Prisma.Decimal('200.00'), // 5 % → 10 points
      items: {
        create: [
          {
            productId: produit.id,
            quantity: 2,
            unitPrice: new Prisma.Decimal('100.00'),
          },
        ],
      },
    },
  });

  return { commande, cliente };
}

const soldeDe = async (userId: string) =>
  (await prisma.loyaltyAccount.findUnique({ where: { userId } }))!
    .pointsBalance;

const statutDe = async (id: string) =>
  (await prisma.order.findUnique({ where: { id } }))!.status;

describe('OrdersService — crédit fidélité et commande terminée (vraie base)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  }, 30_000);

  afterAll(async () => {
    // Effacer les clientes emporte commandes, lignes et mouvements de points
    // (ON DELETE CASCADE), ce qui libère ensuite les produits.
    await prisma.user.deleteMany({ where: { id: { in: aNettoyer.users } } });
    await prisma.product.deleteMany({
      where: { id: { in: aNettoyer.products } },
    });
    await prisma.productCategory.deleteMany({
      where: { id: { in: aNettoyer.categories } },
    });
    await prisma.$disconnect();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('crédite les points en passant la commande à terminée', async () => {
    const { commande, cliente } = await creerCommandePrete();

    await service.updateStatus(commande.id, OrderStatus.COMPLETED);

    expect(await statutDe(commande.id)).toBe(OrderStatus.COMPLETED);
    expect(await soldeDe(cliente.id)).toBe(10); // 5 % de 200
  });

  it('annule le passage à terminée quand le crédit échoue', async () => {
    const { commande, cliente } = await creerCommandePrete();

    // Panne au pire moment : la transition est écrite, le crédit s'effondre.
    // C'est le scénario qui, avant le correctif, laissait une commande terminée
    // sans points — définitivement, puisqu'on ne sort pas de COMPLETED.
    jest
      .spyOn(loyalty, 'earnFromOrder')
      .mockRejectedValue(new Error('base indisponible'));

    await expect(
      service.updateStatus(commande.id, OrderStatus.COMPLETED),
    ).rejects.toThrow('base indisponible');

    // L'invariant : rien n'a bougé. La commande est encore prête, donc le
    // staff peut réessayer. Avant le correctif : COMPLETED et 0 point.
    expect(await statutDe(commande.id)).toBe(OrderStatus.READY);
    expect(await soldeDe(cliente.id)).toBe(0);
  });

  it('rejoue correctement une fois la panne passée', async () => {
    const { commande, cliente } = await creerCommandePrete();

    const enPanne = jest
      .spyOn(loyalty, 'earnFromOrder')
      .mockRejectedValue(new Error('base indisponible'));

    await expect(
      service.updateStatus(commande.id, OrderStatus.COMPLETED),
    ).rejects.toThrow();

    // La panne est passée : le staff refait le geste.
    enPanne.mockRestore();
    await service.updateStatus(commande.id, OrderStatus.COMPLETED);

    expect(await statutDe(commande.id)).toBe(OrderStatus.COMPLETED);
    // Créditée UNE seule fois, pas deux : le premier essai n'a rien laissé.
    expect(await soldeDe(cliente.id)).toBe(10);
  });
});
