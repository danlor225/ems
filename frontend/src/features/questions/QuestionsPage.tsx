// ============================================================
//  QuestionsPage — CRUD Questions (design system).
//  Options dynamiques (useFieldArray) + bonne réponse (radio).
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { createSubject, getSubjects } from '../subjects/subjectsApi'
import {
  createQuestion,
  deleteQuestion,
  getQuestions,
  updateQuestion,
} from './questionsApi'

const TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: 'Choix unique',
  TRUE_FALSE: 'Vrai / Faux',
  MULTIPLE_CHOICE: 'Choix multiples',
  SHORT_ANSWER: 'Réponse libre',
}

const schema = z
  .object({
    subjectId: z.string().uuid('Choisissez une matière.'),
    statement: z.string().min(1, "L'énoncé est requis."),
    type: z.enum([
      'SINGLE_CHOICE',
      'TRUE_FALSE',
      'MULTIPLE_CHOICE',
      'SHORT_ANSWER',
    ]),
    points: z.number().int().min(1),
    options: z
      .array(
        z.object({
          text: z.string().min(1, 'Texte requis.'),
          isCorrect: z.boolean(),
        }),
      )
      .min(1, 'Au moins une réponse.'),
  })
  // Nombre minimum d'options selon le type.
  .refine(
    (v) => (v.type === 'SHORT_ANSWER' ? v.options.length >= 1 : v.options.length >= 2),
    { message: 'Une question à choix doit avoir au moins 2 réponses.', path: ['options'] },
  )
  // Nombre de bonnes réponses (non applicable à la réponse libre).
  .refine(
    (v) => {
      if (v.type === 'SHORT_ANSWER') return true
      const correct = v.options.filter((o) => o.isCorrect).length
      return v.type === 'MULTIPLE_CHOICE' ? correct >= 1 : correct === 1
    },
    {
      message: 'Sélectionnez la (ou les) bonne(s) réponse(s).',
      path: ['options'],
    },
  )
  .refine((v) => v.type !== 'TRUE_FALSE' || v.options.length === 2, {
    message: 'Une question Vrai/Faux doit avoir exactement deux options.',
    path: ['options'],
  })

type FormValues = z.infer<typeof schema>

const subjectSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(150),
  description: z.string().max(1000).optional(),
})

