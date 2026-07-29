// ============================================================
//  StudentResultsPage — historique des évaluations de l'étudiant.
//  Pour chaque tentative : note obtenue, statut réussi/échoué, une
//  observation pédagogique selon la note, et un lien vers la
//  correction détaillée. Les résultats non publiés restent masqués.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { Award, CheckCircle2, ChevronRight, Clock, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getObservation } from './observation'
import { getMyAttempts, type MyAttempt } from './studentApi'

function pct(attempt: MyAttempt): number {
  if (attempt.score === null || attempt.totalPoints <= 0) return 0
  return (attempt.score / attempt.totalPoints) * 100
}

function ResultCard({ attempt }: { attempt: MyAttempt }) {
  const submitted = attempt.submittedAt
    ? new Date(attempt.submittedAt).toLocaleDateString('fr-FR')
    : null

  // Résultats non encore publiés par l'enseignant.
  if (attempt.resultsHidden || attempt.score === null) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground">
              {attempt.examTitle}
            </h3>
            <Badge variant="warning">En attente</Badge>
          </div>
          {submitted && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              Composé le {submitted}
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Vos résultats seront disponibles une fois publiés par
            l'enseignant.
          </p>
        </CardContent>
      </Card>
    )
  }

  const percentage = pct(attempt)
  const rounded = Math.round(percentage)
  const observation = getObservation(percentage)

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-foreground">
              {attempt.examTitle}
            </h3>
            {submitted && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                Composé le {submitted}
              </p>
            )}
          </div>
          {attempt.passed ? (
            <Badge variant="success">
              <CheckCircle2 className="size-3.5" />
              Réussi
            </Badge>
          ) : (
            <Badge variant="danger">
              <XCircle className="size-3.5" />
              Échoué
            </Badge>
          )}
        </div>

        {/* Note */}
        <div className="mt-4 flex items-end gap-3">
          <span className="text-3xl font-bold tabular-nums text-foreground">
            {attempt.score}
            <span className="text-base font-medium text-muted-foreground">
              {' '}
              / {attempt.totalPoints}
            </span>
          </span>
          <span className="mb-1 text-sm font-medium text-muted-foreground">
            ({rounded} %)
          </span>
        </div>

        {/* Observation selon la note */}
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
          <Badge variant={observation.tone}>{observation.label}</Badge>
          <p className="mt-2 text-sm text-foreground">{observation.message}</p>
        </div>

        {/* Lien vers la correction détaillée */}
        <Link
          to={`/resultats/${attempt.attemptId}`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Voir la correction détaillée
          <ChevronRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  )
}

export function StudentResultsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['student', 'attempts'],
    queryFn: getMyAttempts,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Mes résultats
      </h1>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="h-48 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-danger">
          Impossible de charger vos résultats.
        </p>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Award className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              Vous n'avez encore participé à aucune évaluation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((attempt) => (
            <ResultCard key={attempt.attemptId} attempt={attempt} />
          ))}
        </div>
      )}
    </div>
  )
}
