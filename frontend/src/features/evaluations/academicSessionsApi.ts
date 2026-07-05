// ============================================================
//  Appels API des sessions académiques.
// ============================================================
import { api } from '../../lib/api'
import type { Paginated } from '../../lib/types'

export interface AcademicSession {
  id: string
  name: string
  academicYear: string
  startDate: string
  endDate: string
  description: string | null
}

export const getAcademicSessions = () =>
  api
    .get<Paginated<AcademicSession>>('/academic-sessions?limit=100')
    .then((r) => r.data)

export const createAcademicSession = (body: {
  name: string
  academicYear: string
  startDate: string
  endDate: string
  description?: string
}) => api.post<AcademicSession>('/academic-sessions', body).then((r) => r.data)
