import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// Test d'INTÉGRATION : il parle à la vraie base Postgres.
//
// C'est délibéré, et ça l'a été deux fois.
//
// Au départ, ces tests verrouillaient un bug qui ne vivait pas dans le code
// TypeScript mais dans une contrainte de clé étrangère : `loyalty_transactions.
// owner_id` était en ON DELETE RESTRICT, donc la suppression de compte échouait
// dès qu'une cliente avait gagné un seul point. Un test à Prisma mocké (comme
// users.service.spec.ts) ne peut PAS voir ça : `prisma.user.delete` y est un
// jest.fn() qui réussit toujours. C'est pour cette raison que le bug est passé.
//
// Le correctif d'alors — tout passer en CASCADE — réglait la panne mais créait
// un trou plus coûteux : supprimer une cliente emportait ses commandes et ses
// rendez-vous, donc le chiffre d'affaires qu'elle avait généré. On est passé à
// l'ANONYMISATION : la ligne `users` survit, vidée de ce qui désigne la
// personne, et l'historique de vente lui reste rattaché.
//
// Ce que ces tests verrouillent est donc désormais une règle métier autant
// qu'une contrainte : ce qui doit disparaître (la personne) et ce qui doit
// rester (l'argent). Aucun des deux ne se voit sous un Prisma mocké.
//
// Note sur la forme : la version précédente enveloppait chaque test dans une
// transaction annulée. Ce n'est plus possible — `deleteAccount` ouvre sa propre
// transaction pour que l'anonymisation et la coupure des accès soient
// atomiques, et Prisma n'imbrique pas les transactions. On écrit donc vraiment
// en base, et on nettoie explicitement à la fin.

const prisma = new PrismaService();
const service = new UsersService(prisma);

const aNettoyer = {
  users: [] as string[],
  services: [] as string[],
  serviceCategories: [] as string[],
  products: [] as string[],
  productCategories: [] as string[],
  milestones: [] as string[],
  rewards: [] as string[],
};

async function creerCliente(role: Role = Role.CLIENT) {
  const user = await prisma.user.create({
    data: {
      email: `suppression-${randomUUID()}@exemple.test`,
      passwordHash: 'hash-factice',
      firstName: 'Cliente',
      lastName: 'De Test',
      phone: '0600000000',
      role,
      loyaltyAccount: { create: {} },
    },
    include: { loyaltyAccount: true },
  });
  aNettoyer.users.push(user.id);
  return user;
}

