// ============================================================
//  Cookie du refresh token.
//
//  Pourquoi un cookie httpOnly plutôt que localStorage :
//   - httpOnly => INACCESSIBLE au JavaScript => immunisé au vol par XSS
//     (le refresh token est la clé de session longue durée : le plus sensible).
//   - Secure   => transmis uniquement en HTTPS (pas en clair).
//   - SameSite => n'est pas envoyé par un site tiers => anti-CSRF.
//   - path     => n'est envoyé qu'aux routes /api/auth (surface minimale).
//
//  L'access token, lui, reste renvoyé dans le corps JSON et gardé EN MÉMOIRE
//  côté front (courte durée, moins critique).
// ============================================================
import type { CookieOptions } from 'express';
import type { ConfigService } from '@nestjs/config';

export const REFRESH_COOKIE_NAME = 'ems_refresh_token';

// Le cookie est cantonné aux routes d'authentification (login/refresh/logout).
// setGlobalPrefix('api') => les routes réelles sont sous /api/auth/...
const REFRESH_COOKIE_PATH = '/api/auth';

/**
 * Convertit une durée façon JWT ("7d", "15m", "24h", "3600s", ou un nombre de
 * secondes) en millisecondes, pour aligner la durée de vie du cookie sur celle
 * du refresh token.
 */
export function parseDurationToMs(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) {
    // Valeur inattendue : repli prudent sur 7 jours.
    return 7 * 24 * 60 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = match[2] ?? 's'; // sans unité => secondes (convention JWT numérique)
  const unitToMs: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * unitToMs[unit];
}

/** Options du cookie de refresh, cohérentes login / refresh / logout. */
export function refreshCookieOptions(config: ConfigService): CookieOptions {
  const isProd = config.get<string>('NODE_ENV') === 'production';
  return {
    httpOnly: true,
    // En prod (HTTPS derrière le reverse proxy) : Secure obligatoire.
    // En dev (http://localhost) : Secure=false sinon le navigateur rejette le cookie.
    secure: isProd,
    // 'strict' convient au déploiement recommandé (front + API sur la MÊME origine
    // via le reverse proxy). En hébergement cross-site, il faudrait 'none' + secure.
    sameSite: isProd ? 'strict' : 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: parseDurationToMs(
      config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    ),
  };
}

/** Options minimales pour EFFACER le cookie (doivent matcher le path). */
export function clearRefreshCookieOptions(): CookieOptions {
  return { path: REFRESH_COOKIE_PATH };
}
