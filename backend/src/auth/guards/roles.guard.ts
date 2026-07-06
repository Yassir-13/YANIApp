import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Récupère les rôles requis déclarés via @Roles() sur la route
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si la route n'exige aucun rôle précis, on laisse passer
    // (l'authentification est déjà gérée par JwtAuthGuard en amont)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Récupère l'utilisateur injecté par la stratégie JWT
    const { user } = context.switchToHttp().getRequest();

    // Vérifie que le rôle de l'utilisateur fait partie des rôles autorisés
    return requiredRoles.some((role) => user?.role === role);
  }
}