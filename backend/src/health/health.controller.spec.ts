import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('renvoie ok quand la base répond', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(typeof result.uptime).toBe('number');
  });

  it('renvoie 503 quand la base est injoignable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  // La route est publique : elle ne doit rien dire de l'infrastructure.
  it("ne divulgue aucun détail de l'erreur base", async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.5:5432 user=yani password=secret'),
    );

    try {
      await controller.check();
      fail('aurait dû lever une exception');
    } catch (e: any) {
      const body = JSON.stringify(e.getResponse());
      expect(body).not.toContain('5432');
      expect(body).not.toContain('secret');
      expect(body).not.toContain('ECONNREFUSED');
    }
  });
});
