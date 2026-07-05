// ============================================================
//  UserDetailModal — fiche utilisateur + historique de connexion.
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { getUser } from './usersApi'
import { ROLE_LABEL } from './constants'

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function fmt(value: string | null) {
  return value ? dateFmt.format(new Date(value)) : '—'
}

export function UserDetailModal({
  userId,
  onClose,
}: {
  userId: string | null
  onClose: () => void
}) {
  const { data, isPending } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId!),
    enabled: !!userId,
  })

  return (
    <Modal
      open={!!userId}
      onClose={onClose}
      title="Fiche utilisateur"
      className="max-w-xl"
    >
      {isPending || !data ? (
        <div className="grid h-40 place-items-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Identité */}
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-base font-semibold text-primary">
              {data.firstName[0]}
              {data.lastName[0]}
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {data.firstName} {data.lastName}
              </p>
              <p className="text-sm text-muted-foreground">{data.email}</p>
            </div>
          </div>

          {/* Méta */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Rôle</dt>
              <dd className="font-medium text-foreground">
                {ROLE_LABEL[data.role]}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Statut</dt>
              <dd className="font-medium text-foreground">
                {data.isLocked
                  ? 'Verrouillé'
                  : data.isActive
                    ? 'Actif'
                    : 'Inactif'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Matricule</dt>
              <dd className="font-medium text-foreground">
                {data.matricule ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Groupe / Classe</dt>
              <dd className="font-medium text-foreground">
                {data.group?.name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Créé le</dt>
              <dd className="font-medium text-foreground">
                {fmt(data.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dernière connexion</dt>
              <dd className="font-medium text-foreground">
                {fmt(data.lastLoginAt)}
              </dd>
            </div>
          </dl>

          {/* Historique de connexion */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Dernières connexions
            </h3>
            {data.loginHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune connexion enregistrée.
              </p>
            ) : (
              <ul className="max-h-52 space-y-1 overflow-y-auto">
                {data.loginHistory.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-foreground">
                      {fmt(h.createdAt)}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {h.ip ?? '—'}
                    </span>
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
