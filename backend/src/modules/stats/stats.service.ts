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

    // 2) Score moyen (agrégation).
    const avg = await this.prisma.attempt.aggregate({
      where: finished,
      _avg: { score: true },
    });

    // 3) Répartition des notes (comptages par plage).
    const [excellent, bien, moyen, faible] = await this.prisma.$transaction([
      this.prisma.attempt.count({ where: { ...finished, score: { gte: 90 } } }),
      this.prisma.attempt.count({
        where: { ...finished, score: { gte: 70, lt: 90 } },
      }),
      this.prisma.attempt.count({
        where: { ...finished, score: { gte: 50, lt: 70 } },
      }),
      this.prisma.attempt.count({ where: { ...finished, score: { lt: 50 } } }),
    ]);

    // 4) Taux de réussite : compare score au passScore de CHAQUE examen.
    //    Comparaison entre colonnes => SQL brut (paramétré, sûr).
    const rows = await this.prisma.$queryRaw<
      Array<{ total: number; passed: number }>
    >`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE a.score >= e.pass_score)::int AS passed
      FROM attempts a
      JOIN sessions s ON s.id = a.session_id
      JOIN exams e ON e.id = s.exam_id
      WHERE a.status::text IN ('SUBMITTED', 'EXPIRED')`;
    const { total, passed } = rows[0];
    const successRate = total > 0 ? this.round2((passed / total) * 100) : 0;

    return {
      counts: { exams, sessions, students, attempts, questions },
      averageScore: avg._avg.score !== null ? this.round2(avg._avg.score) : 0,
      successRate,
      distribution: { excellent, bien, moyen, faible },
    };
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
