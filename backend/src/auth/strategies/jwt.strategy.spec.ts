import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, User } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';

// La dernière porte d'entrée du compte anonymisé.
//
// `deleteAccount` détruit bien les refresh tokens, mais PAS l'access token déjà
// émis et en circulation — un JWT ne se rappelle pas, il expire. Sans le
// contrôle vérifié ici, le téléphone d'une cliente qui vient de supprimer son
// compte continuerait de le consulter jusqu'à expiration du jeton court.

describe('JwtStrategy — validation du porteur', () => {
  let strategy: JwtStrategy;
  let usersService: { findById: jest.Mock };

  const payload = { sub: 'cliente-1', email: 'c@exemple.test', role: 'CLIENT' };

  const utilisateur = (over: Partial<User> = {}): User => ({
    id: 'cliente-1',
    email: 'c@exemple.test',
    phone: null,
    passwordHash: 'hash',
    role: Role.CLIENT,
    firstName: 'Fati',
    lastName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerifiedAt: null,
    deletedAt: null,
    ...over,
  });

  beforeEach(() => {
    usersService = { findById: jest.fn() };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('secret-de-test'),
    } as unknown as ConfigService;
    strategy = new JwtStrategy(config, usersService as unknown as UsersService);
  });

  it('laisse passer un compte actif', async () => {
    usersService.findById.mockResolvedValue(utilisateur());

    await expect(strategy.validate(payload)).resolves.toEqual({
      id: 'cliente-1',
      email: 'c@exemple.test',
      role: Role.CLIENT,
    });
  });

  it('refuse un compte inexistant', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuse un compte anonymisé, même avec un jeton encore valide', async () => {
    usersService.findById.mockResolvedValue(
      utilisateur({ deletedAt: new Date('2026-08-11') }),
    );

    // Le jeton est signé, non expiré, et pointe vers une ligne qui existe.
    // C'est `deletedAt` — et lui seul — qui referme la porte.
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