describe("UsersService — deleteAccount (droit à l'effacement, CNDP)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  }, 30_000);

  afterAll(async () => {
    // L'ordre compte, et il a changé : commandes et rendez-vous sont désormais
    // en ON DELETE RESTRICT, donc ils ne partent plus avec la cliente. Il faut
    // les retirer AVANT de pouvoir supprimer les lignes de test.
    await prisma.order.deleteMany({
      where: { userId: { in: aNettoyer.users } },
    });
    await prisma.appointment.deleteMany({
      where: { userId: { in: aNettoyer.users } },
    });
    await prisma.user.deleteMany({ where: { id: { in: aNettoyer.users } } });

    await prisma.loyaltyMilestone.deleteMany({
      where: { id: { in: aNettoyer.milestones } },
    });
    await prisma.reward.deleteMany({
      where: { id: { in: aNettoyer.rewards } },
    });
    await prisma.service.deleteMany({
      where: { id: { in: aNettoyer.services } },
    });
    await prisma.serviceCategory.deleteMany({
      where: { id: { in: aNettoyer.serviceCategories } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: aNettoyer.products } },
    });
    await prisma.productCategory.deleteMany({
      where: { id: { in: aNettoyer.productCategories } },
    });

    await prisma.$disconnect();
  }, 30_000);

  it('supprime le compte alors que la cliente a gagné des points', async () => {
    const cliente = await creerCliente();

    // Un seul point suffisait à bloquer toute la suppression.
    await prisma.loyaltyTransaction.create({
      data: {
        accountId: cliente.loyaltyAccount!.id,
        ownerId: cliente.id,
        pointsDelta: 10,
        type: 'EARN',
        reason: 'RDV honoré',
      },
    });

    await expect(service.deleteAccount(cliente.id)).resolves.toEqual({
      message: 'Compte supprimé.',
    });

    const apres = await prisma.user.findUnique({ where: { id: cliente.id } });
    expect(apres).not.toBeNull();
    expect(apres!.deletedAt).not.toBeNull();
  }, 30_000);

  it('efface tout ce qui identifie la personne', async () => {
    const cliente = await creerCliente();

    await service.deleteAccount(cliente.id);

    const apres = await prisma.user.findUnique({ where: { id: cliente.id } });
    expect(apres!.firstName).toBeNull();
    expect(apres!.lastName).toBeNull();
    expect(apres!.phone).toBeNull();
    expect(apres!.emailVerifiedAt).toBeNull();
    // L'adresse d'origine ne doit plus apparaître nulle part.
    expect(apres!.email).not.toBe(cliente.email);
    expect(apres!.email).toMatch(/@compte-supprime\.invalid$/);
    // Et le mot de passe est remplacé, pas conservé.
    expect(apres!.passwordHash).not.toBe(cliente.passwordHash);
  }, 30_000);

  it('libère l’adresse email : la cliente peut se réinscrire', async () => {
    const cliente = await creerCliente();
    const emailOrigine = cliente.email;

    await service.deleteAccount(cliente.id);

    // `email` est unique en base : si l'ancienne adresse était restée sur la
    // coquille, cette création échouerait et la cliente ne pourrait jamais
    // revenir à l'institut avec la même adresse.
    const retour = await prisma.user.create({
      data: {
        email: emailOrigine,
        passwordHash: 'nouveau-hash',
        loyaltyAccount: { create: {} },
      },
    });
    aNettoyer.users.push(retour.id);
    expect(retour.id).not.toBe(cliente.id);
  }, 30_000);

  it('coupe les sessions et les codes en cours', async () => {
    const cliente = await creerCliente();
    await prisma.refreshToken.create({
      data: {
        tokenHash: `hash-${randomUUID()}`,
        userId: cliente.id,
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.verificationCode.create({
      data: {
        userId: cliente.id,
        purpose: 'PASSWORD_RESET',
        codeHash: 'hash-code',
        expiresAt: new Date(Date.now() + 900_000),
      },
    });

    await service.deleteAccount(cliente.id);

    // Le téléphone encore connecté doit tomber, et un code en cours ne doit pas
    // devenir une porte dérobée sur une coquille anonyme.
    expect(
      await prisma.refreshToken.count({ where: { userId: cliente.id } }),
    ).toBe(0);
    expect(
      await prisma.verificationCode.count({ where: { userId: cliente.id } }),
    ).toBe(0);
  }, 30_000);

  it('rejouer la suppression ne réécrit pas la date d’origine', async () => {
    const cliente = await creerCliente();

    await service.deleteAccount(cliente.id);
    const premiere = (await prisma.user.findUnique({
      where: { id: cliente.id },
    }))!.deletedAt;

    await expect(service.deleteAccount(cliente.id)).resolves.toEqual({
      message: 'Compte supprimé.',
    });

    const seconde = (await prisma.user.findUnique({
      where: { id: cliente.id },
    }))!.deletedAt;
    // La date est la seule trace de QUAND le droit a été exercé.
    expect(seconde).toEqual(premiere);
  }, 30_000);

  // ═══════════════════════════════════════════════════════════
  //  LE TEST QUI PORTE TOUT : l'argent reste, la personne part
  // ═══════════════════════════════════════════════════════════
  it('garde le chiffre d’affaires et n’efface que la personne', async () => {
    const cliente = await creerCliente();
    const compteId = cliente.loyaltyAccount!.id;

    // Catalogue partagé : ne doit PAS disparaître avec la cliente.
    const categorieService = await prisma.serviceCategory.create({
      data: { name: `Soins ${randomUUID()}` },
    });
    aNettoyer.serviceCategories.push(categorieService.id);
    const prestation = await prisma.service.create({
      data: {
        categoryId: categorieService.id,
        name: 'Soin visage',
        durationMin: 60,
        price: new Prisma.Decimal('350.00'),
      },
    });
    aNettoyer.services.push(prestation.id);
    const categorieProduit = await prisma.productCategory.create({
      data: { name: `Cosmétiques ${randomUUID()}` },
    });
    aNettoyer.productCategories.push(categorieProduit.id);
    const produit = await prisma.product.create({
      data: {
        categoryId: categorieProduit.id,
        name: 'Crème hydratante',
        price: new Prisma.Decimal('180.00'),
        stockQty: 5,
      },
    });
    aNettoyer.products.push(produit.id);
    const recompense = await prisma.reward.create({
      data: { name: `Soin offert ${randomUUID()}`, pointsCost: 100 },
    });
    aNettoyer.rewards.push(recompense.id);
    const palier = await prisma.loyaltyMilestone.create({
      data: { visitThreshold: 10, rewardId: recompense.id },
    });
    aNettoyer.milestones.push(palier.id);

    // Toute l'empreinte de la cliente.
    const rdv = await prisma.appointment.create({
      data: {
        userId: cliente.id,
        serviceId: prestation.id,
        startAt: new Date('2026-09-01T10:00:00Z'),
        priceAtBooking: new Prisma.Decimal('350.00'),
      },
    });
    const commande = await prisma.order.create({
      data: {
        userId: cliente.id,
        fulfillment: 'PICKUP',
        total: new Prisma.Decimal('180.00'),
        items: {
          create: [
            {
              productId: produit.id,
              quantity: 1,
              unitPrice: new Prisma.Decimal('180.00'),
            },
          ],
        },
      },
    });
    await prisma.loyaltyTransaction.create({
      data: {
        accountId: compteId,
        ownerId: cliente.id,
        pointsDelta: 35,
        type: 'EARN',
        appointmentId: rdv.id,
      },
    });
    await prisma.loyaltyTransaction.create({
      data: {
        accountId: compteId,
        ownerId: cliente.id,
        pointsDelta: 18,
        type: 'EARN',
        orderId: commande.id,
      },
    });
    await prisma.milestoneGrant.create({
      data: {
        accountId: compteId,
        milestoneId: palier.id,
        rewardId: recompense.id,
        cycle: 1,
      },
    });

    await service.deleteAccount(cliente.id);

    // ── Ce qui DOIT survivre : le chiffre d'affaires ──
    //
    // C'est tout l'enjeu. La version précédente supprimait la ligne `users` en
    // cascade, et ces deux lignes partaient avec elle : supprimer dix clientes
    // fidèles effaçait dix historiques de vente, sans que rien ne le signale.
    const rdvApres = await prisma.appointment.findUnique({
      where: { id: rdv.id },
    });
    expect(rdvApres).not.toBeNull();
    expect(rdvApres!.priceAtBooking!.toString()).toBe('350');

    const commandeApres = await prisma.order.findUnique({
      where: { id: commande.id },
    });
    expect(commandeApres).not.toBeNull();
    expect(commandeApres!.total.toString()).toBe('180');

    // Les lignes de commande aussi : sans elles on saurait combien a été
    // encaissé, mais plus sur quoi.
    expect(
      await prisma.orderItem.count({ where: { orderId: commande.id } }),
    ).toBe(1);

    // Les mouvements de points expliquent les soldes rattachés aux ventes :
    // ce sont des écritures, pas des données personnelles.
    expect(
      await prisma.loyaltyTransaction.count({ where: { accountId: compteId } }),
    ).toBe(2);
    expect(
      await prisma.milestoneGrant.count({ where: { accountId: compteId } }),
    ).toBe(1);

    // ── Ce qui DOIT disparaître : la personne ──
    const apres = await prisma.user.findUnique({ where: { id: cliente.id } });
    expect(apres!.deletedAt).not.toBeNull();
    expect(apres!.firstName).toBeNull();
    expect(apres!.lastName).toBeNull();
    expect(apres!.phone).toBeNull();
    expect(apres!.email).toMatch(/@compte-supprime\.invalid$/);

    // ── Et le catalogue de l'institut, qui n'a jamais été à elle ──
    expect(
      await prisma.service.findUnique({ where: { id: prestation.id } }),
    ).not.toBeNull();
    expect(
      await prisma.product.findUnique({ where: { id: produit.id } }),
    ).not.toBeNull();
    expect(
      await prisma.reward.findUnique({ where: { id: recompense.id } }),
    ).not.toBeNull();
    expect(
      await prisma.loyaltyMilestone.findUnique({ where: { id: palier.id } }),
    ).not.toBeNull();
  }, 60_000);

  // Garde-fou : une employée qui part ne doit pas emporter avec elle
  // l'historique de fidélité des clientes qu'elle a servies.
  it("le départ d'une employée n'efface pas les points des clientes", async () => {
    const employee = await creerCliente(Role.STAFF);
    const cliente = await creerCliente();

    const ecriture = await prisma.loyaltyTransaction.create({
      data: {
        accountId: cliente.loyaltyAccount!.id,
        ownerId: cliente.id,
        createdById: employee.id,
        pointsDelta: 50,
        type: 'MANUAL',
        reason: 'Geste commercial',
      },
    });

    await service.deleteAccount(employee.id);

    const apres = await prisma.loyaltyTransaction.findUnique({
      where: { id: ecriture.id },
    });
    expect(apres).not.toBeNull();
    expect(apres!.pointsDelta).toBe(50);

    // Le lien d'audit SURVIT — et c'est voulu. Avec l'ancienne suppression en
    // cascade il passait à null (SET NULL) : on savait qu'un geste commercial
    // avait eu lieu, sans plus jamais savoir qui l'avait accordé. Ici la ligne
    // de l'employée reste, anonymisée, donc la piste d'audit tient : deux
    // écritures faites par la même personne restent reliées entre elles.
    expect(apres!.createdById).toBe(employee.id);

    const employeeApres = await prisma.user.findUnique({
      where: { id: employee.id },
    });
    expect(employeeApres!.deletedAt).not.toBeNull();
    expect(employeeApres!.firstName).toBeNull();

    // Et la cliente servie n'est évidemment pas touchée.
    const clienteApres = await prisma.user.findUnique({
      where: { id: cliente.id },
    });
    expect(clienteApres!.deletedAt).toBeNull();
  }, 30_000);

  it('refuse de supprimer un compte administrateur', async () => {
    const admin = await creerCliente(Role.ADMIN);

    await expect(service.deleteAccount(admin.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const apres = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(apres!.deletedAt).toBeNull();
  }, 30_000);
});
