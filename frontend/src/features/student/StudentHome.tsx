// ============================================================
//  StudentHome : liste des évaluations disponibles pour l'étudiant.
//  Consomme GET /api/sessions/available.
//  Le lancement effectif d'une évaluation arrivera en Phase 7.4.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getAvailableSessions } from './studentApi'

export function StudentHome() {
  const navigate = useNavigate()
  const { data, isPending, isError } = useQuery({
    queryKey: ['sessions', 'available'],
    queryFn: getAvailableSessions,
  })

  if (isPending) {
    return <p className="text-sm text-slate-400">Chargement…</p>
  }
  if (isError) {
    return (
      <p className="text-sm text-red-600">
        Impossible de charger vos évaluations.
      </p>
    )
  }

  return (
    <div>
      <h2 className="mb-4 font-semibold text-slate-800">
        Évaluations disponibles
      </h2>

      {data.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
          Aucune évaluation disponible pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.map((session) => (
            <div
              key={session.id}
              className="rounded-2xl bg-white p-5 shadow-sm"
            >
              <h3 className="font-semibold text-slate-800">
                {session.exam.title}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Durée : {session.exam.durationMinutes} min
              </p>
              <p className="text-xs text-slate-400">
                Ouvert jusqu’au{' '}
                {new Date(session.closesAt).toLocaleString('fr-FR')}
              </p>
              <button
                type="button"
                onClick={() => navigate(`/evaluations/${session.id}`)}
                className="mt-4 w-full rounded-lg bg-ems-primary py-2 text-sm font-semibold text-white transition hover:bg-ems-dark"
              >
                Commencer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
