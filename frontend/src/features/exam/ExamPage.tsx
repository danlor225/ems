// ============================================================
//  ExamPage : écran d'épreuve.
//  - démarre/reprend la tentative (POST /sessions/:id/start)
//  - minuteur basé sur expiresAt (horloge serveur)
//  - sauvegarde auto à chaque sélection (PATCH .../answers)
//  - soumission manuelle OU automatique à la fin du temps
// ============================================================
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { saveAnswer, startAttempt, submitAttempt } from './examApi'

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

export function ExamPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const { data, isPending, isError } = useQuery({
    queryKey: ['attempt', 'start', sessionId],
    queryFn: () => startAttempt(sessionId!),
    retry: false,
  })

  const [answers, setAnswers] = useState<Record<string, string | null>>({})
  const [index, setIndex] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const submittedRef = useRef(false)

  const save = useMutation({
    mutationFn: (v: { questionId: string; optionId: string }) =>
      saveAnswer(data!.attempt.id, v.questionId, v.optionId),
  })
  const submit = useMutation({
    mutationFn: () => submitAttempt(data!.attempt.id),
    onSuccess: () => navigate(`/resultats/${data!.attempt.id}`, { replace: true }),
  })

  // Initialise les réponses déjà enregistrées (reprise).
  useEffect(() => {
    if (!data) return
    const init: Record<string, string | null> = {}
    data.questions.forEach((q) => (init[q.questionId] = q.selectedOptionId))
    setAnswers(init)
  }, [data])

  // Minuteur : recalculé depuis expiresAt (pas de dérive), auto-soumission à 0.
  useEffect(() => {
    if (!data) return
    const expires = new Date(data.attempt.expiresAt).getTime()
    const tick = () => {
      const r = Math.max(0, Math.floor((expires - Date.now()) / 1000))
      setRemaining(r)
      if (r <= 0 && !submittedRef.current) {
        submittedRef.current = true
        submit.mutate()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        Préparation de l’évaluation…
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <p className="text-slate-700">
            Cette évaluation n’est pas accessible (déjà passée ou fermée).
          </p>
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

  const question = data.questions[index]
  const answeredCount = Object.values(answers).filter(Boolean).length

  function choose(optionId: string) {
    setAnswers((prev) => ({ ...prev, [question.questionId]: optionId }))
    save.mutate({ questionId: question.questionId, optionId })
  }

  function doSubmit() {
    if (submittedRef.current) return
    submittedRef.current = true
    submit.mutate()
  }

  return (
    <div className="min-h-screen bg-ems-bg">
      {/* En-tête : titre + minuteur */}
      <header className="flex items-center justify-between bg-ems-dark px-6 py-4 text-white">
        <div>
          <p className="text-xs text-white/60">Évaluation en cours</p>
          <h1 className="font-semibold">{data.exam.title}</h1>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/60">Temps restant</p>
          <p className="font-mono text-xl font-bold">{formatTime(remaining)}</p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Question {index + 1} / {data.questions.length}
          </span>
          <span>
            {answeredCount} / {data.questions.length} répondues
          </span>
        </div>

        {/* Carte question */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-1 text-xs font-medium text-ems-primary">
            {question.points} point{question.points > 1 ? 's' : ''}
          </p>
          <p className="mb-5 text-lg font-semibold text-slate-800">
            {question.statement}
          </p>

          <div className="space-y-3">
            {question.options.map((opt, i) => {
              const selected = answers[question.questionId] === opt.id
              return (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                    selected
                      ? 'border-ems-primary bg-ems-primary/5'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={question.questionId}
                    checked={selected}
                    onChange={() => choose(opt.id)}
                    className="h-4 w-4 accent-ems-primary"
                  />
                  <span className="font-medium text-slate-500">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <span className="text-slate-800">{opt.text}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-40"
          >
            ← Précédent
          </button>
          {index < data.questions.length - 1 ? (
            <button
              onClick={() =>
                setIndex((i) => Math.min(data.questions.length - 1, i + 1))
              }
              className="rounded-lg bg-ems-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Suivant →
            </button>
          ) : (
            <button
              onClick={doSubmit}
              disabled={submit.isPending}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submit.isPending ? 'Envoi…' : 'Terminer l’évaluation'}
            </button>
          )}
        </div>

        {/* Grille de navigation rapide */}
        <div className="mt-6 flex flex-wrap gap-2">
          {data.questions.map((q, i) => (
            <button
              key={q.questionId}
              onClick={() => setIndex(i)}
              className={`h-9 w-9 rounded-lg text-sm font-medium ${
                i === index
                  ? 'bg-ems-primary text-white'
                  : answers[q.questionId]
                    ? 'bg-green-100 text-green-700'
                    : 'bg-white text-slate-500'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
