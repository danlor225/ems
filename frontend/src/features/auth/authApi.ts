// ============================================================
//  Appels API liés à l'authentification.
// ============================================================
import { api } from '../../lib/api'
import type { AuthUser } from './types'

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
}

export const authApi = {
  login: (email: string, password: string) =>
    api
      .post<LoginResponse>('/auth/login', { email, password })
      .then((r) => r.data),

  register: (input: RegisterInput) =>
    api.post<AuthUser>('/auth/register', input).then((r) => r.data),

  me: () => api.get<AuthUser>('/auth/me').then((r) => r.data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
}
