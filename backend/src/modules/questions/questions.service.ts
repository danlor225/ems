// ============================================================
//  QuestionsService : logique métier des questions + options.
// ============================================================
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubjectsService } from '../subjects/subjects.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { QuestionQueryDto } from './dto/question-query.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    // Réutilisation de SubjectsService pour valider l'existence d'une matière (DRY).
    private readonly subjectsService: SubjectsService,
  ) {}

  /** Règle métier : une question a EXACTEMENT une bonne réponse. */
  private ensureExactlyOneCorrect(options: { isCorrect: boolean }[]): void {
    const correctCount = options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      throw new BadRequestException(
        'Une question doit avoir exactement une bonne réponse.',
      );
    }
  }

  /** Crée une question et ses options en une seule transaction. */
  async create(dto: CreateQuestionDto) {
    await this.subjectsService.findOne(dto.subjectId); // 404 si matière absente
    this.ensureExactlyOneCorrect(dto.options);

    return this.prisma.question.create({
      data: {
        subjectId: dto.subjectId,
        statement: dto.statement,
        points: dto.points ?? 1,
        // create imbriqué : Prisma insère la question ET ses options atomiquement.
        options: {
          create: dto.options.map((o) => ({
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        },
      },
      include: { options: true },
    });
  }

  /** Liste paginée, filtrable par matière. */
  async findAll(query: QuestionQueryDto) {
    const { page, limit, subjectId } = query;
    const where: Prisma.QuestionWhereInput = subjectId ? { subjectId } : {};
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { options: true },
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Récupère plusieurs questions par leurs ids (utilisé par ExamsService). */
  findManyByIds(ids: string[]) {
    return this.prisma.question.findMany({ where: { id: { in: ids } } });
  }

  /** Détail (404 si absente). */
  async findOne(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { options: true },
    });
    if (!question) {
      throw new NotFoundException('Question introuvable.');
    }
    return question;
  }

  /** Mise à jour des champs scalaires (404 si absente, 404 si nouvelle matière absente). */
  async update(id: string, dto: UpdateQuestionDto) {
    await this.findOne(id);
    if (dto.subjectId) {
      await this.subjectsService.findOne(dto.subjectId);
    }
    return this.prisma.question.update({
      where: { id },
      data: dto,
      include: { options: true },
    });
  }

  /** Suppression (404 si absente, 409 si utilisée par un examen). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    try {
      await this.prisma.question.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          "Question utilisée par un examen : désactivez-la (isActive=false) au lieu de la supprimer.",
        );
      }
      throw error;
    }
  }
}
