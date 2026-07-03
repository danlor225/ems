// ============================================================
//  ExamsPage : CRUD des examens + composition + publication.
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getQuestions } from '../questions/questionsApi'
import { getSubjects } from '../subjects/subjectsApi'
import {
  createExam,
  deleteExam,
  getExams,
  publishExam,
  unpublishExam,
} from './examsApi'

const schema = z.object({
  title: z.string().min(1, 'Le titre est requis.').max(200),
  subjectId: z.string().uuid('Choisissez une matière.'),
  durationMinutes: z.number().int().min(1),
  passScore: z.number().int().min(0).max(100),
})
type FormValues = z.infer<typeof schema>

function axiosMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    return data?.message ?? fallback
  }
  return fallback
}

export function ExamsPage() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => getSubjects(),
  })
  const { data: exams, isPending, isError } = useQuery({
    queryKey: ['exams'],
    queryFn: () => getExams(),
  })

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { durationMinutes: 60, passScore: 50 },
  })

  const subjectId = watch('subjectId')

  // Questions de la matière choisie (pour la composition).
  const { data: questions } = useQuery({
    queryKey: ['questions', subjectId],
    queryFn: () => getQuestions(subjectId),
    enabled: !!subjectId,
  })

  // On repart d'une sélection vide quand la matière change.
  useEffect(() => {
    setSelected([])
  }, [subjectId])

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      createExam({ ...v, questionIds: selected }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      reset()
      setSelected([])
      setActionError(null)
    },
    onError: (e) => setActionError(axiosMessage(e, 'Erreur lors de la création.')),
  })

  const publish = useMutation({
    mutationFn: (id: string) => publishExam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams'] }),
    onError: (e) => setActionError(axiosMessage(e, 'Publication impossible.')),
  })
  const unpublish = useMutation({
    mutationFn: (id: string) => unpublishExam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams'] }),
  })
  const del = useMutation({
    mutationFn: (id: string) => deleteExam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams'] }),
    onError: (e) => setActionError(axiosMessage(e, 'Suppression impossible.')),
  })

  function onSubmit(v: FormValues) {
    if (selected.length === 0) {
      setActionError('Sélectionnez au moins une question.')
      return
    }
    create.mutate(v)
  }

  const subjectName = (id: string) =>
    subjects?.data.find((s) => s.id === id)?.name ?? '—'

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Examens</h1>

      {/* Formulaire de création */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mb-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Titre
            </label>
            <input
              {...register('title')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
              placeholder="Ex : Examen final — Algèbre"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Matière
            </label>
            <select
              {...register('subjectId')}
              defaultValue=""
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
            >
              <option value="" disabled>
                Choisir…
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
              Durée (minutes)
            </label>
            <input
              type="number"
              min={1}
              {...register('durationMinutes', { valueAsNumber: true })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Seuil de réussite (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              {...register('passScore', { valueAsNumber: true })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
            />
          </div>
        </div>

        {/* Composition */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              Composition
            </label>
            <span className="text-xs text-slate-400">
              {selected.length} sélectionnée(s) — 15 à 20 requises pour publier
            </span>
          </div>
          {!subjectId ? (
            <p className="text-sm text-slate-400">
              Choisissez d’abord une matière.
            </p>
          ) : questions && questions.data.length > 0 ? (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {questions.data.map((q) => (
                <label
                  key={q.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(q.id)}
                    onChange={() => toggle(q.id)}
                    className="h-4 w-4 accent-ems-primary"
                  />
                  <span className="text-slate-700">{q.statement}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Aucune question dans cette matière.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-ems-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {create.isPending ? 'Création…' : 'Créer l’examen (brouillon)'}
        </button>
      </form>

      {actionError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Liste */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {isPending ? (
          <p className="p-6 text-sm text-slate-400">Chargement…</p>
        ) : isError ? (
          <p className="p-6 text-sm text-red-600">Erreur de chargement.</p>
        ) : exams.data.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aucun examen.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {exams.data.map((exam) => (
              <li
                key={exam.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">{exam.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        exam.isPublished
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {exam.isPublished ? 'Publié' : 'Brouillon'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {subjectName(exam.subjectId)} ·{' '}
                    {exam._count?.examQuestions ?? 0} questions · {exam.durationMinutes}{' '}
                    min · seuil {exam.passScore}%
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
                  {exam.isPublished ? (
                    <button
                      onClick={() => unpublish.mutate(exam.id)}
                      className="text-slate-600 hover:underline"
                    >
                      Dépublier
                    </button>
                  ) : (
                    <button
                      onClick={() => publish.mutate(exam.id)}
                      className="text-ems-primary hover:underline"
                    >
                      Publier
                    </button>
                  )}
                  <button
                    onClick={() => del.mutate(exam.id)}
                    className="text-red-600 hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
