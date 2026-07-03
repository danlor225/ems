// ============================================================
//  StudentHome — évaluations disponibles (design system).
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Clock, GraduationCap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getAvailableSessions } from './studentApi'

export function StudentHome() {
  const navigate = useNavigate()
  const { data, isPending, isError } = useQuery({
    queryKey: ['sessions', 'available'],
    queryFn: getAvailableSessions,
  })

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
                <h3 className="font-semibold text-foreground">
                  {session.exam.title}
                </h3>
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Clock className="size-4" />
                    Durée : {session.exam.durationMinutes} min
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarClock className="size-4" />
                    Jusqu'au{' '}
                    {new Date(session.closesAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                <Button
                  className="mt-4 w-full"
                  onClick={() => navigate(`/evaluations/${session.id}`)}
                >
                  Commencer
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
