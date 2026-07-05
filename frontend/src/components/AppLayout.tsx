// ============================================================
//  AppLayout (AppShell) — ossature premium de l'application.
//  Sidebar à icônes + header (thème, profil). Drawer sur mobile.
//  Navigation adaptée au rôle. Contenu rendu dans <Outlet/>.
// ============================================================
import { AnimatePresence, motion } from 'framer-motion'
import {
  Award,
  BarChart3,
  ClipboardList,
  FileBarChart2,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  type LucideIcon,
  Menu,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthContext'
import { ThemeToggle } from '@/features/theme/ThemeToggle'

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  adminOnly?: boolean
}

const EASE = [0.16, 1, 0.3, 1] as const

const STAFF_NAV: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Évaluations', to: '/evaluations', icon: ClipboardList },
  { label: 'Résultats', to: '/admin/resultats', icon: BarChart3 },
  { label: 'Banque de Questions', to: '/admin/questions', icon: ListChecks },
  { label: 'Utilisateurs', to: '/admin/utilisateurs', icon: Users, adminOnly: true },
  { label: 'Groupes', to: '/admin/groupes', icon: UsersRound },
  { label: 'Certificats', to: '/admin/certificats', icon: Award },
  { label: 'Rapports', to: '/admin/rapports', icon: FileBarChart2 },
  { label: 'Paramètres', to: '/parametres', icon: Settings },
]
const STUDENT_NAV: NavItem[] = [
  { label: 'Accueil', to: '/', icon: Home },
  { label: 'Mes résultats', to: '/', icon: Award },
  { label: 'Paramètres', to: '/parametres', icon: Settings },
]

function SidebarContent({
  items,
  onNavigate,
  onLogout,
}: {
  items: NavItem[]
  onNavigate?: () => void
  onLogout: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-white">
      <div className="px-6 py-5 text-2xl font-extrabold tracking-tight text-white">
        EM<span className="text-sky">S</span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-active text-white shadow-[inset_3px_0_0_0_var(--color-sky),0_4px_12px_rgba(0,0,0,0.25)]'
                  : 'text-white/70 hover:translate-x-1 hover:bg-white/10 hover:text-white',
              )
            }
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-all duration-200 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  )
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN'
  const items = (isStaff ? STAFF_NAV : STUDENT_NAV).filter(
    (i) => !i.adminOnly || user?.role === 'ADMIN',
  )
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase()

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 w-64">
          <SidebarContent items={items} onLogout={() => void logout()} />
        </div>
      </aside>

      {/* Drawer mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <SidebarContent
                items={items}
                onNavigate={() => setMobileOpen(false)}
                onLogout={() => void logout()}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Colonne principale */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <div className="flex-1" />

          <ThemeToggle />

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{user?.role}</p>
            </div>
            <div className="grid size-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
