// ============================================================
//  AttemptsService : passage d'évaluation (côté étudiant).
//  5.1 : démarrage d'une tentative (tirage aléatoire figé,
//        minuteur serveur, reprise, vue sans isCorrect).
// ============================================================
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { SaveAnswerDto } from './dto/save-answer.dto';

// Types précis dérivés des requêtes Prisma (pas de `any`).
type SessionWithComposition = Prisma.SessionGetPayload<{
  include: {
    exam: {
      include: {
        examQuestions: { include: { question: { include: { options: true } } } };
      };
    };
  };
}>;
type AttemptWithAnswers = Prisma.AttemptGetPayload<{ include: { answers: true } }>;

/** Mélange un tableau (Fisher-Yates). Non critique => Math.random suffit. */
function shuffle<T>(input: T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsService: SessionsService,
  ) {}

  /** Démarre (ou reprend) une tentative pour l'étudiant sur une session. */
  async start(studentId: string, sessionId: string) {
    const session = await this.sessionsService.findWithComposition(sessionId);
    this.assertSessionOpen(session);

    // Règle "une seule tentative" (portée par la contrainte UNIQUE en base).
    const existing = await this.prisma.attempt.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } },
      include: { answers: true },
    });
    if (existing) {
      if (existing.status !== 'IN_PROGRESS') {
        throw new ConflictException('Vous avez déjà passé cette évaluation.');
      }
      // Reprise : on renvoie la tentative existante (le temps a continué).
      return this.buildStudentView(existing, session);
    }

    // Nouvelle tentative : on fige le tirage aléatoire.
    const questions = session.exam.examQuestions.map((eq) => eq.question);
    const questionOrder = shuffle(questions.map((q) => q.id));
    const startedAt = new Date();
    const expiresAt = new Date(
      startedAt.getTime() + session.exam.durationMinutes * 60_000,
    );

    const attempt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attempt.create({
        data: {
          sessionId,
          studentId,
          startedAt,
          expiresAt,
          questionOrder, // ordre des questions figé
        },
      });
      // Une ligne de réponse par question, avec l'ordre des options figé.
      await tx.attemptAnswer.createMany({
        data: questions.map((q) => ({
          attemptId: created.id,
          questionId: q.id,
          optionOrder: shuffle(q.options.map((o) => o.id)),
        })),
      });
      return tx.attempt.findUniqueOrThrow({
        where: { id: created.id },
        include: { answers: true },
      });
    });

    return this.buildStudentView(attempt, session);
  }

  /** Enregistre (sauvegarde auto) la réponse d'une question. */
  async saveAnswer(studentId: string, attemptId: string, dto: SaveAnswerDto) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      // On ne charge que la ligne de réponse concernée (perf).
      include: { answers: { where: { questionId: dto.questionId } } },
    });

    // Ownership : 404 (et pas 403) pour ne pas révéler l'existence de la tentative.
    if (!attempt || attempt.studentId !== studentId) {
      throw new NotFoundException('Tentative introuvable.');
    }
    this.assertAttemptActive(attempt.status, attempt.expiresAt);

    // La question doit faire partie de cette tentative (ligne pré-créée au start).
    const answer = attempt.answers[0];
    if (!answer) {
      throw new BadRequestException("Cette question ne fait pas partie de la tentative.");
    }

    // L'option choisie doit appartenir à la question (elle est dans optionOrder).
    const optionOrder = answer.optionOrder as unknown as string[];
    if (!optionOrder.includes(dto.selectedOptionId)) {
      throw new BadRequestException('Option invalide pour cette question.');
    }

    await this.prisma.attemptAnswer.update({
      where: {
        attemptId_questionId: { attemptId, questionId: dto.questionId },
      },
      data: { selectedOptionId: dto.selectedOptionId, answeredAt: new Date() },
    });

    const remainingSeconds = Math.max(
      0,
      Math.floor((attempt.expiresAt.getTime() - Date.now()) / 1000),
    );
    return {
      saved: true,
      questionId: dto.questionId,
      selectedOptionId: dto.selectedOptionId,
      remainingSeconds,
    };
  }

  /** Soumet une tentative : calcule la note et la fige. */
  async submit(studentId: string, attemptId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { answers: true },
    });

    if (!attempt || attempt.studentId !== studentId) {
      throw new NotFoundException('Tentative introuvable.');
    }
    if (attempt.status !== 'IN_PROGRESS') {
      throw new ConflictException('Cette tentative est déjà soumise.');
    }

    // On charge, pour chaque question, ses points et SA bonne option.
    // (isCorrect reste côté serveur : il ne quitte jamais cette méthode.)
    const questionIds = attempt.answers.map((a) => a.questionId);
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        points: true,
        options: { where: { isCorrect: true }, select: { id: true } },
      },
    });
    const correctOptionByQuestion = new Map(
      questions.map((q) => [q.id, q.options[0]?.id]),
    );
    const pointsByQuestion = new Map(questions.map((q) => [q.id, q.points]));

    let earned = 0;
    let total = 0;
    for (const answer of attempt.answers) {
      const points = pointsByQuestion.get(answer.questionId) ?? 0;
      total += points;
      if (
        answer.selectedOptionId &&
        answer.selectedOptionId === correctOptionByQuestion.get(answer.questionId)
      ) {
        earned += points;
      }
    }
    // Note en pourcentage, arrondie à 2 décimales.
    const score = total > 0 ? Math.round((earned / total) * 10_000) / 100 : 0;

    // Si le temps est écoulé, on fige en EXPIRED (mais on note quand même).
    const status = Date.now() >= attempt.expiresAt.getTime() ? 'EXPIRED' : 'SUBMITTED';
    const submittedAt = new Date();

    await this.prisma.attempt.update({
      where: { id: attemptId },
      data: { status, score, submittedAt },
    });

    return {
      message: 'Merci, votre évaluation a bien été enregistrée.',
      attemptId,
      status,
      submittedAt,
    };
  }

  /** Résultat détaillé (correction) d'une tentative soumise. */
  async getResult(studentId: string, attemptId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        session: {
          include: {
            exam: {
              select: { title: true, passScore: true, durationMinutes: true },
            },
          },
        },
      },
    });

    if (!attempt || attempt.studentId !== studentId) {
      throw new NotFoundException('Tentative introuvable.');
    }
    if (attempt.status === 'IN_PROGRESS') {
      throw new ConflictException(
        "Résultat indisponible : l'évaluation n'est pas encore soumise.",
      );
    }

    // La tentative est terminée : on peut charger les bonnes réponses.
    const questionIds = attempt.answers.map((a) => a.questionId);
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      include: { options: { select: { id: true, text: true, isCorrect: true } } },
    });
    const questionById = new Map(questions.map((q) => [q.id, q]));
    const answerByQuestion = new Map(
      attempt.answers.map((a) => [a.questionId, a]),
    );

    const questionOrder = attempt.questionOrder as unknown as string[];
    const correction = questionOrder.map((questionId) => {
      const question = questionById.get(questionId)!;
      const answer = answerByQuestion.get(questionId)!;
      const optionOrder = answer.optionOrder as unknown as string[];
      const optionById = new Map(question.options.map((o) => [o.id, o]));
      const correctOption = question.options.find((o) => o.isCorrect);

      return {
        questionId,
        statement: question.statement,
        points: question.points,
        selectedOptionId: answer.selectedOptionId,
        correctOptionId: correctOption?.id ?? null,
        isCorrect:
          !!answer.selectedOptionId &&
          answer.selectedOptionId === correctOption?.id,
        options: optionOrder.map((optionId) => {
          const o = optionById.get(optionId)!;
          return { id: o.id, text: o.text, isCorrect: o.isCorrect };
        }),
      };
    });

    const passScore = attempt.session.exam.passScore;
    return {
      attempt: {
        id: attempt.id,
        status: attempt.status,
        score: attempt.score,
        submittedAt: attempt.submittedAt,
      },
      exam: {
        title: attempt.session.exam.title,
        passScore,
        durationMinutes: attempt.session.exam.durationMinutes,
      },
      passed: attempt.score !== null && attempt.score >= passScore,
      correction,
    };
  }

  /** Historique des tentatives soumises de l'étudiant connecté. */
  async getHistory(studentId: string) {
    const attempts = await this.prisma.attempt.findMany({
      where: { studentId, status: { in: ['SUBMITTED', 'EXPIRED'] } },
      orderBy: { submittedAt: 'desc' },
      include: {
        session: {
          include: { exam: { select: { title: true, passScore: true } } },
        },
      },
    });

    return attempts.map((a) => ({
      attemptId: a.id,
      examTitle: a.session.exam.title,
      score: a.score,
      passed: a.score !== null && a.score >= a.session.exam.passScore,
      status: a.status,
      submittedAt: a.submittedAt,
    }));
  }

  // ------------------------------------------------------------
  //  Privé
  // ------------------------------------------------------------

  /** Vérifie qu'une tentative est encore modifiable (statut + temps serveur). */
  private assertAttemptActive(status: string, expiresAt: Date): void {
    if (status !== 'IN_PROGRESS') {
      throw new ConflictException('Cette tentative est déjà soumise.');
    }
    if (Date.now() >= expiresAt.getTime()) {
      throw new ConflictException('Le temps imparti est écoulé.');
    }
  }

  /** Vérifie que la session est ouvrable maintenant (horloge serveur). */
  private assertSessionOpen(session: SessionWithComposition): void {
    const now = new Date();
    if (!session.exam.isPublished) {
      throw new BadRequestException("L'examen n'est pas publié.");
    }
    if (session.status === 'CLOSED') {
      throw new BadRequestException('Cette session est fermée.');
    }
    if (now < session.opensAt) {
      throw new BadRequestException("Cette session n'est pas encore ouverte.");
    }
    if (now > session.closesAt) {
      throw new BadRequestException('Cette session est terminée.');
    }
  }

  /**
   * Construit la vue ÉTUDIANT : questions/options dans l'ordre figé,
   * réponse déjà sélectionnée le cas échéant, et SANS isCorrect.
   */
  private buildStudentView(
    attempt: AttemptWithAnswers,
    session: SessionWithComposition,
  ) {
    const questionById = new Map(
      session.exam.examQuestions.map((eq) => [eq.question.id, eq.question]),
    );
    const answerByQuestionId = new Map(
      attempt.answers.map((a) => [a.questionId, a]),
    );

    const questionOrder = attempt.questionOrder as unknown as string[];
    const now = Date.now();
    const remainingSeconds = Math.max(
      0,
      Math.floor((attempt.expiresAt.getTime() - now) / 1000),
    );

    const questions = questionOrder.map((questionId) => {
      const question = questionById.get(questionId)!;
      const answer = answerByQuestionId.get(questionId)!;
      const optionOrder = answer.optionOrder as unknown as string[];
      const optionById = new Map(question.options.map((o) => [o.id, o]));

      return {
        questionId,
        statement: question.statement,
        points: question.points,
        selectedOptionId: answer.selectedOptionId,
        // On n'expose QUE id + text : jamais isCorrect.
        options: optionOrder.map((optionId) => {
          const option = optionById.get(optionId)!;
          return { id: option.id, text: option.text };
        }),
      };
    });

    return {
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        remainingSeconds,
      },
      exam: {
        id: session.exam.id,
        title: session.exam.title,
        durationMinutes: session.exam.durationMinutes,
      },
      questions,
    };
  }
}
