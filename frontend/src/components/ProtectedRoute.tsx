// ============================================================
//  ProtectedRoute : garde de navigation côté client.
//  - pendant le bootstrap : écran de chargement
//  - non connecté        : redirection vers /login
//  - rôle insuffisant    : redirection vers l'accueil
//  RAPPEL : ce garde améliore l'UX ; la vraie sécurité est
//  côté serveur (le backend re-vérifie tout).
// ============================================================
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import type { Role } from '../features/auth/types'

interface ProtectedRouteProps {
  children: ReactNode
  roles?: Role[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, isBootstrapping } = useAuth()

  if (isBootstrapping) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-400">
        Chargement…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />

  return <>{children}</>
}
