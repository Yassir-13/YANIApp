import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Appointment, Order, LoyaltyTxType, Prisma } from '@prisma/client';
import { CreateRewardDto } from './dto/create-reward.dto';
import { ManualPointsDto } from './dto/manual-points.dto';


// Taux de fidélité : 5% du montant dépensé, converti en points
const LOYALTY_RATE = 0.05;

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccount(userId: string) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
    });
    if (!account) {
      throw new NotFoundException('Compte fidélité introuvable.');
    }
    return account;
  }

  async getHistory(userId: string) {
    const account = await this.getAccount(userId);
    return this.prisma.loyaltyTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Crédite les points gagnés sur un RDV complété.
  // `tx` : transaction ouverte par l'appelant. Fournie, le crédit et le
  // changement de statut du RDV réussissent ou échouent ensemble.
  async earnFromAppointment(
    appointment: Appointment,
    tx?: Prisma.TransactionClient,
  ) {
    const db: Prisma.TransactionClient = tx ?? this.prisma;

    // Prix de référence : celui figé à la réservation (priceAtBooking).
    // Un changement de tarif après la réservation ne doit pas modifier les
    // points gagnés. Repli sur le prix courant du service pour les RDV
    // antérieurs à la colonne (priceAtBooking null).
    let price = appointment.priceAtBooking;
    if (price == null) {
      const service = await db.service.findUnique({
        where: { id: appointment.serviceId },
      });
      if (!service) return;
      price = service.price;
    }

    // Récupère le compte fidélité du client
    const account = await db.loyaltyAccount.findUnique({
      where: { userId: appointment.userId },
    });
    if (!account) return;

    // Calcule les points : 5% du prix, arrondi à l'entier
    const points = Math.round(Number(price) * LOYALTY_RATE);
    if (points <= 0) return;

    // Créer le mouvement + mettre à jour le solde et le compteur de visites
    const credit = async (client: Prisma.TransactionClient) => {
      await client.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          ownerId: appointment.userId,
          pointsDelta: points,
          type: LoyaltyTxType.EARN,
          appointmentId: appointment.id,
        },
      });
      return client.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: { increment: points },
          visitCount: { increment: 1 },
        },
      });
    };

    // Déjà dans une transaction : on y participe. Sinon, on en ouvre une.
    return tx ? credit(tx) : this.prisma.$transaction(credit);
  }

  // Crédite les points d'une COMMANDE terminée (5% du total, comme les RDV).
  // La transaction est liée à la commande via orderId (idempotence garantie
  // par la contrainte unique sur order_id).
  async earnFromOrder(order: Order) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId: order.userId },
    });
    if (!account) return;

    const points = Math.round(Number(order.total) * LOYALTY_RATE);
    if (points <= 0) return;

    return this.prisma.$transaction([
      this.prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          ownerId: order.userId,
          pointsDelta: points,
          type: LoyaltyTxType.EARN,
          orderId: order.id,
        },
      }),
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: { increment: points },
          visitCount: { increment: 1 },
        },
      }),
    ]);
  }

   createReward(dto: CreateRewardDto) {
    return this.prisma.reward.create({ data: dto });
  }

  // Catalogue des récompenses actives (pour les clients)
  findActiveRewards() {
    return this.prisma.reward.findMany({
      where: { active: true },
      orderBy: { pointsCost: 'asc' },
    });
  }

  // Toutes les récompenses, actives ou non (pour l'admin)
  findAllRewards() {
    return this.prisma.reward.findMany({
      orderBy: { pointsCost: 'asc' },
    });
  }

  async deactivateReward(id: string) {
    const reward = await this.prisma.reward.findUnique({ where: { id } });
    if (!reward) {
      throw new NotFoundException('Récompense introuvable.');
    }
    return this.prisma.reward.update({
      where: { id },
      data: { active: false },
    });
  }

  // ----- ÉCHANGE : le client dépense ses points -----

  async redeem(userId: string, rewardId: string) {
    // 1. La récompense existe et est disponible
    const reward = await this.prisma.reward.findUnique({
      where: { id: rewardId },
    });
    if (!reward || !reward.active) {
      throw new NotFoundException('Récompense introuvable ou indisponible.');
    }

    // 2. Le compte fidélité du client
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
    });
    if (!account) {
      throw new NotFoundException('Compte fidélité introuvable.');
    }

    // 3. Garde-fou : solde suffisant
    if (account.pointsBalance < reward.pointsCost) {
      throw new BadRequestException(
        `Solde insuffisant. Il vous manque ${reward.pointsCost - account.pointsBalance} point(s).`,
      );
    }

    // 4. Transaction atomique : débit + trace
    const [transaction] = await this.prisma.$transaction([
      this.prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          ownerId: userId,
          pointsDelta: -reward.pointsCost, // négatif = dépense
          type: LoyaltyTxType.REDEEM,
          rewardId: reward.id,
        },
      }),
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: { decrement: reward.pointsCost },
        },
      }),
    ]);

    return {
      message: `Récompense « ${reward.name} » échangée avec succès.`,
      pointsSpent: reward.pointsCost,
      transaction,
    };
  }

  async addManualPoints(dto: ManualPointsDto, createdById: string) {
    // Le compte fidélité du client ciblé
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId: dto.userId },
    });
    if (!account) {
      throw new NotFoundException('Compte fidélité introuvable.');
    }

    // Transaction atomique : mouvement tracé + mise à jour du solde
    const [transaction] = await this.prisma.$transaction([
      this.prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          ownerId: dto.userId,
          pointsDelta: dto.points,
          type: LoyaltyTxType.MANUAL,
          createdById, // ← QUI a fait cet ajout (audit)
          reason: dto.reason?.trim() || null, // ← POURQUOI (audit)
        },
      }),
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { pointsBalance: { increment: dto.points } },
      }),
    ]);

    return {
      message: `${dto.points} point(s) ajouté(s) manuellement.`,
      transaction,
    };
  }

  // ----- AUDIT : l'admin consulte tous les ajouts manuels -----

  auditManualTransactions() {
    return this.prisma.loyaltyTransaction.findMany({
      where: { type: LoyaltyTxType.MANUAL },
      include: {
        owner: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ----- STAFF/ADMIN : consulter le compte fidélité d'un client -----

  async getAccountByUserId(userId: string) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, phone: true },
        },
      },
    });
    if (!account) {
      throw new NotFoundException('Compte fidélité introuvable.');
    }
    return account;
  }
}