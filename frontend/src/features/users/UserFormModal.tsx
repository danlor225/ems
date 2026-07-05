// ============================================================
//  Modales de formulaire Utilisateur : création & édition.
//  RHF + Zod, gestion des erreurs serveur (409 email existant).
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { NativeSelect } from '@/components/ui/native-select'
import { getGroups } from '../groups/groupsApi'
import {
  createUser,
  updateUser,
  type UpdateUserBody,
  type UserRow,
} from './usersApi'
import {
  createUserSchema,
  editUserSchema,
  type CreateUserValues,
  type EditUserValues,
} from './usersSchema'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-danger">{message}</p>
}

// ---------- Création ----------

export function CreateUserModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'STUDENT' },
  })

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      reset({ role: 'STUDENT' })
      onClose()
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setError('email', { message: 'Un compte existe déjà avec cet email.' })
      }
    },
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvel utilisateur"
      description="Créez un compte et attribuez-lui un rôle."
    >
      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-firstName">Prénom</Label>
            <Input id="c-firstName" {...register('firstName')} />
            <FieldError message={errors.firstName?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-lastName">Nom</Label>
            <Input id="c-lastName" {...register('lastName')} />
            <FieldError message={errors.lastName?.message} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-email">Email</Label>
          <Input
            id="c-email"
            type="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-password">Mot de passe provisoire</Label>
          <Input id="c-password" type="text" {...register('password')} />
          <FieldError message={errors.password?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-role">Rôle</Label>
          <NativeSelect id="c-role" {...register('role')}>
            <option value="STUDENT">Étudiant</option>
            <option value="TEACHER">Enseignant</option>
            <option value="ADMIN">Administrateur</option>
          </NativeSelect>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Édition ----------

export function EditUserModal({
  user,
  onClose,
}: {
  user: UserRow | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  // Liste des groupes pour le sélecteur (chargée à l'ouverture).
  const { data: groups } = useQuery({
    queryKey: ['groups', 'select'],
    queryFn: () => getGroups({ limit: 100 }),
    enabled: !!user,
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema),
    // La clé `user.id` (voir plus bas) remonte le composant à chaque changement
    // d'utilisateur, donc ces valeurs par défaut sont toujours à jour.
    defaultValues: user
      ? {
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          matricule: user.matricule ?? '',
          groupId: user.groupId ?? '',
        }
      : undefined,
  })

  const mutation = useMutation({
    mutationFn: (values: EditUserValues) => {
      // '' => null : effacer le matricule / retirer du groupe.
      const body: UpdateUserBody = {
        firstName: values.firstName,
        lastName: values.lastName,
        role: values.role,
        matricule: values.matricule?.trim() ? values.matricule.trim() : null,
        groupId: values.groupId ? values.groupId : null,
      }
      return updateUser(user!.id, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      onClose()
    },
  })

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title="Modifier l'utilisateur"
      description={user?.email}
    >
      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="e-firstName">Prénom</Label>
            <Input id="e-firstName" {...register('firstName')} />
            <FieldError message={errors.firstName?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-lastName">Nom</Label>
            <Input id="e-lastName" {...register('lastName')} />
            <FieldError message={errors.lastName?.message} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-role">Rôle</Label>
          <NativeSelect id="e-role" {...register('role')}>
            <option value="STUDENT">Étudiant</option>
            <option value="TEACHER">Enseignant</option>
            <option value="ADMIN">Administrateur</option>
          </NativeSelect>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="e-matricule">Matricule</Label>
            <Input
              id="e-matricule"
              placeholder="MAT-2026-001"
              {...register('matricule')}
            />
            <FieldError message={errors.matricule?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-group">Groupe / Classe</Label>
            <NativeSelect id="e-group" {...register('groupId')}>
              <option value="">— Aucun —</option>
              {groups?.data.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  )
}
