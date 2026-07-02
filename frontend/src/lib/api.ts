// ============================================================
//  Client HTTP Axios partagé + intercepteurs :
//   - requête  : injecte "Authorization: Bearer <accessToken>"
//   - réponse  : sur 401, rafraîchit l'access token puis rejoue
//                la requête (refresh transparent).
// ============================================================
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { tokenStore } from './tokenStore'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export const api = axios.create({ baseURL, withCredentials: true })

// --- Intercepteur de requête : ajoute le jeton s'il existe ---
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On mutualise les refresh concurrents (une seule requête /refresh à la fois).
let refreshing: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStore.getRefreshToken()
  if (!refreshToken) throw new Error('Aucun refresh token')
  // Appel "nu" (axios direct, sans intercepteur) pour éviter la récursion.
  const { data } = await axios.post<{
    accessToken: string
    refreshToken: string
  }>(`${baseURL}/auth/refresh`, { refreshToken })
  tokenStore.setAccessToken(data.accessToken)
  tokenStore.setRefreshToken(data.refreshToken)
  return data.accessToken
}

// --- Intercepteur de réponse : refresh transparent sur 401 ---
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true
      try {
        refreshing = refreshing ?? refreshAccessToken()
        const newToken = await refreshing
        refreshing = null
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshError) {
        refreshing = null
        tokenStore.clear() // refresh impossible => session terminée
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  },
)
