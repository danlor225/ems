// ============================================================
//  ExamsPage — liste des examens + actions.
//  La création se fait via l'assistant (/admin/examens/nouveau).
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getSubjects } from '../subjects/subjectsApi'
import {
  deleteExam,
  getExams,
  publishExam,
  unpublishExam,
} from './examsApi'

function axiosMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    return data?.message ?? fallback
  }
  return fallback
}

export function ExamsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => getSubjects(),
  })
  const { data: exams, isPending, isError } = useQuery({
    queryKey: ['exams'],
    queryFn: () => getExams(),
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

  const subjectName = (id: string) =>
    subjects?.data.find((s) => s.id === id)?.name ?? '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Examens
        </h1>
        <Button onClick={() => navigate('/admin/examens/nouveau')}>
          <Plus className="size-4" />
          Nouvel examen
        </Button>
      </div>

      {actionError && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {actionError}
        </div>
      )}

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
            Aucun examen. Créez-en un avec l'assistant.
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
