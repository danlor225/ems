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
type AttemptForResult = Prisma.AttemptGetPayload<{
  include: {
    answers: true;
    student: {
      select: { id: true; firstName: true; lastName: true; email: true };
    };
    session: {
      include: {
        exam: {
          select: {
            title: true;
            passScore: true;
            durationMinutes: true;
            showResultImmediately: true;
          };
        };
      };
    };
  };
}>;

/** Mélange un tableau (Fisher-Yates). Non critique => Math.random suffit. */
function shuffle<T>(input: T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Égalité ensembliste (mêmes éléments, ordre indifférent, valeurs uniques). */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

/** Lit un champ Json d'ids en tableau de chaînes (tolère null). */
function asIdArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * Normalise un texte pour la correction des réponses libres :
 * minuscules, espaces réduits, accents retirés, ponctuation de bord.
 */
function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques (accents)
    .toLowerCase()
    .replace(/[.,;:!?'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

    // Le type détermine la forme attendue de la réponse.
    const question = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
      select: { type: true },
    });
    if (!question) {
      throw new BadRequestException('Question introuvable.');
    }

    // Les options choisies doivent appartenir à la question (dans optionOrder).
    const optionOrder = answer.optionOrder as unknown as string[];
    const remainingSeconds = Math.max(
      0,
      Math.floor((attempt.expiresAt.getTime() - Date.now()) / 1000),
    );

    if (question.type === 'SHORT_ANSWER') {
      const text = (dto.text ?? '').trim();
      await this.prisma.attemptAnswer.update({
        where: {
          attemptId_questionId: { attemptId, questionId: dto.questionId },
        },
        data: {
          textAnswer: text.length > 0 ? text : null,
          selectedOptionId: null,
          selectedOptionIds: Prisma.DbNull,
          answeredAt: new Date(),
        },
      });
      return {
        saved: true,
        questionId: dto.questionId,
        text,
        remainingSeconds,
      };
    }

    if (question.type === 'MULTIPLE_CHOICE') {
      const selected = dto.selectedOptionIds ?? [];
      if (selected.some((id) => !optionOrder.includes(id))) {
        throw new BadRequestException('Option invalide pour cette question.');
      }
      await this.prisma.attemptAnswer.update({
        where: {
          attemptId_questionId: { attemptId, questionId: dto.questionId },
        },
        data: {
          selectedOptionIds: selected,
          selectedOptionId: null, // exclusif du multi
          answeredAt: new Date(),
        },
      });
      return {
        saved: true,
        questionId: dto.questionId,
        selectedOptionIds: selected,
        remainingSeconds,
      };
    }

    // SINGLE_CHOICE / TRUE_FALSE : une seule option, requise et valide.
    const selectedOptionId = dto.selectedOptionId;
    if (!selectedOptionId || !optionOrder.includes(selectedOptionId)) {
      throw new BadRequestException('Option invalide pour cette question.');
    }
    await this.prisma.attemptAnswer.update({
      where: {
        attemptId_questionId: { attemptId, questionId: dto.questionId },
      },
      data: {
        selectedOptionId,
        selectedOptionIds: Prisma.DbNull, // exclusif du choix unique
        answeredAt: new Date(),
      },
    });
    return {
      saved: true,
      questionId: dto.questionId,
      selectedOptionId,
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
        type: true,
        options: { where: { isCorrect: true }, select: { id: true, text: true } },
      },
    });
    // Toutes les bonnes options par question (une seule pour choix unique).
    const correctIdsByQuestion = new Map(
      questions.map((q) => [q.id, q.options.map((o) => o.id)]),
    );
    // Réponses acceptées (normalisées) pour les réponses libres.
    const acceptedByQuestion = new Map(
      questions.map((q) => [q.id, q.options.map((o) => normalizeText(o.text))]),
    );
    const typeByQuestion = new Map(questions.map((q) => [q.id, q.type]));
    const pointsByQuestion = new Map(questions.map((q) => [q.id, q.points]));

    let earned = 0;
    for (const answer of attempt.answers) {
      const points = pointsByQuestion.get(answer.questionId) ?? 0;
      const correctIds = correctIdsByQuestion.get(answer.questionId) ?? [];
      const type = typeByQuestion.get(answer.questionId);
      if (type === 'SHORT_ANSWER') {
        // Correspondance normalisée avec une réponse acceptée.
        const given = normalizeText(answer.textAnswer);
        const accepted = acceptedByQuestion.get(answer.questionId) ?? [];
        if (given.length > 0 && accepted.includes(given)) {
          earned += points;
        }
      } else if (type === 'MULTIPLE_CHOICE') {
        // Tout ou rien : l'ensemble coché doit correspondre EXACTEMENT.
        const selected = asIdArray(answer.selectedOptionIds);
        if (selected.length > 0 && sameSet(selected, correctIds)) {
          earned += points;
        }
      } else if (
        answer.selectedOptionId &&
        answer.selectedOptionId === correctIds[0]
      ) {
        earned += points;
      }
    }
    // Note = SOMME des points obtenus (barème en points bruts, pas en %).
    const score = earned;

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

  /** Résultat détaillé (correction) pour l'ÉTUDIANT propriétaire. */
  async getResult(studentId: string, attemptId: string) {
    const attempt = await this.loadAttemptForResult(attemptId);
    if (!attempt || attempt.studentId !== studentId) {
      throw new NotFoundException('Tentative introuvable.');
    }
    if (attempt.status === 'IN_PROGRESS') {
      throw new ConflictException(
        "Résultat indisponible : l'évaluation n'est pas encore soumise.",
      );
    }
    // Intégrité : si l'enseignant a désactivé l'affichage immédiat, l'étudiant
    // ne voit NI sa note NI la correction (juste une confirmation). Le staff,
    // lui, passe par getResultForStaff (non affecté).
    if (!attempt.session.exam.showResultImmediately) {
      return {
        hidden: true as const,
        attempt: {
          id: attempt.id,
          status: attempt.status,
          submittedAt: attempt.submittedAt,
        },
        exam: { title: attempt.session.exam.title },
      };
    }
    const result = await this.buildResult(attempt);
    return { hidden: false as const, ...result };
  }

  /** Résultat détaillé pour le STAFF (enseignant/admin), sans ownership. */
  async getResultForStaff(attemptId: string) {
    const attempt = await this.loadAttemptForResult(attemptId);
    if (!attempt) {
      throw new NotFoundException('Tentative introuvable.');
    }
    if (attempt.status === 'IN_PROGRESS') {
      throw new ConflictException("L'évaluation n'est pas encore soumise.");
    }
    return this.buildResult(attempt);
  }

  /** Charge une tentative avec tout le nécessaire au calcul du résultat. */
  private loadAttemptForResult(attemptId: string) {
    return this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        session: {
          include: {
            exam: {
              select: {
                title: true,
                passScore: true,
                durationMinutes: true,
                showResultImmediately: true,
              },
            },
          },
        },
      },
    });
  }

  /** Construit la correction détaillée d'une tentative terminée. */
  private async buildResult(attempt: AttemptForResult) {
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
      const correctIds = question.options
        .filter((o) => o.isCorrect)
        .map((o) => o.id);

      const isShort = question.type === 'SHORT_ANSWER';
      const isMultiple = question.type === 'MULTIPLE_CHOICE';

      // Réponse libre : réponses acceptées (tous les libellés) + correspondance.
      const acceptedAnswers = isShort
        ? question.options.map((o) => o.text)
        : [];
      if (isShort) {
        const given = normalizeText(answer.textAnswer);
        const isCorrect =
          given.length > 0 &&
          acceptedAnswers.map((t) => normalizeText(t)).includes(given);
        return {
          questionId,
          type: question.type,
          statement: question.statement,
          points: question.points,
          selectedOptionId: null,
          correctOptionId: null,
          selectedOptionIds: [],
          correctOptionIds: [],
          textAnswer: answer.textAnswer,
          acceptedAnswers,
          isCorrect,
          options: [] as { id: string; text: string; isCorrect: boolean }[],
        };
      }

      const selectedIds = isMultiple
        ? asIdArray(answer.selectedOptionIds)
        : answer.selectedOptionId
          ? [answer.selectedOptionId]
          : [];
      const isCorrect = isMultiple
        ? selectedIds.length > 0 && sameSet(selectedIds, correctIds)
        : selectedIds.length === 1 && selectedIds[0] === correctIds[0];

      return {
        questionId,
        type: question.type,
        statement: question.statement,
        points: question.points,
        // Champs "choix unique" conservés pour compatibilité de l'UI existante.
        selectedOptionId: answer.selectedOptionId,
        correctOptionId: isMultiple ? null : (correctIds[0] ?? null),
        // Champs "multi" (tableaux) pour les QCM à réponses multiples.
        selectedOptionIds: selectedIds,
        correctOptionIds: correctIds,
        textAnswer: null as string | null,
        acceptedAnswers,
        isCorrect,
        options: optionOrder.map((optionId) => {
          const o = optionById.get(optionId)!;
          return { id: o.id, text: o.text, isCorrect: o.isCorrect };
        }),
      };
    });

    const passScore = attempt.session.exam.passScore;
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
    const percentage =
      attempt.score !== null && totalPoints > 0
        ? (attempt.score / totalPoints) * 100
        : 0;
    return {
      attempt: {
        id: attempt.id,
        status: attempt.status,
        score: attempt.score, // note = somme des points
        submittedAt: attempt.submittedAt,
      },
      student: attempt.student,
      exam: {
        title: attempt.session.exam.title,
        passScore,
        durationMinutes: attempt.session.exam.durationMinutes,
        totalPoints, // note maximale (somme des points des questions)
      },
      passed: percentage >= passScore,
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
          include: {
            exam: {
              select: {
                title: true,
                passScore: true,
                showResultImmediately: true,
                examQuestions: {
                  select: { question: { select: { points: true } } },
                },
              },
            },
          },
        },
      },
    });

    return attempts.map((a) => {
      const totalPoints = a.session.exam.examQuestions.reduce(
        (sum, eq) => sum + eq.question.points,
        0,
      );
      const percentage =
        a.score !== null && totalPoints > 0 ? (a.score / totalPoints) * 100 : 0;
      // Si l'affichage immédiat est désactivé, on masque la note/réussite.
      const hidden = !a.session.exam.showResultImmediately;
      return {
        attemptId: a.id,
        sessionId: a.sessionId,
        examTitle: a.session.exam.title,
        resultsHidden: hidden,
        score: hidden ? null : a.score, // points
        totalPoints,
        passed: hidden ? null : percentage >= a.session.exam.passScore,
        status: a.status,
        submittedAt: a.submittedAt,
      };
    });
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
      const isShort = question.type === 'SHORT_ANSWER';

      return {
        questionId,
        type: question.type,
        statement: question.statement,
        points: question.points,
        selectedOptionId: answer.selectedOptionId,
        selectedOptionIds: asIdArray(answer.selectedOptionIds),
        // Réponse libre déjà saisie (reprise). Aucune option n'est exposée :
        // les "options" d'une réponse libre SONT les réponses acceptées.
        textAnswer: isShort ? (answer.textAnswer ?? '') : null,
        options: isShort
          ? []
          : optionOrder.map((optionId) => {
              const option = optionById.get(optionId)!;
              // On n'expose QUE id + text : jamais isCorrect.
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
