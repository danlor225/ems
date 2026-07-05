// ============================================================
//  GroupsListPage — groupes / classes.
//  Lecture : staff. Créer / modifier / supprimer : ADMIN.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardList,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { useState } from 'react'
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
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useAuth } from '../auth/AuthContext'
import { GroupDetailModal } from './GroupDetailModal'
import { GroupFormModal } from './GroupFormModal'
import { deleteGroup, getGroups, type GroupRow } from './groupsApi'

export function GroupsListPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canManage = user?.role === 'ADMIN'

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<GroupRow | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data, isPending, isError } = useQuery({
    queryKey: ['groups', debouncedSearch],
    queryFn: () => getGroups({ search: debouncedSearch || undefined, limit: 100 }),
  })

  const del = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  })

  const rows = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Groupes
          </h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.meta.total} groupe(s)` : ' '}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Nouveau groupe
          </Button>
        )}
      </div>

      <div className="relative sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher (nom, niveau, année)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-danger">Erreur de chargement.</p>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Aucun groupe.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((g) => (
            <Card
              key={g.id}
              className="flex cursor-pointer flex-col gap-4 p-5 transition-shadow hover:shadow-md"
              onClick={() => setDetailId(g.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <UsersRound className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[g.level, g.academicYear].filter(Boolean).join(' • ') ||
                        '—'}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label="Actions"
                        onClick={(e) => e.stopPropagation()}
                        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => setEditing(g)}>
                        <Pencil className="size-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => {
                          if (
                            window.confirm(
                              `Supprimer le groupe « ${g.name} » ? Les étudiants ne seront pas supprimés.`,
                            )
                          )
                            del.mutate(g.id)
                        }}
                        className="text-danger focus:bg-danger/10"
                      >
                        <Trash2 className="size-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <UsersRound className="size-4" />
                  {g.studentsCount} étudiant(s)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardList className="size-4" />
                  {g.evaluationsCount} éval.
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modales */}
      <GroupFormModal
        open={creating}
        group={null}
        onClose={() => setCreating(false)}
      />
      <GroupFormModal
        key={editing?.id ?? 'none'}
        open={!!editing}
        group={editing}
        onClose={() => setEditing(null)}
      />
      <GroupDetailModal
        groupId={detailId}
        canManage={canManage}
        onClose={() => setDetailId(null)}
      />
    </div>
  )
}
