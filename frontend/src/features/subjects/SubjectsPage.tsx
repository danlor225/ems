// ============================================================
//  SubjectsPage : CRUD des matières (patron de référence).
//  - liste      : useQuery(['subjects'])
//  - création   : useMutation + invalidation du cache
//  - suppression: useMutation + gestion du 409 (matière utilisée)
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { createSubject, deleteSubject, getSubjects } from './subjectsApi'

const schema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(150),
  description: z.string().max(1000).optional(),
})
type FormValues = z.infer<typeof schema>

export function SubjectsPage() {
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isPending, isError } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => getSubjects(),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      createSubject({ name: v.name, description: v.description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      reset()
      setActionError(null)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteSubject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setActionError('Matière utilisée par des questions/examens : suppression impossible.')
      } else {
        setActionError('Erreur lors de la suppression.')
      }
    },
  })

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Matières</h1>

      {/* Formulaire de création */}
      <form
        onSubmit={handleSubmit((v) => create.mutate(v))}
        className="mb-6 rounded-2xl bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <div className="flex-1">
            <input
              {...register('name')}
              placeholder="Nom de la matière"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>
          <div className="flex-1">
            <input
              {...register('description')}
              placeholder="Description (optionnelle)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary"
            />
          </div>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-lg bg-ems-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {create.isPending ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
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
        ) : data.data.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aucune matière.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Nom</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((subject) => (
                <tr key={subject.id}>
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {subject.name}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {subject.description ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove.mutate(subject.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
