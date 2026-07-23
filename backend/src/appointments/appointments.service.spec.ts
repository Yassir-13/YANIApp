import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppointmentStatus, Role } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';

describe('AppointmentsService — machine à états', () => {
  let service: AppointmentsService;
  let prisma: any;
  let tx: any;
  let loyalty: { earnFromAppointment: jest.Mock };

  const rdv = (status: AppointmentStatus) => ({
    id: 'rdv-1',
    userId: 'cliente-1',
    serviceId: 'service-1',
    status,
    startAt: new Date('2099-01-01T10:00:00.000Z'),
  });

  beforeEach(async () => {
    tx = {
      appointment: {
        update: jest.fn(async ({ data }: any) => ({ ...rdv(data.status) })),
      },
    };

    prisma = {
      appointment: {
        findUnique: jest.fn(),
        update: jest.fn(async ({ data }: any) => ({ ...rdv(data.status) })),
      },
      // Transaction interactive : on se contente d'exécuter le callback
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    loyalty = { earnFromAppointment: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LoyaltyService, useValue: loyalty },
        { provide: ConfigService, useValue: { get: () => 'Africa/Casablanca' } },
      ],
    }).compile();

    service = module.get(AppointmentsService);
  });

  describe('updateStatus', () => {
    // ── Le bug d'origine : des points offerts pour une prestation annulée ──
    it("refuse d'un RDV annulé vers terminé, sans créditer de points", async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        rdv(AppointmentStatus.CANCELLED),
      );

      await expect(
        service.updateStatus('rdv-1', AppointmentStatus.COMPLETED),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(loyalty.earnFromAppointment).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuse de sortir de terminé (état final)', async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        rdv(AppointmentStatus.COMPLETED),
      );

      await expect(
        service.updateStatus('rdv-1', AppointmentStatus.PENDING),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuse de passer directement de en attente à terminé', async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        rdv(AppointmentStatus.PENDING),
      );

      await expect(
        service.updateStatus('rdv-1', AppointmentStatus.COMPLETED),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(loyalty.earnFromAppointment).not.toHaveBeenCalled();
    });

    it('accepte confirmé → terminé et crédite les points dans la transaction', async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        rdv(AppointmentStatus.CONFIRMED),
      );

      const updated = await service.updateStatus(
        'rdv-1',
        AppointmentStatus.COMPLETED,
      );

      expect(updated.status).toBe(AppointmentStatus.COMPLETED);
      expect(loyalty.earnFromAppointment).toHaveBeenCalledTimes(1);
      // Le crédit reçoit bien le client de transaction : statut et points
      // sont écrits ensemble, ou pas du tout.
      expect(loyalty.earnFromAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ status: AppointmentStatus.COMPLETED }),
        tx,
      );
    });

    it('accepte en attente → confirmé sans créditer de points', async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        rdv(AppointmentStatus.PENDING),
      );

      await service.updateStatus('rdv-1', AppointmentStatus.CONFIRMED);

      expect(loyalty.earnFromAppointment).not.toHaveBeenCalled();
    });

    // Si le crédit échoue, la transaction remonte l'erreur : le statut
    // ne peut pas rester enregistré seul.
    it('propage un échec du crédit fidélité', async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        rdv(AppointmentStatus.CONFIRMED),
      );
      loyalty.earnFromAppointment.mockRejectedValue(new Error('doublon'));

      await expect(
        service.updateStatus('rdv-1', AppointmentStatus.COMPLETED),
      ).rejects.toThrow('doublon');
    });
  });

  describe('cancel', () => {
    it("refuse d'annuler un RDV déjà terminé", async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        rdv(AppointmentStatus.COMPLETED),
      );

      await expect(
        service.cancel('rdv-1', 'cliente-1', Role.CLIENT),
      ).rejects.toThrow(/ne peut plus être annulé/);

      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('signale un RDV déjà annulé', async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        rdv(AppointmentStatus.CANCELLED),
      );

      await expect(
        service.cancel('rdv-1', 'cliente-1', Role.CLIENT),
      ).rejects.toThrow(/déjà annulé/);
    });

    it('accepte une annulation depuis confirmé', async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        rdv(AppointmentStatus.CONFIRMED),
      );

      const result = await service.cancel('rdv-1', 'cliente-1', Role.CLIENT);

      expect(result.status).toBe(AppointmentStatus.CANCELLED);
    });
  });

  describe('reschedule', () => {
    it('refuse de reprogrammer un RDV annulé', async () => {
      prisma.appointment.findUnique.mockResolvedValue(
        rdv(AppointmentStatus.CANCELLED),
      );

      await expect(
        service.reschedule('rdv-1', '2099-01-02T10:00:00.000Z'),
      ).rejects.toThrow(/ne peut pas être reprogrammé/);
    });
  });
});
