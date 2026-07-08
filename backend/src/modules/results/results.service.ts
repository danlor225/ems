// ============================================================
//  ResultsService : consultation des résultats côté staff.
//  Réutilise AttemptsService pour la correction détaillée (DRY).
// ============================================================
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttemptsService } from '../attempts/attempts.service';
import { ResultQueryDto } from './dto/result-query.dto';

type ResultStatus = 'Très Bien' | 'Bien' | 'Passable' | 'Mauvais';

// Observations automatiques imposées par le cahier des charges.
const OBSERVATIONS: Record<ResultStatus, string> = {
  'Très Bien': 'Excellent niveau. Continue comme ça !',
  Bien: 'Bon niveau. Tu peux faire encore mieux lors de la prochaine évaluation.',
  Passable:
    'Résultat encourageant, mais davantage de travail et de régularité te permettront de progresser.',
  Mauvais:
    "Les objectifs ne sont pas encore atteints. Continue à travailler et n'hésite pas à revoir les notions essentielles avant la prochaine évaluation.",
};

function classify(pct: number): ResultStatus {
  if (pct >= 80) return 'Très Bien';
  if (pct >= 60) return 'Bien';
  if (pct >= 50) return 'Passable';
  return 'Mauvais';
}

/** Normalise un texte pour la correction des réponses libres. */
function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;:!?'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Égalité ensembliste (mêmes éléments, ordre indifférent). */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attemptsService: AttemptsService,
  ) {}

  /** Liste paginée et filtrable des tentatives terminées. */
  async findAll(query: ResultQueryDto) {
    const { page, limit, examId, sessionId, studentId, status } = query;

    const where: Prisma.AttemptWhereInput = {
      // Par défaut, seules les tentatives terminées ; sinon le statut demandé.
      status: status ?? { in: ['SUBMITTED', 'EXPIRED'] },
      ...(sessionId ? { sessionId } : {}),
      ...(studentId ? { studentId } : {}),
      ...(examId ? { session: { examId } } : {}),
    };
    const skip = (page - 1) * limit;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.attempt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          session: {
            include: { exam: { select: { title: true, passScore: true } } },
          },
        },
      }),
      this.prisma.attempt.count({ where }),
    ]);

    const data = rows.map((a) => ({
      attemptId: a.id,
      student: a.student,
      examTitle: a.session.exam.title,
      score: a.score,
      passed: a.score !== null && a.score >= a.session.exam.passScore,
      status: a.status,
      submittedAt: a.submittedAt,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Correction détaillée d'une tentative (délègue à AttemptsService). */
  findOne(attemptId: string) {
    return this.attemptsService.getResultForStaff(attemptId);
  }

  /** Résultats détaillés + statistiques pour une évaluation donnée. */
  async getByEvaluation(evaluationId: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: evaluationId },
      select: {
        id: true,
        title: true,
        passScore: true,
        examQuestions: {
          select: {
            questionId: true,
            question: {
              select: {
                points: true,
                type: true,
                options: {
                  where: { isCorrect: true },
                  select: { id: true, text: true },
                },
              },
            },
          },
        },
      },
    });
    if (!exam) {
      throw new NotFoundException('Évaluation introuvable.');
    }
    // Par question : type, ids des bonnes options, réponses acceptées (texte).
    const typeByQuestion = new Map(
      exam.examQuestions.map((eq) => [eq.questionId, eq.question.type]),
    );
    const correctIdsByQuestion = new Map(
      exam.examQuestions.map((eq) => [
        eq.questionId,
        eq.question.options.map((o) => o.id),
      ]),
    );
    const acceptedByQuestion = new Map(
      exam.examQuestions.map((eq) => [
        eq.questionId,
        eq.question.options.map((o) => normalize(o.text)),
      ]),
    );
    // Note maximale = somme des points des questions de l'évaluation.
    const totalPoints = exam.examQuestions.reduce(
      (sum, eq) => sum + eq.question.points,
      0,
    );

    const attempts = await this.prisma.attempt.findMany({
      where: {
        session: { examId: evaluationId },
        status: { in: ['SUBMITTED', 'EXPIRED'] },
      },
      orderBy: { score: 'desc' },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            matricule: true,
            group: { select: { name: true } },
          },
        },
        answers: {
          select: {
            questionId: true,
            selectedOptionId: true,
            selectedOptionIds: true,
            textAnswer: true,
          },
        },
      },
    });

    const students = attempts.map((a) => {
      let correctCount = 0;
      let incorrectCount = 0;
      let unansweredCount = 0;
      for (const ans of a.answers) {
        const type = typeByQuestion.get(ans.questionId);
        const correctIds = correctIdsByQuestion.get(ans.questionId) ?? [];
        let answered: boolean;
        let correct: boolean;
        if (type === 'SHORT_ANSWER') {
          const given = normalize(ans.textAnswer);
          answered = given.length > 0;
          correct =
            answered &&
            (acceptedByQuestion.get(ans.questionId) ?? []).includes(given);
        } else if (type === 'MULTIPLE_CHOICE') {
          const selected = Array.isArray(ans.selectedOptionIds)
            ? (ans.selectedOptionIds as string[])
            : [];
          answered = selected.length > 0;
          correct = answered && sameSet(selected, correctIds);
        } else {
          answered = !!ans.selectedOptionId;
          correct = answered && ans.selectedOptionId === correctIds[0];
        }
        if (!answered) unansweredCount++;
        else if (correct) correctCount++;
        else incorrectCount++;
      }
      const note = a.score ?? 0; // note = somme des points obtenus
      const percentage = totalPoints > 0 ? (note / totalPoints) * 100 : 0;
      const status = classify(percentage);
      const timeSpentSeconds = a.submittedAt
        ? Math.max(
            0,
            Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 1000),
          )
        : null;
      return {
        attemptId: a.id,
        firstName: a.student.firstName,
        lastName: a.student.lastName,
        email: a.student.email,
        matricule: a.student.matricule,
        className: a.student.group?.name ?? null,
        submittedAt: a.submittedAt,
        timeSpentSeconds,
        correctCount,
        incorrectCount,
        unansweredCount,
        note,
        status,
        observation: OBSERVATIONS[status],
      };
    });

    return {
      evaluation: {
        id: exam.id,
        title: exam.title,
        passScore: exam.passScore,
        totalPoints,
      },
      stats: this.computeStats(
        students.map((s) => s.note),
        exam.passScore,
        totalPoints,
        students,
      ),
      students,
    };
  }

  private computeStats(
    notes: number[],
    passScore: number,
    totalPoints: number,
    students: { status: ResultStatus }[],
  ) {
    const n = notes.length;
    const distribution = { tresBien: 0, bien: 0, passable: 0, mauvais: 0 };
    for (const s of students) {
      if (s.status === 'Très Bien') distribution.tresBien++;
      else if (s.status === 'Bien') distribution.bien++;
      else if (s.status === 'Passable') distribution.passable++;
      else distribution.mauvais++;
    }
    if (n === 0) {
      return {
        participants: 0,
        average: 0,
        max: 0,
        min: 0,
        median: 0,
        stdDev: 0,
        successRate: 0,
        distribution,
      };
    }
    const sorted = [...notes].sort((a, b) => a - b);
    const average = notes.reduce((s, x) => s + x, 0) / n;
    const median =
      n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const variance = notes.reduce((s, x) => s + (x - average) ** 2, 0) / n;
    // Réussite : pourcentage (note/total) >= passScore.
    const passed = notes.filter(
      (note) => totalPoints > 0 && (note / totalPoints) * 100 >= passScore,
    ).length;
    const r2 = (x: number) => Math.round(x * 100) / 100;
    return {
      participants: n,
      average: r2(average),
      max: sorted[n - 1],
      min: sorted[0],
      median: r2(median),
      stdDev: r2(Math.sqrt(variance)),
      successRate: r2((passed / n) * 100),
      distribution,
    };
  }
}
