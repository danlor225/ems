// ============================================================
//  UsersService : accès aux données de la table `users`.
//  Responsabilité UNIQUE : lire/écrire des utilisateurs en base.
//  Il ne sait rien de bcrypt ni du HTTP (Separation of Concerns).
// ============================================================
import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  // PrismaService est injecté (fourni globalement par PrismaModule).
  constructor(private readonly prisma: PrismaService) {}

  /** Retrouve un utilisateur par son email (ou null s'il n'existe pas). */
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Retrouve un utilisateur par son id (ou null). Utilisé par la JwtStrategy. */
  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Crée un utilisateur. Le mot de passe reçu est DÉJÀ haché (jamais en clair ici). */
  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  /** Met à jour le profil (prénom / nom). */
  updateProfile(
    id: string,
    data: { firstName?: string; lastName?: string },
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /** Met à jour le hash du mot de passe. */
  updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }
}
