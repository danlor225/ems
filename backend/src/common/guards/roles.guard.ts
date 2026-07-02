// ============================================================
//  RolesGuard : autorise/refuse selon le rôle de l'utilisateur.
//  À utiliser APRÈS JwtAuthGuard (qui remplit request.user) :
//    @UseGuards(JwtAuthGuard, RolesGuard)
//    @Roles(Role.ADMIN)
// ============================================================
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { SafeUser } from '../../modules/auth/auth.service';

@Injectable()
export class RolesGuard implements CanActivate {
  // Reflector : outil NestJS pour lire les métadonnées posées par @Roles.
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // On lit les rôles requis, au niveau méthode PUIS classe.
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Aucune restriction déclarée => accès autorisé (le guard ne fait rien).
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: SafeUser }>();
    const user = request.user;

    // Correspondance EXPLICITE : le rôle de l'utilisateur doit figurer dans la liste.
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Accès refusé : rôle insuffisant.');
    }

    return true;
  }
}