export function QuestionsPage() {
  const queryClient = useQueryClient()
  const [subjectFilter, setSubjectFilter] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [subjectError, setSubjectError] = useState<string | null>(null)
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const formSectionRef = useRef<HTMLDivElement>(null)

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => getSubjects(),
  })

  const {
    register: registerSubject,
    handleSubmit: handleSubmitSubject,
    reset: resetSubject,
    formState: { errors: subjectErrors },
  } = useForm<z.infer<typeof subjectSchema>>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { name: '', description: '' },
  })
  const subjectName = (id: string) =>
    subjects?.data.find((s) => s.id === id)?.name ?? '—'

  const { data, isPending, isError } = useQuery({
    queryKey: ['questions', subjectFilter],
    queryFn: () => getQuestions(subjectFilter || undefined),
  })

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'SINGLE_CHOICE',
      points: 1,
      options: [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
      ],
    },
  })
  const {
    fields,
    append,
    remove: removeOption,
    replace,
  } = useFieldArray({ control, name: 'options' })

  const type = watch('type')
  const options = watch('options')
  const isMulti = type === 'MULTIPLE_CHOICE'
  const isTrueFalse = type === 'TRUE_FALSE'
  const isShort = type === 'SHORT_ANSWER'

  // Changement de type : on ajuste les options en conséquence.
  function onTypeChange(next: FormValues['type']) {
    setValue('type', next)
    if (next === 'TRUE_FALSE') {
      replace([
        { text: 'Vrai', isCorrect: true },
        { text: 'Faux', isCorrect: false },
      ])
    } else if (next === 'SHORT_ANSWER') {
      // Réponse libre : une réponse acceptée au départ (toutes "correctes").
      replace([{ text: '', isCorrect: true }])
    } else if (type === 'TRUE_FALSE' || type === 'SHORT_ANSWER') {
      // On quittait Vrai/Faux ou réponse libre : deux options vierges.
      replace([
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
      ])
    }
  }

  // Choix unique / Vrai-Faux : une seule bonne réponse (exclusif).
  function setSingleCorrect(index: number) {
    options.forEach((_, i) => setValue(`options.${i}.isCorrect`, i === index))
  }

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      createQuestion({
        subjectId: v.subjectId,
        statement: v.statement,
        type: v.type,
        points: v.points,
        options: v.options.map((o) => ({
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      reset()
      setEditingQuestionId(null)
      setActionError(null)
    },
    onError: () => setActionError('Erreur lors de la création.'),
  })

  const update = useMutation({
    mutationFn: (v: FormValues) =>
      updateQuestion(editingQuestionId!, {
        subjectId: v.subjectId,
        statement: v.statement,
        points: v.points,
        options: v.options.map((o) => ({
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
      reset()
      setEditingQuestionId(null)
      setActionError(null)
    },
    onError: () => setActionError('Erreur lors de la modification.'),
  })

  const del = useMutation({
    mutationFn: (id: string) => deleteQuestion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
    onError: (error) =>
      setActionError(
        axios.isAxiosError(error) && error.response?.status === 409
          ? 'Question utilisée par un examen : suppression impossible.'
          : 'Erreur lors de la suppression.',
      ),
  })

  const createSubjectMutation = useMutation({
    mutationFn: (v: z.infer<typeof subjectSchema>) =>
      createSubject({ name: v.name, description: v.description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      resetSubject()
      setSubjectError(null)
      setIsSubjectModalOpen(false)
    },
    onError: () => setSubjectError('Erreur lors de la création de la matière.'),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Questions
        </h1>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setSubjectError(null)
            resetSubject()
            setIsSubjectModalOpen(true)
          }}
        >
          <Plus className="size-4" />
          Nouvelle matière
        </Button>
      </div>

      {/* Création */}
      <div ref={formSectionRef}>
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle question</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((v) => (editingQuestionId ? update.mutate(v) : create.mutate(v)))}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="subjectId">Matière</Label>
                <NativeSelect
                  id="subjectId"
                  defaultValue=""
                  aria-invalid={!!errors.subjectId}
                  {...register('subjectId')}
                >
                  <option value="" disabled>
                    Choisir une matière…
                  </option>
                  {subjects?.data.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
                {errors.subjectId && (
                  <p className="text-xs text-danger">
                    {errors.subjectId.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <NativeSelect
                  id="type"
                  value={type}
                  onChange={(e) =>
                    onTypeChange(e.target.value as FormValues['type'])
                  }
                  disabled={!!editingQuestionId}
                >
                  <option value="SINGLE_CHOICE">Choix unique</option>
                  <option value="TRUE_FALSE">Vrai / Faux</option>
                  <option value="MULTIPLE_CHOICE">Choix multiples</option>
                  <option value="SHORT_ANSWER">Réponse libre</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  min={1}
                  {...register('points', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="statement">Énoncé</Label>
              <Textarea
                id="statement"
                rows={2}
                placeholder="Quelle est la question ?"
                aria-invalid={!!errors.statement}
                {...register('statement')}
              />
              {errors.statement && (
                <p className="text-xs text-danger">
                  {errors.statement.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                {isShort
                  ? 'Réponses acceptées (toute correspondance vaut juste)'
                  : isMulti
                    ? 'Réponses (cochez toutes les bonnes)'
                    : 'Réponses (cochez la bonne)'}
              </Label>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  {isShort ? null : isMulti ? (
                    <input
                      type="checkbox"
                      aria-label={`Bonne réponse : option ${index + 1}`}
                      {...register(`options.${index}.isCorrect`)}
                      className="size-4 rounded accent-primary"
                    />
                  ) : (
                    <input
                      type="radio"
                      name="correct-option"
                      aria-label={`Bonne réponse : option ${index + 1}`}
                      checked={!!options[index]?.isCorrect}
                      onChange={() => setSingleCorrect(index)}
                      className="size-4 accent-primary"
                    />
                  )}
                  <Input
                    className="flex-1"
                    placeholder={
                      isShort ? `Réponse acceptée ${index + 1}` : `Réponse ${index + 1}`
                    }
                    readOnly={isTrueFalse}
                    {...register(`options.${index}.text`)}
                  />
                  {!isTrueFalse && fields.length > (isShort ? 1 : 2) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Retirer la réponse"
                      onClick={() => removeOption(index)}
                      className="text-muted-foreground hover:text-danger"
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {errors.options && (
                <p className="text-xs text-danger">
                  {errors.options.message ?? errors.options.root?.message}
                </p>
              )}
              {!isTrueFalse && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => append({ text: '', isCorrect: isShort })}
                  className="text-primary"
                >
                  <Plus className="size-4" />
                  {isShort ? 'Ajouter une réponse acceptée' : 'Ajouter une réponse'}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {editingQuestionId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    reset()
                    setEditingQuestionId(null)
                    setActionError(null)
                  }}
                >
                  Annuler
                </Button>
              )}
              <Button
                type="submit"
                loading={create.isPending || update.isPending}
              >
                {editingQuestionId ? 'Enregistrer les modifications' : 'Créer la question'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>

      {actionError && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {actionError}
        </div>
      )}

      <Modal
        open={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        title="Nouvelle matière"
        description="Créez une matière directement depuis la banque de questions."
      >
        <form
          onSubmit={handleSubmitSubject((v) => createSubjectMutation.mutate(v))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="subject-name">Nom</Label>
            <Input
              id="subject-name"
              placeholder="Nom de la matière"
              {...registerSubject('name')}
              aria-invalid={!!subjectErrors.name}
            />
            {subjectErrors.name && (
              <p className="text-xs text-danger">
                {subjectErrors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject-description">Description</Label>
            <Textarea
              id="subject-description"
              rows={3}
              placeholder="Description (optionnelle)"
              {...registerSubject('description')}
            />
            {subjectErrors.description && (
              <p className="text-xs text-danger">
                {subjectErrors.description.message}
              </p>
            )}
          </div>
          {subjectError && (
            <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {subjectError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSubjectModalOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" loading={createSubjectMutation.isPending}>
              Créer la matière
            </Button>
          </div>
        </form>
      </Modal>

      {/* Filtre + liste */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrer :</span>
        <NativeSelect
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="h-9 w-auto"
        >
          <option value="">Toutes les matières</option>
          {subjects?.data.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <Card className="overflow-hidden">
        {isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="p-6 text-sm text-danger">Erreur de chargement.</p>
        ) : data.data.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Aucune question.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.data.map((q) => (
              <li
                key={q.id}
                className="flex items-start justify-between gap-4 px-4 py-4"
              >
                <div>
                  <p className="font-medium text-foreground">{q.statement}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {subjectName(q.subjectId)} · {TYPE_LABELS[q.type] ?? q.type}{' '}
                    · {q.options.length} réponses · {q.points} pt
                    {q.points > 1 ? 's' : ''}
                    {!q.isActive && ' · désactivée'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Modifier"
                    onClick={() => {
                      setEditingQuestionId(q.id)
                      setValue('subjectId', q.subjectId)
                      setValue('statement', q.statement)
                      setValue('type', q.type)
                      setValue('points', q.points)
                      setValue(
                        'options',
                        q.options.map((o) => ({
                          text: o.text,
                          isCorrect: o.isCorrect,
                        })),
                      )
                      setActionError(null)
                      requestAnimationFrame(() => {
                        formSectionRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                        document.getElementById('subjectId')?.focus()
                      })
                    }}
                    className="shrink-0 text-muted-foreground hover:text-primary"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer"
                    onClick={() => del.mutate(q.id)}
                    className="shrink-0 text-muted-foreground hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
