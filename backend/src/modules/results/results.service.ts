// ============================================================
//  ResultsService : consultation des résultats côté staff.
//  Réutilise AttemptsService pour la correction détaillée (DRY).
// ============================================================
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttemptsService } from '../attempts/attempts.service';
import { ResultQueryDto } from './dto/result-query.dto';

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
}
