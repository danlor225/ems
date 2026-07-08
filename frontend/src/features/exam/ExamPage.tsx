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
import { Textarea } from '@/components/ui/textarea'
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

  // Valeur : string (choix unique) ou string[] (choix multiples).
  const [answers, setAnswers] = useState<
    Record<string, string | string[] | null>
  >({})
  const [index, setIndex] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const submittedRef = useRef(false)

  const save = useMutation({
    mutationFn: (
      body:
        | { questionId: string; selectedOptionId: string }
        | { questionId: string; selectedOptionIds: string[] }
        | { questionId: string; text: string },
    ) => saveAnswer(data!.attempt.id, body),
  })
  const submit = useMutation({
    mutationFn: () => submitAttempt(data!.attempt.id),
    onSuccess: () =>
      navigate(`/resultats/${data!.attempt.id}`, { replace: true }),
  })

  useEffect(() => {
    if (!data) return
    const init: Record<string, string | string[] | null> = {}
    data.questions.forEach((q) => {
      init[q.questionId] =
        q.type === 'MULTIPLE_CHOICE'
          ? q.selectedOptionIds
          : q.type === 'SHORT_ANSWER'
            ? q.textAnswer
            : q.selectedOptionId
    })
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
  const isAnswered = (v: string | string[] | null | undefined) =>
    Array.isArray(v) ? v.length > 0 : !!v
  const answeredCount = Object.values(answers).filter(isAnswered).length
  const timeClass =
    remaining <= 300
      ? 'text-danger'
      : remaining <= 600
        ? 'text-warning'
        : 'text-foreground'

  // Choix unique (SINGLE_CHOICE / TRUE_FALSE).
  function chooseSingle(optionId: string) {
    setAnswers((prev) => ({ ...prev, [question.questionId]: optionId }))
    save.mutate({ questionId: question.questionId, selectedOptionId: optionId })
  }
  // Choix multiples (MULTIPLE_CHOICE) : bascule l'option.
  function toggleMulti(optionId: string) {
    const current = answers[question.questionId]
    const cur = Array.isArray(current) ? current : []
    const next = cur.includes(optionId)
      ? cur.filter((x) => x !== optionId)
      : [...cur, optionId]
    setAnswers((prev) => ({ ...prev, [question.questionId]: next }))
    save.mutate({ questionId: question.questionId, selectedOptionIds: next })
  }
  // Réponse libre (SHORT_ANSWER) : saisie locale, sauvegarde à la perte de focus.
  function setText(value: string) {
    setAnswers((prev) => ({ ...prev, [question.questionId]: value }))
  }
  function saveText() {
    const v = answers[question.questionId]
    save.mutate({
      questionId: question.questionId,
      text: typeof v === 'string' ? v : '',
    })
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
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="info">
                  {question.points} point{question.points > 1 ? 's' : ''}
                </Badge>
                {question.type === 'MULTIPLE_CHOICE' && (
                  <span className="text-xs font-medium text-info">
                    Plusieurs réponses possibles
                  </span>
                )}
                {question.type === 'SHORT_ANSWER' && (
                  <span className="text-xs font-medium text-info">
                    Réponse libre
                  </span>
                )}
              </div>
              <p className="mb-5 text-lg font-semibold text-foreground">
                {question.statement}
              </p>

              {question.type === 'SHORT_ANSWER' ? (
                <Textarea
                  rows={3}
                  placeholder="Saisissez votre réponse…"
                  value={
                    typeof answers[question.questionId] === 'string'
                      ? (answers[question.questionId] as string)
                      : ''
                  }
                  onChange={(e) => setText(e.target.value)}
                  onBlur={saveText}
                />
              ) : (
              <div className="space-y-3">
                {question.options.map((opt, i) => {
                  const isMulti = question.type === 'MULTIPLE_CHOICE'
                  const current = answers[question.questionId]
                  const selected = isMulti
                    ? Array.isArray(current) && current.includes(opt.id)
                    : current === opt.id
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
                        type={isMulti ? 'checkbox' : 'radio'}
                        name={question.questionId}
                        checked={selected}
                        onChange={() =>
                          isMulti ? toggleMulti(opt.id) : chooseSingle(opt.id)
                        }
                        className={cn(
                          'size-4 accent-primary',
                          isMulti && 'rounded',
                        )}
                      />
                      <span className="font-medium text-muted-foreground">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <span className="text-foreground">{opt.text}</span>
                    </label>
                  )
                })}
              </div>
              )}
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
                    : isAnswered(answers[q.questionId])
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
