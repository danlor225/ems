import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Lit le .env situé à la RACINE du monorepo (une seule source de vérité).
  // Vite n'expose au navigateur QUE les variables préfixées VITE_.
  envDir: '..',
  server: { port: 5173 },
})
