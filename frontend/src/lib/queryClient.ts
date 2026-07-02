// ============================================================
//  Instance TanStack Query partagée par toute l'application.
// ============================================================
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // une seule nouvelle tentative en cas d'échec réseau
      refetchOnWindowFocus: false, // pas de rechargement au focus (confort)
    },
  },
})
