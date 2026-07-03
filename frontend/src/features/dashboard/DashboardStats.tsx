// ============================================================
//  DashboardStats — KPIs animés + donut de répartition (Recharts).
//  Consomme GET /api/stats/dashboard.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, ClipboardList, FileText, Users } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { getDashboardStats } from './statsApi'

export function DashboardStats() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['stats', 'dashboard'],
    queryFn: getDashboardStats,
  })

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-28 animate-pulse" />
        ))}
      </div>
    )
  }
  if (isError) {
    return (
      <p className="text-sm text-danger">
        Impossible de charger les statistiques.
      </p>
    )
  }

  const d = data.distribution
  const total = d.excellent + d.bien + d.moyen + d.faible
  const donut = [
    { name: 'Excellents', value: d.excellent, color: '#10b981' },
    { name: 'Bien', value: d.bien, color: '#1d4ed8' },
    { name: 'Moyen', value: d.moyen, color: '#f59e0b' },
    { name: 'Faible', value: d.faible, color: '#ef4444' },
  ]

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Examens"
          icon={FileText}
          value={<AnimatedCounter value={data.counts.exams} />}
        />
        <StatCard
          label="Sessions"
          icon={CalendarClock}
          value={<AnimatedCounter value={data.counts.sessions} />}
        />
        <StatCard
          label="Étudiants"
          icon={Users}
          value={<AnimatedCounter value={data.counts.students} />}
        />
        <StatCard
          label="Tentatives"
          icon={ClipboardList}
          value={<AnimatedCounter value={data.counts.attempts} />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Indicateurs clés */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Indicateurs clés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground">Taux de réussite</p>
              <p className="text-4xl font-bold text-primary">
                {data.successRate}%
              </p>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-[width] duration-700"
                  style={{ width: `${data.successRate}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Score moyen</p>
              <p className="text-4xl font-bold text-foreground">
                {data.averageScore}%
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Répartition (donut) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Répartition des résultats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid items-center gap-6 sm:grid-cols-2">
              <div className="relative h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut}
                      dataKey="value"
                      innerRadius={64}
                      outerRadius={92}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {donut.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--popover)',
                        color: 'var(--popover-foreground)',
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>

              <ul className="space-y-3">
                {donut.map((entry) => (
                  <li
                    key={entry.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: entry.color }}
                      />
                      {entry.name}
                    </span>
                    <span className="font-medium text-foreground">
                      {entry.value} (
                      {total ? Math.round((entry.value / total) * 100) : 0}%)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
