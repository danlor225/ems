// ============================================================
//  SubjectsPage — CRUD Matières (design system).
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
      setActionError(
        axios.isAxiosError(error) && error.response?.status === 409
          ? 'Matière utilisée par des questions/examens : suppression impossible.'
          : 'Erreur lors de la suppression.',
      )
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Matières
      </h1>

      {/* Création */}
      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={handleSubmit((v) => create.mutate(v))}
            className="flex flex-col gap-3 md:flex-row md:items-start"
          >
            <div className="flex-1">
              <Input placeholder="Nom de la matière" {...register('name')} />
              {errors.name && (
                <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
              )}
            </div>
            <Input
              className="flex-1"
              placeholder="Description (optionnelle)"
              {...register('description')}
            />
            <Button type="submit" loading={create.isPending}>
              <Plus className="size-4" />
              Ajouter
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
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="p-6 text-sm text-danger">Erreur de chargement.</p>
        ) : data.data.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Aucune matière pour le moment.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nom</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell className="font-medium text-foreground">
                    {subject.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {subject.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Supprimer"
                      onClick={() => remove.mutate(subject.id)}
                      className="text-muted-foreground hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
