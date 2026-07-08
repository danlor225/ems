// ============================================================
//  CreateExamWizard — assistant de création d'examen (3 étapes).
//  Informations -> Questions -> Révision & création.
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { getQuestions } from '../questions/questionsApi'
import { getSubjects } from '../subjects/subjectsApi'
import { createExam, publishExam } from './examsApi'

const EASE = [0.16, 1, 0.3, 1] as const
const STEPS = ['Informations', 'Questions', 'Révision']
const MIN = 15
const MAX = 60

const schema = z.object({
  title: z.string().min(1, 'Le titre est requis.').max(200),
  subjectId: z.string().uuid('Choisissez une matière.'),
  durationMinutes: z.number().int().min(1),
  passScore: z.number().int().min(0).max(100),
})
type Values = z.infer<typeof schema>

function axiosMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    return data?.message ?? fallback
  }
  return fallback
}

export function CreateExamWizard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [publishNow, setPublishNow] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { durationMinutes: 60, passScore: 50 },
  })
  const subjectId = form.watch('subjectId')

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => getSubjects(),
  })
  const { data: questions } = useQuery({
    queryKey: ['questions', subjectId],
    queryFn: () => getQuestions(subjectId),
    enabled: !!subjectId,
  })

  useEffect(() => setSelected([]), [subjectId])

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const subjectName = subjects?.data.find((s) => s.id === subjectId)?.name ?? '—'
  const canPublish = selected.length >= MIN && selected.length <= MAX

  const create = useMutation({
    mutationFn: async () => {
      const exam = await createExam({ ...form.getValues(), questionIds: selected })
      if (publishNow && canPublish) {
        await publishExam(exam.id).catch(() => {
          /* reste en brouillon si la publication échoue */
        })
      }
      return exam
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      navigate('/admin/examens')
    },
    onError: (e) => setError(axiosMessage(e, 'Création impossible.')),
  })

  async function next() {
    setError(null)
    if (step === 0) {
      const ok = await form.trigger([
        'title',
        'subjectId',
        'durationMinutes',
        'passScore',
      ])
      if (!ok) return
    }
    if (step === 1 && selected.length === 0) {
      setError('Sélectionnez au moins une question.')
      return
    }
    setStep((s) => s + 1)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <button
          onClick={() => navigate('/admin/examens')}
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour aux examens
        </button>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Nouvel examen
        </h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'grid size-8 place-items-center rounded-full text-sm font-semibold transition-colors',
                  i < step
                    ? 'bg-primary text-primary-foreground'
                    : i === step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:block',
                  i <= step ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-3 h-px flex-1',
                  i < step ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              {/* Étape 0 : Informations */}
              {step === 0 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Titre de l'examen</Label>
                    <Input
                      id="title"
                      placeholder="Ex : Examen final — Algèbre"
                      aria-invalid={!!form.formState.errors.title}
                      {...form.register('title')}
                    />
                    {form.formState.errors.title && (
                      <p className="text-xs text-danger">
                        {form.formState.errors.title.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="subjectId">Matière</Label>
                    <NativeSelect
                      id="subjectId"
                      defaultValue=""
                      aria-invalid={!!form.formState.errors.subjectId}
                      {...form.register('subjectId')}
                    >
                      <option value="" disabled>
                        Choisir…
                      </option>
                      {subjects?.data.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </NativeSelect>
                    {form.formState.errors.subjectId && (
                      <p className="text-xs text-danger">
                        {form.formState.errors.subjectId.message}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="durationMinutes">Durée (minutes)</Label>
                      <Input
                        id="durationMinutes"
                        type="number"
                        min={1}
                        {...form.register('durationMinutes', {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="passScore">Seuil de réussite (%)</Label>
                      <Input
                        id="passScore"
                        type="number"
                        min={0}
                        max={100}
                        {...form.register('passScore', { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Étape 1 : Questions */}
              {step === 1 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">
                      Sélectionnez les questions
                    </p>
                    <span
                      className={cn(
                        'text-xs',
                        canPublish
                          ? 'text-success'
                          : 'text-muted-foreground',
                      )}
                    >
                      {selected.length} sélectionnée(s) — {MIN} à {MAX} pour
                      publier
                    </span>
                  </div>
                  {questions && questions.data.length > 0 ? (
                    <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                      {questions.data.map((q) => (
                        <label
                          key={q.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(q.id)}
                            onChange={() => toggle(q.id)}
                            className="size-4 accent-primary"
                          />
                          <span className="text-foreground">{q.statement}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucune question dans « {subjectName} ». Ajoutez-en
                      d'abord.
                    </p>
                  )}
                </div>
              )}

              {/* Étape 2 : Révision */}
              {step === 2 && (
                <div className="space-y-4">
                  <dl className="divide-y divide-border rounded-lg border border-border">
                    {[
                      ['Titre', form.getValues('title')],
                      ['Matière', subjectName],
                      ['Durée', `${form.getValues('durationMinutes')} min`],
                      ['Seuil', `${form.getValues('passScore')} %`],
                      ['Questions', `${selected.length}`],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between px-4 py-2.5 text-sm"
                      >
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="font-medium text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  {canPublish ? (
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={publishNow}
                        onChange={(e) => setPublishNow(e.target.checked)}
                        className="size-4 accent-primary"
                      />
                      Publier directement (l'examen sera disponible pour les
                      sessions)
                    </label>
                  ) : (
                    <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                      Il faut {MIN} à {MAX} questions pour publier. L'examen sera
                      créé en brouillon.
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="size-4" />
              Précédent
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Suivant
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={() => create.mutate()} loading={create.isPending}>
                <Check className="size-4" />
                Créer l'examen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
