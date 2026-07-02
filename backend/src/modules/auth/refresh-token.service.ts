// ============================================================
//  RefreshTokenService : persistance de la table `refresh_tokens`.
//  Responsabilité UNIQUE : créer / retrouver / révoquer des
//  refresh tokens en base. Ne connaît ni JWT ni HTTP.
// ============================================================
import { Injectable } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Enregistre un nouveau refresh token (déjà haché) en base. */
  create(data: {
    id: string; // = le "jti" embarqué dans le JWT (identifiant du token)
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  /** Retrouve un refresh token par son id (jti). */
  findById(id: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { id } });
  }

  /** Révoque UN refresh token. updateMany => ne lève pas d'erreur s'il n'existe pas. */
  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id },
      data: { revoked: true },
    });
  }

  /** Révoque TOUS les refresh tokens actifs d'un utilisateur (sécurité). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}
