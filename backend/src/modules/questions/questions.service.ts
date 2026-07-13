// ============================================================
//  QuestionsService : logique métier des questions + options.
// ============================================================
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestionType } from '@prisma/client';
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

  /**
   * Règles métier selon le type de question :
   *  - SINGLE_CHOICE / TRUE_FALSE : EXACTEMENT une bonne réponse.
   *  - TRUE_FALSE : en plus, EXACTEMENT deux options (Vrai / Faux).
   *  - MULTIPLE_CHOICE : AU MOINS une bonne réponse (et pas toutes fausses).
   */
  private validateOptions(
    type: QuestionType,
    options: { text: string; isCorrect: boolean }[],
  ): void {
    // Réponse libre : ≥1 réponse acceptée (chaque option = un libellé accepté).
    if (type === 'SHORT_ANSWER') {
      if (options.length < 1) {
        throw new BadRequestException(
          'Une réponse libre doit avoir au moins une réponse acceptée.',
        );
      }
      return;
    }

    // Les types à choix exigent au moins 2 options.
    if (options.length < 2) {
      throw new BadRequestException(
        'Une question à choix doit avoir au moins 2 réponses.',
      );
    }

    const correctCount = options.filter((o) => o.isCorrect).length;
    if (type === 'MULTIPLE_CHOICE') {
      if (correctCount < 1) {
        throw new BadRequestException(
          'Un QCM à réponses multiples doit avoir au moins une bonne réponse.',
        );
      }
      return;
    }

    // SINGLE_CHOICE et TRUE_FALSE : exactement une bonne réponse.
    if (correctCount !== 1) {
      throw new BadRequestException(
        'Une question à choix unique doit avoir exactement une bonne réponse.',
      );
    }
    if (type === 'TRUE_FALSE' && options.length !== 2) {
      throw new BadRequestException(
        'Une question Vrai/Faux doit avoir exactement deux options.',
      );
    }
  }

  /** Crée une question et ses options en une seule transaction. */
  async create(dto: CreateQuestionDto) {
    await this.subjectsService.findOne(dto.subjectId); // 404 si matière absente
    const type = dto.type ?? 'SINGLE_CHOICE';
    this.validateOptions(type, dto.options);

    return this.prisma.question.create({
      data: {
        subjectId: dto.subjectId,
        statement: dto.statement,
        type,
        points: dto.points ?? 1,
        // create imbriqué : Prisma insère la question ET ses options atomiquement.
        // Réponse libre : chaque option est une réponse acceptée (isCorrect=true).
        options: {
          create: dto.options.map((o) => ({
            text: o.text,
            isCorrect: type === 'SHORT_ANSWER' ? true : o.isCorrect,
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

  /**
   * Mise à jour d'une question (404 si absente, 404 si nouvelle matière absente).
   * Si `options` est fourni, on remplace intégralement le jeu de réponses :
   *  - validation selon le type ACTUEL (le type n'est pas modifiable après création) ;
   *  - suppression des anciennes options puis recréation, en une transaction.
   * NB : AttemptAnswer.selectedOptionId est en onDelete:SetNull → l'intégrité des
   *      tentatives déjà soumises (dont le score est figé) est préservée.
   */
  async update(id: string, dto: UpdateQuestionDto) {
    const existing = await this.findOne(id);
    if (dto.subjectId) {
      await this.subjectsService.findOne(dto.subjectId);
    }

    const { options, ...scalars } = dto;
    if (options) {
      this.validateOptions(existing.type, options);
    }

    return this.prisma.$transaction(async (tx) => {
      if (options) {
        await tx.answerOption.deleteMany({ where: { questionId: id } });
      }
      return tx.question.update({
        where: { id },
        data: {
          ...scalars,
          ...(options && {
            options: {
              create: options.map((o) => ({
                text: o.text,
                // Réponse libre : chaque option = un libellé accepté (isCorrect=true).
                isCorrect: existing.type === 'SHORT_ANSWER' ? true : o.isCorrect,
              })),
            },
          }),
        },
        include: { options: true },
      });
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
