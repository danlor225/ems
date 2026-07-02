// ============================================================
//  tokenStore : gestion centralisée des jetons.
//  - accessToken : EN MÉMOIRE uniquement (jamais persisté => moins exposé).
//  - refreshToken : localStorage (persiste au rechargement).
//    /!\ localStorage est vulnérable au XSS ; en prod on préférerait
//        un cookie httpOnly. Documenté comme amélioration future.
// ============================================================
const REFRESH_KEY = 'ems_refresh_token'

let accessToken: string | null = null

export const tokenStore = {
  getAccessToken: () => accessToken,
  setAccessToken: (token: string | null) => {
    accessToken = token
  },
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setRefreshToken: (token: string) => localStorage.setItem(REFRESH_KEY, token),
  clear: () => {
    accessToken = null
    localStorage.removeItem(REFRESH_KEY)
  },
}
