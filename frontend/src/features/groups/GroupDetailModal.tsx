// ============================================================
//  GroupDetailModal — membres du groupe + ajout / retrait (ADMIN).
//  L'ajout recherche parmi les étudiants (GET /users?role=STUDENT).
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Search, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getUsers } from '../users/usersApi'
import {
  addGroupMember,
  getGroup,
  removeGroupMember,
} from './groupsApi'

export function GroupDetailModal({
  groupId,
  canManage,
  onClose,
}: {
  groupId: string | null
  canManage: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 300)

  const { data: group, isPending } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId!),
    enabled: !!groupId,
  })

  // Recherche d'étudiants à ajouter (uniquement quand on saisit).
  const { data: candidates } = useQuery({
    queryKey: ['users', 'student-search', debounced],
    queryFn: () => getUsers({ role: 'STUDENT', search: debounced, limit: 8 }),
    enabled: canManage && debounced.length > 0,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['group', groupId] })
    queryClient.invalidateQueries({ queryKey: ['groups'] })
  }
  const add = useMutation({
    mutationFn: (userId: string) => addGroupMember(groupId!, userId),
    onSuccess: () => {
      setSearch('')
      invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: (userId: string) => removeGroupMember(groupId!, userId),
    onSuccess: invalidate,
  })

  const memberIds = new Set(group?.students.map((s) => s.id))

  return (
    <Modal
      open={!!groupId}
      onClose={onClose}
      title={group?.name ?? 'Groupe'}
      description={
        group
          ? [group.level, group.academicYear].filter(Boolean).join(' • ') ||
            undefined
          : undefined
      }
      className="max-w-xl"
    >
      {isPending || !group ? (
        <div className="grid h-40 place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Ajout de membre (ADMIN) */}
          {canManage && (
            <div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Ajouter un étudiant (nom, email)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {debounced && candidates && (
                <ul className="mt-2 space-y-1">
                  {candidates.data.filter((u) => !memberIds.has(u.id)).length ===
                  0 ? (
                    <li className="px-1 py-2 text-xs text-muted-foreground">
                      Aucun étudiant à ajouter.
                    </li>
                  ) : (
                    candidates.data
                      .filter((u) => !memberIds.has(u.id))
                      .map((u) => (
                        <li
                          key={u.id}
                          className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                        >
                          <span>
                            <span className="font-medium text-foreground">
                              {u.firstName} {u.lastName}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {u.email}
                            </span>
                          </span>
                          <button
                            onClick={() => add.mutate(u.id)}
                            disabled={add.isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                          >
                            <Plus className="size-3.5" />
                            Ajouter
                          </button>
                        </li>
                      ))
                  )}
                </ul>
              )}
            </div>
          )}

          {/* Liste des membres */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Membres ({group.students.length})
            </h3>
            {group.students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun étudiant dans ce groupe.
              </p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {group.students.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {s.firstName[0]}
                        {s.lastName[0]}
                      </span>
                      <span>
                        <span className="block font-medium text-foreground">
                          {s.firstName} {s.lastName}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {s.matricule ? `${s.matricule} · ` : ''}
                          {s.email}
                        </span>
                      </span>
                    </span>
                    {canManage && (
                      <button
                        onClick={() => remove.mutate(s.id)}
                        disabled={remove.isPending}
                        aria-label="Retirer du groupe"
                        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                      >
                        <UserMinus className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
