// ============================================================
//  ResetPasswordModal — l'admin définit un nouveau mot de passe.
//  Révoque les sessions actives côté backend (déconnexion forcée).
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { resetUserPassword, type UserRow } from './usersApi'
import { resetPasswordSchema, type ResetPasswordValues } from './usersSchema'

export function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserRow | null
  onClose: () => void
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) })

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordValues) =>
      resetUserPassword(user!.id, values.newPassword),
    onSuccess: () => {
      reset()
      onClose()
    },
  })

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title="Réinitialiser le mot de passe"
      description={
        user
          ? `${user.firstName} ${user.lastName} sera déconnecté(e) de ses sessions actives.`
          : undefined
      }
    >
      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="r-password">Nouveau mot de passe</Label>
          <Input
            id="r-password"
            type="text"
            autoComplete="new-password"
            aria-invalid={!!errors.newPassword}
            {...register('newPassword')}
          />
          {errors.newPassword && (
            <p className="text-xs text-danger">{errors.newPassword.message}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Réinitialiser
          </Button>
        </div>
      </form>
    </Modal>
  )
}
