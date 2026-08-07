import { Test, TestingModule } from '@nestjs/testing';
import { Appointment, AppointmentStatus, Prisma } from '@prisma/client';
import { LoyaltyService } from './loyalty.service';
import { PrismaService } from '../prisma/prisma.service';

// Le crédit fidélité d'un RDV doit se baser sur le prix FIGÉ à la réservation
// (priceAtBooking), pas sur le prix courant de la prestation.
describe('LoyaltyService — earnFromAppointment (prix figé)', () => {
  let service: LoyaltyService;
  let prisma: any;

  const account = { id: 'compte-1' };

  // RDV complet : le type Appointment garantit qu'aucun champ ne manque,
  // et que le mock reste aligné si le schéma évolue.
  const appointment = (over: Partial<Appointment> = {}): Appointment => ({
    id: 'rdv-1',
    userId: 'cliente-1',
    serviceId: 'service-1',
    startAt: new Date('2099-01-01T10:00:00.000Z'),
    status: AppointmentStatus.COMPLETED,
    priceAtBooking: new Prisma.Decimal(400),
    createdAt: new Date('2099-01-01T09:00:00.000Z'),
    updatedAt: new Date('2099-01-01T09:00:00.000Z'),
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      service: { findUnique: jest.fn() },
      loyaltyAccount: {
        findUnique: jest.fn().mockResolvedValue(account),
        update: jest.fn().mockResolvedValue(account),
      },
      loyaltyTransaction: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LoyaltyService);
  });

  it('crédite 5% du prix FIGÉ, en ignorant le prix courant du service', async () => {
    // Le tarif a grimpé à 999 depuis la réservation ; il ne doit PAS être lu.
    prisma.service.findUnique.mockResolvedValue({ price: new Prisma.Decimal(999) });

    await service.earnFromAppointment(appointment({ priceAtBooking: new Prisma.Decimal(400) }));

    // 5% de 400 = 20 (et surtout pas 5% de 999 = 50)
    expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pointsDelta: 20 }) }),
    );
    expect(prisma.loyaltyAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pointsBalance: { increment: 20 } }),
      }),
    );
    // Le prix étant figé, on ne va même pas chercher le service.
    expect(prisma.service.findUnique).not.toHaveBeenCalled();
  });

  it('repli sur le prix courant quand priceAtBooking est null (RDV hérités)', async () => {
    prisma.service.findUnique.mockResolvedValue({ price: new Prisma.Decimal(300) });

    await service.earnFromAppointment(appointment({ priceAtBooking: null }));

    // Pas de prix figé -> on lit le service -> 5% de 300 = 15
    expect(prisma.service.findUnique).toHaveBeenCalled();
    expect(prisma.loyaltyTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pointsDelta: 15 }) }),
    );
  });

  it('ne crédite rien si le prix figé arrondit à 0 point', async () => {
    // 5% de 5 = 0.25 -> arrondi 0 -> aucun mouvement
    await service.earnFromAppointment(appointment({ priceAtBooking: new Prisma.Decimal(5) }));

    expect(prisma.loyaltyTransaction.create).not.toHaveBeenCalled();
  });
});
