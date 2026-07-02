// ============================================================
//  Appels API côté étudiant.
// ============================================================
import { api } from '../../lib/api'

export interface AvailableSession {
  id: string
  opensAt: string
  closesAt: string
  status: string
  exam: {
    id: string
    title: string
    durationMinutes: number
    subjectId: string
  }
}

export const getAvailableSessions = () =>
  api.get<AvailableSession[]>('/sessions/available').then((r) => r.data)
