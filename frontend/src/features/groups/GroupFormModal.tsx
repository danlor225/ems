// ============================================================
//  Modale création / édition d'un groupe (ADMIN).
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { createGroup, updateGroup, type GroupRow } from './groupsApi'

const schema = z.object({
  name: z.string().trim().min(1, 'Nom requis.').max(150),
  level: z.string().trim().max(50).optional(),
  academicYear: z.string().trim().max(20).optional(),
  description: z.string().trim().optional(),
})
type Values = z.infer<typeof schema>

export function GroupFormModal({
  open,
  group,
  onClose,
}: {
  open: boolean
  group: GroupRow | null // null => création
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: group
      ? {
          name: group.name,
          level: group.level ?? '',
          academicYear: group.academicYear ?? '',
          description: group.description ?? '',
        }
      : undefined,
  })

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      group ? updateGroup(group.id, values) : createGroup(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      onClose()
    },
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={group ? 'Modifier le groupe' : 'Nouveau groupe'}
      description="Une classe / cohorte d'étudiants."
    >
      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="space-y-4"
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="g-name">Nom</Label>
          <Input id="g-name" placeholder="L3 Informatique" {...register('name')} />
          {errors.name && (
            <p className="text-xs text-danger">{errors.name.message}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="g-level">Niveau</Label>
            <Input id="g-level" placeholder="L3" {...register('level')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-year">Année académique</Label>
            <Input id="g-year" placeholder="2025-2026" {...register('academicYear')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="g-desc">Description</Label>
          <Textarea id="g-desc" rows={3} {...register('description')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {group ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
