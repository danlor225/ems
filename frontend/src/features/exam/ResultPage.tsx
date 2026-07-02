// ============================================================
//  ResultPage : "Voir ma note" + correction détaillée.
//  Consomme GET /api/attempts/:id/result.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { getResult } from './examApi'

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
      <div className="grid min-h-screen place-items-center text-slate-400">
        Chargement du résultat…
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <p className="text-slate-700">Résultat indisponible.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 rounded-lg bg-ems-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Retour à l’accueil
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ems-bg p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Bloc note */}
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">Merci, votre évaluation est terminée.</p>
          <p className="mt-2 text-5xl font-extrabold text-ems-primary">
            {data.attempt.score}%
          </p>
          <span
            className={`mt-3 inline-block rounded-full px-4 py-1 text-sm font-semibold ${
              data.passed
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {data.passed ? 'Réussi' : 'Échoué'} — seuil {data.exam.passScore}%
          </span>
        </div>

        {/* Correction */}
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-800">Correction</h2>
          {data.correction.map((item, qi) => (
            <div key={item.questionId} className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="mb-3 font-medium text-slate-800">
                {qi + 1}. {item.statement}
              </p>
              <div className="space-y-2">
                {item.options.map((opt) => {
                  const isSelected = item.selectedOptionId === opt.id
                  const base =
                    'flex items-center justify-between rounded-lg border p-2.5 text-sm'
                  const style = opt.isCorrect
                    ? 'border-green-300 bg-green-50 text-green-800'
                    : isSelected
                      ? 'border-red-300 bg-red-50 text-red-800'
                      : 'border-slate-200 text-slate-600'
                  return (
                    <div key={opt.id} className={`${base} ${style}`}>
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
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full rounded-lg bg-ems-primary py-2.5 text-sm font-semibold text-white"
        >
          Retour à l’accueil
        </button>
      </div>
    </div>
  )
}
