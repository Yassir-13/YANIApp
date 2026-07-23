import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Doit être strictement le même secret que celui de la signature
      // (auth.module). Une valeur de repli en dur rendrait les tokens forgeables.
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Appelé automatiquement après vérification de la signature du token
  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    // Ce qui est retourné ici sera injecté dans request.user
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}