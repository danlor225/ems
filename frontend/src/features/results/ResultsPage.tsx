// ============================================================
//  ResultsPage — consultation des résultats (design system).
//  Tableau filtrable + modale de correction animée.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getExams } from '../exams/examsApi'
import { getResultDetail, getResults } from './resultsApi'

const EASE = [0.16, 1, 0.3, 1] as const

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
        transition={{ duration: 0.2, ease: EASE }}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        {isPending ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : isError || !data ? (
          <p className="text-sm text-danger">Erreur de chargement.</p>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-foreground">
                  {data.student.firstName} {data.student.lastName}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {data.exam.title}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {data.attempt.score}%
                  </p>
                  <Badge variant={data.passed ? 'success' : 'danger'}>
                    {data.passed ? 'Réussi' : 'Échoué'}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Fermer"
                  onClick={onClose}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {data.correction.map((item, qi) => (
                <div
                  key={item.questionId}
                  className="rounded-lg border border-border p-3"
                >
                  <p className="mb-2 text-sm font-medium text-foreground">
                    {qi + 1}. {item.statement}
                  </p>
                  <div className="space-y-1">
                    {item.options.map((opt) => {
                      const isSelected = item.selectedOptionId === opt.id
                      const style = opt.isCorrect
                        ? 'text-success'
                        : isSelected
                          ? 'text-danger'
                          : 'text-muted-foreground'
                      return (
                        <div key={opt.id} className={`text-sm ${style}`}>
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
  const [examId, setExamId] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const { data: exams } = useQuery({ queryKey: ['exams'], queryFn: () => getExams() })
  const { data, isPending, isError } = useQuery({
    queryKey: ['results', examId, status],
    queryFn: () =>
      getResults({ examId: examId || undefined, status: status || undefined }),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Résultats
      </h1>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
          className="h-9 w-auto"
        >
          <option value="">Tous les examens</option>
          {exams?.data.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 w-auto"
        >
          <option value="">Tous les statuts</option>
          <option value="SUBMITTED">Soumis</option>
          <option value="EXPIRED">Expiré</option>
        </NativeSelect>
      </div>

      {/* Tableau */}
      <Card className="overflow-hidden">
        {isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="p-6 text-sm text-danger">Erreur de chargement.</p>
        ) : data.data.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Aucun résultat.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Étudiant</TableHead>
                <TableHead>Examen</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Résultat</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((row) => (
                <TableRow
                  key={row.attemptId}
                  onClick={() => setSelected(row.attemptId)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium text-foreground">
                    {row.student.firstName} {row.student.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.examTitle}
                  </TableCell>
                  <TableCell className="text-foreground">{row.score}%</TableCell>
                  <TableCell>
                    <Badge variant={row.passed ? 'success' : 'danger'}>
                      {row.passed ? 'Réussi' : 'Échoué'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.submittedAt
                      ? new Date(row.submittedAt).toLocaleString('fr-FR')
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <AnimatePresence>
        {selected && (
          <ResultDetailModal
            attemptId={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
