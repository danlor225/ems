// ============================================================
//  ResultsPage : consultation des résultats (staff).
//  - tableau filtrable (examen, statut)
//  - clic sur une ligne -> modale de correction détaillée
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getExams } from '../exams/examsApi'
import { getResultDetail, getResults } from './resultsApi'

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {isPending ? (
          <p className="text-sm text-slate-400">Chargement…</p>
        ) : isError || !data ? (
          <p className="text-sm text-red-600">Erreur de chargement.</p>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-slate-800">
                  {data.student.firstName} {data.student.lastName}
                </h2>
                <p className="text-xs text-slate-400">{data.exam.title}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-ems-primary">
                  {data.attempt.score}%
                </p>
                <span
                  className={`text-xs font-semibold ${
                    data.passed ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {data.passed ? 'Réussi' : 'Échoué'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {data.correction.map((item, qi) => (
                <div
                  key={item.questionId}
                  className="rounded-lg border border-slate-100 p-3"
                >
                  <p className="mb-2 text-sm font-medium text-slate-800">
                    {qi + 1}. {item.statement}
                  </p>
                  <div className="space-y-1">
                    {item.options.map((opt) => {
                      const isSelected = item.selectedOptionId === opt.id
                      const style = opt.isCorrect
                        ? 'text-green-700'
                        : isSelected
                          ? 'text-red-700'
                          : 'text-slate-500'
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

            <button
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-ems-primary py-2 text-sm font-semibold text-white"
            >
              Fermer
            </button>
          </>
        )}
      </div>
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
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Résultats</h1>

      {/* Filtres */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-ems-primary"
        >
          <option value="">Tous les examens</option>
          {exams?.data.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-ems-primary"
        >
          <option value="">Tous les statuts</option>
          <option value="SUBMITTED">Soumis</option>
          <option value="EXPIRED">Expiré</option>
        </select>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {isPending ? (
          <p className="p-6 text-sm text-slate-400">Chargement…</p>
        ) : isError ? (
          <p className="p-6 text-sm text-red-600">Erreur de chargement.</p>
        ) : data.data.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aucun résultat.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Étudiant</th>
                <th className="px-5 py-3 font-medium">Examen</th>
                <th className="px-5 py-3 font-medium">Score</th>
                <th className="px-5 py-3 font-medium">Résultat</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((row) => (
                <tr
                  key={row.attemptId}
                  onClick={() => setSelected(row.attemptId)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {row.student.firstName} {row.student.lastName}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{row.examTitle}</td>
                  <td className="px-5 py-3 text-slate-800">{row.score}%</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.passed
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {row.passed ? 'Réussi' : 'Échoué'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {row.submittedAt
                      ? new Date(row.submittedAt).toLocaleString('fr-FR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <ResultDetailModal
          attemptId={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
