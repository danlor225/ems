// ============================================================
//  Libellés & styles partagés du module Utilisateurs.
// ============================================================
import type { Role } from '../auth/types'

export const ROLE_LABEL: Record<Role, string> = {
  STUDENT: 'Étudiant',
  TEACHER: 'Enseignant',
  ADMIN: 'Administrateur',
}

// Pastille de rôle (couleurs de la palette officielle EMS).
export const ROLE_BADGE: Record<Role, string> = {
  STUDENT: 'bg-sky/15 text-sky',
  TEACHER: 'bg-info/15 text-info',
  ADMIN: 'bg-primary/15 text-primary',
}
