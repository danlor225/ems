// ============================================================
//  ResultPage — "Voir ma note" + correction (design system).
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getResult } from './examApi'

const EASE = [0.16, 1, 0.3, 1] as const

export function ResultPage() {
  const { attemptId } = useParams()
  const navigate = useNavigate()

  const { data, isPending, isError } = useQuery({
    queryKey: ['result', attemptId],
    queryFn: () => getResult(attemptId!),
    retry: false,
  })

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        Chargement du résultat…
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-4">
        <Card className="p-8 text-center">
          <p className="text-foreground">Résultat indisponible.</p>
          <Button className="mt-4" onClick={() => navigate('/')}>
            Retour à l'accueil
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Bloc note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <Card>
            <CardContent className="flex flex-col items-center py-10 text-center">
              <div
                className={
                  data.passed
                    ? 'grid size-14 place-items-center rounded-full bg-success/15 text-success'
                    : 'grid size-14 place-items-center rounded-full bg-danger/15 text-danger'
                }
              >
                {data.passed ? (
                  <CheckCircle2 className="size-7" />
                ) : (
                  <XCircle className="size-7" />
                )}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Merci, votre évaluation est terminée.
              </p>
              <p className="mt-1 text-5xl font-extrabold tracking-tight text-primary">
                {data.attempt.score}
                <span className="text-2xl text-muted-foreground">
                  {' '}
                  / {data.exam.totalPoints}
                </span>
              </p>
              <Badge
                variant={data.passed ? 'success' : 'danger'}
                className="mt-3"
              >
                {data.passed ? 'Réussi' : 'Échoué'} — seuil {data.exam.passScore}
                %
              </Badge>
            </CardContent>
          </Card>
        </motion.div>

        {/* Correction */}
        <div className="space-y-4">
          <h2 className="font-semibold text-foreground">Correction</h2>
          {data.correction.map((item, qi) => (
            <Card key={item.questionId}>
              <CardContent className="p-5">
                <p className="mb-3 font-medium text-foreground">
                  {qi + 1}. {item.statement}
                </p>
                <div className="space-y-2">
                  {item.options.map((opt) => {
                    const isSelected = item.selectedOptionId === opt.id
                    const cls = opt.isCorrect
                      ? 'border-success/40 bg-success/10 text-success'
                      : isSelected
                        ? 'border-danger/40 bg-danger/10 text-danger'
                        : 'border-border text-muted-foreground'
                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center justify-between rounded-lg border p-2.5 text-sm ${cls}`}
                      >
                        <span>{opt.text}</span>
                        <span className="text-xs">
                          {opt.isCorrect
                            ? '✓ bonne réponse'
                            : isSelected
                              ? '✗ votre réponse'
                              : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button className="w-full" onClick={() => navigate('/')}>
          Retour à l'accueil
        </Button>
      </div>
    </div>
  )
}
