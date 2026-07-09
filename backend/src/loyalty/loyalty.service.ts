import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Appointment, LoyaltyTxType } from '@prisma/client';
import { CreateRewardDto } from './dto/create-reward.dto';

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

  // Crédite les points gagnés sur un RDV complété
  async earnFromAppointment(appointment: Appointment) {
    // Récupère le service pour connaître le prix
    const service = await this.prisma.service.findUnique({
      where: { id: appointment.serviceId },
    });
    if (!service) return;

    // Récupère le compte fidélité du client
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId: appointment.userId },
    });
    if (!account) return;

    // Calcule les points : 5% du prix, arrondi à l'entier
    const points = Math.round(Number(service.price) * LOYALTY_RATE);
    if (points <= 0) return;

    // Transaction atomique : créer le mouvement + mettre à jour le solde + le compteur de visites
    return this.prisma.$transaction([
      this.prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          ownerId: appointment.userId,
          pointsDelta: points,
          type: LoyaltyTxType.EARN,
          appointmentId: appointment.id,
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
}