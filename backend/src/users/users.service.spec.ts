import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService — changePassword (révocation des sessions)', () => {
  let service: UsersService;
  let prisma: any;

  const USER_ID = 'cliente-1';
  const ANCIEN = 'ancien-mot-de-passe';

  beforeEach(async () => {
    const passwordHash = await argon2.hash(ANCIEN);

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: USER_ID, passwordHash }),
        update: jest.fn(),
      },
      refreshToken: { updateMany: jest.fn() },
      // Transaction en tableau : on exécute simplement les opérations reçues.
      $transaction: jest.fn(async (ops: unknown[]) => ops),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  // Le cœur du correctif : sans cette révocation, une session volée
  // survivait au changement de mot de passe.
  it('révoque tous les refresh tokens actifs de l’utilisateur', async () => {
    await service.changePassword(USER_ID, {
      currentPassword: ANCIEN,
      newPassword: 'un-nouveau-mot-de-passe',
    });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('écrit le nouveau hash et la révocation dans une seule transaction', async () => {
    await service.changePassword(USER_ID, {
      currentPassword: ANCIEN,
      newPassword: 'un-nouveau-mot-de-passe',
    });

    // Une seule transaction, contenant les deux opérations : impossible
    // de changer le mot de passe sans révoquer, ou l'inverse.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('ne touche à rien si le mot de passe actuel est faux', async () => {
    await expect(
      service.changePassword(USER_ID, {
        currentPassword: 'mauvais',
        newPassword: 'un-nouveau-mot-de-passe',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('remplace bien le hash (le nouveau mot de passe vérifie, l’ancien non)', async () => {
    await service.changePassword(USER_ID, {
      currentPassword: ANCIEN,
      newPassword: 'un-nouveau-mot-de-passe',
    });

    const nouveauHash = prisma.user.update.mock.calls[0][0].data.passwordHash;
    await expect(argon2.verify(nouveauHash, 'un-nouveau-mot-de-passe')).resolves.toBe(true);
    await expect(argon2.verify(nouveauHash, ANCIEN)).resolves.toBe(false);
  });
});
