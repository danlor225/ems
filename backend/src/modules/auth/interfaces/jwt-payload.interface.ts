// ============================================================
//  JwtPayload : le contenu (lisible) que l'on met dans le JWT.
//  RAPPEL : un JWT est signé mais PAS chiffré => aucune donnée
//  sensible ici (pas de mot de passe, pas d'info privée).
// ============================================================
import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string; // "subject" : l'identifiant de l'utilisateur (convention JWT)
  email: string;
  role: Role; // STUDENT | TEACHER | ADMIN (servira au contrôle d'accès RBAC)
}
