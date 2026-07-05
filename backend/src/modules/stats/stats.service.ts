// ============================================================
//  StatsService : agrégats du tableau de bord (staff).
//  On délègue les calculs à PostgreSQL (count/aggregate/raw) :
//  on ne charge JAMAIS toutes les lignes pour compter en JS.
// ============================================================
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    // Tentatives "terminées" (soumises ou expirées) : base des statistiques.
    const finished: Prisma.AttemptWhereInput = {
      status: { in: ['SUBMITTED', 'EXPIRED'] },
    };

    // 1) Compteurs (chaque count est exécuté par la base).
    const [exams, sessions, students, attempts, questions] =
      await this.prisma.$transaction([
        this.prisma.exam.count(),
        this.prisma.session.count(),
        this.prisma.user.count({ where: { role: 'STUDENT' } }),
        this.prisma.attempt.count({ where: finished }),
        this.prisma.question.count(),
      ]);

    // La note est en POINTS bruts ; on dérive un pourcentage par tentative
    // (note / total des points de l'évaluation) pour agréger un tableau de bord
    // comparable entre évaluations de barèmes différents.
    const rows = await this.prisma.$queryRaw<
      Array<{ pct: number; pass_score: number }>
    >`
      SELECT
        CASE WHEN tp.total > 0 THEN (a.score / tp.total) * 100 ELSE 0 END AS pct,
        e.pass_score AS pass_score
      FROM attempts a
      JOIN sessions s ON s.id = a.session_id
      JOIN exams e ON e.id = s.exam_id
      JOIN LATERAL (
        SELECT COALESCE(SUM(q.points), 0) AS total
        FROM exam_questions eq
        JOIN questions q ON q.id = eq.question_id
        WHERE eq.exam_id = e.id
      ) tp ON true
      WHERE a.status::text IN ('SUBMITTED', 'EXPIRED')`;

    const n = rows.length;
    const pcts = rows.map((r) => Number(r.pct));
    const averageScore = n
      ? this.round2(pcts.reduce((s, p) => s + p, 0) / n)
      : 0;
    const passed = rows.filter(
      (r) => Number(r.pct) >= Number(r.pass_score),
    ).length;
    const successRate = n ? this.round2((passed / n) * 100) : 0;

    const distribution = { excellent: 0, bien: 0, moyen: 0, faible: 0 };
    for (const p of pcts) {
      if (p >= 90) distribution.excellent++;
      else if (p >= 70) distribution.bien++;
      else if (p >= 50) distribution.moyen++;
      else distribution.faible++;
    }

    return {
      counts: { exams, sessions, students, attempts, questions },
      averageScore,
      successRate,
      distribution,
    };
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
