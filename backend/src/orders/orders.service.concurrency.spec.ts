import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Prisma, OrderStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PrismaService } from '../prisma/prisma.service';

// Test d'INTÉGRATION, et il ne peut pas être autre chose.
//
// La condition de course vit dans l'intervalle entre une LECTURE et une
// ÉCRITURE en base. Un test à Prisma mocké ne peut pas la voir : les mocks
// répondent toujours la même chose et n'ont pas de notion de simultanéité.
// C'est exactement pour ça que le bug tenait alors que orders.service.spec.ts
// était vert.
//
// Ici on ouvre de VRAIES connexions concurrentes vers Postgres et on lance
// les requêtes en même temps. Les données créées sont réellement écrites
// (pas de transaction annulée : elle sérialiserait tout et ne prouverait
// rien), puis supprimées en fin de fichier.

// PrismaService, et non un PrismaClient nu : c'est lui qui porte les
// réglages de transaction de l'application. Un client nu testerait une
// configuration qui n'existe nulle part en production.
const prisma = new PrismaService();
const service = new OrdersService(prisma, new LoyaltyService(prisma));

// Tout ce qui est créé ici est suivi pour être effacé ensuite.
const aNettoyer = {
  users: [] as string[],
  products: [] as string[],
  categories: [] as string[],
};

async function creerProduit(stockQty: number) {
  const categorie = await prisma.productCategory.create({
    data: { name: `Cat concurrence ${randomUUID()}` },
  });
  aNettoyer.categories.push(categorie.id);

  const produit = await prisma.product.create({
    data: {
      categoryId: categorie.id,
      name: `Produit concurrence ${randomUUID()}`,
      price: new Prisma.Decimal('100.00'),
      stockQty,
    },
  });
  aNettoyer.products.push(produit.id);
  return produit;
}

async function creerCliente() {
  const user = await prisma.user.create({
    data: {
      email: `concurrence-${randomUUID()}@exemple.test`,
      passwordHash: 'hash-factice',
      firstName: 'Cliente',
      lastName: 'Concurrence',
      loyaltyAccount: { create: {} },
    },
  });
  aNettoyer.users.push(user.id);
  return user;
}

async function creerCommande(
  userId: string,
  productId: string,
  quantity: number,
) {
  return prisma.order.create({
    data: {
      userId,
      status: OrderStatus.PENDING,
      fulfillment: 'PICKUP',
      total: new Prisma.Decimal('100.00').mul(quantity),
      items: {
        create: [
          { productId, quantity, unitPrice: new Prisma.Decimal('100.00') },
        ],
      },
    },
  });
}

const messages = (résultats: PromiseSettledResult<unknown>[]) =>
  résultats
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => String(r.reason?.message ?? r.reason));

