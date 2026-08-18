import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppointmentStatus, OrderStatus, Prisma, Role } from '@prisma/client';
import { Workbook } from 'exceljs';
import { ExportsService } from './exports.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Export Excel du bilan (clientes, commandes, rendez-vous), réservé à
 * l'administratrice. Ce qui est vérifié ici, c'est ce qu'on ne voit PAS en
 * ouvrant le fichier une fois : les bornes de période dans le fuseau du centre,
 * l'heure affichée, et ce que comptent — ou ne comptent pas — les totaux.
 */
describe('ExportsService', () => {
  let service: ExportsService;
  let prisma: any;

  const decimal = (n: string) => new Prisma.Decimal(n);

  const cliente = {
    firstName: 'Salma',
    lastName: 'Bennani',
    phone: '0600000000',
    email: 'salma@example.ma',
  };

  const commandeTerminee = {
    id: 'o1',
    createdAt: new Date('2026-08-05T14:30:00Z'),
    status: OrderStatus.COMPLETED,
    fulfillment: 'PICKUP',
    total: decimal('120.00'),
    user: cliente,
    items: [
      {
        quantity: 2,
        unitPrice: decimal('60.00'),
        productId: 'p1',
        product: { name: 'Sérum éclat', category: { name: 'Visage' } },
      },
    ],
  };

  const commandeAnnulee = {
    ...commandeTerminee,
    id: 'o2',
    status: OrderStatus.CANCELLED,
    total: decimal('80.00'),
    items: [
      {
        quantity: 1,
        unitPrice: decimal('80.00'),
        productId: 'p2',
        product: { name: 'Huile d’argan', category: { name: 'Corps' } },
      },
    ],
  };

  const service1 = {
    name: 'Soin visage',
    durationMin: 60,
    price: decimal('300.00'),
    category: { name: 'Visage' },
  };

  const rdvTermine = {
    id: 'a1',
    serviceId: 's1',
    // 9 h UTC = 10 h à Casablanca : c'est l'heure du rendez-vous pour l'institut.
    startAt: new Date('2026-08-18T09:00:00Z'),
    status: AppointmentStatus.COMPLETED,
    priceAtBooking: decimal('250.00'),
    service: service1,
    user: cliente,
  };

  const rdvAnnule = {
    ...rdvTermine,
    id: 'a2',
    status: AppointmentStatus.CANCELLED,
    priceAtBooking: decimal('250.00'),
  };

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn().mockResolvedValue([]) },
      order: { findMany: jest.fn().mockResolvedValue([]) },
      orderItem: { findMany: jest.fn().mockResolvedValue([]) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: () => 'Africa/Casablanca' },
        },
      ],
    }).compile();

    service = module.get(ExportsService);
  });

  // Relit le fichier produit : c'est ce que Fati ouvrira, pas un objet interne.
  const relire = async (buffer: Buffer) => {
    const wb = new Workbook();
    await wb.xlsx.load(buffer as any);
    return wb;
  };

  // Valeur de la deuxième colonne de la ligne de total dont le libellé commence
  // par `debut` (les libellés portent des compteurs : « (2) »).
  const total = (wb: Workbook, feuille: string, debut: string) => {
    const ws = wb.getWorksheet(feuille)!;
    let valeur: unknown;
    ws.eachRow((row) => {
      const label = row.getCell(1).value;
      if (typeof label === 'string' && label.startsWith(debut)) {
        valeur = row.getCell(2).value;
      }
    });
    return valeur;
  };

  describe('période', () => {
    it('borne la période sur les journées DU CENTRE, pas sur UTC', async () => {
      await service.orders({ from: '2026-08-01', to: '2026-08-31' });

      // Casablanca est à UTC+1 : le 1er août commence à 23 h UTC la veille, et
      // le 31 août se termine à 22h59 UTC. Sans cette conversion, la commande
      // du 31 août à 23 h tomberait dans le bilan de septembre.
      const { createdAt } = prisma.order.findMany.mock.calls[0][0].where;
      expect(createdAt.gte.toISOString()).toBe('2026-07-31T23:00:00.000Z');
      expect(createdAt.lte.toISOString()).toBe('2026-08-31T22:59:59.999Z');
    });

    it('sans période, ne restreint rien', async () => {
      await service.orders({});
      expect(prisma.order.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('filtre les rendez-vous sur le JOUR DE LA PRESTATION', async () => {
      await service.appointments({ from: '2026-08-01' });

      // …et non sur la date de réservation : un rendez-vous d'août pris en
      // juillet appartient au bilan d'août.
      const { where } = prisma.appointment.findMany.mock.calls[0][0];
      expect(where.startAt).toBeDefined();
      expect(where.createdAt).toBeUndefined();
    });

    it('nomme le fichier avec la période demandée', async () => {
      const { filename } = await service.orders({
        from: '2026-08-01',
        to: '2026-08-31',
      });
      expect(filename).toBe('commandes_2026-08-01_2026-08-31.xlsx');
    });
  });

  describe('heures affichées', () => {
    it("écrit l'heure de l'institut, pas l'heure UTC", async () => {
      prisma.appointment.findMany.mockResolvedValue([rdvTermine]);

      const wb = await relire((await service.appointments({})).buffer);
      const cellule = wb.getWorksheet('Rendez-vous')!.getRow(5).getCell(1)
        .value as Date;

      // Excel ignore les fuseaux : la cellule doit porter 10:00, l'heure à
      // laquelle la cliente était attendue — pas le 09:00 stocké en base.
      expect(cellule.toISOString()).toBe('2026-08-18T10:00:00.000Z');
    });
  });

  describe('totaux', () => {
    it('ne compte comme encaissé que les commandes terminées', async () => {
      prisma.order.findMany.mockResolvedValue([
        commandeTerminee,
        commandeAnnulee,
      ]);

      const wb = await relire((await service.orders({})).buffer);

      expect(total(wb, 'Commandes', 'Montant cumulé')).toBe(200);
      expect(total(wb, 'Commandes', 'Encaissé')).toBe(120);
      expect(total(wb, 'Commandes', 'Perdu')).toBe(80);
    });

    it('ne compte comme encaissés que les rendez-vous terminés', async () => {
      prisma.appointment.findMany.mockResolvedValue([rdvTermine, rdvAnnule]);

      const wb = await relire((await service.appointments({})).buffer);

      expect(total(wb, 'Rendez-vous', 'Encaissé')).toBe(250);
      expect(total(wb, 'Rendez-vous', 'Perdu')).toBe(250);
    });

    it('facture le prix annoncé à la réservation, pas le tarif du jour', async () => {
      // Le tarif du soin est passé à 300 dh ; cette cliente a réservé à 250.
      prisma.appointment.findMany.mockResolvedValue([rdvTermine]);

      const wb = await relire((await service.appointments({})).buffer);
      expect(wb.getWorksheet('Rendez-vous')!.getRow(5).getCell(8).value).toBe(
        250,
      );
    });
  });

  describe('feuilles de synthèse', () => {
    it('ne compte comme vendus que les produits des commandes terminées', async () => {
      // La première feuille montre les commandes annulées…
      await service.orders({ status: OrderStatus.CANCELLED });

      // …mais « Produits vendus » reste calculée sur les commandes terminées :
      // une commande annulée n'a rien vendu.
      const { where } = prisma.orderItem.findMany.mock.calls[0][0];
      expect(where.order.status).toBe(OrderStatus.COMPLETED);
    });

    it('cumule les quantités et le chiffre d’affaires par produit', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        commandeTerminee.items[0],
        { ...commandeTerminee.items[0], quantity: 1 },
      ]);

      const wb = await relire((await service.orders({})).buffer);
      const ligne = wb.getWorksheet('Produits vendus')!.getRow(5);

      expect(ligne.getCell(1).value).toBe('Sérum éclat');
      expect(ligne.getCell(3).value).toBe(3);
      expect(ligne.getCell(4).value).toBe(180);
    });

    it('ne compte comme réalisés que les rendez-vous terminés', async () => {
      await service.appointments({ status: AppointmentStatus.PENDING });

      const { where } = prisma.appointment.findMany.mock.calls[1][0];
      expect(where.status).toBe(AppointmentStatus.COMPLETED);
    });
  });

  describe('clientes', () => {
    it('laisse de côté les comptes supprimés', async () => {
      await service.users({});

      // Ce sont des coquilles anonymisées : ni nom, ni téléphone, et une
      // adresse en @compte-supprime.invalid.
      expect(prisma.user.findMany.mock.calls[0][0].where.deletedAt).toBeNull();
    });

    it('traduit le rôle et l’état de vérification', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          ...cliente,
          role: Role.CLIENT,
          createdAt: new Date('2026-08-05T14:30:00Z'),
          emailVerifiedAt: null,
        },
      ]);

      const wb = await relire((await service.users({})).buffer);
      const ligne = wb.getWorksheet('Clientes')!.getRow(5);

      expect(ligne.getCell(5).value).toBe('Cliente');
      expect(ligne.getCell(7).value).toBe('Non');
    });
  });
});
