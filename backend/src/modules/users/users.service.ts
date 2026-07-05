// ============================================================
//  UsersService : accès aux données de la table `users`.
//  + opérations d'administration (Phase B) : liste, création,
//  rôle, reset mot de passe, verrouillage, (dés)activation,
//  historique de connexion.
// ============================================================
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

const SALT_ROUNDS = 12;

// Sélection SANS le hash du mot de passe (jamais exposé).
const SAFE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  isLocked: true,
  avatarUrl: true,
  lastLoginAt: true,
  matricule: true,
  groupId: true,
  group: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Utilisé par l'authentification (renvoie le hash) ----------

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  updateProfile(
    id: string,
    data: { firstName?: string; lastName?: string },
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /** Enregistre une connexion (dernière activité + historique). */
  async recordLogin(
    userId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.loginHistory.create({ data: { userId, ip, userAgent } }),
    ]);
  }

  // ---------- Administration (ADMIN) ----------

  async findAll(query: UserQueryDto) {
    const { page, limit, role, status, search } = query;
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(status === 'active' ? { isActive: true, isLocked: false } : {}),
      ...(status === 'inactive' ? { isActive: false } : {}),
      ...(status === 'locked' ? { isLocked: true } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: SAFE_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOneDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...SAFE_SELECT,
        loginHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, ip: true, userAgent: true, createdAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return user;
  }

  async createByAdmin(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
        },
        select: SAFE_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Un compte existe déjà avec cet email.');
      }
      throw error;
    }
  }

  async updateByAdmin(id: string, dto: UpdateUserDto) {
    await this.ensureExists(id);
    // Matricule : une chaîne vide équivaut à "aucun matricule" (null),
    // pour ne pas violer la contrainte d'unicité avec plusieurs "".
    const matricule =
      dto.matricule === undefined
        ? undefined
        : dto.matricule?.trim()
          ? dto.matricule.trim()
          : null;
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          isActive: dto.isActive,
          matricule,
          // groupId: undefined => inchangé ; null => retiré du groupe.
          groupId: dto.groupId,
        },
        select: SAFE_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Ce matricule est déjà attribué.');
      }
      throw error;
    }
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await this.ensureExists(id);
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    // On révoque aussi les sessions actives (refresh tokens).
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revoked: false },
        data: { revoked: true },
      }),
    ]);
  }

  setLocked(id: string, locked: boolean, actorId: string) {
    if (id === actorId && locked) {
      throw new ForbiddenException(
        'Vous ne pouvez pas verrouiller votre propre compte.',
      );
    }
    return this.updateFlag(id, { isLocked: locked });
  }

  setActive(id: string, active: boolean, actorId: string) {
    if (id === actorId && !active) {
      throw new ForbiddenException(
        'Vous ne pouvez pas désactiver votre propre compte.',
      );
    }
    return this.updateFlag(id, { isActive: active });
  }

  async remove(id: string, actorId: string): Promise<void> {
    if (id === actorId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer votre propre compte.',
      );
    }
    await this.ensureExists(id);
    await this.prisma.user.delete({ where: { id } });
  }

  // ---------- Privé ----------

  private async updateFlag(id: string, data: Prisma.UserUpdateInput) {
    await this.ensureExists(id);
    return this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT });
  }

  private async ensureExists(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
  }
}
