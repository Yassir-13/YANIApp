import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentStatus, Role } from '@prisma/client';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { ConfigService } from '@nestjs/config';
import { toZonedTime, format } from 'date-fns-tz';

// Capacité applicative : 2 cabines réservées à l'app
const CENTER_CAPACITY = 2;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loyaltyService: LoyaltyService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────
  //  Utilitaires fuseau horaire
  //  Convention : l'API reçoit et stocke des instants UTC.
  //  Les horaires d'ouverture sont exprimés en heure LOCALE du centre.
  // ─────────────────────────────────────────

  private get timezone(): string {
    return this.config.get<string>('CENTER_TIMEZONE') ?? 'Africa/Casablanca';
  }

  // Convertit un instant UTC en "HH:MM" heure locale du centre
  private toLocalHHMM(date: Date): string {
    const zoned = toZonedTime(date, this.timezone);
    return format(zoned, 'HH:mm', { timeZone: this.timezone });
  }

  // Jour de la semaine en heure locale (0 = dimanche ... 6 = samedi)
  private toLocalDayOfWeek(date: Date): number {
    const zoned = toZonedTime(date, this.timezone);
    return zoned.getDay();
  }

  // ─────────────────────────────────────────
  //  Vérification de disponibilité
  // ─────────────────────────────────────────

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

    // ── Horaires d'ouverture (heure locale du centre) ──
    const dayOfWeek = this.toLocalDayOfWeek(startAt);
    const hours = await this.prisma.openingHours.findUnique({
      where: { dayOfWeek },
    });

    if (!hours || hours.isClosed) {
      throw new BadRequestException('Le centre est fermé ce jour-là.');
    }

    const startHHMM = this.toLocalHHMM(startAt);
    const endHHMM = this.toLocalHHMM(endAt);

    if (startHHMM < hours.openTime || endHHMM > hours.closeTime) {
      throw new BadRequestException(
        `Le créneau doit être compris entre ${hours.openTime} et ${hours.closeTime} (heure locale).`,
      );
    }

    // ── Capacité (chevauchement d'intervalles) ──
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

  // ─────────────────────────────────────────
  //  CLIENT : réserve pour lui-même
  // ─────────────────────────────────────────

  async create(userId: string, dto: CreateAppointmentDto) {
    const startAt = new Date(dto.startAt);
    await this.assertSlotAvailable(dto.serviceId, startAt);

    return this.prisma.appointment.create({
      data: { userId, serviceId: dto.serviceId, startAt },
      include: { service: true },
    });
  }

  // ─────────────────────────────────────────
  //  STAFF/ADMIN : réserve pour un client donné
  // ─────────────────────────────────────────

  async createForClient(targetUserId: string, dto: CreateAppointmentDto) {
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

  // ─────────────────────────────────────────
  //  Lecture : client = les siens ; staff/admin = tous
  // ─────────────────────────────────────────

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

  // ─────────────────────────────────────────
  //  Annulation : client = le sien ; staff/admin = tous
  // ─────────────────────────────────────────

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

  // ─────────────────────────────────────────
  //  STAFF/ADMIN : change librement le statut
  // ─────────────────────────────────────────

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

  // ─────────────────────────────────────────
  //  STAFF/ADMIN : reprogrammation
  // ─────────────────────────────────────────

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

  // Granularité des créneaux proposés (en minutes)
  private readonly SLOT_INTERVAL = 30;

  // Calcule les créneaux disponibles pour un service à une date donnée
  async getAvailability(serviceId: string, dateStr: string) {
    // 1. Le service (pour connaître sa durée)
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service || !service.active) {
      throw new NotFoundException('Service introuvable ou indisponible.');
    }

    // 2. Le jour de la semaine (en heure locale) et ses horaires
    const dayDate = new Date(`${dateStr}T12:00:00.000Z`); // midi pour éviter les bascules de jour
    const dayOfWeek = this.toLocalDayOfWeek(dayDate);
    const hours = await this.prisma.openingHours.findUnique({
      where: { dayOfWeek },
    });

    if (!hours || hours.isClosed) {
      return { date: dateStr, closed: true, slots: [] };
    }

    // 3. Récupère les RDV actifs de ce jour (pour vérifier la capacité)
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
    const dayAppointments = await this.prisma.appointment.findMany({
      where: {
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
        startAt: { gte: dayStart, lte: dayEnd },
      },
      include: { service: true },
    });

    // 4. Génère les créneaux de l'ouverture à la fermeture
    const slots: { time: string; available: boolean }[] = [];
    const [openH, openM] = hours.openTime.split(':').map(Number);
    const [closeH, closeM] = hours.closeTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    for (
      let m = openMinutes;
      m + service.durationMin <= closeMinutes;
      m += this.SLOT_INTERVAL
    ) {
      // Construit l'instant UTC correspondant à ce créneau local
      const slotStart = this.localTimeToUtc(dateStr, m);
      const slotEnd = new Date(slotStart.getTime() + service.durationMin * 60_000);

      // Passé ? indisponible
      if (slotStart.getTime() < Date.now()) {
        slots.push({ time: this.minutesToHHMM(m), available: false });
        continue;
      }

      // Compte les chevauchements
      const overlapping = dayAppointments.filter((appt) => {
        const apptStart = appt.startAt.getTime();
        const apptEnd = apptStart + appt.service.durationMin * 60_000;
        return slotStart.getTime() < apptEnd && apptStart < slotEnd.getTime();
      });

      slots.push({
        time: this.minutesToHHMM(m),
        available: overlapping.length < CENTER_CAPACITY,
      });
    }

    return { date: dateStr, closed: false, slots };
  }

  // Convertit "HH:MM" (minutes locales) + date en instant UTC
  private localTimeToUtc(dateStr: string, minutesFromMidnight: number): Date {
    const h = Math.floor(minutesFromMidnight / 60);
    const m = minutesFromMidnight % 60;
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    // On construit une date locale puis on la convertit en UTC via le fuseau
    const localStr = `${dateStr}T${hh}:${mm}:00`;
    const asUtc = new Date(`${localStr}Z`); // interprété comme UTC d'abord
    // Ajuste selon le décalage du fuseau à cette date
    const zoned = toZonedTime(asUtc, this.timezone);
    const offset = asUtc.getTime() - zoned.getTime();
    return new Date(asUtc.getTime() + offset);
  }

  private minutesToHHMM(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}