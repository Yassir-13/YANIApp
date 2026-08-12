import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppointmentStatus, Role } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  AppointmentFilter,
  FindAppointmentsQueryDto,
} from './dto/find-appointments-query.dto';

/**
 * `GET /appointments` renvoyait TOUS les rendez-vous depuis l'ouverture (I4).
 * Le filtre et les compteurs d'onglets vivaient dans le navigateur, sur cette
 * liste complète : une fois la liste paginée, les laisser là donnerait des
 * résultats faux — « À confirmer » ne compterait que la page affichée.
 */
describe('AppointmentsService — liste paginée', () => {
  let service: AppointmentsService;
  let prisma: any;

  const TZ = 'Africa/Casablanca';

  const query = (over: Partial<FindAppointmentsQueryDto> = {}) =>
    ({
      page: 1,
      limit: 20,
      filter: AppointmentFilter.ALL,
      ...over,
    }) as FindAppointmentsQueryDto;

  beforeEach(async () => {
    prisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([
          { status: AppointmentStatus.PENDING, _count: 3 },
          { status: AppointmentStatus.CONFIRMED, _count: 5 },
        ]),
      },
      // Forme tableau : les opérations sont construites puis attendues
      // ensemble, comme le fait Prisma.
      $transaction: jest.fn(async (ops: any) =>
        Array.isArray(ops) ? Promise.all(ops) : ops(prisma),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LoyaltyService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => TZ } },
      ],
    }).compile();

    service = module.get(AppointmentsService);
  });

  const argsListe = () => prisma.appointment.findMany.mock.calls[0][0];

  // ═══════════════════════════════════════════════════════════
  //  DÉCOUPAGE
  // ═══════════════════════════════════════════════════════════
  it('ne demande à la base que la tranche affichée', async () => {
    await service.findForUser('staff-1', Role.STAFF, query({ page: 3, limit: 20 }));

    expect(argsListe().skip).toBe(40);
    expect(argsListe().take).toBe(20);
  });

  // ═══════════════════════════════════════════════════════════
  //  COMPTEURS D'ONGLETS
  // ═══════════════════════════════════════════════════════════
  it('compte sur l’ensemble des rendez-vous, pas sur la page', async () => {
    prisma.appointment.count
      .mockResolvedValueOnce(42) // total du filtre courant
      .mockResolvedValueOnce(4) // aujourd'hui
      .mockResolvedValueOnce(9); // à venir

    const res: any = await service.findForUser('staff-1', Role.STAFF, query());

    // 3 + 5 lignes vues par groupBy, alors que la page en contient zéro.
    expect(res.counts.ALL).toBe(8);
    expect(res.counts.PENDING).toBe(3);
    expect(res.counts.TODAY).toBe(4);
    expect(res.counts.UPCOMING).toBe(9);
    expect(res.total).toBe(42);
  });

  // ═══════════════════════════════════════════════════════════
  //  FILTRES DÉPLACÉS CÔTÉ SERVEUR
  // ═══════════════════════════════════════════════════════════
  describe('filtres', () => {
    it('« aujourd’hui » borne la journée du CENTRE et écarte les annulés', async () => {
      await service.findForUser(
        'staff-1',
        Role.STAFF,
        query({ filter: AppointmentFilter.TODAY }),
      );

      const { where } = argsListe();
      expect(where.status.not).toBe(AppointmentStatus.CANCELLED);
      // Le jour commence à minuit à Casablanca — pas à minuit UTC, ni à
      // minuit chez la personne qui consulte le backoffice.
      expect(formatInTimeZone(where.startAt.gte, TZ, 'HH:mm')).toBe('00:00');
      expect(
        where.startAt.lte.getTime() - where.startAt.gte.getTime(),
      ).toBe(86_399_999);
    });

    it('« à venir » part de maintenant et écarte les annulés', async () => {
      const avant = Date.now();
      await service.findForUser(
        'staff-1',
        Role.STAFF,
        query({ filter: AppointmentFilter.UPCOMING }),
      );

      const { where } = argsListe();
      expect(where.status.not).toBe(AppointmentStatus.CANCELLED);
      expect(where.startAt.gt.getTime()).toBeGreaterThanOrEqual(avant);
    });

    it('un statut filtre sur ce statut', async () => {
      await service.findForUser(
        'staff-1',
        Role.STAFF,
        query({ filter: AppointmentFilter.PENDING }),
      );

      expect(argsListe().where).toEqual({ status: AppointmentStatus.PENDING });
    });

    it('« tous » ne filtre rien', async () => {
      await service.findForUser('staff-1', Role.STAFF, query());
      expect(argsListe().where).toEqual({});
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  ORDRE DE LECTURE
  // ═══════════════════════════════════════════════════════════
  describe('ordre', () => {
    it('les vues d’historique commencent par le plus récent', async () => {
      await service.findForUser(
        'staff-1',
        Role.STAFF,
        query({ filter: AppointmentFilter.COMPLETED }),
      );
      expect(argsListe().orderBy).toEqual({ startAt: 'desc' });
    });

    it('les vues de travail suivent l’ordre de passage des clientes', async () => {
      await service.findForUser(
        'staff-1',
        Role.STAFF,
        query({ filter: AppointmentFilter.TODAY }),
      );
      expect(argsListe().orderBy).toEqual({ startAt: 'asc' });
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  CÔTÉ CLIENTE
  // ═══════════════════════════════════════════════════════════
  describe('liste de la cliente', () => {
    it('ne renvoie que ses rendez-vous, paginés', async () => {
      await service.findForUser('cliente-1', Role.CLIENT, query({ limit: 50 }));

      expect(argsListe().where).toEqual({ userId: 'cliente-1' });
      expect(argsListe().take).toBe(50);
    });

    it('met les plus récents en premier', async () => {
      // En ordre croissant, la première page ne contiendrait que ses plus
      // VIEUX rendez-vous — le contraire de ce qu'elle vient consulter.
      await service.findForUser('cliente-1', Role.CLIENT, query());
      expect(argsListe().orderBy).toEqual({ startAt: 'desc' });
    });

    it('ne calcule pas les compteurs du comptoir', async () => {
      const res: any = await service.findForUser(
        'cliente-1',
        Role.CLIENT,
        query(),
      );
      expect(res.counts).toBeUndefined();
      expect(prisma.appointment.groupBy).not.toHaveBeenCalled();
    });
  });
});
