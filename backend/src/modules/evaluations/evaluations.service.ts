// ============================================================
//  EvaluationsService : cœur v2. Opère sur la table `exams`
//  enrichie. À la publication, crée automatiquement une Session
//  (fenêtre) => le moteur de passage/résultats existant est réutilisé.
// ============================================================
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AcademicSessionsService } from '../academic-sessions/academic-sessions.service';
import { QuestionsService } from '../questions/questions.service';
import { SubjectsService } from '../subjects/subjects.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { EvaluationQueryDto } from './dto/evaluation-query.dto';
import { PublishEvaluationDto } from './dto/publish-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';

const MIN_QUESTIONS = 15;
const MAX_QUESTIONS = 60;

interface Actor {
  id: string;
  role: Role;
}

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subjectsService: SubjectsService,
    private readonly questionsService: QuestionsService,
    private readonly academicSessionsService: AcademicSessionsService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // ---------- Écriture ----------

  async create(dto: CreateEvaluationDto, actor: Actor) {
    await this.subjectsService.findOne(dto.subjectId);
    await this.academicSessionsService.findOne(dto.academicSessionId);

    const questionIds = dto.questionIds?.length
      ? await this.validateComposition(dto.subjectId, dto.questionIds)
      : [];

    const code = await this.generateCode();

    const exam = await this.prisma.exam.create({
      data: {
        title: dto.name,
        description: dto.description,
        code,
        status: 'DRAFT',
        durationMinutes: dto.durationMinutes,
        passScore: dto.passScore,
        maxScore: dto.maxScore,
        extraTimeMinutes: dto.extraTimeMinutes,
        attemptsAllowed: dto.attemptsAllowed,
        randomizeQuestions: dto.randomizeQuestions,
        oneQuestionAtATime: dto.oneQuestionAtATime,
        shuffleAnswers: dto.shuffleAnswers,
        showResultImmediately: dto.showResultImmediately,
        autoGrade: dto.autoGrade,
        level: dto.level,
        ...(dto.groupId ? { group: { connect: { id: dto.groupId } } } : {}),
        subject: { connect: { id: dto.subjectId } },
        academicSession: { connect: { id: dto.academicSessionId } },
        author: { connect: { id: actor.id } },
        examQuestions: {
          create: questionIds.map((questionId, index) => ({
            question: { connect: { id: questionId } },
            order: index + 1,
          })),
        },
      },
    });

    await this.activityLog.log({
      actorId: actor.id,
      action: 'EVALUATION_CREATED',
      entity: 'Evaluation',
      metadata: { id: exam.id, code },
    });
    return this.findOne(exam.id);
  }

  async update(id: string, dto: UpdateEvaluationDto, actor: Actor) {
    await this.getOwned(id, actor);
    if (dto.academicSessionId) {
      await this.academicSessionsService.findOne(dto.academicSessionId);
    }
    await this.prisma.exam.update({
      where: { id },
      data: {
        title: dto.name,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        passScore: dto.passScore,
        maxScore: dto.maxScore,
        extraTimeMinutes: dto.extraTimeMinutes,
        attemptsAllowed: dto.attemptsAllowed,
        randomizeQuestions: dto.randomizeQuestions,
        oneQuestionAtATime: dto.oneQuestionAtATime,
        shuffleAnswers: dto.shuffleAnswers,
        showResultImmediately: dto.showResultImmediately,
        autoGrade: dto.autoGrade,
        level: dto.level,
        ...(dto.groupId !== undefined
          ? {
              group: dto.groupId
                ? { connect: { id: dto.groupId } }
                : { disconnect: true },
            }
          : {}),
        ...(dto.academicSessionId
          ? { academicSession: { connect: { id: dto.academicSessionId } } }
          : {}),
      },
    });
    return this.findOne(id);
  }

  /** Remplace la composition (questions) d'une évaluation. */
  async setQuestions(id: string, questionIds: string[], actor: Actor) {
    const exam = await this.getOwned(id, actor);
    const uniqueIds = await this.validateComposition(exam.subjectId, questionIds);
    await this.prisma.$transaction([
      this.prisma.examQuestion.deleteMany({ where: { examId: id } }),
      this.prisma.examQuestion.createMany({
        data: uniqueIds.map((questionId, index) => ({
          examId: id,
          questionId,
          order: index + 1,
        })),
      }),
    ]);
    return this.findOne(id);
  }

  /** Publication : contrôle 15–60 questions, crée la Session (fenêtre). */
  async publish(id: string, dto: PublishEvaluationDto, actor: Actor) {
    const exam = await this.getOwned(id, actor);
    if (exam.status !== 'DRAFT') {
      throw new ConflictException('Seul un brouillon peut être publié.');
    }
    const count = exam.examQuestions.length;
    if (count < MIN_QUESTIONS || count > MAX_QUESTIONS) {
      throw new BadRequestException(
        `Une évaluation doit contenir entre ${MIN_QUESTIONS} et ${MAX_QUESTIONS} questions (actuellement ${count}).`,
      );
    }
    if (exam.examQuestions.some((eq) => !eq.question.isActive)) {
      throw new BadRequestException(
        'Certaines questions sont désactivées.',
      );
    }

    const opensAt = new Date(dto.opensAt);
    const closesAt = new Date(dto.closesAt);
    if (closesAt <= opensAt) {
      throw new BadRequestException('La fermeture doit suivre l’ouverture.');
    }
    if (closesAt <= new Date()) {
      throw new BadRequestException('La fermeture doit être dans le futur.');
    }
    const now = new Date();
    const sessionStatus =
      now >= opensAt && now <= closesAt ? 'OPEN' : 'SCHEDULED';

    await this.prisma.$transaction([
      this.prisma.exam.update({
        where: { id },
        data: { status: 'PUBLISHED', isPublished: true, publishedAt: now },
      }),
      // Auto-création de la fenêtre => moteur de passage existant réutilisé.
      this.prisma.session.create({
        data: { examId: id, opensAt, closesAt, status: sessionStatus },
      }),
    ]);

    await this.activityLog.log({
      actorId: actor.id,
      action: 'EVALUATION_PUBLISHED',
      entity: 'Evaluation',
      metadata: { id },
    });
    return this.findOne(id);
  }

  async close(id: string, actor: Actor) {
    await this.getOwned(id, actor);
    await this.prisma.$transaction([
      this.prisma.exam.update({
        where: { id },
        data: { status: 'CLOSED', isPublished: false },
      }),
      this.prisma.session.updateMany({
        where: { examId: id },
        data: { status: 'CLOSED' },
      }),
    ]);
    return this.findOne(id);
  }

  async archive(id: string, actor: Actor) {
    await this.getOwned(id, actor);
    await this.prisma.$transaction([
      this.prisma.exam.update({
        where: { id },
        data: { status: 'ARCHIVED', isPublished: false },
      }),
      this.prisma.session.updateMany({
        where: { examId: id },
        data: { status: 'CLOSED' },
      }),
    ]);
    return this.findOne(id);
  }

  /** Duplique une évaluation en brouillon (nouveau code, mêmes questions). */
  async duplicate(id: string, actor: Actor) {
    const exam = await this.getOwned(id, actor);
    const code = await this.generateCode();
    const created = await this.prisma.exam.create({
      data: {
        title: `${exam.title} (copie)`,
        description: exam.description,
        code,
        status: 'DRAFT',
        durationMinutes: exam.durationMinutes,
        passScore: exam.passScore,
        maxScore: exam.maxScore,
        extraTimeMinutes: exam.extraTimeMinutes,
        attemptsAllowed: exam.attemptsAllowed,
        randomizeQuestions: exam.randomizeQuestions,
        oneQuestionAtATime: exam.oneQuestionAtATime,
        shuffleAnswers: exam.shuffleAnswers,
        showResultImmediately: exam.showResultImmediately,
        autoGrade: exam.autoGrade,
        level: exam.level,
        group: exam.groupId
          ? { connect: { id: exam.groupId } }
          : undefined,
        subject: { connect: { id: exam.subjectId } },
        author: { connect: { id: actor.id } },
        academicSession: exam.academicSessionId
          ? { connect: { id: exam.academicSessionId } }
          : undefined,
        examQuestions: {
          create: exam.examQuestions.map((eq) => ({
            question: { connect: { id: eq.questionId } },
            order: eq.order,
          })),
        },
      },
    });
    return this.findOne(created.id);
  }

  async remove(id: string, actor: Actor): Promise<void> {
    await this.getOwned(id, actor);
    try {
      await this.prisma.exam.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Évaluation rattachée à des tentatives : archivez-la plutôt.',
        );
      }
      throw error;
    }
  }

  // ---------- Lecture ----------

  async findAll(query: EvaluationQueryDto) {
    const { page, limit, status, subjectId, academicSessionId, search } = query;
    const where: Prisma.ExamWhereInput = {
      ...(status ? { status } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(academicSessionId ? { academicSessionId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (page - 1) * limit;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.exam.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subject: { select: { name: true } },
          academicSession: { select: { name: true } },
          author: { select: { firstName: true, lastName: true } },
          _count: { select: { examQuestions: true } },
          sessions: {
            orderBy: { opensAt: 'desc' },
            take: 1,
            select: { opensAt: true, closesAt: true, status: true },
          },
        },
      }),
      this.prisma.exam.count({ where }),
    ]);

    const data = rows.map((e) => ({
      id: e.id,
      code: e.code,
      name: e.title,
      status: e.status,
      effectiveStatus: this.effectiveStatus(e.status, e.sessions[0]),
      subject: e.subject.name,
      academicSession: e.academicSession?.name ?? null,
      author: e.author
        ? `${e.author.firstName} ${e.author.lastName}`
        : null,
      questionsCount: e._count.examQuestions,
      durationMinutes: e.durationMinutes,
      passScore: e.passScore,
      opensAt: e.sessions[0]?.opensAt ?? null,
      closesAt: e.sessions[0]?.closesAt ?? null,
      createdAt: e.createdAt,
      publishedAt: e.publishedAt,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true } },
        academicSession: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        examQuestions: {
          orderBy: { order: 'asc' },
          include: { question: { include: { options: true } } },
        },
        sessions: { orderBy: { opensAt: 'desc' } },
      },
    });
    if (!exam) {
      throw new NotFoundException('Évaluation introuvable.');
    }
    return exam;
  }

  async summary(id: string, actor: Actor) {
    const exam = await this.getOwned(id, actor);
    const totalPoints = exam.examQuestions.reduce(
      (sum, eq) => sum + eq.question.points,
      0,
    );
    return {
      questionCount: exam.examQuestions.length,
      totalPoints,
      durationMinutes: exam.durationMinutes,
      estimatedMinutes: exam.durationMinutes,
    };
  }

  // ---------- Helpers ----------

  private effectiveStatus(
    status: string,
    session?: { opensAt: Date; closesAt: Date; status: string },
  ): string {
    if (status !== 'PUBLISHED') return status;
    if (!session) return 'PUBLISHED';
    const now = Date.now();
    if (now < new Date(session.opensAt).getTime()) return 'PUBLISHED';
    if (now > new Date(session.closesAt).getTime()) return 'CLOSED';
    return 'OPEN';
  }

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `EVAL-${year}-`;
    const count = await this.prisma.exam.count({
      where: { code: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async validateComposition(
    subjectId: string,
    questionIds: string[],
  ): Promise<string[]> {
    const uniqueIds = [...new Set(questionIds)];
    if (uniqueIds.length !== questionIds.length) {
      throw new BadRequestException('La composition contient des doublons.');
    }
    const questions = await this.questionsService.findManyByIds(uniqueIds);
    if (questions.length !== uniqueIds.length) {
      throw new BadRequestException('Une ou plusieurs questions sont introuvables.');
    }
    if (questions.some((q) => q.subjectId !== subjectId)) {
      throw new BadRequestException(
        "Toutes les questions doivent appartenir à la matière de l'évaluation.",
      );
    }
    return uniqueIds;
  }

  /** Charge l'évaluation et vérifie l'ownership (auteur ou ADMIN). */
  private async getOwned(id: string, actor: Actor) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        examQuestions: {
          orderBy: { order: 'asc' },
          include: { question: true },
        },
      },
    });
    if (!exam) {
      throw new NotFoundException('Évaluation introuvable.');
    }
    if (actor.role !== 'ADMIN' && exam.authorId && exam.authorId !== actor.id) {
      throw new ForbiddenException('Vous n’êtes pas l’auteur de cette évaluation.');
    }
    return exam;
  }
}