describe('OrdersService — accès concurrents (vraie base)', () => {
  // Le moteur Prisma démarre à la première requête, et ce démarrage prend
  // plusieurs secondes. Sans ce préchauffage, la rafale de transactions
  // simultanées fait la queue derrière le démarrage et dépasse `maxWait` :
  // les tests échoueraient sur un problème de banc d'essai, pas sur la
  // condition de course qu'ils sont censés mesurer.
  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$transaction(async (tx) => tx.product.count());
  }, 30_000);

  afterAll(async () => {
    // L'ordre compte, et il a changé : les commandes ne partent PLUS avec la
    // cliente (`orders.user_id` est en ON DELETE RESTRICT depuis que la
    // suppression de compte est une anonymisation — un total encaissé ne doit
    // pas disparaître avec la personne). On les retire donc explicitement ;
    // leurs lignes suivent en cascade, ce qui libère ensuite les produits.
    await prisma.order.deleteMany({
      where: { userId: { in: aNettoyer.users } },
    });
    await prisma.user.deleteMany({ where: { id: { in: aNettoyer.users } } });
    await prisma.product.deleteMany({
      where: { id: { in: aNettoyer.products } },
    });
    await prisma.productCategory.deleteMany({
      where: { id: { in: aNettoyer.categories } },
    });
    await prisma.$disconnect();
  });

  // ═══════════════════════════════════════════════════════════
  //  Deux commandes, une seule unité en stock
  // ═══════════════════════════════════════════════════════════
  //
  // Portée exacte de ce test : il verrouille l'INVARIANT (le stock ne passe
  // jamais sous zéro), pas le scénario de course. L'ancien code lisait le
  // stock à l'intérieur de sa transaction ; pour le prendre en défaut il faut
  // que les deux transactions se chevauchent vraiment, ce qui dépend de la
  // machine — vérifié ici, l'ancien code passe parfois ce test.
  // Le scénario de course qui, lui, échoue systématiquement sur l'ancien code
  // est le double clic, juste en dessous.
  it('ne descend jamais le stock sous zéro : une seule confirmation passe', async () => {
    const produit = await creerProduit(1); // UNE seule unité disponible
    const cliente = await creerCliente();
    const cmdA = await creerCommande(cliente.id, produit.id, 1);
    const cmdB = await creerCommande(cliente.id, produit.id, 1);

    // Les deux confirmations partent ensemble : elles lisent toutes deux
    // « stock = 1 » avant que l'une ait écrit quoi que ce soit.
    const résultats = await Promise.allSettled([
      service.updateStatus(cmdA.id, OrderStatus.CONFIRMED),
      service.updateStatus(cmdB.id, OrderStatus.CONFIRMED),
    ]);

    const réussies = résultats.filter((r) => r.status === 'fulfilled');
    expect(réussies).toHaveLength(1);
    expect(messages(résultats)[0]).toMatch(/Stock insuffisant/);

    // L'invariant : le stock est à 0. Avant le correctif : −1.
    const après = await prisma.product.findUnique({
      where: { id: produit.id },
    });
    expect(après!.stockQty).toBe(0);

    // La commande perdante est restée en attente, pas confirmée à vide.
    const statuts = await prisma.order.findMany({
      where: { id: { in: [cmdA.id, cmdB.id] } },
      select: { status: true },
    });
    expect(statuts.map((o) => o.status).sort()).toEqual([
      OrderStatus.CONFIRMED,
      OrderStatus.PENDING,
    ]);
  });

  // ═══════════════════════════════════════════════════════════
  //  Le double clic sur « Confirmer »
  // ═══════════════════════════════════════════════════════════
  //
  // Celui-ci prend l'ancien code en défaut à tous les coups : rien n'y liait
  // l'écriture au statut qui venait d'être lu, donc la 2ᵉ requête rejouait
  // toute la transition — stock compris — sans rien pour l'arrêter.
  it('ne décrémente pas deux fois le stock pour la même commande', async () => {
    const produit = await creerProduit(10);
    const cliente = await creerCliente();
    const commande = await creerCommande(cliente.id, produit.id, 3);

    // Deux clics rapides : les deux requêtes lisent le statut PENDING.
    const résultats = await Promise.allSettled([
      service.updateStatus(commande.id, OrderStatus.CONFIRMED),
      service.updateStatus(commande.id, OrderStatus.CONFIRMED),
    ]);

    expect(résultats.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    // Selon l'entrelacement : soit la 2ᵉ a lu PENDING et son écriture
    // conditionnelle n'a touché aucune ligne, soit elle a lu CONFIRMED et
    // la machine à états l'a refusée. Les deux refus sont corrects.
    expect(messages(résultats)[0]).toMatch(
      /changé de statut|Transition impossible/,
    );

    // L'invariant : 10 − 3 = 7, décrémenté UNE fois. Avant le correctif : 4.
    const après = await prisma.product.findUnique({
      where: { id: produit.id },
    });
    expect(après!.stockQty).toBe(7);
  });

  // ═══════════════════════════════════════════════════════════
  //  Rien à moitié écrit
  // ═══════════════════════════════════════════════════════════
  it('annule tout si le stock manque : ni statut, ni décrément partiel', async () => {
    // Deux produits dans la même commande : le 1er est servable, le 2ᵉ non.
    // Si la transaction ne s'annulait pas, le 1er resterait décrémenté.
    const servable = await creerProduit(5);
    const manquant = await creerProduit(0);
    const cliente = await creerCliente();

    const commande = await prisma.order.create({
      data: {
        userId: cliente.id,
        status: OrderStatus.PENDING,
        fulfillment: 'PICKUP',
        total: new Prisma.Decimal('200.00'),
        items: {
          create: [
            {
              productId: servable.id,
              quantity: 1,
              unitPrice: new Prisma.Decimal('100.00'),
            },
            {
              productId: manquant.id,
              quantity: 1,
              unitPrice: new Prisma.Decimal('100.00'),
            },
          ],
        },
      },
    });

    await expect(
      service.updateStatus(commande.id, OrderStatus.CONFIRMED),
    ).rejects.toThrow(/Stock insuffisant/);

    expect(
      (await prisma.product.findUnique({ where: { id: servable.id } }))!
        .stockQty,
    ).toBe(5);
    expect(
      (await prisma.order.findUnique({ where: { id: commande.id } }))!.status,
    ).toBe(OrderStatus.PENDING);
  });
});
