// ============================================================
//  SubjectsService : logique métier + accès données des matières.
// ============================================================
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée une matière. */
  create(dto: CreateSubjectDto) {
    return this.prisma.subject.create({ data: dto });
  }

  /** Liste paginée. On renvoie les données ET les métadonnées de pagination. */
  async findAll(query: PaginationQueryDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    // $transaction : les deux requêtes (page + total) sont exécutées ensemble
    // pour un compte cohérent.
    const [data, total] = await this.prisma.$transaction([
      this.prisma.subject.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subject.count(),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Détail d'une matière (404 si absente). */
  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw new NotFoundException('Matière introuvable.');
    }
    return subject;
  }

  /** Mise à jour (404 si absente). */
  async update(id: string, dto: UpdateSubjectDto) {
    await this.findOne(id); // garantit l'existence => 404 sinon
    return this.prisma.subject.update({ where: { id }, data: dto });
  }

  /** Suppression (404 si absente, 409 si encore utilisée). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    try {
      await this.prisma.subject.delete({ where: { id } });
    } catch (error) {
      // P2003 = violation de clé étrangère : la matière est référencée
      // (questions/examens). Le onDelete: Restrict du schéma nous protège.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Matière utilisée par des questions ou examens : suppression impossible.',
        );
      }
      throw error;
    }
  }
}
