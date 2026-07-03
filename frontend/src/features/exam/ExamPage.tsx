// ============================================================
//  ExamPage — passage d'évaluation (design system, premium).
//  Minuteur serveur (expiresAt), sauvegarde auto, soumission,
//  reprise. Transitions de question animées.
// ============================================================
import { useMutation, useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { saveAnswer, startAttempt, submitAttempt } from './examApi'

const EASE = [0.16, 1, 0.3, 1] as const

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
    onSuccess: () =>
      navigate(`/resultats/${data!.attempt.id}`, { replace: true }),
  })

  useEffect(() => {
    if (!data) return
    const init: Record<string, string | null> = {}
    data.questions.forEach((q) => (init[q.questionId] = q.selectedOptionId))
    setAnswers(init)
  }, [data])

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
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        Préparation de l'évaluation…
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-4">
        <Card className="p-8 text-center">
          <p className="text-foreground">
            Cette évaluation n'est pas accessible (déjà passée ou fermée).
          </p>
          <Button className="mt-4" onClick={() => navigate('/')}>
            Retour à l'accueil
          </Button>
        </Card>
      </div>
    )
  }

  const question = data.questions[index]
  const answeredCount = Object.values(answers).filter(Boolean).length
  const timeClass =
    remaining <= 300
      ? 'text-danger'
      : remaining <= 600
        ? 'text-warning'
        : 'text-foreground'

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
    <div className="min-h-screen bg-background">
      {/* Barre supérieure */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Évaluation en cours</p>
            <h1 className="font-semibold text-foreground">{data.exam.title}</h1>
          </div>
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-lg font-bold tabular-nums',
              timeClass,
            )}
          >
            <Clock className="size-4" />
            {formatTime(remaining)}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl p-4">
        <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Question {index + 1} / {data.questions.length}
          </span>
          <span>
            {answeredCount} / {data.questions.length} répondues
          </span>
        </div>

        {/* Question animée */}
        <AnimatePresence mode="wait">
          <motion.div
            key={question.questionId}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <Card className="p-6">
              <Badge variant="info" className="mb-3">
                {question.points} point{question.points > 1 ? 's' : ''}
              </Badge>
              <p className="mb-5 text-lg font-semibold text-foreground">
                {question.statement}
              </p>

              <div className="space-y-3">
                {question.options.map((opt, i) => {
                  const selected = answers[question.questionId] === opt.id
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted',
                      )}
                    >
                      <input
                        type="radio"
                        name={question.questionId}
                        checked={selected}
                        onChange={() => choose(opt.id)}
                        className="size-4 accent-primary"
                      />
                      <span className="font-medium text-muted-foreground">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <span className="text-foreground">{opt.text}</span>
                    </label>
                  )
                })}
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            <ChevronLeft className="size-4" />
            Précédent
          </Button>
          {index < data.questions.length - 1 ? (
            <Button onClick={() => setIndex((i) => i + 1)}>
              Suivant
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={doSubmit} loading={submit.isPending}>
              <Flag className="size-4" />
              Terminer l'évaluation
            </Button>
          )}
        </div>

        {/* Grille de navigation rapide */}
        <Card className="mt-6 p-4">
          <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-success" /> Répondue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-primary" /> Actuelle
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.questions.map((q, i) => (
              <button
                key={q.questionId}
                onClick={() => setIndex(i)}
                className={cn(
                  'grid size-9 place-items-center rounded-lg text-sm font-medium transition-colors',
                  i === index
                    ? 'bg-primary text-primary-foreground'
                    : answers[q.questionId]
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70',
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
