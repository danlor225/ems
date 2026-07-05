// ============================================================
//  Appels API du module Groupes / Classes.
//  Lecture : staff (TEACHER+ADMIN). Écritures : ADMIN.
// ============================================================
import { api } from '../../lib/api'
import type { Paginated } from '../../lib/types'

export interface GroupRow {
  id: string
  name: string
  level: string | null
  academicYear: string | null
  description: string | null
  studentsCount: number
  evaluationsCount: number
  createdAt: string
  updatedAt: string
}

export interface GroupMember {
  id: string
  firstName: string
  lastName: string
  email: string
  matricule: string | null
  isActive: boolean
}

export interface GroupDetail {
  id: string
  name: string
  level: string | null
  academicYear: string | null
  description: string | null
  createdAt: string
  updatedAt: string
  students: GroupMember[]
  evaluationsCount: number
}

export interface GroupQuery {
  page?: number
  limit?: number
  search?: string
}

export const getGroups = (params: GroupQuery = {}) => {
  const q = new URLSearchParams()
  q.set('page', String(params.page ?? 1))
  q.set('limit', String(params.limit ?? 50))
  if (params.search) q.set('search', params.search)
  return api.get<Paginated<GroupRow>>(`/groups?${q.toString()}`).then((r) => r.data)
}

export const getGroup = (id: string) =>
  api.get<GroupDetail>(`/groups/${id}`).then((r) => r.data)

export interface GroupBody {
  name: string
  level?: string
  academicYear?: string
  description?: string
}

export const createGroup = (body: GroupBody) =>
  api.post<GroupRow>('/groups', body).then((r) => r.data)

export const updateGroup = (id: string, body: Partial<GroupBody>) =>
  api.patch<GroupRow>(`/groups/${id}`, body).then((r) => r.data)

export const deleteGroup = (id: string) => api.delete(`/groups/${id}`)

export const addGroupMember = (groupId: string, userId: string) =>
  api.post<GroupDetail>(`/groups/${groupId}/members`, { userId }).then((r) => r.data)

export const removeGroupMember = (groupId: string, userId: string) =>
  api.delete<GroupDetail>(`/groups/${groupId}/members/${userId}`).then((r) => r.data)
