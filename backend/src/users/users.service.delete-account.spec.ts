import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { PrismaClient, Prisma, Role } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// Test d'INTÉGRATION : il parle à la vraie base Postgres.
//
// C'est délibéré. Le bug que ces tests verrouillent ne vivait pas dans le code
// TypeScript mais dans une contrainte de clé étrangère : `loyalty_transactions.
// owner_id` était en ON DELETE RESTRICT, donc la suppression de compte échouait
// dès qu'une cliente avait gagné un seul point. Un test à Prisma mocké
// (comme users.service.spec.ts) ne peut PAS voir ça : `prisma.user.delete`
// y est un jest.fn() qui réussit toujours. C'est exactement pour cette raison
// que le bug est passé en production.
//
// Chaque test s'exécute dans une transaction systématiquement annulée :
// il lit et écrit dans la base de dev sans y laisser la moindre ligne.

const prisma = new PrismaClient();

// Sentinelle : sert uniquement à faire annuler la transaction par Prisma.
class RollbackVoulu extends Error {}

async function dansUneTransactionAnnulee(
  fn: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await fn(tx);
        // Toujours annuler : le test ne laisse aucune trace.
        throw new RollbackVoulu();
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  } catch (e) {
    // Une vraie erreur (ou une assertion échouée) doit remonter ;
    // seule notre annulation volontaire est absorbée.
    if (!(e instanceof RollbackVoulu)) throw e;
  }
}

// Crée une cliente avec son compte fidélité, comme le fait UsersService.create.
async function creerCliente(
  tx: Prisma.TransactionClient,
  role: Role = Role.CLIENT,
) {
  return tx.user.create({
    data: {
      email: `test-${randomUUID()}@exemple.test`,
      passwordHash: 'hash-factice',
      firstName: 'Cliente',
      lastName: 'De Test',
      role,
      loyaltyAccount: { create: {} },
    },
    include: { loyaltyAccount: true },
  });
}

const service = (tx: Prisma.TransactionClient) =>
  new UsersService(tx as unknown as PrismaService);

