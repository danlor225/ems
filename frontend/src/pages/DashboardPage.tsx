// ============================================================
//  DashboardPage : page d'accueil connectée.
//  - Staff (TEACHER/ADMIN) : statistiques.
//  - Étudiant : évaluations disponibles.
// ============================================================
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../features/auth/AuthContext'
import { DashboardStats } from '../features/dashboard/DashboardStats'
import { StudentHome } from '../features/student/StudentHome'

export function DashboardPage() {
  const { user } = useAuth()
  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN'

  return (
    <AppLayout>
      <h1 className="mb-6 text-xl font-bold text-slate-800">
        Bonjour {user?.firstName} 👋
      </h1>
      {isStaff ? <DashboardStats /> : <StudentHome />}
    </AppLayout>
  )
}
