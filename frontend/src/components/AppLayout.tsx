// ============================================================
//  AppLayout : ossature de l'application (barre latérale + en-tête).
//  La navigation s'adapte au rôle. Seul le "Tableau de bord" est
//  actif en Phase 7.3 ; les autres entrées sont des repères visuels
//  qui seront reliés à leurs pages dans les phases suivantes.
// ============================================================
import type { ReactNode } from 'react'
import { useAuth } from '../features/auth/AuthContext'

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN'

  const navItems = isStaff
    ? ['Tableau de bord', 'Évaluations', 'Résultats', 'Utilisateurs', 'Paramètres']
    : ['Accueil', 'Mes évaluations', 'Mes résultats']

  return (
    <div className="flex min-h-screen">
      {/* Barre latérale */}
      <aside className="flex w-64 flex-col bg-ems-dark text-white">
        <div className="px-6 py-5 text-2xl font-extrabold tracking-tight">
          EM<span className="text-ems-sky">S</span>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {navItems.map((item, index) => (
            <div
              key={item}
              className={
                index === 0
                  ? 'rounded-lg bg-white/15 px-3 py-2 text-sm font-medium'
                  : 'cursor-default rounded-lg px-3 py-2 text-sm text-white/60'
              }
            >
              {item}
            </div>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="m-3 rounded-lg px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/10"
        >
          Se déconnecter
        </button>
      </aside>

      {/* Contenu */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-end border-b border-slate-200 bg-white px-6">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-800">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-slate-400">{user?.role}</p>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
