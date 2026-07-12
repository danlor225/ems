// ============================================================
//  tokenStore : gestion centralisée de l'ACCESS token.
//  - accessToken : EN MÉMOIRE uniquement (jamais persisté => moins exposé).
//
//  Le REFRESH token n'est plus géré ici : il vit désormais dans un cookie
//  httpOnly posé par le backend. Le JavaScript n'y a donc AUCUN accès
//  (immunité au vol par XSS) et le navigateur l'envoie automatiquement
//  aux routes /api/auth grâce à `withCredentials`.
// ============================================================
let accessToken: string | null = null

export const tokenStore = {
  getAccessToken: () => accessToken,
  setAccessToken: (token: string | null) => {
    accessToken = token
  },
  clear: () => {
    accessToken = null
  },
}
