// ============================================================
//  DashboardStats : KPIs + répartition des notes (staff).
//  Consomme GET /api/stats/dashboard via TanStack Query.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { getDashboardStats } from './statsApi'

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  )
}

function DistributionBar({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-800">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export function DashboardStats() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: getDashboardStats,
  })

  if (isPending) {
    return <p className="text-sm text-slate-400">Chargement des statistiques…</p>
  }
  if (isError) {
    return (
      <p className="text-sm text-red-600">
        Impossible de charger les statistiques.
      </p>
    )
  }

  const d = data.distribution
  const distributionTotal = d.excellent + d.bien + d.moyen + d.faible

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Examens" value={data.counts.exams} />
        <KpiCard label="Sessions" value={data.counts.sessions} />
        <KpiCard label="Étudiants" value={data.counts.students} />
        <KpiCard label="Tentatives" value={data.counts.attempts} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">Indicateurs clés</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Taux de réussite</p>
              <p className="text-3xl font-bold text-ems-primary">
                {data.successRate}%
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Score moyen</p>
              <p className="text-3xl font-bold text-slate-800">
                {data.averageScore}%
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">
            Répartition des résultats
          </h2>
          <div className="space-y-3">
            <DistributionBar
              label="Excellents (90-100%)"
              count={d.excellent}
              total={distributionTotal}
              color="#10b981"
            />
            <DistributionBar
              label="Bien (70-89%)"
              count={d.bien}
              total={distributionTotal}
              color="#1d4ed8"
            />
            <DistributionBar
              label="Moyen (50-69%)"
              count={d.moyen}
              total={distributionTotal}
              color="#f59e0b"
            />
            <DistributionBar
              label="Faible (<50%)"
              count={d.faible}
              total={distributionTotal}
              color="#ef4444"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
