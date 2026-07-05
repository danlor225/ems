// ============================================================
//  ResultsPage — Résultats repensés (Phase C).
//  Sélection d'une évaluation -> analyses + tableau étudiants
//  (observations auto) + modale de correction.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { StatCard } from '@/components/ui/stat-card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { getEvaluations } from '../evaluations/evaluationsApi'
import {
  getEvaluationResults,
  getResultDetail,
  type ResultStatus,
} from './resultsApi'
import { Award, CheckCircle2, TrendingUp, Users } from 'lucide-react'

const STATUS_CLS: Record<ResultStatus, string> = {
  'Très Bien': 'bg-success/15 text-success',
  Bien: 'bg-primary/15 text-primary',
  Passable: 'bg-warning/15 text-warning',
  Mauvais: 'bg-danger/15 text-danger',
}

function fmtTime(sec: number | null): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function ResultDetailModal({
  attemptId,
  onClose,
}: {
  attemptId: string
  onClose: () => void
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['result-detail', attemptId],
    queryFn: () => getResultDetail(attemptId),
  })
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        {isPending ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : isError || !data ? (
          <p className="text-sm text-danger">Erreur.</p>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-foreground">
                  {data.student.firstName} {data.student.lastName}
                </h2>
                <p className="text-xs text-muted-foreground">{data.exam.title}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Fermer" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="space-y-3">
              {data.correction.map((item, qi) => (
                <div key={item.questionId} className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-medium text-foreground">
                    {qi + 1}. {item.statement}
                  </p>
                  <div className="space-y-1">
                    {item.options.map((opt) => {
                      const isSelected = item.selectedOptionId === opt.id
                      const cls = opt.isCorrect
                        ? 'text-success'
                        : isSelected
                          ? 'text-danger'
                          : 'text-muted-foreground'
                      return (
                        <div key={opt.id} className={`text-sm ${cls}`}>
                          {opt.isCorrect ? '✓ ' : isSelected ? '✗ ' : '• '}
                          {opt.text}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

export function ResultsPage() {
  const [evaluationId, setEvaluationId] = useState('')
  const [selectedAttempt, setSelectedAttempt] = useState<string | null>(null)

  const { data: evaluations } = useQuery({
    queryKey: ['evaluations', 'for-results'],
    queryFn: () => getEvaluations({ limit: 100 }),
  })

  const { data, isPending, isError } = useQuery({
    queryKey: ['evaluation-results', evaluationId],
    queryFn: () => getEvaluationResults(evaluationId),
    enabled: !!evaluationId,
  })

  const dist = data?.stats.distribution
  const chartData = dist
    ? [
        { name: 'Très Bien', value: dist.tresBien, color: '#10b981' },
        { name: 'Bien', value: dist.bien, color: '#1d4ed8' },
        { name: 'Passable', value: dist.passable, color: '#f59e0b' },
        { name: 'Mauvais', value: dist.mauvais, color: '#ef4444' },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Résultats
        </h1>
        <NativeSelect
          value={evaluationId}
          onChange={(e) => setEvaluationId(e.target.value)}
          className="sm:w-72"
        >
          <option value="">Choisir une évaluation…</option>
          {evaluations?.data.map((e) => (
            <option key={e.id} value={e.id}>
              {e.code ? `${e.code} · ` : ''}
              {e.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {!evaluationId ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Sélectionnez une évaluation pour afficher ses résultats.
          </CardContent>
        </Card>
      ) : isPending ? (
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="text-sm text-danger">Erreur de chargement.</p>
      ) : data.students.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Aucun résultat pour cette évaluation.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Analyses */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Participants" icon={Users} value={data.stats.participants} />
            <StatCard
              label="Moyenne"
              icon={TrendingUp}
              value={`${data.stats.average} / ${data.evaluation.totalPoints}`}
            />
            <StatCard label="Taux de réussite" icon={CheckCircle2} value={`${data.stats.successRate}%`} />
            <StatCard
              label="Meilleure note"
              icon={Award}
              value={`${data.stats.max} / ${data.evaluation.totalPoints}`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Indicateurs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  ['Médiane', `${data.stats.median} / ${data.evaluation.totalPoints}`],
                  ['Écart-type', `${data.stats.stdDev} pts`],
                  ['Note min', `${data.stats.min} / ${data.evaluation.totalPoints}`],
                  ['Note max', `${data.stats.max} / ${data.evaluation.totalPoints}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium text-foreground">{v}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Répartition des niveaux</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid items-center gap-4 sm:grid-cols-2">
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                        <Tooltip
                          cursor={{ fill: 'var(--muted)' }}
                          contentStyle={{
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'var(--popover)',
                            color: 'var(--popover-foreground)',
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {chartData.map((e) => (
                            <Cell key={e.name} fill={e.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2} strokeWidth={0}>
                          {chartData.map((e) => (
                            <Cell key={e.name} fill={e.color} />
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
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tableau étudiants */}
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Étudiant</TableHead>
                  <TableHead>Bonnes</TableHead>
                  <TableHead>Mauvaises</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Temps</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Observation</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.students.map((s) => (
                  <TableRow key={s.attemptId}>
                    <TableCell className="font-medium text-foreground">
                      {s.firstName} {s.lastName}
                    </TableCell>
                    <TableCell className="text-success">{s.correctCount}</TableCell>
                    <TableCell className="text-danger">{s.incorrectCount}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {s.note} / {data.evaluation.totalPoints}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtTime(s.timeSpentSeconds)}</TableCell>
                    <TableCell>
                      <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_CLS[s.status])}>
                        {s.status}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs text-xs text-muted-foreground">
                      <span className="line-clamp-2">{s.observation}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedAttempt(s.attemptId)}>
                        Voir réponses
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <AnimatePresence>
        {selectedAttempt && (
          <ResultDetailModal attemptId={selectedAttempt} onClose={() => setSelectedAttempt(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
