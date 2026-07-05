// ============================================================
//  GroupsService : gestion des groupes / classes.
//  Un étudiant appartient à AU PLUS un groupe (User.groupId).
// ============================================================
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupQueryDto } from './dto/group-query.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

// Sélection des membres exposés (jamais de hash de mot de passe).
const MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  matricule: true,
  isActive: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateGroupDto) {
    return this.prisma.group.create({ data: dto });
  }

  async findAll(query: GroupQueryDto) {
    const { page, limit, search } = query;
    const where: Prisma.GroupWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { level: { contains: search, mode: 'insensitive' } },
            { academicYear: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const skip = (page - 1) * limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.group.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { students: true, evaluations: true } },
        },
      }),
      this.prisma.group.count({ where }),
    ]);
    // On aplatit _count pour une réponse simple à consommer côté front.
    const data = rows.map(({ _count, ...g }) => ({
      ...g,
      studentsCount: _count.students,
      evaluationsCount: _count.evaluations,
    }));
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        students: {
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: MEMBER_SELECT,
        },
        _count: { select: { evaluations: true } },
      },
    });
    if (!group) throw new NotFoundException('Groupe introuvable.');
    const { _count, ...rest } = group;
    return { ...rest, evaluationsCount: _count.evaluations };
  }

  async update(id: string, dto: UpdateGroupDto) {
    await this.ensureExists(id);
    return this.prisma.group.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    // Les étudiants et évaluations rattachés voient leur group_id passer à NULL
    // (onDelete: SetNull) : aucune donnée n'est perdue.
    await this.prisma.group.delete({ where: { id } });
  }

  /** Affecte un étudiant à ce groupe (remplace son éventuel groupe précédent). */
  async addMember(groupId: string, userId: string) {
    await this.ensureExists(groupId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    await this.prisma.user.update({
      where: { id: userId },
      data: { groupId },
    });
    return this.findOne(groupId);
  }

  /** Retire un étudiant du groupe (uniquement s'il y appartient). */
  async removeMember(groupId: string, userId: string) {
    await this.ensureExists(groupId);
    await this.prisma.user.updateMany({
      where: { id: userId, groupId },
      data: { groupId: null },
    });
    return this.findOne(groupId);
  }

  private async ensureExists(id: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!group) throw new NotFoundException('Groupe introuvable.');
  }
}
