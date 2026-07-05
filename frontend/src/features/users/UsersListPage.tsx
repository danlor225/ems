// ============================================================
//  UsersListPage — gestion des utilisateurs (ADMIN).
//  Liste filtrable + CRUD + verrouillage / (dés)activation +
//  réinitialisation de mot de passe + fiche détaillée.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Unlock,
  UserRound,
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
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../auth/types'
import { ROLE_BADGE, ROLE_LABEL } from './constants'
import { ResetPasswordModal } from './ResetPasswordModal'
import { UserDetailModal } from './UserDetailModal'
import { CreateUserModal, EditUserModal } from './UserFormModal'
import {
  activateUser,
  deactivateUser,
  deleteUser,
  getUsers,
  lockUser,
  unlockUser,
  type UserRow,
  type UserStatus,
} from './usersApi'

const ROLE_FILTERS: { key: 'ALL' | Role; label: string }[] = [
  { key: 'ALL', label: 'Tous' },
  { key: 'STUDENT', label: 'Étudiants' },
  { key: 'TEACHER', label: 'Enseignants' },
  { key: 'ADMIN', label: 'Administrateurs' },
]

const STATUS_FILTERS: { key: 'ALL' | UserStatus; label: string }[] = [
  { key: 'ALL', label: 'Tous statuts' },
  { key: 'active', label: 'Actifs' },
  { key: 'inactive', label: 'Inactifs' },
  { key: 'locked', label: 'Verrouillés' },
]

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function statusBadge(u: UserRow) {
  if (u.isLocked)
    return { label: 'Verrouillé', cls: 'bg-danger/15 text-danger' }
  if (!u.isActive) return { label: 'Inactif', cls: 'bg-muted text-muted-foreground' }
  return { label: 'Actif', cls: 'bg-success/15 text-success' }
}

export function UsersListPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()

  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  // État des modales.
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [resetting, setResetting] = useState<UserRow | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data, isPending, isError } = useQuery({
    queryKey: ['users', roleFilter, statusFilter, debouncedSearch],
    queryFn: () =>
      getUsers({
        role: roleFilter === 'ALL' ? undefined : roleFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: debouncedSearch || undefined,
        limit: 100,
      }),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['users'] })
  const lock = useMutation({ mutationFn: lockUser, onSuccess: invalidate })
  const unlock = useMutation({ mutationFn: unlockUser, onSuccess: invalidate })
  const activate = useMutation({ mutationFn: activateUser, onSuccess: invalidate })
  const deactivate = useMutation({ mutationFn: deactivateUser, onSuccess: invalidate })
  const del = useMutation({ mutationFn: deleteUser, onSuccess: invalidate })

  const rows = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Utilisateurs
          </h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.meta.total} compte(s)` : ' '}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Filtres + recherche */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1">
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setRoleFilter(f.key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  roleFilter === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher (nom, email)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === f.key
                  ? 'bg-foreground/10 text-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <Card className="overflow-hidden">
        {isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="p-6 text-sm text-danger">Erreur de chargement.</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Aucun utilisateur.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Utilisateur</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => {
                const s = statusBadge(u)
                const isSelf = u.id === currentUser?.id
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <button
                        onClick={() => setDetailId(u.id)}
                        className="flex items-center gap-3 text-left"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {u.firstName[0]}
                          {u.lastName[0]}
                        </span>
                        <span>
                          <span className="block font-medium text-foreground">
                            {u.firstName} {u.lastName}
                            {isSelf && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                (vous)
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {u.email}
                          </span>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                          ROLE_BADGE[u.role],
                        )}
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
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
                    <TableCell className="text-muted-foreground">
                      {u.lastLoginAt
                        ? dateFmt.format(new Date(u.lastLoginAt))
                        : 'Jamais'}
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
                          <DropdownMenuItem onSelect={() => setDetailId(u.id)}>
                            <UserRound className="size-4" />
                            Voir la fiche
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setEditing(u)}>
                            <Pencil className="size-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setResetting(u)}>
                            <KeyRound className="size-4" />
                            Réinitialiser le mot de passe
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.isLocked ? (
                            <DropdownMenuItem
                              onSelect={() => unlock.mutate(u.id)}
                            >
                              <Unlock className="size-4" />
                              Déverrouiller
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={isSelf}
                              onSelect={() => lock.mutate(u.id)}
                            >
                              <Lock className="size-4" />
                              Verrouiller
                            </DropdownMenuItem>
                          )}
                          {u.isActive ? (
                            <DropdownMenuItem
                              disabled={isSelf}
                              onSelect={() => deactivate.mutate(u.id)}
                            >
                              <Ban className="size-4" />
                              Désactiver
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() => activate.mutate(u.id)}
                            >
                              <CheckCircle2 className="size-4" />
                              Activer
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={isSelf}
                            onSelect={() => {
                              if (
                                window.confirm(
                                  `Supprimer définitivement ${u.firstName} ${u.lastName} ?`,
                                )
                              )
                                del.mutate(u.id)
                            }}
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

      {/* Modales */}
      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
      <EditUserModal
        key={editing?.id ?? 'none'}
        user={editing}
        onClose={() => setEditing(null)}
      />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
      <UserDetailModal userId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}
