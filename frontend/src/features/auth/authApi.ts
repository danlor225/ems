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

export const authApi = {
  login: (email: string, password: string) =>
    api
      .post<LoginResponse>('/auth/login', { email, password })
      .then((r) => r.data),

  me: () => api.get<AuthUser>('/auth/me').then((r) => r.data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
}
