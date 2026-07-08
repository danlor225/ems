// ============================================================
//  EvaluationWizard — assistant v2 en 4 étapes.
//  Session académique -> Configuration -> Questions -> Publication.
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, PartyPopper } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getGroups } from '../groups/groupsApi'
import { getQuestions } from '../questions/questionsApi'
import { getSubjects } from '../subjects/subjectsApi'
import {
  createAcademicSession,
  getAcademicSessions,
} from './academicSessionsApi'
import {
  createEvaluation,
  getEvaluation,
  publishEvaluation,
  setEvaluationQuestions,
  updateEvaluation,
} from './evaluationsApi'

const EASE = [0.16, 1, 0.3, 1] as const
const STEPS = ['Session', 'Configuration', 'Questions', 'Publication']
const MIN = 15
const MAX = 60

const configSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(200),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(1),
  passScore: z.number().int().min(0).max(100),
  maxScore: z.number().int().min(1),
  extraTimeMinutes: z.number().int().min(0),
  attemptsAllowed: z.number().int().min(1),
  randomizeQuestions: z.boolean(),
  oneQuestionAtATime: z.boolean(),
  shuffleAnswers: z.boolean(),
  showResultImmediately: z.boolean(),
  autoGrade: z.boolean(),
})
type ConfigValues = z.infer<typeof configSchema>

function axiosMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    return data?.message ?? fallback
  }
  return fallback
}

const TOGGLES: { key: keyof ConfigValues; label: string }[] = [
  { key: 'randomizeQuestions', label: 'Ordre des questions aléatoire' },
  { key: 'shuffleAnswers', label: 'Mélanger les réponses' },
  { key: 'oneQuestionAtATime', label: 'Une question à la fois' },
  { key: 'showResultImmediately', label: 'Afficher le résultat immédiatement' },
  { key: 'autoGrade', label: 'Calcul automatique de la note' },
]

