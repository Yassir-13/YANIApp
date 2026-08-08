import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Appointment,
  Order,
  LoyaltyAccount,
  LoyaltyTxType,
  Prisma,
} from '@prisma/client';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
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
      const updated = await client.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: { increment: points },
          visitCount: { increment: 1 },
        },
      });

      // Cette visite fait peut-être franchir un palier
      await this.grantMilestones(client, updated);

      return updated;
    };

    // Déjà dans une transaction : on y participe. Sinon, on en ouvre une.
    return tx ? credit(tx) : this.prisma.$transaction(credit);
  }

  // Crédite les points d'une COMMANDE terminée (5% du total, comme les RDV).
  // La transaction est liée à la commande via orderId (idempotence garantie
  // par la contrainte unique sur order_id).
  // N'incrémente PAS visitCount : une visite est une prestation réalisée à
  // l'institut, pas un achat de produits. Seuls les RDV comptent pour les
  // paliers de fidélité.
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
        },
      }),
    ]);
  }

  // ----- PALIERS DE VISITES -----

  // Débloque les récompenses des paliers franchis par ce compte.
  // Appelée dans la transaction du RDV : le déblocage et le crédit de points
  // réussissent ou échouent ensemble.
  private async grantMilestones(
    client: Prisma.TransactionClient,
    account: LoyaltyAccount,
  ) {
    // Un palier dont la récompense a été retirée du catalogue ne débloque plus
    const milestones = await client.loyaltyMilestone.findMany({
      where: { active: true, reward: { active: true } },
    });

    for (const milestone of milestones) {
      if (milestone.visitThreshold <= 0) continue;

      // Combien de fois le seuil a été franchi : 10 visites pour un seuil de
      // 10 → cycle 1, 20 visites → cycle 2.
      const cycle = Math.floor(account.visitCount / milestone.visitThreshold);
      if (cycle < 1) continue;

      // Palier non récurrent : seul le premier franchissement compte
      if (!milestone.recurring && cycle > 1) continue;

      // skipDuplicates s'appuie sur l'unique (compte, palier, cycle) : si le
      // déblocage est rejoué, il ne fait rien plutôt que de faire échouer le
      // passage du RDV en « terminé ».
      await client.milestoneGrant.createMany({
        data: {
          accountId: account.id,
          milestoneId: milestone.id,
          // Récompense figée au déblocage : la modifier plus tard ne change
          // pas ce qui a déjà été offert.
          rewardId: milestone.rewardId,
          cycle,
        },
        skipDuplicates: true,
      });
    }
  }

  // Récompenses débloquées d'une cliente (réclamées ou non)
  async getMyGrants(userId: string) {
    const account = await this.getAccount(userId);
    return this.prisma.milestoneGrant.findMany({
      where: { accountId: account.id },
      include: {
        reward: true,
        milestone: { select: { visitThreshold: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // La cliente réclame une récompense offerte (aucun point dépensé)
  async claimGrant(userId: string, grantId: string) {
    const account = await this.getAccount(userId);

    const grant = await this.prisma.milestoneGrant.findUnique({
      where: { id: grantId },
      include: { reward: true },
    });
    // Un grant appartenant à quelqu'un d'autre est traité comme inexistant :
    // pas de fuite d'information sur les comptes tiers.
    if (!grant || grant.accountId !== account.id) {
      throw new NotFoundException('Récompense introuvable.');
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      // updateMany conditionné à claimedAt null : deux appels simultanés
      // (double tap sur mobile) ne peuvent pas réclamer deux fois.
      const { count } = await tx.milestoneGrant.updateMany({
        where: { id: grant.id, claimedAt: null },
        data: { claimedAt: new Date() },
      });
      if (count === 0) {
        throw new BadRequestException('Cette récompense a déjà été réclamée.');
      }

      // Trace dans l'historique fidélité, à solde inchangé
      return tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          ownerId: userId,
          pointsDelta: 0,
          type: LoyaltyTxType.MILESTONE,
          rewardId: grant.rewardId,
        },
      });
    });

    return {
      message: `Récompense « ${grant.reward.name} » réclamée. Présentez-la à l'institut.`,
      reward: grant.reward,
      transaction,
    };
  }

  // Paliers actifs (pour l'app cliente : afficher l'objectif en cours)
  findActiveMilestones() {
    return this.prisma.loyaltyMilestone.findMany({
      where: { active: true, reward: { active: true } },
      include: { reward: true },
      orderBy: { visitThreshold: 'asc' },
    });
  }

  // Tous les paliers, actifs ou non (pour l'admin)
  findAllMilestones() {
    return this.prisma.loyaltyMilestone.findMany({
      include: { reward: true },
      orderBy: { visitThreshold: 'asc' },
    });
  }

  async createMilestone(dto: CreateMilestoneDto) {
    const reward = await this.prisma.reward.findUnique({
      where: { id: dto.rewardId },
    });
    if (!reward) {
      throw new NotFoundException('Récompense introuvable.');
    }
    return this.prisma.loyaltyMilestone.create({
      data: dto,
      include: { reward: true },
    });
  }

  async updateMilestone(id: string, dto: UpdateMilestoneDto) {
    const milestone = await this.prisma.loyaltyMilestone.findUnique({
      where: { id },
    });
    if (!milestone) {
      throw new NotFoundException('Palier introuvable.');
    }
    if (dto.rewardId) {
      const reward = await this.prisma.reward.findUnique({
        where: { id: dto.rewardId },
      });
      if (!reward) {
        throw new NotFoundException('Récompense introuvable.');
      }
    }
    return this.prisma.loyaltyMilestone.update({
      where: { id },
      data: dto,
      include: { reward: true },
    });
  }

  async deactivateMilestone(id: string) {
    const milestone = await this.prisma.loyaltyMilestone.findUnique({
      where: { id },
    });
    if (!milestone) {
      throw new NotFoundException('Palier introuvable.');
    }
    return this.prisma.loyaltyMilestone.update({
      where: { id },
      data: { active: false },
      include: { reward: true },
    });
  }

   createReward(dto: CreateRewardDto) {
    return this.prisma.reward.create({ data: dto });
  }

  async updateReward(id: string, dto: UpdateRewardDto) {
    const reward = await this.prisma.reward.findUnique({ where: { id } });
    if (!reward) {
      throw new NotFoundException('Récompense introuvable.');
    }
    return this.prisma.reward.update({ where: { id }, data: dto });
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
        // Récompenses offertes en attente : le comptoir doit les voir pour
        // honorer une cliente qui se présente sans avoir réclamé dans l'app.
        grants: {
          where: { claimedAt: null },
          include: { reward: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!account) {
      throw new NotFoundException('Compte fidélité introuvable.');
    }
    return account;
  }
}