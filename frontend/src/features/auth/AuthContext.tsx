// ============================================================
//  AuthContext : état d'authentification global.
//  - user : l'utilisateur connecté (ou null)
//  - isBootstrapping : true tant qu'on vérifie la session au démarrage
//  - login / logout
// ============================================================
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { tokenStore } from '../../lib/tokenStore'
import { authApi, type RegisterInput } from './authApi'
import type { AuthUser } from './types'

interface AuthContextValue {
  user: AuthUser | null
  isBootstrapping: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  register: (input: RegisterInput) => Promise<AuthUser>
  updateProfile: (input: {
    firstName?: string
    lastName?: string
  }) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  // Au démarrage : on tente de récupérer l'utilisateur. L'access token vit en
  // mémoire (perdu au rechargement) ; l'appel /auth/me part donc sans jeton et
  // reçoit un 401 => l'intercepteur Axios tente un refresh silencieux via le
  // cookie httpOnly. S'il existe et reste valide, la session est restaurée ;
  // sinon l'utilisateur n'est simplement pas connecté.
  useEffect(() => {
    let active = true
    async function bootstrap() {
      try {
        const me = await authApi.me()
        if (active) setUser(me)
      } catch {
        tokenStore.clear()
      } finally {
        if (active) setIsBootstrapping(false)
      }
    }
    void bootstrap()
    return () => {
      active = false
    }
  }, [])

  async function login(email: string, password: string) {
    const res = await authApi.login(email, password)
    // Access token en mémoire ; le refresh token est posé en cookie httpOnly
    // par le backend (invisible au JS).
    tokenStore.setAccessToken(res.accessToken)
    setUser(res.user)
    return res.user
  }

  // Inscription puis connexion automatique.
  async function register(input: RegisterInput) {
    await authApi.register(input)
    return login(input.email, input.password)
  }

  // Met à jour le profil et rafraîchit l'utilisateur en mémoire.
  async function updateProfile(input: {
    firstName?: string
    lastName?: string
  }) {
    const updated = await authApi.updateProfile(input)
    setUser(updated)
    return updated
  }

  async function logout() {
    // Le cookie httpOnly est envoyé automatiquement ; le backend le révoque
    // et l'efface. Best-effort : on nettoie même si l'appel échoue.
    await authApi.logout().catch(() => {})
    tokenStore.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isBootstrapping,
        login,
        register,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.')
  return ctx
}
