// ============================================================
//  AuthLayout — coquille commune aux écrans d'authentification.
//  Panneau de marque (desktop) + colonne formulaire animée.
//  Réutilisé par login / register / mot de passe oublié / reset.
// ============================================================
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* ---------- Panneau de marque (desktop) ---------- */}
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-white/5 blur-3xl"
        />

        <div className="relative text-3xl font-extrabold tracking-tight text-primary-foreground">
          EM<span className="text-white/70">S</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative"
        >
          <h1 className="text-4xl font-bold leading-tight text-primary-foreground">
            Évaluez. Analysez.
            <br />
            Progressez.
          </h1>
          <p className="mt-4 max-w-sm text-primary-foreground/70">
            La plateforme d'évaluation intelligente pour les établissements,
            universités et centres de formation.
          </p>
        </motion.div>

        <p className="relative text-sm text-primary-foreground/50">
          © {new Date().getFullYear()} EMS — Evaluation Management System
        </p>
      </div>

      {/* ---------- Colonne formulaire ---------- */}
      <div className="flex min-h-screen items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="w-full max-w-sm"
        >
          {/* Logo compact (mobile) */}
          <div className="mb-8 text-2xl font-extrabold tracking-tight text-primary lg:hidden">
            EM<span className="text-accent-foreground">S</span>
          </div>
          {children}
        </motion.div>
      </div>
    </div>
  )
}
