// ============================================================
//  StudentHome — évaluations disponibles (design system).
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Clock, GraduationCap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getAvailableSessions, getMyAttempts } from './studentApi'

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
                  onClick={() => navigate(`/evaluations/${session.id}`)}
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
    </div>
  )
}
