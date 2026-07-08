// ============================================================
//  ExamsService : logique métier des examens (modèles d'évaluation).
// ============================================================
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { QuestionsService } from '../questions/questions.service';
import { SubjectsService } from '../subjects/subjects.service';
import { CreateExamDto } from './dto/create-exam.dto';
import { ExamQueryDto } from './dto/exam-query.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

// Bornes imposées par le cahier des charges (contrôlées à la publication).
const MIN_QUESTIONS = 15;
const MAX_QUESTIONS = 60;

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subjectsService: SubjectsService,
    private readonly questionsService: QuestionsService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /** Crée un examen (brouillon) avec sa composition de questions. */
  async create(dto: CreateExamDto, actorId: string) {
    await this.subjectsService.findOne(dto.subjectId); // 404 si matière absente

    // Pas de doublon dans la composition.
    const uniqueIds = [...new Set(dto.questionIds)];
    if (uniqueIds.length !== dto.questionIds.length) {
      throw new BadRequestException('La composition contient des doublons.');
    }

    // Toutes les questions doivent exister ET appartenir à la matière.
    const questions = await this.questionsService.findManyByIds(uniqueIds);
    if (questions.length !== uniqueIds.length) {
      throw new BadRequestException('Une ou plusieurs questions sont introuvables.');
    }
    const outOfSubject = questions.some((q) => q.subjectId !== dto.subjectId);
    if (outOfSubject) {
      throw new BadRequestException(
        "Toutes les questions doivent appartenir à la matière de l'examen.",
      );
    }

    const exam = await this.prisma.exam.create({
      data: {
        title: dto.title,
        subjectId: dto.subjectId,
        durationMinutes: dto.durationMinutes,
        passScore: dto.passScore ?? 50,
        examQuestions: {
          create: uniqueIds.map((questionId, index) => ({
            questionId,
            order: index + 1,
          })),
        },
      },
      include: { examQuestions: true },
    });

    await this.activityLog.log({
      actorId,
      action: 'EXAM_CREATED',
      entity: 'Exam',
      metadata: { examId: exam.id, title: exam.title },
    });
    return exam;
  }

  /** Liste paginée, filtrable par matière. */
  async findAll(query: ExamQueryDto) {
    const { page, limit, subjectId } = query;
    const where: Prisma.ExamWhereInput = subjectId ? { subjectId } : {};
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.exam.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { examQuestions: true } } },
      }),
      this.prisma.exam.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Détail avec la composition (questions + leurs options). */
  async findOne(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        examQuestions: {
          orderBy: { order: 'asc' },
          include: { question: { include: { options: true } } },
        },
      },
    });
    if (!exam) {
      throw new NotFoundException('Examen introuvable.');
    }
    return exam;
  }

  /** Mise à jour scalaire (404 si absent). */
  async update(id: string, dto: UpdateExamDto) {
    await this.ensureExists(id);
    return this.prisma.exam.update({ where: { id }, data: dto });
  }

  /** Publication : vérifie le nombre de questions (15–60) et leur activité. */
  async publish(id: string, actorId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: { examQuestions: { include: { question: true } } },
    });
    if (!exam) {
      throw new NotFoundException('Examen introuvable.');
    }

    const count = exam.examQuestions.length;
    if (count < MIN_QUESTIONS || count > MAX_QUESTIONS) {
      throw new BadRequestException(
        `Un examen doit contenir entre ${MIN_QUESTIONS} et ${MAX_QUESTIONS} questions (actuellement ${count}).`,
      );
    }

    const hasInactive = exam.examQuestions.some((eq) => !eq.question.isActive);
    if (hasInactive) {
      throw new BadRequestException(
        'Impossible de publier : certaines questions sont désactivées.',
      );
    }

    const updated = await this.prisma.exam.update({
      where: { id },
      data: { isPublished: true },
    });
    await this.activityLog.log({
      actorId,
      action: 'EXAM_PUBLISHED',
      entity: 'Exam',
      metadata: { examId: id },
    });
    return updated;
  }

  /** Dépublication. */
  async unpublish(id: string) {
    await this.ensureExists(id);
    return this.prisma.exam.update({
      where: { id },
      data: { isPublished: false },
    });
  }

  /** Suppression (404 si absent, 409 si des sessions y sont rattachées). */
  async remove(id: string, actorId: string): Promise<void> {
    await this.ensureExists(id);
    try {
      await this.prisma.exam.delete({ where: { id } });
      await this.activityLog.log({
        actorId,
        action: 'EXAM_DELETED',
        entity: 'Exam',
        metadata: { examId: id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Examen rattaché à des sessions : suppression impossible.',
        );
      }
      throw error;
    }
  }

  /**
   * Vérifie qu'un examen existe ET est publié (utilisé par SessionsService).
   * Lève 404 si absent, 400 s'il n'est pas publié.
   */
  async assertPublishedExists(id: string): Promise<void> {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      select: { id: true, isPublished: true },
    });
    if (!exam) {
      throw new NotFoundException('Examen introuvable.');
    }
    if (!exam.isPublished) {
      throw new BadRequestException(
        "L'examen doit être publié avant de créer une session.",
      );
    }
  }

  /** Vérifie l'existence, lève 404 sinon. */
  private async ensureExists(id: string): Promise<void> {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exam) {
      throw new NotFoundException('Examen introuvable.');
    }
  }
}
