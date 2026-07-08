import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentStatus, Role } from '@prisma/client';
import { LoyaltyService } from '../loyalty/loyalty.service'

// Capacité applicative : 2 cabines réservées à l'app
const CENTER_CAPACITY = 2;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  // Vérifie la disponibilité d'un créneau (capacité par chevauchement)
 private async assertSlotAvailable(
    serviceId: string,
    startAt: Date,
    excludeAppointmentId?: string,
  ) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service || !service.active) {
      throw new NotFoundException('Service introuvable ou indisponible.');
    }

    if (startAt.getTime() < Date.now()) {
      throw new BadRequestException('Impossible de réserver dans le passé.');
    }

    const endAt = new Date(startAt.getTime() + service.durationMin * 60_000);

    // ── Vérification des horaires d'ouverture ──
    const dayOfWeek = startAt.getUTCDay(); // 0 = dimanche ... 6 = samedi
    const hours = await this.prisma.openingHours.findUnique({
      where: { dayOfWeek },
    });

    if (!hours || hours.isClosed) {
      throw new BadRequestException('Le centre est fermé ce jour-là.');
    }

    // Heure de début et de fin du RDV au format "HH:MM" pour comparer
    const startHHMM = this.toHHMM(startAt);
    const endHHMM = this.toHHMM(endAt);

    if (startHHMM < hours.openTime || endHHMM > hours.closeTime) {
      throw new BadRequestException(
        `Le créneau doit être compris entre ${hours.openTime} et ${hours.closeTime}.`,
      );
    }

    // ── Vérification de la capacité (chevauchement) ──
    const candidates = await this.prisma.appointment.findMany({
      where: {
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
        startAt: { lt: endAt },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      include: { service: true },
    });

    const overlapping = candidates.filter((appt) => {
      const apptStart = appt.startAt.getTime();
      const apptEnd = apptStart + appt.service.durationMin * 60_000;
      return startAt.getTime() < apptEnd && apptStart < endAt.getTime();
    });

    if (overlapping.length >= CENTER_CAPACITY) {
      throw new BadRequestException('Ce créneau est complet.');
    }

    return { service, endAt };
  }

  // Convertit une Date en "HH:MM" (UTC)
  private toHHMM(date: Date): string {
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // ----- CLIENT : réserve pour lui-même -----
  async create(userId: string, dto: CreateAppointmentDto) {
    const startAt = new Date(dto.startAt);
    await this.assertSlotAvailable(dto.serviceId, startAt);

    return this.prisma.appointment.create({
      data: { userId, serviceId: dto.serviceId, startAt },
      include: { service: true },
    });
  }

  // ----- STAFF/ADMIN : réserve pour un client donné -----
  async createForClient(
    targetUserId: string,
    dto: CreateAppointmentDto,
  ) {
    const client = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!client) {
      throw new NotFoundException('Client introuvable.');
    }

    const startAt = new Date(dto.startAt);
    await this.assertSlotAvailable(dto.serviceId, startAt);

    return this.prisma.appointment.create({
      data: { userId: targetUserId, serviceId: dto.serviceId, startAt },
      include: { service: true },
    });
  }

  // ----- Lecture : client = les siens ; staff/admin = tous -----
  findForUser(userId: string, role: Role) {
    if (role === Role.CLIENT) {
      return this.prisma.appointment.findMany({
        where: { userId },
        include: { service: true },
        orderBy: { startAt: 'asc' },
      });
    }
    return this.prisma.appointment.findMany({
      include: {
        service: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
          },
        },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  // ----- Annulation : client = le sien ; staff/admin = tous -----
  async cancel(id: string, userId: string, role: Role) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) {
      throw new NotFoundException('Rendez-vous introuvable.');
    }
    if (role === Role.CLIENT && appointment.userId !== userId) {
      throw new ForbiddenException('Ce rendez-vous ne vous appartient pas.');
    }
    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
    });
  }

  // ----- STAFF/ADMIN : change librement le statut -----
  async updateStatus(id: string, status: AppointmentStatus) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) {
      throw new NotFoundException('Rendez-vous introuvable.');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status },
    });

    // ── Automatisation fidélité ──
    // Crédite les points UNIQUEMENT à la transition vers COMPLETED
    if (
      status === AppointmentStatus.COMPLETED &&
      appointment.status !== AppointmentStatus.COMPLETED
    ) {
      await this.loyaltyService.earnFromAppointment(updated);
    }

    return updated;
  }

  // ----- STAFF/ADMIN : reprogrammation (change l'horaire) -----
  async reschedule(id: string, newStartAt: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) {
      throw new NotFoundException('Rendez-vous introuvable.');
    }

    const startAt = new Date(newStartAt);
    // On revérifie la disponibilité en excluant le RDV lui-même
    await this.assertSlotAvailable(appointment.serviceId, startAt, id);

    return this.prisma.appointment.update({
      where: { id },
      data: { startAt },
      include: { service: true },
    });
  }
}