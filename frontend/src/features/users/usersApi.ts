// ============================================================
//  Appels API du module Utilisateurs (ADMIN).
//  Miroir de /api/users côté backend.
// ============================================================
import { api } from '../../lib/api'
import type { Role } from '../auth/types'
import type { Paginated } from '../../lib/types'

// Un utilisateur tel que renvoyé par l'API (jamais de passwordHash).
export interface UserRow {
  id: string
  email: string
  firstName: string
  lastName: string
  role: Role
  isActive: boolean
  isLocked: boolean
  avatarUrl: string | null
  lastLoginAt: string | null
  matricule: string | null
  groupId: string | null
  group: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface LoginHistoryRow {
  id: string
  ip: string | null
  userAgent: string | null
  createdAt: string
}

// Le détail ajoute l'historique des 10 dernières connexions.
export interface UserDetail extends UserRow {
  loginHistory: LoginHistoryRow[]
}

export type UserStatus = 'active' | 'inactive' | 'locked'

export interface UserQuery {
  page?: number
  limit?: number
  role?: Role
  status?: UserStatus
  search?: string
}

export const getUsers = (params: UserQuery = {}) => {
  const q = new URLSearchParams()
  q.set('page', String(params.page ?? 1))
  q.set('limit', String(params.limit ?? 50))
  if (params.role) q.set('role', params.role)
  if (params.status) q.set('status', params.status)
  if (params.search) q.set('search', params.search)
  return api.get<Paginated<UserRow>>(`/users?${q.toString()}`).then((r) => r.data)
}

export const getUser = (id: string) =>
  api.get<UserDetail>(`/users/${id}`).then((r) => r.data)

export interface CreateUserBody {
  email: string
  password: string
  firstName: string
  lastName: string
  role: Role
}

export const createUser = (body: CreateUserBody) =>
  api.post<UserRow>('/users', body).then((r) => r.data)

export interface UpdateUserBody {
  firstName?: string
  lastName?: string
  role?: Role
  isActive?: boolean
  matricule?: string | null
  groupId?: string | null
}

export const updateUser = (id: string, body: UpdateUserBody) =>
  api.patch<UserRow>(`/users/${id}`, body).then((r) => r.data)

export const resetUserPassword = (id: string, newPassword: string) =>
  api.post(`/users/${id}/reset-password`, { newPassword })

export const lockUser = (id: string) => api.post(`/users/${id}/lock`)
export const unlockUser = (id: string) => api.post(`/users/${id}/unlock`)
export const activateUser = (id: string) => api.post(`/users/${id}/activate`)
export const deactivateUser = (id: string) => api.post(`/users/${id}/deactivate`)
export const deleteUser = (id: string) => api.delete(`/users/${id}`)
