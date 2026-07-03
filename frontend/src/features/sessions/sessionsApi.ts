// ============================================================
//  Appels API des sessions.
// ============================================================
import { api } from '../../lib/api'
import type { Paginated } from '../../lib/types'

export interface Session {
  id: string
  examId: string
  opensAt: string
  closesAt: string
  status: 'SCHEDULED' | 'OPEN' | 'CLOSED'
  exam: { id: string; title: string }
}

export interface CreateSessionBody {
  examId: string
  opensAt: string // ISO (UTC)
  closesAt: string // ISO (UTC)
}

export const getSessions = (page = 1, limit = 50) =>
  api
    .get<Paginated<Session>>(`/sessions?page=${page}&limit=${limit}`)
    .then((r) => r.data)

export const createSession = (body: CreateSessionBody) =>
  api.post<Session>('/sessions', body).then((r) => r.data)

export const closeSession = (id: string) => api.post(`/sessions/${id}/close`)
export const deleteSession = (id: string) => api.delete(`/sessions/${id}`)
