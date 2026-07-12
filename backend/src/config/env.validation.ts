// ============================================================
//  Validation des variables d'environnement au démarrage.
//  Principe "fail fast" : si la config est incomplète/invalide,
//  l'application refuse de démarrer AU BOOT plutôt que de planter
//  plus tard, en pleine utilisation.
// ============================================================
import { z } from 'zod';

// Le schéma décrit CE QUE l'application exige de son environnement.
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Port du backend. z.coerce transforme la chaîne "3000" (.env) en nombre.
  BACKEND_PORT: z.coerce.number().int().positive().default(3000),

  // URL de connexion à PostgreSQL (utilisée par Prisma).
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
      message: 'DATABASE_URL doit commencer par postgresql://',
    }),

  // Secrets JWT : on impose une longueur minimale (un secret court est cassable).
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Utilisé pour autoriser le front dans la configuration CORS (fallback DEV).
  FRONTEND_PORT: z.coerce.number().int().positive().default(5173),

  // Origine(s) autorisée(s) par CORS en PRODUCTION.
  // Liste séparée par des virgules, ex: "https://ems.mondomaine.fr,https://www.ems.mondomaine.fr".
  // Optionnel : si absent, on retombe sur http://localhost:FRONTEND_PORT (pratique en DEV).
  CORS_ORIGIN: z.string().min(1).optional(),
});

// Le type est INFÉRÉ du schéma : une seule source de vérité (DRY).
export type Env = z.infer<typeof envSchema>;

/**
 * Fonction branchée sur ConfigModule.forRoot({ validate }).
 * NestJS l'appelle au démarrage avec toutes les variables d'environnement.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    // On construit un message lisible listant chaque variable fautive.
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables d'environnement invalides :\n${details}`);
  }

  return result.data;
}
