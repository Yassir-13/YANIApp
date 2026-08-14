import { BadRequestException } from '@nestjs/common';
import { OpeningHoursService } from './opening-hours.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Les plages d'ouverture d'un même jour ne doivent pas se chevaucher, et
 * chacune doit se tenir. Aucune contrainte SQL ne sait l'exprimer sans
 * extension : c'est ce service, et lui seul, qui tient la règle — d'où ces
 * tests.
 */
describe('OpeningHoursService — plages et fermetures', () => {
  let service: OpeningHoursService;
  let prisma: any;

  const plage = (startTime: string, endTime: string) => ({ startTime, endTime });

  beforeEach(() => {
    prisma = {
      openingHours: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      closure: {
        create: jest.fn(async ({ data }: any) => ({ id: 'fermeture-1', ...data })),
        findUnique: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };

    service = new OpeningHoursService(prisma as unknown as PrismaService);
  });

  const enregistrer = (ranges: { startTime: string; endTime: string }[]) =>
    service.setForDay({ dayOfWeek: 3, ranges });

  // ═══════════════════════════════════════════════════════════
  //  COHÉRENCE DES PLAGES
  // ═══════════════════════════════════════════════════════════
  describe('cohérence', () => {
    it('accepte une matinée et une après-midi séparées par une pause', async () => {
      await expect(
        enregistrer([plage('09:00', '13:00'), plage('14:00', '18:00')]),
      ).resolves.toBeDefined();
    });

    it('accepte deux plages contiguës', async () => {
      // 13:00–14:00 ne chevauche pas 14:00–18:00 : la fin est exclusive.
      await expect(
        enregistrer([plage('09:00', '14:00'), plage('14:00', '18:00')]),
      ).resolves.toBeDefined();
    });

    it('refuse une plage dont le début ne précède pas la fin', async () => {
      await expect(enregistrer([plage('18:00', '09:00')])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuse une plage de durée nulle', async () => {
      await expect(enregistrer([plage('09:00', '09:00')])).rejects.toThrow(
        /doit précéder/,
      );
    });

    // Sans ce contrôle, le moteur de créneaux proposerait deux fois la même
    // heure — une pour chaque plage qui la contient.
    it('refuse deux plages qui se chevauchent', async () => {
      await expect(
        enregistrer([plage('09:00', '14:00'), plage('13:00', '18:00')]),
      ).rejects.toThrow(/chevauchent/);
    });

    it('détecte le chevauchement même envoyé dans le désordre', async () => {
      await expect(
        enregistrer([plage('13:00', '18:00'), plage('09:00', '14:00')]),
      ).rejects.toThrow(/chevauchent/);
    });

    it("n'écrit rien quand les plages sont incohérentes", async () => {
      await expect(
        enregistrer([plage('09:00', '14:00'), plage('13:00', '18:00')]),
      ).rejects.toThrow();
      // Le jour existant ne doit pas être effacé pour une requête refusée.
      expect(prisma.openingHours.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  ÉCRITURE
  // ═══════════════════════════════════════════════════════════
  describe('enregistrement', () => {
    it('remplace entièrement le jour', async () => {
      await enregistrer([plage('09:00', '13:00')]);

      expect(prisma.openingHours.deleteMany).toHaveBeenCalledWith({
        where: { dayOfWeek: 3 },
      });
      expect(prisma.openingHours.createMany).toHaveBeenCalledWith({
        data: [{ dayOfWeek: 3, startTime: '09:00', endTime: '13:00' }],
      });
    });

    it('trie les plages avant de les écrire', async () => {
      await enregistrer([plage('14:00', '18:00'), plage('09:00', '13:00')]);

      const { data } = prisma.openingHours.createMany.mock.calls[0][0];
      expect(data.map((r: any) => r.startTime)).toEqual(['09:00', '14:00']);
    });

    // Une liste vide ferme le jour : c'est ce qui a remplacé l'ancien booléen
    // `isClosed`, qu'il fallait interpréter à chaque lecture.
    it('ferme le jour quand la liste est vide', async () => {
      await enregistrer([]);

      expect(prisma.openingHours.deleteMany).toHaveBeenCalledWith({
        where: { dayOfWeek: 3 },
      });
      expect(prisma.openingHours.createMany).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  FERMETURES EXCEPTIONNELLES
  // ═══════════════════════════════════════════════════════════
  describe('fermetures exceptionnelles', () => {
    it('accepte une fermeture d’un seul jour', async () => {
      await expect(
        service.createClosure({ startDate: '2026-12-25', endDate: '2026-12-25' }),
      ).resolves.toBeDefined();
    });

    it('accepte une période de congés', async () => {
      await expect(
        service.createClosure({
          startDate: '2026-08-20',
          endDate: '2026-08-27',
          reason: 'Congés annuels',
        }),
      ).resolves.toBeDefined();
    });

    // Bornes inversées : la fermeture ne couvrirait aucun jour et passerait
    // inaperçue jusqu'au moment où l'institut resterait réservable.
    it('refuse une fin antérieure au début', async () => {
      await expect(
        service.createClosure({ startDate: '2026-08-27', endDate: '2026-08-20' }),
      ).rejects.toThrow(/doit précéder/);
      expect(prisma.closure.create).not.toHaveBeenCalled();
    });

    it('refuse de supprimer une fermeture inexistante', async () => {
      prisma.closure.findUnique.mockResolvedValue(null);
      await expect(service.deleteClosure('inconnue')).rejects.toThrow(
        /introuvable/,
      );
      expect(prisma.closure.delete).not.toHaveBeenCalled();
    });
  });
});
