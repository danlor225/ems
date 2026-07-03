// ============================================================
//  DashboardPage : contenu de l'accueil (rendu dans AppLayout).
//  - Staff (TEACHER/ADMIN) : statistiques.
//  - Étudiant : évaluations disponibles.
// ============================================================
import { useAuth } from '../features/auth/AuthContext'
import { DashboardStats } from '../features/dashboard/DashboardStats'
import { StudentHome } from '../features/student/StudentHome'

export function DashboardPage() {
  const { user } = useAuth()
  const isStaff = user?.role === 'TEACHER' || user?.role === 'ADMIN'

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-foreground">
        Bonjour {user?.firstName} 👋
      </h1>
      {isStaff ? <DashboardStats /> : <StudentHome />}
    </div>
  )
}
