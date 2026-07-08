import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Appointment, LoyaltyTxType } from '@prisma/client';

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
}