describe("UsersService — deleteAccount (droit à l'effacement, CNDP)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('supprime le compte alors que la cliente a gagné des points', async () => {
    await dansUneTransactionAnnulee(async (tx) => {
      const cliente = await creerCliente(tx);

      // Un seul point suffisait à bloquer toute la suppression.
      await tx.loyaltyTransaction.create({
        data: {
          accountId: cliente.loyaltyAccount!.id,
          ownerId: cliente.id,
          pointsDelta: 10,
          type: 'EARN',
          reason: 'RDV honoré',
        },
      });

      await expect(service(tx).deleteAccount(cliente.id)).resolves.toEqual({
        message: 'Compte supprimé.',
      });

      expect(await tx.user.findUnique({ where: { id: cliente.id } })).toBeNull();
      expect(
        await tx.loyaltyTransaction.count({ where: { ownerId: cliente.id } }),
      ).toBe(0);
    });
  });

  it('efface toutes les données personnelles rattachées, sans orphelin', async () => {
    await dansUneTransactionAnnulee(async (tx) => {
      const cliente = await creerCliente(tx);
      const compteId = cliente.loyaltyAccount!.id;

      // Catalogue partagé : ne doit PAS disparaître avec la cliente.
      const categorieService = await tx.serviceCategory.create({
        data: { name: `Soins ${randomUUID()}` },
      });
      const prestation = await tx.service.create({
        data: {
          categoryId: categorieService.id,
          name: 'Soin visage',
          durationMin: 60,
          price: new Prisma.Decimal('350.00'),
        },
      });
      const categorieProduit = await tx.productCategory.create({
        data: { name: `Cosmétiques ${randomUUID()}` },
      });
      const produit = await tx.product.create({
        data: {
          categoryId: categorieProduit.id,
          name: 'Crème hydratante',
          price: new Prisma.Decimal('180.00'),
          stockQty: 5,
        },
      });
      const recompense = await tx.reward.create({
        data: { name: `Soin offert ${randomUUID()}`, pointsCost: 100 },
      });
      const palier = await tx.loyaltyMilestone.create({
        data: { visitThreshold: 10, rewardId: recompense.id },
      });

      // Toute l'empreinte personnelle de la cliente.
      const rdv = await tx.appointment.create({
        data: {
          userId: cliente.id,
          serviceId: prestation.id,
          startAt: new Date('2026-09-01T10:00:00Z'),
          priceAtBooking: new Prisma.Decimal('350.00'),
        },
      });
      const commande = await tx.order.create({
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
      await tx.loyaltyTransaction.create({
        data: {
          accountId: compteId,
          ownerId: cliente.id,
          pointsDelta: 35,
          type: 'EARN',
          appointmentId: rdv.id,
        },
      });
      await tx.loyaltyTransaction.create({
        data: {
          accountId: compteId,
          ownerId: cliente.id,
          pointsDelta: 18,
          type: 'EARN',
          orderId: commande.id,
        },
      });
      await tx.milestoneGrant.create({
        data: {
          accountId: compteId,
          milestoneId: palier.id,
          rewardId: recompense.id,
          cycle: 1,
        },
      });
      await tx.refreshToken.create({
        data: {
          tokenHash: `hash-${randomUUID()}`,
          userId: cliente.id,
          familyId: randomUUID(),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      await tx.verificationCode.create({
        data: {
          userId: cliente.id,
          purpose: 'EMAIL_VERIFY',
          codeHash: 'hash-code',
          expiresAt: new Date(Date.now() + 900_000),
        },
      });

      await service(tx).deleteAccount(cliente.id);

      // Plus rien de personnel : ni la cliente, ni ce qui la désigne.
      expect(await tx.user.findUnique({ where: { id: cliente.id } })).toBeNull();
      expect(
        await tx.loyaltyAccount.count({ where: { userId: cliente.id } }),
      ).toBe(0);
      expect(
        await tx.loyaltyTransaction.count({ where: { ownerId: cliente.id } }),
      ).toBe(0);
      expect(
        await tx.loyaltyTransaction.count({ where: { accountId: compteId } }),
      ).toBe(0);
      expect(await tx.appointment.count({ where: { userId: cliente.id } })).toBe(
        0,
      );
      expect(await tx.order.count({ where: { userId: cliente.id } })).toBe(0);
      expect(await tx.orderItem.count({ where: { orderId: commande.id } })).toBe(
        0,
      );
      expect(
        await tx.milestoneGrant.count({ where: { accountId: compteId } }),
      ).toBe(0);
      expect(
        await tx.refreshToken.count({ where: { userId: cliente.id } }),
      ).toBe(0);
      expect(
        await tx.verificationCode.count({ where: { userId: cliente.id } }),
      ).toBe(0);

      // Le catalogue de l'institut survit : ce ne sont pas ses données à elle.
      expect(
        await tx.service.findUnique({ where: { id: prestation.id } }),
      ).not.toBeNull();
      expect(
        await tx.product.findUnique({ where: { id: produit.id } }),
      ).not.toBeNull();
      expect(
        await tx.reward.findUnique({ where: { id: recompense.id } }),
      ).not.toBeNull();
      expect(
        await tx.loyaltyMilestone.findUnique({ where: { id: palier.id } }),
      ).not.toBeNull();
    });
  });

  // Garde-fou : une employée qui part ne doit pas emporter avec elle
  // l'historique de fidélité des clientes qu'elle a servies.
  it("le départ d'une employée n'efface pas les points des clientes", async () => {
    await dansUneTransactionAnnulee(async (tx) => {
      const employee = await creerCliente(tx, Role.STAFF);
      const cliente = await creerCliente(tx);

      const ecriture = await tx.loyaltyTransaction.create({
        data: {
          accountId: cliente.loyaltyAccount!.id,
          ownerId: cliente.id,
          createdById: employee.id,
          pointsDelta: 50,
          type: 'MANUAL',
          reason: 'Geste commercial',
        },
      });

      await service(tx).deleteAccount(employee.id);

      const apres = await tx.loyaltyTransaction.findUnique({
        where: { id: ecriture.id },
      });
      expect(apres).not.toBeNull();
      expect(apres!.pointsDelta).toBe(50);
      // L'écriture reste, mais ne désigne plus personne : l'employée est effacée.
      expect(apres!.createdById).toBeNull();
      expect(
        await tx.user.findUnique({ where: { id: cliente.id } }),
      ).not.toBeNull();
    });
  });

  it('refuse de supprimer un compte administrateur', async () => {
    await dansUneTransactionAnnulee(async (tx) => {
      const admin = await creerCliente(tx, Role.ADMIN);

      await expect(service(tx).deleteAccount(admin.id)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(
        await tx.user.findUnique({ where: { id: admin.id } }),
      ).not.toBeNull();
    });
  });
});
