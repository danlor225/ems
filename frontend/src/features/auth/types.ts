// ============================================================
//  Types partagés de l'authentification (miroir du backend).
// ============================================================
export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN'

export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: Role
  isActive: boolean
  createdAt: string
  updatedAt: string
}
