import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthContext.tsx'
import { ThemeProvider } from './features/theme/ThemeProvider.tsx'
import { queryClient } from './lib/queryClient.ts'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* ThemeProvider : applique .dark sur <html> (le plus externe) */}
    <ThemeProvider>
      {/* TanStack Query : cache des appels API */}
      <QueryClientProvider client={queryClient}>
        {/* React Router : navigation */}
        <BrowserRouter>
          {/* AuthProvider : état d'authentification global */}
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
