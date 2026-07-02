// ============================================================
//  Appel API des statistiques du tableau de bord (staff).
// ============================================================
import { api } from '../../lib/api'

export interface DashboardStats {
  counts: {
    exams: number
    sessions: number
    students: number
    attempts: number
    questions: number
  }
  averageScore: number
  successRate: number
  distribution: {
    excellent: number
    bien: number
    moyen: number
    faible: number
  }
}

export const getDashboardStats = () =>
  api.get<DashboardStats>('/stats/dashboard').then((r) => r.data)
