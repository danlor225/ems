// ============================================================
//  Schéma de validation du formulaire de connexion (Zod).
//  Une seule source de vérité : validation + type TypeScript.
// ============================================================
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Adresse email invalide.'),
  password: z.string().min(1, 'Le mot de passe est requis.'),
})

export type LoginFormValues = z.infer<typeof loginSchema>
