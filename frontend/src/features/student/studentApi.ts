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
    // Nombre de questions de l'examen (fourni par Prisma `_count`).
    _count: { examQuestions: number }
  }
}

export const getAvailableSessions = () =>
  api.get<AvailableSession[]>('/sessions/available').then((r) => r.data)

export interface MyAttempt {
  attemptId: string
  sessionId?: string
  examTitle: string
  resultsHidden: boolean
  score: number | null
  totalPoints: number
  passed: boolean | null
  status: string
  submittedAt?: string | null
}

export const getMyAttempts = () =>
  api.get<MyAttempt[]>('/attempts/me').then((r) => r.data)
