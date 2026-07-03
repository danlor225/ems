// ============================================================
//  SettingsPage — Profil, Sécurité, Préférences.
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/features/auth/authApi'
import { useAuth } from '@/features/auth/AuthContext'
import { useTheme } from '@/features/theme/ThemeProvider'
import { cn } from '@/lib/utils'

// ---------- Profil ----------
const profileSchema = z.object({
  firstName: z.string().min(1, 'Requis.').max(100),
  lastName: z.string().min(1, 'Requis.').max(100),
})
type ProfileValues = z.infer<typeof profileSchema>

function ProfileCard() {
  const { user, updateProfile } = useAuth()
  const [saved, setSaved] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
    },
  })

  async function onSubmit(v: ProfileValues) {
    setSaved(false)
    await updateProfile(v)
    setSaved(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>Vos informations personnelles.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Prénom</Label>
              <Input id="firstName" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-xs text-danger">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Nom</Label>
              <Input id="lastName" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-xs text-danger">{errors.lastName.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ''} disabled />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={isSubmitting}>
              Enregistrer
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-success">
                <Check className="size-4" /> Enregistré
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ---------- Sécurité ----------
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Requis.'),
    newPassword: z.string().min(8, 'Au moins 8 caractères.').max(72),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  })
type PasswordValues = z.infer<typeof passwordSchema>

function SecurityCard() {
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })

  async function onSubmit(v: PasswordValues) {
    setMessage(null)
    try {
      await authApi.changePassword({
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      })
      reset()
      setMessage({ type: 'success', text: 'Mot de passe modifié.' })
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          axios.isAxiosError(error) && error.response?.status === 401
            ? 'Mot de passe actuel incorrect.'
            : 'Erreur lors du changement.',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sécurité</CardTitle>
        <CardDescription>Modifiez votre mot de passe.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Mot de passe actuel</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...register('currentPassword')}
            />
            {errors.currentPassword && (
              <p className="text-xs text-danger">
                {errors.currentPassword.message}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                {...register('newPassword')}
              />
              {errors.newPassword && (
                <p className="text-xs text-danger">
                  {errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmer</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-danger">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>
          {message && (
            <p
              className={cn(
                'text-sm',
                message.type === 'success' ? 'text-success' : 'text-danger',
              )}
            >
              {message.text}
            </p>
          )}
          <Button type="submit" loading={isSubmitting}>
            Changer le mot de passe
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ---------- Préférences ----------
function PreferencesCard() {
  const { theme, toggle } = useTheme()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Préférences</CardTitle>
        <CardDescription>Apparence de l'interface.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Thème</p>
            <p className="text-xs text-muted-foreground">
              Clair ou sombre selon votre confort.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => theme === 'dark' && toggle()}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                theme === 'light'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              Clair
            </button>
            <button
              type="button"
              onClick={() => theme === 'light' && toggle()}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                theme === 'dark'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              Sombre
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Paramètres
      </h1>
      <ProfileCard />
      <SecurityCard />
      <PreferencesCard />
    </div>
  )
}
