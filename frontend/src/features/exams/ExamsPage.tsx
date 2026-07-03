// ============================================================
//  ExamsPage — CRUD Examens + composition + publication (DS).
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
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

  const { data: questions } = useQuery({
    queryKey: ['questions', subjectId],
    queryFn: () => getQuestions(subjectId),
    enabled: !!subjectId,
  })

  useEffect(() => setSelected([]), [subjectId])

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const create = useMutation({
    mutationFn: (v: FormValues) => createExam({ ...v, questionIds: selected }),
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
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Examens
      </h1>

      {/* Création */}
      <Card>
        <CardHeader>
          <CardTitle>Nouvel examen</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="title">Titre</Label>
                <Input
                  id="title"
                  placeholder="Ex : Examen final — Algèbre"
                  aria-invalid={!!errors.title}
                  {...register('title')}
                />
                {errors.title && (
                  <p className="text-xs text-danger">{errors.title.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subjectId">Matière</Label>
                <NativeSelect
                  id="subjectId"
                  defaultValue=""
                  aria-invalid={!!errors.subjectId}
                  {...register('subjectId')}
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
                {errors.subjectId && (
                  <p className="text-xs text-danger">
                    {errors.subjectId.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="durationMinutes">Durée (minutes)</Label>
                <Input
                  id="durationMinutes"
                  type="number"
                  min={1}
                  {...register('durationMinutes', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="passScore">Seuil de réussite (%)</Label>
                <Input
                  id="passScore"
                  type="number"
                  min={0}
                  max={100}
                  {...register('passScore', { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Composition */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Composition</Label>
                <span className="text-xs text-muted-foreground">
                  {selected.length} sélectionnée(s) — 15 à 20 pour publier
                </span>
              </div>
              {!subjectId ? (
                <p className="text-sm text-muted-foreground">
                  Choisissez d'abord une matière.
                </p>
              ) : questions && questions.data.length > 0 ? (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
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
                  Aucune question dans cette matière.
                </p>
              )}
            </div>

            <Button type="submit" loading={create.isPending}>
              Créer l'examen (brouillon)
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
        ) : exams.data.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Aucun examen.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {exams.data.map((exam) => (
              <li
                key={exam.id}
                className="flex items-center justify-between gap-4 px-4 py-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{exam.title}</p>
                    <Badge variant={exam.isPublished ? 'success' : 'default'}>
                      {exam.isPublished ? 'Publié' : 'Brouillon'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {subjectName(exam.subjectId)} ·{' '}
                    {exam._count?.examQuestions ?? 0} questions ·{' '}
                    {exam.durationMinutes} min · seuil {exam.passScore}%
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {exam.isPublished ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unpublish.mutate(exam.id)}
                    >
                      Dépublier
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary"
                      onClick={() => publish.mutate(exam.id)}
                    >
                      Publier
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-danger"
                    onClick={() => del.mutate(exam.id)}
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
