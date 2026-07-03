// ============================================================
//  SessionsPage : planification des sessions.
//  - examen publié + fenêtre (datetime-local -> ISO UTC)
//  - liste avec statut + Fermer / Supprimer
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getExams } from '../exams/examsApi'
import {
  closeSession,
  createSession,
  deleteSession,
  getSessions,
} from './sessionsApi'

const schema = z.object({
  examId: z.string().uuid('Choisissez un examen.'),
  opensAt: z.string().min(1, "Date d'ouverture requise."),
  closesAt: z.string().min(1, 'Date de fermeture requise.'),
})
type FormValues = z.infer<typeof schema>

function axiosMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    return data?.message ?? fallback
  }
  return fallback
}

const statusStyle: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  OPEN: 'bg-green-100 text-green-700',
  CLOSED: 'bg-slate-100 text-slate-500',
}

export function SessionsPage() {
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: exams } = useQuery({ queryKey: ['exams'], queryFn: () => getExams() })
  const publishedExams = exams?.data.filter((e) => e.isPublished) ?? []

  const { data: sessions, isPending, isError } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => getSessions(),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      createSession({
        examId: v.examId,
        // datetime-local (heure locale) -> ISO UTC
        opensAt: new Date(v.opensAt).toISOString(),
        closesAt: new Date(v.closesAt).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      reset()
      setActionError(null)
    },
    onError: (e) => setActionError(axiosMessage(e, 'Création impossible.')),
  })

  const close = useMutation({
    mutationFn: (id: string) => closeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })
  const del = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
    onError: (e) => setActionError(axiosMessage(e, 'Suppression impossible.')),
  })

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Sessions</h1>

      {/* Formulaire */}
      <form
        onSubmit={handleSubmit((v) => create.mutate(v))}
        className="mb-6 space-y-4 rounded-2xl bg-white p-5 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Examen (publié)
          </label>
          <select
            {...register('examId')}
            defaultValue=""
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
          >
            <option value="" disabled>
              Choisir un examen…
            </option>
            {publishedExams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          {publishedExams.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Aucun examen publié. Publiez d’abord un examen.
            </p>
          )}
          {errors.examId && (
            <p className="mt-1 text-xs text-red-600">{errors.examId.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Ouverture
            </label>
            <input
              type="datetime-local"
              {...register('opensAt')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
            />
            {errors.opensAt && (
              <p className="mt-1 text-xs text-red-600">
                {errors.opensAt.message}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Fermeture
            </label>
            <input
              type="datetime-local"
              {...register('closesAt')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
            />
            {errors.closesAt && (
              <p className="mt-1 text-xs text-red-600">
                {errors.closesAt.message}
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-ems-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {create.isPending ? 'Planification…' : 'Planifier la session'}
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
        ) : sessions.data.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aucune session.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sessions.data.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">{s.exam.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[s.status]}`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Du {new Date(s.opensAt).toLocaleString('fr-FR')} au{' '}
                    {new Date(s.closesAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs font-medium">
                  {s.status !== 'CLOSED' && (
                    <button
                      onClick={() => close.mutate(s.id)}
                      className="text-slate-600 hover:underline"
                    >
                      Fermer
                    </button>
                  )}
                  <button
                    onClick={() => del.mutate(s.id)}
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
