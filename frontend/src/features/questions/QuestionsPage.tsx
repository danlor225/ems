// ============================================================
//  QuestionsPage : CRUD des questions.
//  - formulaire : matière + énoncé + options dynamiques (useFieldArray)
//    + choix de LA bonne réponse (radio correctIndex).
//  - liste filtrable par matière.
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { getSubjects } from '../subjects/subjectsApi'
import {
  createQuestion,
  deleteQuestion,
  getQuestions,
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
      setActionError(null)
    },
    onError: () => setActionError('Erreur lors de la création.'),
  })

  const del = useMutation({
    mutationFn: (id: string) => deleteQuestion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setActionError('Question utilisée par un examen : suppression impossible.')
      } else {
        setActionError('Erreur lors de la suppression.')
      }
    },
  })

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Questions</h1>

      {/* Formulaire de création */}
      <form
        onSubmit={handleSubmit((v) => create.mutate(v))}
        className="mb-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Matière
            </label>
            <select
              {...register('subjectId')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
              defaultValue=""
            >
              <option value="" disabled>
                Choisir une matière…
              </option>
              {subjects?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.subjectId && (
              <p className="mt-1 text-xs text-red-600">
                {errors.subjectId.message}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Points
            </label>
            <input
              type="number"
              min={1}
              {...register('points', { valueAsNumber: true })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Énoncé
          </label>
          <textarea
            {...register('statement')}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
            placeholder="Quelle est la question ?"
          />
          {errors.statement && (
            <p className="mt-1 text-xs text-red-600">
              {errors.statement.message}
            </p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Réponses (cochez la bonne)
          </label>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  value={index}
                  {...register('correctIndex', { valueAsNumber: true })}
                  className="h-4 w-4 accent-ems-primary"
                />
                <input
                  {...register(`options.${index}.text`)}
                  placeholder={`Réponse ${index + 1}`}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
                />
                {fields.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.options && (
            <p className="mt-1 text-xs text-red-600">
              {errors.options.message ?? errors.options.root?.message}
            </p>
          )}
          {errors.correctIndex && (
            <p className="mt-1 text-xs text-red-600">
              {errors.correctIndex.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => append({ text: '' })}
            className="mt-2 text-sm font-medium text-ems-primary hover:underline"
          >
            + Ajouter une réponse
          </button>
        </div>

        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-ems-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {create.isPending ? 'Création…' : 'Créer la question'}
        </button>
      </form>

      {actionError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Filtre + liste */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-slate-500">Filtrer :</span>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-ems-primary"
        >
          <option value="">Toutes les matières</option>
          {subjects?.data.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {isPending ? (
          <p className="p-6 text-sm text-slate-400">Chargement…</p>
        ) : isError ? (
          <p className="p-6 text-sm text-red-600">Erreur de chargement.</p>
        ) : data.data.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aucune question.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.data.map((q) => (
              <li
                key={q.id}
                className="flex items-start justify-between gap-4 px-5 py-4"
              >
                <div>
                  <p className="font-medium text-slate-800">{q.statement}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {subjectName(q.subjectId)} · {q.options.length} réponses ·{' '}
                    {q.points} pt{q.points > 1 ? 's' : ''}
                    {!q.isActive && ' · désactivée'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => del.mutate(q.id)}
                  className="shrink-0 text-xs font-medium text-red-600 hover:underline"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
