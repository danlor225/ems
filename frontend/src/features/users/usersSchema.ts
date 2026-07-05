// ============================================================
//  Schémas de validation (Zod) du module Utilisateurs.
//  Miroir des règles des DTO backend.
// ============================================================
import { z } from 'zod'

const roleEnum = z.enum(['STUDENT', 'TEACHER', 'ADMIN'])

// Création : email + mot de passe requis.
export const createUserSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis.').max(50),
  lastName: z.string().trim().min(1, 'Nom requis.').max(50),
  email: z.string().trim().toLowerCase().email('Email invalide.'),
  password: z
    .string()
    .min(8, 'Au moins 8 caractères.')
    .max(72, 'Au plus 72 caractères.'),
  role: roleEnum,
})
export type CreateUserValues = z.infer<typeof createUserSchema>

// Édition : pas de mot de passe (géré séparément), email non modifiable.
export const editUserSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis.').max(50),
  lastName: z.string().trim().min(1, 'Nom requis.').max(50),
  role: roleEnum,
  matricule: z.string().trim().max(50).optional(),
  // '' = aucun groupe (le formulaire envoie un <select>).
  groupId: z.string().optional(),
})
export type EditUserValues = z.infer<typeof editUserSchema>

export const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Au moins 8 caractères.')
    .max(72, 'Au plus 72 caractères.'),
})
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
