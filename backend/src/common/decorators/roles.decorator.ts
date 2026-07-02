// ============================================================
//  @Roles(...) : attache à une route la liste des rôles autorisés.
//  Ex : @Roles(Role.TEACHER, Role.ADMIN)
//  Ces métadonnées seront lues par le RolesGuard.
// ============================================================
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

// Clé sous laquelle on stocke/lit la métadonnée (partagée avec le guard).
export const ROLES_KEY = 'roles';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
