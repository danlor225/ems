// ============================================================
//  ReportsService : rapports analytiques agrégés (staff).
//  Une seule requête SQL enrichit chaque tentative terminée
//  (matière, groupe, période, pourcentage, réussite) ; on agrège
//  ensuite en mémoire par différentes dimensions.
// ============================================================
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface AttemptRow {
  subject: string;
  group_name: string | null;
  period: string; // 'YYYY-MM'
  pct: number;
  passed: boolean;
}

export interface Aggregate {
  label: string;
  participants: number;
  average: number; // moyenne sur 20
  successRate: number; // % de réussite
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReports() {
    const rows = await this.prisma.$queryRaw<AttemptRow[]>`
      SELECT
        sub.name AS subject,
        g.name AS group_name,
        to_char(COALESCE(a.submitted_at, a.started_at), 'YYYY-MM') AS period,
        CASE WHEN tp.total > 0 THEN (a.score / tp.total) * 100 ELSE 0 END AS pct,
        (CASE WHEN tp.total > 0 THEN (a.score / tp.total) * 100 ELSE 0 END) >= e.pass_score AS passed
      FROM attempts a
      JOIN sessions s ON s.id = a.session_id
      JOIN exams e ON e.id = s.exam_id
      JOIN subjects sub ON sub.id = e.subject_id
      JOIN users u ON u.id = a.student_id
      LEFT JOIN groups g ON g.id = u.group_id
      JOIN LATERAL (
        SELECT COALESCE(SUM(q.points), 0) AS total
        FROM exam_questions eq
        JOIN questions q ON q.id = eq.question_id
        WHERE eq.exam_id = e.id
      ) tp ON true
      WHERE a.status::text IN ('SUBMITTED', 'EXPIRED')`;

    // Normalisation (pg peut renvoyer les numériques en chaîne).
    const data = rows.map((r) => ({
      subject: r.subject,
      group: r.group_name ?? 'Sans groupe',
      period: r.period,
      pct: Number(r.pct),
      passed: Boolean(r.passed),
    }));

    return {
      overview: this.aggregate('Global', data),
      bySubject: this.groupAggregate(data, (d) => d.subject).sort(
        (a, b) => b.participants - a.participants,
      ),
      byGroup: this.groupAggregate(data, (d) => d.group).sort(
        (a, b) => b.participants - a.participants,
      ),
      timeline: this.groupAggregate(data, (d) => d.period).sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
    };
  }

  private aggregate(
    label: string,
    rows: { pct: number; passed: boolean }[],
  ): Aggregate {
    const n = rows.length;
    if (n === 0) {
      return { label, participants: 0, average: 0, successRate: 0 };
    }
    const sum = rows.reduce((s, r) => s + r.pct, 0);
    const passed = rows.filter((r) => r.passed).length;
    return {
      label,
      participants: n,
      // `pct` est un pourcentage (0-100) ; on l'exprime sur 20.
      average: this.round2(sum / n / 5),
      successRate: this.round2((passed / n) * 100),
    };
  }

  private groupAggregate<T extends { pct: number; passed: boolean }>(
    rows: T[],
    keyFn: (row: T) => string,
  ): Aggregate[] {
    const buckets = new Map<string, T[]>();
    for (const row of rows) {
      const key = keyFn(row);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(row);
      else buckets.set(key, [row]);
    }
    return [...buckets.entries()].map(([label, group]) =>
      this.aggregate(label, group),
    );
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
