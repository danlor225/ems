// ============================================================
//  EvaluationsListPage — liste v2 (filtres, recherche, actions).
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  Archive,
  Copy,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'
import {
  archiveEvaluation,
  closeEvaluation,
  deleteEvaluation,
  duplicateEvaluation,
  getEvaluations,
  publishEvaluation,
  type EvaluationRow,
  type EvaluationStatus,
} from './evaluationsApi'

// Bornes de composition (identiques au wizard) : une éval doit contenir
// entre 15 et 60 questions pour être publiable.
const MIN_QUESTIONS = 15
const MAX_QUESTIONS = 60

// Formate une Date en valeur d'input datetime-local (heure LOCALE).
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Remonte le message d'erreur métier renvoyé par l'API (sinon un fallback).
function axiosMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    return data?.message ?? fallback
  }
  return fallback
}

const FILTERS = [
  { key: 'ALL', label: 'Toutes' },
  { key: 'PUBLISHED', label: 'Publiées' },
  { key: 'DRAFT', label: 'Brouillons' },
  { key: 'OPEN', label: 'Ouvertes' },
  { key: 'CLOSED', label: 'Fermées' },
  { key: 'ARCHIVED', label: 'Archivées' },
] as const

const STATUS: Record<EvaluationStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Brouillon', cls: 'bg-warning/15 text-warning' },
  PUBLISHED: { label: 'Publiée', cls: 'bg-success/15 text-success' },
  OPEN: { label: 'Ouverte', cls: 'bg-primary/15 text-primary' },
  CLOSED: { label: 'Fermée', cls: 'bg-danger/15 text-danger' },
  ARCHIVED: { label: 'Archivée', cls: 'bg-muted text-muted-foreground' },
}

export function EvaluationsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('ALL')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const statusParam: EvaluationStatus | undefined =
    filter === 'ALL' ? undefined : filter === 'OPEN' ? 'PUBLISHED' : filter

  const { data, isPending, isError } = useQuery({
    queryKey: ['evaluations', statusParam, debouncedSearch],
    queryFn: () =>
      getEvaluations({
        status: statusParam,
        search: debouncedSearch || undefined,
        limit: 50,
      }),
  })

  // Publication d'un brouillon existant : cible + fenêtre saisie dans une modale.
  const [publishTarget, setPublishTarget] = useState<EvaluationRow | null>(null)
  const [opensAt, setOpensAt] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [publishError, setPublishError] = useState<string | null>(null)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['evaluations'] })
  const dup = useMutation({ mutationFn: duplicateEvaluation, onSuccess: invalidate })
  const close = useMutation({ mutationFn: closeEvaluation, onSuccess: invalidate })
  const archive = useMutation({ mutationFn: archiveEvaluation, onSuccess: invalidate })
  const del = useMutation({ mutationFn: deleteEvaluation, onSuccess: invalidate })
  const publish = useMutation({
    mutationFn: (v: { id: string; opensAt: string; closesAt: string }) =>
      publishEvaluation(v.id, {
        opensAt: new Date(v.opensAt).toISOString(),
        closesAt: new Date(v.closesAt).toISOString(),
      }),
    onSuccess: () => {
      invalidate()
      setPublishTarget(null)
    },
    onError: (e) => setPublishError(axiosMessage(e, 'Publication impossible.')),
  })

  // Ouvre la modale avec une fenêtre par défaut (maintenant → +7 jours).
  function openPublish(row: EvaluationRow) {
    const now = new Date()
    setPublishTarget(row)
    setOpensAt(toLocalInput(now))
    setClosesAt(toLocalInput(new Date(now.getTime() + 7 * 24 * 3600 * 1000)))
    setPublishError(null)
  }

  const targetOutOfRange =
    !!publishTarget &&
    (publishTarget.questionsCount < MIN_QUESTIONS ||
      publishTarget.questionsCount > MAX_QUESTIONS)

  const rows =
    filter === 'OPEN'
      ? (data?.data.filter((r) => r.effectiveStatus === 'OPEN') ?? [])
      : (data?.data ?? [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Évaluations
        </h1>
        <Button onClick={() => navigate('/evaluations/nouvelle')}>
          <Plus className="size-4" />
          Nouvelle évaluation
        </Button>
      </div>

      {/* Filtres + recherche */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                filter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher (nom, code)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tableau */}
      <Card className="overflow-hidden">
        {isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="p-6 text-sm text-danger">Erreur de chargement.</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Aucune évaluation.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Matière</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Auteur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => {
                const s = STATUS[e.effectiveStatus]
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {e.code ?? '—'}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {e.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.subject}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.questionsCount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.durationMinutes} min
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.author ?? '—'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                          s.cls,
                        )}
                      >
                        {s.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            aria-label="Actions"
                            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <MoreVertical className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onSelect={() => navigate('/admin/resultats')}
                          >
                            Voir les résultats
                          </DropdownMenuItem>
                          {e.status === 'DRAFT' && (
                            <DropdownMenuItem
                              onSelect={() =>
                                navigate('/evaluations/nouvelle', {
                                  state: { evaluationId: e.id },
                                })
                              }
                            >
                              <Pencil className="size-4" />
                              Modifier
                            </DropdownMenuItem>
                          )}
                          {e.status === 'DRAFT' && (
                            <DropdownMenuItem onSelect={() => openPublish(e)}>
                              <Send className="size-4" />
                              Publier
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => dup.mutate(e.id)}>
                            <Copy className="size-4" />
                            Dupliquer
                          </DropdownMenuItem>
                          {e.status === 'PUBLISHED' && (
                            <DropdownMenuItem onSelect={() => close.mutate(e.id)}>
                              <XCircle className="size-4" />
                              Fermer
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => archive.mutate(e.id)}>
                            <Archive className="size-4" />
                            Archiver
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => del.mutate(e.id)}
                            className="text-danger focus:bg-danger/10"
                          >
                            <Trash2 className="size-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modale : publier un brouillon existant (fenêtre de passage). */}
      <Modal
        open={!!publishTarget}
        onClose={() => setPublishTarget(null)}
        title="Publier l'évaluation"
        description={
          publishTarget
            ? `${publishTarget.name} · ${publishTarget.questionsCount} question(s)`
            : undefined
        }
      >
        {targetOutOfRange ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              Une évaluation doit contenir entre {MIN_QUESTIONS} et{' '}
              {MAX_QUESTIONS} questions pour être publiée (actuellement{' '}
              {publishTarget?.questionsCount}). Modifiez sa composition avant de
              publier.
            </p>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                onClick={() => setPublishTarget(null)}
              >
                Fermer
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(ev) => {
              ev.preventDefault()
              if (!publishTarget) return
              setPublishError(null)
              publish.mutate({ id: publishTarget.id, opensAt, closesAt })
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="opensAt">Ouverture</Label>
                <Input
                  id="opensAt"
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="closesAt">Fermeture</Label>
                <Input
                  id="closesAt"
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Les étudiants pourront composer entre l'ouverture et la fermeture.
            </p>
            {publishError && (
              <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {publishError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPublishTarget(null)}
              >
                Annuler
              </Button>
              <Button type="submit" loading={publish.isPending}>
                <Send className="size-4" />
                Publier
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
