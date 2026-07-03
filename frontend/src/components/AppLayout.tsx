// ============================================================
//  AppLayout : ossature de l'application (barre latérale + en-tête).
//  Route de mise en page : le contenu s'affiche dans <Outlet/>.
//  La navigation s'adapte au rôle et utilise NavLink (lien actif).
// ============================================================
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

interface NavItem {
  label: string
  to: string
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN'

  const navItems: NavItem[] = isStaff
    ? [
        { label: 'Tableau de bord', to: '/' },
        { label: 'Matières', to: '/admin/matieres' },
        { label: 'Questions', to: '/admin/questions' },
        { label: 'Examens', to: '/admin/examens' },
        { label: 'Sessions', to: '/admin/sessions' },
        { label: 'Résultats', to: '/admin/resultats' },
      ]
    : [{ label: 'Accueil', to: '/' }]

  return (
    <div className="flex min-h-screen">
      {/* Barre latérale */}
      <aside className="flex w-64 flex-col bg-ems-dark text-white">
        <div className="px-6 py-5 text-2xl font-extrabold tracking-tight">
          EM<span className="text-ems-sky">S</span>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-white/15 font-medium text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
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
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
