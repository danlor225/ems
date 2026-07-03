// ============================================================
//  RegisterPage : inscription étudiant (RHF + Zod).
//  Après succès : connexion automatique + redirection.
// ============================================================
import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from './AuthContext'

const schema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis.').max(100),
  lastName: z.string().min(1, 'Le nom est requis.').max(100),
  email: z.string().email('Adresse email invalide.'),
  password: z
    .string()
    .min(8, 'Au moins 8 caractères.')
    .max(72, 'Au plus 72 caractères.'),
})
type FormValues = z.infer<typeof schema>

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ems-primary focus:ring-2 focus:ring-ems-primary/20'

export function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      await registerUser(values)
      navigate('/', { replace: true })
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setServerError('Un compte existe déjà avec cet email.')
      } else {
        setServerError('Inscription impossible. Réessayez plus tard.')
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-3xl font-extrabold tracking-tight text-ems-primary">
            EM<span className="text-ems-dark">S</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Créer un compte étudiant</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Prénom
              </label>
              <input {...register('firstName')} className={inputClass} />
              {errors.firstName && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nom
              </label>
              <input {...register('lastName')} className={inputClass} />
              {errors.lastName && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              {...register('email')}
              className={inputClass}
              placeholder="vous@exemple.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className={inputClass}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {serverError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-ems-primary py-2.5 text-sm font-semibold text-white transition hover:bg-ems-dark disabled:opacity-60"
          >
            {isSubmitting ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Déjà un compte ?{' '}
          <Link to="/login" className="font-medium text-ems-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
