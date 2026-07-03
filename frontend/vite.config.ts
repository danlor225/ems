import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Alias "@/..." -> "src/..." (imports absolus, comme dans shadcn/ui)
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Lit le .env situé à la RACINE du monorepo (une seule source de vérité).
  envDir: '..',
  server: { port: 5173 },
})
