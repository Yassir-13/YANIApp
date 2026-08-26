import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import {
  AppointmentFilter,
  FindAppointmentsQueryDto,
} from './dto/find-appointments-query.dto';
import { Paginated } from '../common/dto/pagination-query.dto';
import { AppointmentStatus, Prisma, Role } from '@prisma/client';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { SettingsService } from '../settings/settings.service';
import { ConfigService } from '@nestjs/config';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';

// Clé du verrou consultatif Postgres qui sérialise les réservations.
// Valeur arbitraire, mais elle doit être IDENTIQUE partout : c'est ce qui
// fait que deux réservations simultanées se mettent en file au lieu de se
// croiser. Voir withBookingLock.
const BOOKING_LOCK_KEY = 4_242_001;

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
    private readonly settings: SettingsService,
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

  // Jour du calendrier local du centre, "AAAA-MM-JJ" — la forme sous laquelle
  // les fermetures exceptionnelles sont stockées.
  private toLocalDate(date: Date): string {
    return format(toZonedTime(date, this.timezone), 'yyyy-MM-dd', {
      timeZone: this.timezone,
    });
  }

  // Une fermeture exceptionnelle prime sur les horaires hebdomadaires : un
  // mardi ouvert reste fermé s'il tombe dans des congés. Les bornes sont
  // incluses, et la comparaison de chaînes "AAAA-MM-JJ" ordonne les dates
  // correctement — aucun fuseau ne s'invite dans le calcul.
  private async isExceptionallyClosed(
    db: Prisma.TransactionClient | PrismaService,
    dateStr: string,
  ): Promise<boolean> {
    const closure = await db.closure.findFirst({
      where: { startDate: { lte: dateStr }, endDate: { gte: dateStr } },
      select: { id: true },
    });
    return closure !== null;
  }

  // ─────────────────────────────────────────
  //  Sérialisation des réservations
  // ─────────────────────────────────────────

  // Compter les RDV qui chevauchent puis insérer ne peut pas être rendu
  // atomique par une simple écriture conditionnelle : la capacité porte sur
  // un ENSEMBLE de lignes, pas sur une ligne à modifier. On prend donc un
  // verrou consultatif Postgres, tenu jusqu'à la fin de la transaction :
  // la 2ᵉ réservation attend que la 1ʳᵉ soit écrite avant de compter, au lieu
  // de voir le même créneau libre. Sans lui, 3 clientes pouvaient réserver
  // 2 cabines. pg_advisory_xact_lock se libère seul au commit comme au
  // rollback : aucun verrou ne peut rester coincé.
  private async withBookingLock<T>(
    run: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // $executeRaw et non $queryRaw : la fonction renvoie `void`, un type que
      // $queryRaw ne sait pas désérialiser (il lève « Failed to deserialize
      // column of type 'void' »). On ne veut de toute façon aucune valeur,
      // juste l'effet de bord.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOKING_LOCK_KEY}::bigint)`;
      return run(tx);
    });
  }

  // ─────────────────────────────────────────
  //  Vérification de disponibilité
  // ─────────────────────────────────────────

  // `db` : le client de la transaction qui détient le verrou de réservation.
  // La vérification et l'insertion doivent partager cette transaction, sinon
  // le verrou ne protège rien.
  private async assertSlotAvailable(
    db: Prisma.TransactionClient,
    serviceId: string,
    startAt: Date,
    excludeAppointmentId?: string,
  ) {
    const service = await db.service.findUnique({
      where: { id: serviceId },
    });
    if (!service || !service.active) {
      throw new NotFoundException('Service introuvable ou indisponible.');
    }

    if (startAt.getTime() < Date.now()) {
      throw new BadRequestException('Impossible de réserver dans le passé.');
    }

    // Un rendez-vous occupe UN créneau, jamais la durée de sa prestation.
    //
    // C'est une règle de gestion du centre, pas une contrainte technique : les
    // rendez-vous sont espacés d'un écart fixe que Fati règle depuis le
    // backoffice, et deux clientes ne se gênent que si elles sont sur le même
    // créneau — le nombre de salles dit combien peuvent l'être.
    //
    // ⚠️ Ce calcul lisait auparavant `service.durationMin`. Une prestation
    // d'1h25 réservée à 10h occupait alors jusqu'à 11h25 et interdisait le
    // créneau de 11h, alors que le centre veut précisément pouvoir le donner.
    // C'est aussi pourquoi `durationMin` est devenue facultative : plus rien
    // ici ne la lit.
    const { capacity, slotIntervalMin } = await this.settings.get();
    const endAt = new Date(startAt.getTime() + slotIntervalMin * 60_000);

    // ── Fermeture exceptionnelle (congés, jour férié) ──
    if (await this.isExceptionallyClosed(db, this.toLocalDate(startAt))) {
      throw new BadRequestException('Le centre est fermé ce jour-là.');
    }

    // ── Horaires d'ouverture (heure locale du centre) ──
    // Un jour sans aucune plage est fermé : c'est ce qui a remplacé l'ancien
    // booléen `isClosed`.
    const dayOfWeek = this.toLocalDayOfWeek(startAt);
    const ranges = await db.openingHours.findMany({
      where: { dayOfWeek },
      orderBy: { startTime: 'asc' },
    });

    if (ranges.length === 0) {
      throw new BadRequestException('Le centre est fermé ce jour-là.');
    }

    // Le rendez-vous doit tenir ENTIÈREMENT dans UNE plage : à cheval sur la
    // pause déjeuner, il n'y aurait personne pour le finir.
    //
    // Le calcul se fait en minutes depuis minuit, et non sur l'heure de fin
    // convertie en "HH:MM", pour deux raisons. C'est exactement l'expression
    // qu'utilise getAvailability, donc ce qui est proposé est ce qui est
    // accepté — les deux ne peuvent plus diverger. Et une prestation qui
    // déborderait après minuit donne ici plus de 1440 minutes, donc un refus,
    // là où "02:00" se serait comparé comme le matin même.
    const startMinutes = this.hhmmToMinutes(this.toLocalHHMM(startAt));
    const endMinutes = startMinutes + slotIntervalMin;

    const tientDansUnePlage = ranges.some(
      (plage) =>
        startMinutes >= this.hhmmToMinutes(plage.startTime) &&
        endMinutes <= this.hhmmToMinutes(plage.endTime),
    );

    if (!tientDansUnePlage) {
      const plages = ranges
        .map((p) => `${p.startTime}–${p.endTime}`)
        .join(', ');
      throw new BadRequestException(
        `Le créneau doit tenir dans une plage d'ouverture : ${plages} (heure locale).`,
      );
    }

    // ── Capacité (chevauchement d'intervalles) ──
    //
    // La borne basse est ce qui empêche cette requête de relire tout le passé.
    // Un rendez-vous ne peut chevaucher le créneau demandé que s'il se termine
    // après son début — donc qu'il commence après « début − un écart », tous
    // les rendez-vous occupant désormais la même largeur.
    //
    // Sans cette borne, chaque réservation chargeait tous les rendez-vous
    // encore en attente ou confirmés depuis l'ouverture. Et comme cette
    // lecture se fait DANS le verrou de réservation, elle faisait patienter
    // toutes les autres clientes en train de réserver.
    //
    // Elle remplace une agrégation qui cherchait la prestation la plus longue
    // du catalogue à chaque réservation : une requête de moins, et elle était
    // prise à l'intérieur du verrou.
    const borneBasse = new Date(startAt.getTime() - slotIntervalMin * 60_000);

    // `select` et non `include: { service: true }` : seule l'heure de début
    // compte maintenant, la prestation ne dit plus rien de l'occupation.
    const candidates = await db.appointment.findMany({
      where: {
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
        startAt: { gt: borneBasse, lt: endAt },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { startAt: true },
    });

    // Chevauchement d'intervalles, et non simple égalité d'heure de début : le
    // comptoir peut caser une cliente à 9h30, hors de la grille proposée par
    // l'application. Ce rendez-vous-là occupe une partie de 9h ET une partie
    // de 10h, et les deux doivent le voir.
    const overlapping = candidates.filter((appt) => {
      const apptStart = appt.startAt.getTime();
      const apptEnd = apptStart + slotIntervalMin * 60_000;
      return startAt.getTime() < apptEnd && apptStart < endAt.getTime();
    });

    if (overlapping.length >= capacity) {
      throw new BadRequestException('Ce créneau est complet.');
    }

    return { service, endAt };
  }

  // ─────────────────────────────────────────
  //  CLIENT : réserve pour lui-même
  // ─────────────────────────────────────────

  async create(userId: string, dto: CreateAppointmentDto) {
    const startAt = new Date(dto.startAt);

    // Vérification ET insertion sous le même verrou : le créneau constaté
    // libre l'est encore au moment où le RDV est écrit.
    return this.withBookingLock(async (tx) => {
      // assertSlotAvailable renvoie la prestation validée : on fige son prix.
      const { service } = await this.assertSlotAvailable(tx, dto.serviceId, startAt);

      return tx.appointment.create({
        data: {
          userId,
          serviceId: dto.serviceId,
          startAt,
          priceAtBooking: service.price,
        },
        include: { service: true },
      });
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

    return this.withBookingLock(async (tx) => {
      const { service } = await this.assertSlotAvailable(tx, dto.serviceId, startAt);

      return tx.appointment.create({
        data: {
          userId: targetUserId,
          serviceId: dto.serviceId,
          startAt,
          priceAtBooking: service.price,
        },
        include: { service: true },
      });
    });
  }

  // ─────────────────────────────────────────
  //  Lecture : client = les siens ; staff/admin = tous
  // ─────────────────────────────────────────

  // La cliente voit les siens, le comptoir voit tout — mais les deux listes
  // sont désormais paginées. Auparavant, cette route renvoyait TOUS les
  // rendez-vous depuis l'ouverture à chaque affichage (I4).
  findForUser(userId: string, role: Role, query: FindAppointmentsQueryDto) {
    return role === Role.CLIENT
      ? this.findMine(userId, query)
      : this.findAllForStaff(query);
  }

  private async findMine(
    userId: string,
    query: FindAppointmentsQueryDto,
  ): Promise<Paginated<any>> {
    const { page, limit } = query;
    const where: Prisma.AppointmentWhereInput = { userId };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        include: { service: true },
        // Du plus récent au plus ancien, comme « Mes commandes ».
        //
        // 📌 VOULU, ne pas « corriger ». « Mes rendez-vous » est un historique,
        // et un historique se lit dans ce sens. L'ordre croissant d'avant
        // plaçait les rendez-vous les PLUS VIEUX en tête : sans pagination ça
        // se voyait à peine, avec pagination la première page ne contiendrait
        // plus que du passé. Un regroupement « à venir d'abord » a été envisagé
        // (I18) puis écarté le 2026-08-12 : ce n'est pas un tableau de bord,
        // c'est un journal.
        orderBy: { startAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // Le « aujourd'hui » et le « à venir » du comptoir, traduits en conditions
  // de base. Ils étaient calculés dans le navigateur, sur la liste complète :
  // sur une liste paginée, ils ne porteraient plus que sur la page affichée.
  private whereForFilter(
    filter: AppointmentFilter,
  ): Prisma.AppointmentWhereInput {
    const now = new Date();

    switch (filter) {
      case AppointmentFilter.TODAY: {
        // Le jour du CENTRE, pas celui du navigateur de la personne qui
        // consulte : c'est le serveur qui possède la base des fuseaux.
        const jour = format(toZonedTime(now, this.timezone), 'yyyy-MM-dd', {
          timeZone: this.timezone,
        });
        return {
          status: { not: AppointmentStatus.CANCELLED },
          startAt: {
            gte: fromZonedTime(`${jour}T00:00:00`, this.timezone),
            lte: fromZonedTime(`${jour}T23:59:59.999`, this.timezone),
          },
        };
      }
      case AppointmentFilter.UPCOMING:
        return {
          status: { not: AppointmentStatus.CANCELLED },
          startAt: { gt: now },
        };
      case AppointmentFilter.ALL:
        return {};
      default:
        return { status: filter as unknown as AppointmentStatus };
    }
  }

  private async findAllForStaff(
    query: FindAppointmentsQueryDto,
  ): Promise<Paginated<any> & { counts: Record<string, number> }> {
    const { page, limit, filter } = query;
    const where = this.whereForFilter(filter);

    // Les vues d'historique se lisent du plus récent au plus ancien ; les vues
    // de travail (aujourd'hui, à venir, à confirmer) dans l'ordre où les
    // clientes se présentent.
    const historique =
      filter === AppointmentFilter.ALL ||
      filter === AppointmentFilter.COMPLETED ||
      filter === AppointmentFilter.CANCELLED;

    const [data, total, today, upcoming] =
      await this.prisma.$transaction([
        this.prisma.appointment.findMany({
          where,
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
          orderBy: { startAt: historique ? 'desc' : 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.appointment.count({ where }),
        this.prisma.appointment.count({
          where: this.whereForFilter(AppointmentFilter.TODAY),
        }),
        this.prisma.appointment.count({
          where: this.whereForFilter(AppointmentFilter.UPCOMING),
        }),
      ]);

    // Les compteurs des onglets portent sur TOUT, pas sur la page : c'est ce
    // qui permet d'annoncer « À confirmer (7) » sans télécharger les sept
    // mille autres. Hors de la transaction ci-dessus à dessein — ce sont des
    // indicateurs, pas des invariants.
    const parStatut = await this.prisma.appointment.groupBy({
      by: ['status'],
      _count: true,
      orderBy: { status: 'asc' },
    });

    const counts: Record<string, number> = {
      ALL: 0,
      TODAY: today,
      UPCOMING: upcoming,
    };
    for (const ligne of parStatut) {
      counts[ligne.status] = ligne._count;
      counts.ALL += ligne._count;
    }

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      counts,
    };
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
    const startAt = new Date(newStartAt);

    // Sous le même verrou que create : déplacer un RDV occupe un créneau,
    // exactement comme en réserver un. Hors du verrou, une reprogrammation
    // et une réservation simultanées viseraient le même créneau libre.
    return this.withBookingLock(async (tx) => {
      const appointment = await tx.appointment.findUnique({ where: { id } });
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

      // On revérifie la disponibilité en excluant le RDV lui-même
      await this.assertSlotAvailable(tx, appointment.serviceId, startAt, id);

      return tx.appointment.update({
        where: { id },
        data: { startAt },
        include: { service: true },
      });
    });
  }

  // Calcule les créneaux disponibles pour un service à une date donnée
  async getAvailability(serviceId: string, dateStr: string) {
    // 1. Le service — pour refuser une prestation inexistante ou retirée du
    // catalogue, et pour rien d'autre. La grille produite ci-dessous est
    // désormais LA MÊME pour toutes les prestations : c'est l'écart réglé par
    // le centre qui la dessine, pas la durée de la prestation demandée.
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service || !service.active) {
      throw new NotFoundException('Service introuvable ou indisponible.');
    }

    // 2. Une fermeture exceptionnelle ferme la journée quels que soient les
    // horaires hebdomadaires — c'est le cas des congés et des jours fériés.
    if (await this.isExceptionallyClosed(this.prisma, dateStr)) {
      return { date: dateStr, closed: true, slots: [] };
    }

    // 3. Le jour de la semaine (en heure locale) et ses plages d'ouverture.
    // Aucune plage = jour fermé.
    const dayDate = new Date(`${dateStr}T12:00:00.000Z`); // midi pour éviter les bascules de jour
    const dayOfWeek = this.toLocalDayOfWeek(dayDate);
    const ranges = await this.prisma.openingHours.findMany({
      where: { dayOfWeek },
      orderBy: { startTime: 'asc' },
    });

    if (ranges.length === 0) {
      return { date: dateStr, closed: true, slots: [] };
    }

    const { capacity, slotIntervalMin } = await this.settings.get();

    // 4. Récupère les RDV actifs de ce jour (pour vérifier la capacité).
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
      select: { startAt: true },
    });

    // 5. Génère les créneaux, plage par plage
    //
    // Un créneau ne peut pas déborder de sa plage : la condition d'arrêt porte
    // sur la fin de CHAQUE plage. Rien n'est donc proposé à 12h30 si la pause
    // déjeuner commence à 13h — c'est ce que coûtait, en logique d'exclusion,
    // l'approche « une plage trouée ».
    //
    // Chaque créneau porte DEUX valeurs : `time` pour l'affichage (heure locale)
    // et `startAt`, l'instant UTC exact à renvoyer tel quel lors de la réservation.
    // Le client n'a ainsi aucun calcul de fuseau à refaire — c'est le serveur,
    // qui possède la base IANA, qui fait autorité.
    //
    // Les plages arrivent triées et ne se chevauchent pas (garanti par
    // OpeningHoursService) : la liste produite reste dans l'ordre des heures.
    const slots: { time: string; startAt: string; available: boolean }[] = [];

    for (const plage of ranges) {
      const debut = this.hhmmToMinutes(plage.startTime);
      const fin = this.hhmmToMinutes(plage.endTime);

      // L'écart sert deux fois : il dessine le pas de la grille ET la largeur
      // occupée par un rendez-vous. Les deux sont volontairement la même
      // valeur — un rendez-vous occupe exactement un créneau.
      for (let m = debut; m + slotIntervalMin <= fin; m += slotIntervalMin) {
        // Construit l'instant UTC correspondant à ce créneau local
        const slotStart = this.localTimeToUtc(dateStr, m);
        const slotEnd = new Date(slotStart.getTime() + slotIntervalMin * 60_000);

        // Passé ? indisponible
        if (slotStart.getTime() < Date.now()) {
          slots.push({
            time: this.minutesToHHMM(m),
            startAt: slotStart.toISOString(),
            available: false,
          });
          continue;
        }

        // Compte les chevauchements. Même règle qu'à la réservation : chaque
        // rendez-vous occupe un écart, quelle que soit sa prestation.
        const overlapping = dayAppointments.filter((appt) => {
          const apptStart = appt.startAt.getTime();
          const apptEnd = apptStart + slotIntervalMin * 60_000;
          return slotStart.getTime() < apptEnd && apptStart < slotEnd.getTime();
        });

        slots.push({
          time: this.minutesToHHMM(m),
          startAt: slotStart.toISOString(),
          available: overlapping.length < capacity,
        });
      }
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

  // "09:30" → 570. Le format est garanti par le DTO des horaires.
  private hhmmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
}