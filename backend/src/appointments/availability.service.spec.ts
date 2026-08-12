import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

/**
 * Règles de réservation : capacité des cabines, horaires d'ouverture et
 * conversion de fuseau. Ce sont les règles qui décident si deux clientes
 * peuvent se retrouver au même moment, ou si un rendez-vous tombe à la
 * mauvaise heure.
 */
describe('AppointmentsService — disponibilité des créneaux', () => {
  let service: AppointmentsService;
  let prisma: any;

  const SERVICE = {
    id: 'service-1',
    name: 'Brushing',
    durationMin: 60,
    price: new Prisma.Decimal(200),
    active: true,
  };

  // Un mercredi (jour 3), largement dans le futur pour ne jamais être « passé ».
  const JOUR = '2099-01-07';
  // 14:00 heure locale de Casablanca (UTC+1 hors Ramadan) = 13:00 UTC.
  const A_14H_LOCAL = new Date('2099-01-07T13:00:00.000Z');

  const rdvExistant = (startAtUtc: string, durationMin = 60) => ({
    id: `rdv-${startAtUtc}`,
    startAt: new Date(startAtUtc),
    status: AppointmentStatus.CONFIRMED,
    service: { durationMin },
  });

  beforeEach(async () => {
    prisma = {
      service: {
        findUnique: jest.fn().mockResolvedValue({ ...SERVICE }),
        // Borne basse de la recherche de chevauchement : la plus longue
        // prestation du catalogue (I5). Ici tout dure 60 minutes.
        aggregate: jest.fn().mockResolvedValue({ _max: { durationMin: 60 } }),
      },
      openingHours: {
        findUnique: jest.fn().mockResolvedValue({
          dayOfWeek: 3,
          openTime: '09:00',
          closeTime: '19:00',
          isClosed: false,
        }),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: any) => ({ id: 'rdv-neuf', ...data })),
        findUnique: jest.fn(),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'cliente-1' }) },
      // Réserver se fait sous verrou, dans une transaction : vérification de
      // capacité et insertion partagent le même client. Ici le mock joue les
      // deux rôles, les assertions portent donc toujours sur `prisma`.
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LoyaltyService, useValue: { earnFromAppointment: jest.fn() } },
        { provide: ConfigService, useValue: { get: () => 'Africa/Casablanca' } },
      ],
    }).compile();

    service = module.get(AppointmentsService);
  });

  const reserver = () =>
    service.create('cliente-1', {
      serviceId: 'service-1',
      startAt: A_14H_LOCAL.toISOString(),
    });

  // ═══════════════════════════════════════════════════════════
  //  CAPACITÉ : 2 cabines
  // ═══════════════════════════════════════════════════════════
  describe('capacité des cabines', () => {
    it('accepte une réservation quand le centre est vide', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);
      await expect(reserver()).resolves.toBeDefined();
    });

    it('accepte une 2ᵉ réservation sur le même créneau', async () => {
      prisma.appointment.findMany.mockResolvedValue([rdvExistant('2099-01-07T13:00:00.000Z')]);
      await expect(reserver()).resolves.toBeDefined();
    });

    // La règle qui évite deux clientes sans cabine libre.
    it('refuse la 3ᵉ réservation : les 2 cabines sont prises', async () => {
      prisma.appointment.findMany.mockResolvedValue([
        rdvExistant('2099-01-07T13:00:00.000Z'),
        rdvExistant('2099-01-07T13:00:00.000Z'),
      ]);
      await expect(reserver()).rejects.toThrow(/complet/);
    });

    // Le chevauchement se calcule sur des intervalles, pas sur l'heure de début :
    // deux RDV qui commencent à des heures différentes peuvent se recouvrir.
    it('compte les RDV qui CHEVAUCHENT, même à des heures de début différentes', async () => {
      prisma.appointment.findMany.mockResolvedValue([
        rdvExistant('2099-01-07T12:30:00.000Z'), // 13h30-14h30 local → chevauche
        rdvExistant('2099-01-07T13:30:00.000Z'), // 14h30-15h30 local → chevauche
      ]);
      await expect(reserver()).rejects.toThrow(/complet/);
    });

    it('ignore un RDV qui se termine pile au début du nouveau', async () => {
      prisma.appointment.findMany.mockResolvedValue([
        rdvExistant('2099-01-07T12:00:00.000Z'), // finit exactement à 13:00 UTC
        rdvExistant('2099-01-07T12:00:00.000Z'),
      ]);
      await expect(reserver()).resolves.toBeDefined();
    });

    it('ignore les RDV annulés dans le calcul de capacité', async () => {
      // Le filtre est fait par la requête Prisma : on vérifie qu'elle ne
      // demande QUE les statuts actifs.
      await reserver();
      const where = prisma.appointment.findMany.mock.calls[0][0].where;
      expect(where.status.in).toEqual([
        AppointmentStatus.PENDING,
        AppointmentStatus.CONFIRMED,
      ]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  BORNE BASSE DE LA RECHERCHE DE CHEVAUCHEMENT (I5)
  // ═══════════════════════════════════════════════════════════
  //
  // Sans borne basse, chaque réservation relisait tous les rendez-vous encore
  // actifs depuis l'ouverture — et cette lecture se fait à l'intérieur du
  // verrou de réservation, donc elle faisait patienter les autres clientes.
  describe('borne basse de la recherche de chevauchement', () => {
    it('ne remonte pas plus loin que la plus longue prestation', async () => {
      await reserver();

      const where = prisma.appointment.findMany.mock.calls[0][0].where;
      // 60 minutes avant le créneau : au-delà, aucun rendez-vous ne peut
      // encore être en cours.
      expect(where.startAt.gt).toEqual(
        new Date(A_14H_LOCAL.getTime() - 60 * 60_000),
      );
      // La borne haute n'a pas bougé : la fin du créneau demandé.
      expect(where.startAt.lt).toEqual(
        new Date(A_14H_LOCAL.getTime() + 60 * 60_000),
      );
    });

    it('suit la plus longue prestation, pas celle qu’on réserve', async () => {
      // Le jour où Fati crée un soin de 4 heures, la fenêtre doit s'élargir
      // d'elle-même. Une constante figée dans le code, elle, resterait à 1 h.
      prisma.service.aggregate.mockResolvedValue({
        _max: { durationMin: 240 },
      });

      await reserver();

      const where = prisma.appointment.findMany.mock.calls[0][0].where;
      expect(where.startAt.gt).toEqual(
        new Date(A_14H_LOCAL.getTime() - 240 * 60_000),
      );
    });

    it('ne masque pas un long rendez-vous commencé bien avant', async () => {
      // Le vrai risque d'une borne trop courte : rater une occupation réelle,
      // donc accepter deux clientes sur la même cabine. Ici deux soins de 4 h
      // commencés à 10h UTC courent encore à 13h.
      prisma.service.aggregate.mockResolvedValue({
        _max: { durationMin: 240 },
      });
      prisma.appointment.findMany.mockResolvedValue([
        rdvExistant('2099-01-07T10:00:00.000Z', 240),
        rdvExistant('2099-01-07T10:00:00.000Z', 240),
      ]);

      await expect(reserver()).rejects.toThrow(/complet/);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  HORAIRES D'OUVERTURE
  // ═══════════════════════════════════════════════════════════
  describe("horaires d'ouverture", () => {
    it('refuse un jour de fermeture', async () => {
      prisma.openingHours.findUnique.mockResolvedValue({
        dayOfWeek: 3,
        openTime: '09:00',
        closeTime: '19:00',
        isClosed: true,
      });
      await expect(reserver()).rejects.toThrow(/fermé/);
    });

    it('refuse un jour non configuré', async () => {
      prisma.openingHours.findUnique.mockResolvedValue(null);
      await expect(reserver()).rejects.toThrow(/fermé/);
    });

    // Le RDV commence dans les horaires mais déborde après la fermeture :
    // sans ce contrôle, une cliente resterait seule dans un centre fermé.
    it('refuse un créneau qui déborde après la fermeture', async () => {
      prisma.openingHours.findUnique.mockResolvedValue({
        dayOfWeek: 3,
        openTime: '09:00',
        closeTime: '14:30', // 14:00 + 60 min = 15:00 > 14:30
        isClosed: false,
      });
      await expect(reserver()).rejects.toThrow(/compris entre/);
    });

    it("refuse un créneau avant l'ouverture", async () => {
      prisma.openingHours.findUnique.mockResolvedValue({
        dayOfWeek: 3,
        openTime: '15:00',
        closeTime: '19:00',
        isClosed: false,
      });
      await expect(reserver()).rejects.toThrow(/compris entre/);
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  GARDE-FOUS
  // ═══════════════════════════════════════════════════════════
  describe('garde-fous', () => {
    it('refuse de réserver dans le passé', async () => {
      await expect(
        service.create('cliente-1', {
          serviceId: 'service-1',
          startAt: '2020-01-01T10:00:00.000Z',
        }),
      ).rejects.toThrow(/passé/);
    });

    it('refuse une prestation désactivée', async () => {
      prisma.service.findUnique.mockResolvedValue({ ...SERVICE, active: false });
      await expect(reserver()).rejects.toBeInstanceOf(NotFoundException);
    });

    // Le prix est figé à la réservation : un changement de tarif ultérieur
    // ne doit pas modifier ce que la cliente paiera.
    it('fige le prix de la prestation au moment de la réservation', async () => {
      await reserver();
      const data = prisma.appointment.create.mock.calls[0][0].data;
      expect(data.priceAtBooking.toString()).toBe('200');
    });

    it('fige aussi le prix pour un RDV créé par le staff', async () => {
      await service.createForClient('cliente-2', {
        serviceId: 'service-1',
        startAt: A_14H_LOCAL.toISOString(),
      });
      const data = prisma.appointment.create.mock.calls[0][0].data;
      expect(data.priceAtBooking.toString()).toBe('200');
      expect(data.userId).toBe('cliente-2');
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  FUSEAU HORAIRE — le bug du Ramadan
  // ═══════════════════════════════════════════════════════════
  describe('conversion de fuseau horaire', () => {
    // Le Maroc bascule à UTC+0 pendant le Ramadan, puis revient à UTC+1.
    // Un décalage codé en dur donnait des rendez-vous une heure à côté.
    it('génère des créneaux corrects hors Ramadan (UTC+1)', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);
      const res = await service.getAvailability('service-1', '2099-01-07');

      const neufHeures = res.slots.find((s) => s.time === '09:00');
      expect(neufHeures).toBeDefined();
      // 09:00 à Casablanca en janvier = 08:00 UTC
      expect(neufHeures!.startAt).toBe('2099-01-07T08:00:00.000Z');
    });

    it('chaque créneau porte son instant UTC exact', async () => {
      const res = await service.getAvailability('service-1', '2099-01-07');
      // Le client ne doit avoir aucun calcul de fuseau à refaire.
      for (const slot of res.slots) {
        expect(slot.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });

    it('signale un jour fermé sans proposer de créneau', async () => {
      prisma.openingHours.findUnique.mockResolvedValue({
        dayOfWeek: 3,
        openTime: '09:00',
        closeTime: '19:00',
        isClosed: true,
      });
      const res = await service.getAvailability('service-1', '2099-01-07');
      expect(res.closed).toBe(true);
      expect(res.slots).toEqual([]);
    });

    it('ne propose pas de créneau qui déborderait après la fermeture', async () => {
      const res = await service.getAvailability('service-1', '2099-01-07');
      // Fermeture 19:00, prestation de 60 min → dernier départ possible 18:00
      const heures = res.slots.map((s) => s.time);
      expect(heures).toContain('18:00');
      expect(heures).not.toContain('18:30');
      expect(heures).not.toContain('19:00');
    });
  });
});
