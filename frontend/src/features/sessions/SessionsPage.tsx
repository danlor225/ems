// ============================================================
//  SessionsPage — planification des sessions (design system).
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
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

const statusVariant: Record<string, BadgeProps['variant']> = {
  SCHEDULED: 'info',
  OPEN: 'success',
  CLOSED: 'default',
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
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Sessions
      </h1>

      {/* Création */}
      <Card>
        <CardHeader>
          <CardTitle>Planifier une session</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((v) => create.mutate(v))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="examId">Examen (publié)</Label>
              <NativeSelect
                id="examId"
                defaultValue=""
                aria-invalid={!!errors.examId}
                {...register('examId')}
              >
                <option value="" disabled>
                  Choisir un examen…
                </option>
                {publishedExams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </NativeSelect>
              {publishedExams.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun examen publié. Publiez d'abord un examen.
                </p>
              )}
              {errors.examId && (
                <p className="text-xs text-danger">{errors.examId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="opensAt">Ouverture</Label>
                <Input
                  id="opensAt"
                  type="datetime-local"
                  aria-invalid={!!errors.opensAt}
                  {...register('opensAt')}
                />
                {errors.opensAt && (
                  <p className="text-xs text-danger">{errors.opensAt.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="closesAt">Fermeture</Label>
                <Input
                  id="closesAt"
                  type="datetime-local"
                  aria-invalid={!!errors.closesAt}
                  {...register('closesAt')}
                />
                {errors.closesAt && (
                  <p className="text-xs text-danger">
                    {errors.closesAt.message}
                  </p>
                )}
              </div>
            </div>

            <Button type="submit" loading={create.isPending}>
              Planifier la session
            </Button>
          </form>
        </CardContent>
      </Card>

      {actionError && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {actionError}
        </div>
      )}

      {/* Liste */}
      <Card className="overflow-hidden">
        {isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="p-6 text-sm text-danger">Erreur de chargement.</p>
        ) : sessions.data.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Aucune session.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.data.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 px-4 py-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">
                      {s.exam.title}
                    </p>
                    <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Du {new Date(s.opensAt).toLocaleString('fr-FR')} au{' '}
                    {new Date(s.closesAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {s.status !== 'CLOSED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => close.mutate(s.id)}
                    >
                      Fermer
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-danger"
                    onClick={() => del.mutate(s.id)}
                  >
                    Supprimer
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
