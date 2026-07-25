// ============================================================
//  StudentHome — évaluations disponibles (design system).
// ============================================================
import { useQuery } from '@tanstack/react-query'
import {
  AlarmClock,
  CalendarClock,
  Clock,
  GraduationCap,
  ListChecks,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import {
  getAvailableSessions,
  getMyAttempts,
  type AvailableSession,
} from './studentApi'

function formatTimeLeft(until: Date) {
  const now = Date.now()
  const ms = +until - now
  if (ms <= 0) return 'Clôturée'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `Expire dans ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Expire dans ${hours} h`
  const days = Math.floor(hours / 24)
  return `Expire dans ${days} j`
}

export function StudentHome() {
  const navigate = useNavigate()
  // Session choisie pour laquelle on affiche le modal de règles.
  // `null` = aucun modal ouvert.
  const [confirmSession, setConfirmSession] = useState<AvailableSession | null>(
    null,
  )
  // L'étudiant doit cocher « J'ai lu les règles » pour débloquer le démarrage.
  const [rulesAccepted, setRulesAccepted] = useState(false)

  // Ouvre le modal pour une session et réinitialise la case à cocher.
  function openConfirm(session: AvailableSession) {
    setRulesAccepted(false)
    setConfirmSession(session)
  }
  const { data, isPending, isError } = useQuery({
    queryKey: ['sessions', 'available'],
    queryFn: getAvailableSessions,
  })

  const { data: myAttempts } = useQuery({
    queryKey: ['student', 'attempts'],
    queryFn: getMyAttempts,
  })

  const attemptedSessionIds = new Set(
    (myAttempts || [])
      .filter((a) => a.sessionId)
      .map((a) => a.sessionId as string),
  )

  return (
    <div>
      <h2 className="mb-4 font-semibold text-foreground">
        Évaluations disponibles
      </h2>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-danger">
          Impossible de charger vos évaluations.
        </p>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <GraduationCap className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              Aucune évaluation disponible pour le moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((session) => (
            <Card key={session.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-foreground">
                    {session.exam.title}
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    {new Date(session.opensAt) > new Date() ? (
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-800">
                        À venir
                      </span>
                    ) : new Date(session.closesAt) < new Date() ? (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-red-800">
                          Fermée
                        </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">
                        Ouverte
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Clock className="size-4" />
                    Durée : {session.exam.durationMinutes} min
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarClock className="size-4" />
                    Clôture : {new Date(session.closesAt).toLocaleString('fr-FR')}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{formatTimeLeft(new Date(session.closesAt))}</span>
                  </p>
                </div>

                <div className="mt-4">
                  {attemptedSessionIds.has(session.id) && (
                    <div className="mb-2 text-sm text-foreground">
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-1 text-slate-800">
                        Vous avez déjà composé
                      </span>
                    </div>
                  )}
                <Button
                  className="mt-4 w-full"
                  onClick={() => openConfirm(session)}
                  disabled={
                    attemptedSessionIds.has(session.id) ||
                    new Date(session.opensAt) > new Date() ||
                    new Date(session.closesAt) < new Date()
                  }
                  aria-disabled={
                    attemptedSessionIds.has(session.id) ||
                    new Date(session.opensAt) > new Date() ||
                    new Date(session.closesAt) < new Date()
                  }
                >
                  {attemptedSessionIds.has(session.id)
                    ? 'Déjà composé'
                    : new Date(session.opensAt) > new Date()
                    ? 'Pas encore disponible'
                    : new Date(session.closesAt) < new Date()
                    ? 'Clôturée'
                    : 'Commencer'}
                </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de règles : décrit l'évaluation avant de la démarrer.
          Le minuteur serveur ne se déclenche qu'à la navigation. */}
      <Modal
        open={confirmSession !== null}
        onClose={() => setConfirmSession(null)}
        title="Avant de commencer"
        description={confirmSession?.exam.title}
      >
        {confirmSession && (
          <div className="space-y-5">
            {/* Récapitulatif de l'épreuve */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  Durée
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {confirmSession.exam.durationMinutes} min
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ListChecks className="size-3.5" />
                  Questions
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {confirmSession.exam._count.examQuestions}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  Clôture
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {new Date(confirmSession.closesAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>

            {/* Règles à respecter */}
            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">
                Règles à respecter
              </p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>
                    <span className="font-medium text-foreground">
                      Une seule tentative.
                    </span>{' '}
                    Une fois commencée, l'évaluation ne peut pas être
                    recommencée.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <AlarmClock className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>
                    <span className="font-medium text-foreground">
                      Minuteur chronométré.
                    </span>{' '}
                    Le compte à rebours démarre dès que vous commencez ; à zéro,
                    l'évaluation est soumise automatiquement.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <RefreshCw className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>
                    <span className="font-medium text-foreground">
                      Reprise possible.
                    </span>{' '}
                    Si vous fermez le navigateur, vous pouvez reprendre, mais le
                    temps continue de s'écouler.
                  </span>
                </li>
              </ul>
            </div>

            {/* Consentement : débloque le démarrage */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 transition-colors hover:bg-muted">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(e) => setRulesAccepted(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="text-sm text-foreground">
                J'ai lu et j'accepte les règles ci-dessus.
              </span>
            </label>

            {/* Actions */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmSession(null)}
              >
                Annuler
              </Button>
              <Button
                onClick={() => navigate(`/evaluations/${confirmSession.id}`)}
                disabled={!rulesAccepted}
                aria-disabled={!rulesAccepted}
              >
                Commencer maintenant
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
