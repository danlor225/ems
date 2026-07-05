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
import { getSubjects } from '../subjects/subjectsApi'
import {
  createQuestion,
  deleteQuestion,
  getQuestions,
  updateQuestion,
} from './questionsApi'

const schema = z
  .object({
    subjectId: z.string().uuid('Choisissez une matière.'),
    statement: z.string().min(1, "L'énoncé est requis."),
    points: z.number().int().min(1),
    correctIndex: z.number().int().min(0),
    options: z
      .array(z.object({ text: z.string().min(1, 'Texte requis.') }))
      .min(2, 'Au moins 2 réponses.'),
  })
  .refine((v) => v.correctIndex < v.options.length, {
    message: 'La bonne réponse doit correspondre à une option.',
    path: ['correctIndex'],
  })
type FormValues = z.infer<typeof schema>

export function QuestionsPage() {
  const queryClient = useQueryClient()
  const [subjectFilter, setSubjectFilter] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const formSectionRef = useRef<HTMLDivElement>(null)

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => getSubjects(),
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
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      points: 1,
      correctIndex: 0,
      options: [{ text: '' }, { text: '' }],
    },
  })
  const { fields, append, remove: removeOption } = useFieldArray({
    control,
    name: 'options',
  })

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      createQuestion({
        subjectId: v.subjectId,
        statement: v.statement,
        points: v.points,
        options: v.options.map((o, i) => ({
          text: o.text,
          isCorrect: i === v.correctIndex,
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
        options: v.options.map((o, i) => ({
          text: o.text,
          isCorrect: i === v.correctIndex,
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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Questions
      </h1>

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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <Label>Réponses (cochez la bonne)</Label>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    value={index}
                    aria-label={`Bonne réponse : option ${index + 1}`}
                    {...register('correctIndex', { valueAsNumber: true })}
                    className="size-4 accent-primary"
                  />
                  <Input
                    className="flex-1"
                    placeholder={`Réponse ${index + 1}`}
                    {...register(`options.${index}.text`)}
                  />
                  {fields.length > 2 && (
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
              {(errors.options || errors.correctIndex) && (
                <p className="text-xs text-danger">
                  {errors.options?.message ??
                    errors.options?.root?.message ??
                    errors.correctIndex?.message}
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ text: '' })}
                className="text-primary"
              >
                <Plus className="size-4" />
                Ajouter une réponse
              </Button>
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
                    {subjectName(q.subjectId)} · {q.options.length} réponses ·{' '}
                    {q.points} pt{q.points > 1 ? 's' : ''}
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
                      setValue('points', q.points)
                      const correctIndex = q.options.findIndex((o) => o.isCorrect)
                      setValue('correctIndex', correctIndex >= 0 ? correctIndex : 0)
                      setValue('options', q.options.map((o) => ({ text: o.text })))
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
