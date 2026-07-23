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
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

// Capacité applicative : 2 cabines réservées à l'app
const CENTER_CAPACITY = 2;

// Transitions de statut autorisées (machine à états, miroir de celle des
// commandes). COMPLETED et CANCELLED sont des états finaux : on n'en sort plus.
// Sans cette table, un RDV annulé pouvait passer à COMPLETED et créditer des
// points de fidélité pour une prestation jamais réalisée.
const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
  CONFIRMED: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

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
    // assertSlotAvailable renvoie la prestation validée : on fige son prix.
    const { service } = await this.assertSlotAvailable(dto.serviceId, startAt);

    return this.prisma.appointment.create({
      data: {
        userId,
        serviceId: dto.serviceId,
        startAt,
        priceAtBooking: service.price,
      },
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
    const { service } = await this.assertSlotAvailable(dto.serviceId, startAt);

    return this.prisma.appointment.create({
      data: {
        userId: targetUserId,
        serviceId: dto.serviceId,
        startAt,
        priceAtBooking: service.price,
      },
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

    // Même machine à états que updateStatus : un RDV terminé ou déjà annulé
    // ne peut plus être annulé. Message orienté cliente, pas technique.
    if (!ALLOWED_TRANSITIONS[appointment.status].includes(AppointmentStatus.CANCELLED)) {
      throw new BadRequestException(
        appointment.status === AppointmentStatus.CANCELLED
          ? 'Ce rendez-vous est déjà annulé.'
          : "Ce rendez-vous ne peut plus être annulé. Contactez l'institut.",
      );
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

    // Refusé AVANT toute écriture : la base n'est jamais touchée pour rien.
    const allowed = ALLOWED_TRANSITIONS[appointment.status];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Transition impossible de ${appointment.status} vers ${status}.`,
      );
    }

    // Le statut et le crédit fidélité forment un tout : si le crédit échoue,
    // le RDV ne doit pas rester marqué COMPLETED sans ses points.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: { status },
      });

      // ── Automatisation fidélité ──
      // Seul CONFIRMED mène à COMPLETED, et COMPLETED est un état final :
      // ce crédit ne peut donc plus être joué deux fois pour le même RDV.
      if (status === AppointmentStatus.COMPLETED) {
        await this.loyaltyService.earnFromAppointment(updated, tx);
      }

      return updated;
    });
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

    // Reprogrammer un RDV terminé ou annulé n'a pas de sens : ce sont des
    // états finaux. Sans ce garde-fou, un RDV annulé redevenait actif.
    if (ALLOWED_TRANSITIONS[appointment.status].length === 0) {
      throw new BadRequestException(
        'Un rendez-vous terminé ou annulé ne peut pas être reprogrammé.',
      );
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

    // 3. Récupère les RDV actifs de ce jour (pour vérifier la capacité).
    // La journée est bornée en heure LOCALE puis convertie : un « 00:00 UTC »
    // ne correspond pas à minuit à Casablanca et décalait la fenêtre d'une heure.
    const dayStart = fromZonedTime(`${dateStr}T00:00:00`, this.timezone);
    const dayEnd = fromZonedTime(`${dateStr}T23:59:59.999`, this.timezone);
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
    //
    // Chaque créneau porte DEUX valeurs : `time` pour l'affichage (heure locale)
    // et `startAt`, l'instant UTC exact à renvoyer tel quel lors de la réservation.
    // Le client n'a ainsi aucun calcul de fuseau à refaire — c'est le serveur,
    // qui possède la base IANA, qui fait autorité.
    const slots: { time: string; startAt: string; available: boolean }[] = [];
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
        slots.push({
          time: this.minutesToHHMM(m),
          startAt: slotStart.toISOString(),
          available: false,
        });
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
        startAt: slotStart.toISOString(),
        available: overlapping.length < CENTER_CAPACITY,
      });
    }

    return { date: dateStr, closed: false, slots };
  }

  // Convertit "HH:MM" (heure LOCALE du centre) + date en instant UTC.
  //
  // Le calcul d'offset à la main donnait un résultat qui dépendait du fuseau
  // système du serveur (juste en TZ=UTC, faux d'une heure en TZ=Africa/Casablanca)
  // et ignorait le passage du Maroc à UTC+0 pendant le Ramadan.
  // fromZonedTime interroge la base IANA : correct quel que soit le serveur,
  // et correct toute l'année.
  private localTimeToUtc(dateStr: string, minutesFromMidnight: number): Date {
    const hh = String(Math.floor(minutesFromMidnight / 60)).padStart(2, '0');
    const mm = String(minutesFromMidnight % 60).padStart(2, '0');
    return fromZonedTime(`${dateStr}T${hh}:${mm}:00`, this.timezone);
  }

  private minutesToHHMM(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}