import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { SettingsService } from '../settings/settings.service';

/**
 * Règles de réservation : occupation d'un créneau, capacité des salles, plages
 * d'ouverture, fermetures exceptionnelles et conversion de fuseau. Ce sont les
 * règles qui décident si deux clientes peuvent se retrouver au même moment, ou
 * si un rendez-vous tombe à la mauvaise heure.
 *
 * ⚠️ LA règle à ne pas perdre de vue en lisant ce fichier : un rendez-vous
 * occupe UN CRÉNEAU, jamais la durée de sa prestation. Le centre espace ses
 * rendez-vous d'un écart fixe — choix de gestion, pas contrainte technique.
 * C'est pourquoi la prestation de référence ci-dessous dure 240 minutes alors
 * que l'écart en vaut 60 : si un test se met à dépendre de ces 240 minutes,
 * c'est que le moteur s'est remis à lire la durée.
 */
describe('AppointmentsService — disponibilité des créneaux', () => {
  let service: AppointmentsService;
  let prisma: any;

  // 240 minutes face à un écart de 60 : l'écart de valeur est le test.
  const SERVICE = {
    id: 'service-1',
    name: 'Pose complète',
    durationMin: 240,
    price: new Prisma.Decimal(200),
    active: true,
  };

  // Un mercredi (jour 3), largement dans le futur pour ne jamais être « passé ».
  const JOUR = '2099-01-07';
  // 14:00 heure locale de Casablanca (UTC+1 hors Ramadan) = 13:00 UTC.
  const A_14H_LOCAL = new Date('2099-01-07T13:00:00.000Z');

  // Plus de prestation attachée : seule l'heure de début compte désormais.
  const rdvExistant = (startAtUtc: string) => ({
    id: `rdv-${startAtUtc}`,
    startAt: new Date(startAtUtc),
    status: AppointmentStatus.CONFIRMED,
  });

  beforeEach(async () => {
    prisma = {
      service: {
        findUnique: jest.fn().mockResolvedValue({ ...SERVICE }),
      },
      // Une seule plage 09:00–19:00 par défaut : les tests qui portent sur la
      // pause déjeuner redéfinissent cette liste.
      openingHours: {
        findMany: jest.fn().mockResolvedValue([
          { dayOfWeek: 3, startTime: '09:00', endTime: '19:00' },
        ]),
      },
      // Aucune fermeture exceptionnelle par défaut.
      closure: { findFirst: jest.fn().mockResolvedValue(null) },
      centerSettings: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          capacity: 2,
          slotIntervalMin: 60,
        }),
        create: jest.fn(),
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
        // Le vrai service : la capacité et l'écart entre créneaux se lisent
        // désormais en base, et c'est cette lecture qu'on veut exercer.
        { provide: SettingsService, useValue: new SettingsService(prisma) },
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
  //  OCCUPATION : UN CRÉNEAU, JAMAIS LA DURÉE DE LA PRESTATION
  // ═══════════════════════════════════════════════════════════
  //
  // La règle de gestion du centre, et le cœur de ce fichier. Auparavant une
  // prestation d'1h25 réservée à 10h occupait jusqu'à 11h25 et interdisait le
  // créneau de 11h. Le centre veut précisément pouvoir le donner.
  describe('occupation du créneau', () => {
    it("n'occupe qu'un écart, même pour une prestation de 4 heures", async () => {
      // Deux rendez-vous commencés trois heures plus tôt, sur une prestation
      // qui dure 240 minutes. L'ancien calcul les faisait courir jusqu'à 14h
      // UTC et refusait donc 13h. Ils libèrent maintenant la salle à 11h.
      prisma.appointment.findMany.mockResolvedValue([
        rdvExistant('2099-01-07T10:00:00.000Z'),
        rdvExistant('2099-01-07T10:00:00.000Z'),
      ]);

      await expect(reserver()).resolves.toBeDefined();
    });

    it('propose la même grille à une prestation courte et à une longue', async () => {
      prisma.service.findUnique.mockResolvedValue({ ...SERVICE, durationMin: 15 });
      const courte = (
        await service.getAvailability('service-1', '2099-01-07')
      ).slots.map((s) => s.time);

      prisma.service.findUnique.mockResolvedValue({ ...SERVICE, durationMin: 240 });
      const longue = (
        await service.getAvailability('service-1', '2099-01-07')
      ).slots.map((s) => s.time);

      // Identiques : la grille ne trahit plus la durée de la prestation, ce
      // qui est aussi ce qui rend son retrait de l'application complet.
      expect(longue).toEqual(courte);
      expect(courte.length).toBeGreaterThan(0);
    });

    // Sans borne basse, chaque réservation relisait tous les rendez-vous encore
    // actifs depuis l'ouverture — et cette lecture se fait à l'intérieur du
    // verrou de réservation, donc elle faisait patienter les autres clientes.
    it('borne sa recherche à un écart, et non à la plus longue prestation', async () => {
      await reserver();

      const where = prisma.appointment.findMany.mock.calls[0][0].where;
      // 60 minutes, l'écart réglé — et surtout pas les 240 de la prestation.
      expect(where.startAt.gt).toEqual(
        new Date(A_14H_LOCAL.getTime() - 60 * 60_000),
      );
      expect(where.startAt.lt).toEqual(
        new Date(A_14H_LOCAL.getTime() + 60 * 60_000),
      );
    });

    it('suit la borne de l’écart réglé en base', async () => {
      prisma.centerSettings.findUnique.mockResolvedValue({
        id: 1,
        capacity: 2,
        slotIntervalMin: 30,
      });

      await reserver();

      const where = prisma.appointment.findMany.mock.calls[0][0].where;
      expect(where.startAt.gt).toEqual(
        new Date(A_14H_LOCAL.getTime() - 30 * 60_000),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  PLAGES D'OUVERTURE
  // ═══════════════════════════════════════════════════════════
  describe("plages d'ouverture", () => {
    // Un jour sans aucune plage est fermé. C'est ce qui a remplacé l'ancien
    // booléen `isClosed` : il n'y a plus de ligne « fermée » à interpréter.
    it('refuse un jour sans aucune plage', async () => {
      prisma.openingHours.findMany.mockResolvedValue([]);
      await expect(reserver()).rejects.toThrow(/fermé/);
    });

    // Le RDV commence dans les horaires mais déborde après la fermeture :
    // sans ce contrôle, une cliente resterait seule dans un centre fermé.
    it('refuse un créneau qui déborde après la fermeture', async () => {
      prisma.openingHours.findMany.mockResolvedValue([
        { dayOfWeek: 3, startTime: '09:00', endTime: '14:30' }, // 14:00 + 60 min = 15:00
      ]);
      await expect(reserver()).rejects.toThrow(/plage d'ouverture/);
    });

    it("refuse un créneau avant l'ouverture", async () => {
      prisma.openingHours.findMany.mockResolvedValue([
        { dayOfWeek: 3, startTime: '15:00', endTime: '19:00' },
      ]);
      await expect(reserver()).rejects.toThrow(/plage d'ouverture/);
    });

    // Le cœur du modèle à plusieurs plages : 14:00 tombe entre les deux, dans
    // la pause déjeuner. Avec une amplitude continue 09:00–19:00 il passait.
    it('refuse un créneau tombant dans la pause déjeuner', async () => {
      prisma.openingHours.findMany.mockResolvedValue([
        { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 3, startTime: '15:00', endTime: '19:00' },
      ]);
      await expect(reserver()).rejects.toThrow(/plage d'ouverture/);
    });

    // Le rendez-vous doit tenir dans UNE plage, pas dans l'amplitude du jour :
    // à cheval sur la pause, il n'y aurait personne pour le finir.
    it('refuse un créneau à cheval sur deux plages', async () => {
      prisma.openingHours.findMany.mockResolvedValue([
        { dayOfWeek: 3, startTime: '09:00', endTime: '14:30' },
        { dayOfWeek: 3, startTime: '14:30', endTime: '19:00' },
      ]);
      // 14:00 → 15:00 : commence dans la première, finit dans la seconde.
      await expect(reserver()).rejects.toThrow(/plage d'ouverture/);
    });

    it("accepte un créneau qui tient dans la plage de l'après-midi", async () => {
      prisma.openingHours.findMany.mockResolvedValue([
        { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 3, startTime: '14:00', endTime: '19:00' },
      ]);
      await expect(reserver()).resolves.toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  FERMETURES EXCEPTIONNELLES
  // ═══════════════════════════════════════════════════════════
  //
  // Congés et jours fériés. Sans elles, l'institut ne pouvait fermer qu'un jour
  // de la semaine de façon RÉCURRENTE : partir une semaine laissait les
  // clientes réserver.
  describe('fermetures exceptionnelles', () => {
    it('refuse de réserver un jour couvert par une fermeture', async () => {
      prisma.closure.findFirst.mockResolvedValue({ id: 'conges-1' });
      await expect(reserver()).rejects.toThrow(/fermé/);
    });

    it('ne propose aucun créneau un jour de fermeture, même ouvert', async () => {
      prisma.closure.findFirst.mockResolvedValue({ id: 'conges-1' });
      const res = await service.getAvailability('service-1', '2099-01-07');
      expect(res.closed).toBe(true);
      expect(res.slots).toEqual([]);
    });

    // Les bornes sont incluses et comparées comme des chaînes : aucun fuseau
    // ne s'invite dans le calcul, une fermeture est un jour du calendrier.
    it('interroge les fermetures sur le jour local du centre', async () => {
      await service.getAvailability('service-1', '2099-01-07');
      expect(prisma.closure.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            startDate: { lte: '2099-01-07' },
            endDate: { gte: '2099-01-07' },
          },
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  RÉGLAGES LUS EN BASE
  // ═══════════════════════════════════════════════════════════
  //
  // Capacité et écart entre créneaux vivaient en constantes dans ce fichier :
  // ajouter une cabine demandait un redéploiement.
  describe('réglages du centre', () => {
    it('suit la capacité réglée en base, pas une constante', async () => {
      prisma.centerSettings.findUnique.mockResolvedValue({
        id: 1,
        capacity: 3,
        slotIntervalMin: 30,
      });
      // Deux RDV en cours : refusé à 2 cabines, accepté à 3.
      prisma.appointment.findMany.mockResolvedValue([
        rdvExistant('2099-01-07T13:00:00.000Z'),
        rdvExistant('2099-01-07T13:00:00.000Z'),
      ]);
      await expect(reserver()).resolves.toBeDefined();
    });

    it("suit l'écart entre créneaux réglé en base", async () => {
      // Par défaut l'écart vaut 60 : aucune demi-heure n'est proposée.
      const parDefaut = (
        await service.getAvailability('service-1', '2099-01-07')
      ).slots.map((s) => s.time);
      expect(parDefaut).toContain('10:00');
      expect(parDefaut).not.toContain('09:30');

      // Ramené à 30, les demi-heures reviennent — sans qu'aucune prestation
      // n'ait changé.
      prisma.centerSettings.findUnique.mockResolvedValue({
        id: 1,
        capacity: 2,
        slotIntervalMin: 30,
      });
      const resserre = (
        await service.getAvailability('service-1', '2099-01-07')
      ).slots.map((s) => s.time);
      expect(resserre).toContain('09:30');
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
      prisma.openingHours.findMany.mockResolvedValue([]);
      const res = await service.getAvailability('service-1', '2099-01-07');
      expect(res.closed).toBe(true);
      expect(res.slots).toEqual([]);
    });

    it('ne propose pas de créneau qui déborderait après la fermeture', async () => {
      const res = await service.getAvailability('service-1', '2099-01-07');
      // Fermeture 19:00, écart de 60 min → dernier départ possible 18:00
      const heures = res.slots.map((s) => s.time);
      expect(heures).toContain('18:00');
      expect(heures).not.toContain('18:30');
      expect(heures).not.toContain('19:00');
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  GÉNÉRATION DES CRÉNEAUX PLAGE PAR PLAGE
  // ═══════════════════════════════════════════════════════════
  describe('génération sur plusieurs plages', () => {
    const AVEC_PAUSE = [
      { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 3, startTime: '14:00', endTime: '18:00' },
    ];

    it('ne propose aucun créneau pendant la pause déjeuner', async () => {
      prisma.openingHours.findMany.mockResolvedValue(AVEC_PAUSE);
      const heures = (
        await service.getAvailability('service-1', '2099-01-07')
      ).slots.map((s) => s.time);

      expect(heures).toContain('11:00');
      expect(heures).toContain('14:00');
      // 13:00 et 13:30 tombent dans la pause ; 12:30 déborderait dessus.
      expect(heures).not.toContain('12:30');
      expect(heures).not.toContain('13:00');
      expect(heures).not.toContain('13:30');
    });

    // La propriété qui compte : un rendez-vous ne déborde jamais de SA plage.
    // C'est ce que coûtait, en logique d'exclusion, l'approche « une plage
    // trouée » — ici c'est la condition d'arrêt de la boucle qui l'assure.
    it("borne chaque plage par l'écart, non par la durée de la prestation", async () => {
      prisma.openingHours.findMany.mockResolvedValue(AVEC_PAUSE);
      const heures = (
        await service.getAvailability('service-1', '2099-01-07')
      ).slots.map((s) => s.time);

      // Écart de 60 min : dernier départ 12:00 le matin, 17:00 l'après-midi.
      // Avec les 240 minutes de la prestation, la matinée se serait arrêtée
      // à 09:00 et l'après-midi n'aurait rien proposé du tout.
      expect(heures).toContain('12:00');
      expect(heures).toContain('17:00');
      expect(heures).not.toContain('17:30');
    });

    it('rend les créneaux dans l’ordre des heures', async () => {
      prisma.openingHours.findMany.mockResolvedValue(AVEC_PAUSE);
      const heures = (
        await service.getAvailability('service-1', '2099-01-07')
      ).slots.map((s) => s.time);

      expect(heures).toEqual([...heures].sort());
    });
  });
});
