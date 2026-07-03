// ============================================================
//  Appels API des matières.
// ============================================================
import { api } from '../../lib/api'
import type { Paginated } from '../../lib/types'

export interface Subject {
  id: string
  name: string
  description: string | null
  createdAt: string
}

export const getSubjects = (page = 1, limit = 50) =>
  api
    .get<Paginated<Subject>>(`/subjects?page=${page}&limit=${limit}`)
    .then((r) => r.data)

export const createSubject = (body: { name: string; description?: string }) =>
  api.post<Subject>('/subjects', body).then((r) => r.data)

export const deleteSubject = (id: string) => api.delete(`/subjects/${id}`)