export function EvaluationWizard() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [academicSessionId, setAcademicSessionId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [groupId, setGroupId] = useState('') // groupe cible (optionnel)
  const [selected, setSelected] = useState<string[]>([])
  const [publishNow, setPublishNow] = useState(false)
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [editingEvaluationId, setEditingEvaluationId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Nouvelle session académique (inline)
  const [creatingSession, setCreatingSession] = useState(false)
  const [ns, setNs] = useState({
    name: '',
    academicYear: '',
    startDate: '',
    endDate: '',
  })

  const form = useForm<ConfigValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      durationMinutes: 60,
      passScore: 50,
      maxScore: 100,
      extraTimeMinutes: 0,
      attemptsAllowed: 1,
      randomizeQuestions: true,
      oneQuestionAtATime: false,
      shuffleAnswers: true,
      showResultImmediately: true,
      autoGrade: true,
    },
  })

  const { data: sessions } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: getAcademicSessions,
  })
  const evaluationIdFromState = (location.state as { evaluationId?: string } | null)?.evaluationId ?? null
  const { data: editingEvaluation } = useQuery({
    queryKey: ['evaluation', evaluationIdFromState],
    queryFn: () => getEvaluation(evaluationIdFromState!),
    enabled: !!evaluationIdFromState,
  })
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => getSubjects(),
  })
  const { data: groups } = useQuery({
    queryKey: ['groups', 'wizard'],
    queryFn: () => getGroups({ limit: 100 }),
  })
  const { data: questions } = useQuery({
    queryKey: ['questions', subjectId],
    queryFn: () => getQuestions(subjectId),
    enabled: !!subjectId,
  })

  useEffect(() => setSelected([]), [subjectId])

  useEffect(() => {
    if (!editingEvaluation) return
    setEditingEvaluationId(editingEvaluation.id)
    setIsEditing(true)
    setAcademicSessionId(editingEvaluation.academicSession?.id ?? '')
    setSubjectId(editingEvaluation.subject?.id ?? '')
    setGroupId(editingEvaluation.groupId ?? '')
    setSelected(editingEvaluation.examQuestions.map((q) => q.question.id))
    form.reset({
      name: editingEvaluation.title,
      description: editingEvaluation.description ?? '',
      durationMinutes: editingEvaluation.durationMinutes,
      passScore: editingEvaluation.passScore,
      maxScore: editingEvaluation.maxScore,
      extraTimeMinutes: editingEvaluation.extraTimeMinutes,
      attemptsAllowed: editingEvaluation.attemptsAllowed,
      randomizeQuestions: editingEvaluation.randomizeQuestions,
      oneQuestionAtATime: editingEvaluation.oneQuestionAtATime,
      shuffleAnswers: editingEvaluation.shuffleAnswers,
      showResultImmediately: editingEvaluation.showResultImmediately,
      autoGrade: editingEvaluation.autoGrade,
    })
  }, [editingEvaluation, form])

  const createSession = useMutation({
    mutationFn: () =>
      createAcademicSession({
        name: ns.name,
        academicYear: ns.academicYear,
        startDate: new Date(ns.startDate).toISOString(),
        endDate: new Date(ns.endDate).toISOString(),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['academic-sessions'] })
      setAcademicSessionId(created.id)
      setCreatingSession(false)
      setError(null)
    },
    onError: (e) => setError(axiosMessage(e, 'Création de session impossible.')),
  })

  const finish = useMutation({
    mutationFn: async () => {
      if (isEditing && editingEvaluationId) {
        await updateEvaluation(editingEvaluationId, {
          ...form.getValues(),
          academicSessionId,
          groupId: groupId || null, // null => retirer le groupe cible
        })
        await setEvaluationQuestions(editingEvaluationId, selected)
        return
      }

      const evaluation = await createEvaluation({
        ...form.getValues(),
        subjectId,
        academicSessionId,
        groupId: groupId || undefined,
        questionIds: selected,
      })
      if (publishNow) {
        await publishEvaluation(evaluation.id, {
          opensAt: new Date(opensAt).toISOString(),
          closesAt: new Date(closesAt).toISOString(),
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      setDone(true)
      setTimeout(() => navigate('/evaluations'), 1500)
    },
    onError: (e) => setError(axiosMessage(e, 'Création impossible.')),
  })

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const totalPoints =
    questions?.data
      .filter((q) => selected.includes(q.id))
      .reduce((s, q) => s + q.points, 0) ?? 0
  const canPublish = selected.length >= MIN && selected.length <= MAX
  const subjectName = subjects?.data.find((s) => s.id === subjectId)?.name ?? '—'
  const sessionName =
    sessions?.data.find((s) => s.id === academicSessionId)?.name ?? '—'
  const groupName = groupId
    ? (groups?.data.find((g) => g.id === groupId)?.name ?? '—')
    : 'Tous les étudiants'

  async function next() {
    setError(null)
    if (step === 0 && !academicSessionId) {
      setError('Sélectionnez ou créez une session académique.')
      return
    }
    if (step === 1) {
      const ok = await form.trigger()
      if (!ok) return
    }
    if (step === 2) {
      if (!subjectId) return setError('Choisissez une matière.')
      if (selected.length === 0) return setError('Sélectionnez au moins une question.')
    }
    setStep((s) => s + 1)
  }

  if (done) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="mx-auto grid size-16 place-items-center rounded-full bg-success/15 text-success"
          >
            <PartyPopper className="size-8" />
          </motion.div>
          <h2 className="mt-4 text-xl font-bold text-foreground">
            Évaluation créée !
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Redirection vers la liste…
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <button
          onClick={() => navigate('/evaluations')}
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour aux évaluations
        </button>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {isEditing ? 'Modifier l’évaluation' : 'Nouvelle évaluation'}
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
                  i <= step
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
              {/* Étape 0 : Session académique */}
              {step === 0 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Session académique</Label>
                    <NativeSelect
                      value={academicSessionId}
                      onChange={(e) => setAcademicSessionId(e.target.value)}
                    >
                      <option value="">Choisir une session…</option>
                      {sessions?.data.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {s.academicYear}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  {!creatingSession ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-primary"
                      onClick={() => setCreatingSession(true)}
                    >
                      + Nouvelle session académique
                    </Button>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-border p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          placeholder="Nom (ex : Semestre 1)"
                          value={ns.name}
                          onChange={(e) =>
                            setNs({ ...ns, name: e.target.value })
                          }
                        />
                        <Input
                          placeholder="Année (ex : 2025-2026)"
                          value={ns.academicYear}
                          onChange={(e) =>
                            setNs({ ...ns, academicYear: e.target.value })
                          }
                        />
                        <div>
                          <Label className="text-xs">Début</Label>
                          <Input
                            type="date"
                            value={ns.startDate}
                            onChange={(e) =>
                              setNs({ ...ns, startDate: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Fin</Label>
                          <Input
                            type="date"
                            value={ns.endDate}
                            onChange={(e) =>
                              setNs({ ...ns, endDate: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          loading={createSession.isPending}
                          onClick={() => createSession.mutate()}
                        >
                          Créer la session
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setCreatingSession(false)}
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Étape 1 : Configuration */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nom de l'évaluation</Label>
                    <Input
                      id="name"
                      placeholder="Ex : Examen final — Algèbre"
                      aria-invalid={!!form.formState.errors.name}
                      {...form.register('name')}
                    />
                    {form.formState.errors.name && (
                      <p className="text-xs text-danger">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Code : généré automatiquement à la création.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      rows={2}
                      {...form.register('description')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="groupId">Groupe / Classe cible</Label>
                    <NativeSelect
                      id="groupId"
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                    >
                      <option value="">— Aucun (tous les étudiants) —</option>
                      {groups?.data.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                          {g.level ? ` · ${g.level}` : ''}
                        </option>
                      ))}
                    </NativeSelect>
                    <p className="text-xs text-muted-foreground">
                      Optionnel : cible une classe précise pour cette évaluation.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="durationMinutes">Durée (min)</Label>
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
                      <Label htmlFor="extraTimeMinutes">Temps suppl. (min)</Label>
                      <Input
                        id="extraTimeMinutes"
                        type="number"
                        min={0}
                        {...form.register('extraTimeMinutes', {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="attemptsAllowed">Tentatives</Label>
                      <Input
                        id="attemptsAllowed"
                        type="number"
                        min={1}
                        {...form.register('attemptsAllowed', {
                          valueAsNumber: true,
                        })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="passScore">Score min (%)</Label>
                      <Input
                        id="passScore"
                        type="number"
                        min={0}
                        max={100}
                        {...form.register('passScore', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="maxScore">Score max</Label>
                      <Input
                        id="maxScore"
                        type="number"
                        min={1}
                        {...form.register('maxScore', { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 rounded-lg border border-border p-4">
                    {TOGGLES.map((t) => (
                      <label
                        key={t.key}
                        className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          {...form.register(t.key)}
                        />
                        {t.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Étape 2 : Matière + Questions */}
              {step === 2 && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-3 md:col-span-2">
                    <div className="space-y-1.5">
                      <Label>Matière</Label>
                      <NativeSelect
                        value={subjectId}
                        onChange={(e) => setSubjectId(e.target.value)}
                      >
                        <option value="">Choisir…</option>
                        {subjects?.data.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    {subjectId && questions && questions.data.length > 0 ? (
                      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
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
                            <span className="text-foreground">
                              {q.statement}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : subjectId ? (
                      <p className="text-sm text-muted-foreground">
                        Aucune question dans cette matière.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Choisissez d'abord une matière.
                      </p>
                    )}
                  </div>

                  {/* Panneau récap */}
                  <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
                    <p className="font-medium text-foreground">Récapitulatif</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Questions</span>
                      <span
                        className={cn(
                          'font-medium',
                          canPublish ? 'text-success' : 'text-foreground',
                        )}
                      >
                        {selected.length} / {MIN}–{MAX}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Points</span>
                      <span className="font-medium text-foreground">
                        {totalPoints}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Temps estimé</span>
                      <span className="font-medium text-foreground">
                        {form.getValues('durationMinutes')} min
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Étape 3 : Publication */}
              {step === 3 && (
                <div className="space-y-4">
                  <dl className="divide-y divide-border rounded-lg border border-border">
                    {[
                      ['Session', sessionName],
                      ['Nom', form.getValues('name')],
                      ['Matière', subjectName],
                      ['Groupe cible', groupName],
                      ['Durée', `${form.getValues('durationMinutes')} min`],
                      ['Questions', `${selected.length}`],
                      ['Score min', `${form.getValues('passScore')} %`],
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
                    <div className="space-y-3 rounded-lg border border-border p-4">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={publishNow}
                          onChange={(e) => setPublishNow(e.target.checked)}
                          className="size-4 accent-primary"
                        />
                        Publier maintenant (programmer la fenêtre)
                      </label>
                      {publishNow && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs">Ouverture</Label>
                            <Input
                              type="datetime-local"
                              value={opensAt}
                              onChange={(e) => setOpensAt(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Fermeture</Label>
                            <Input
                              type="datetime-local"
                              value={closesAt}
                              onChange={(e) => setClosesAt(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                      Il faut {MIN} à {MAX} questions pour publier. L'évaluation
                      sera créée en brouillon.
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
              <Button onClick={() => finish.mutate()} loading={finish.isPending}>
                <Check className="size-4" />
                {isEditing ? 'Enregistrer les modifications' : 'Créer l’évaluation'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
