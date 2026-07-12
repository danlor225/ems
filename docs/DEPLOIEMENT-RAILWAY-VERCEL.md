# Déploiement EMS — Backend + PostgreSQL sur Railway, Frontend sur Vercel

> Guide pas-à-pas exhaustif. Architecture cible :
> - **Railway** : PostgreSQL (managé) + API NestJS (via le Dockerfile existant).
> - **Vercel** : SPA React/Vite (fichiers statiques + CDN).
>
> ⚠ Front et API sont sur **deux domaines différents** (`*.vercel.app` vs
> `*.up.railway.app`) ⇒ **contexte cross-site**. Lire la Phase 0 AVANT tout.

---

## Phase 0 — Comprendre l'impact « cross-site » (à lire en premier)

Le refresh token vit dans un **cookie httpOnly** (correctif §2.6). Un cookie n'est
envoyé sur une requête vers un autre site que s'il est `SameSite=None; Secure`. Or :

- `app.vercel.app` (front) et `api.up.railway.app` (API) = **sites différents** ⇒
  le cookie doit être **`SameSite=None; Secure`**, sinon `/auth/refresh`, le bootstrap
  de session et la reconnexion silencieuse **ne fonctionneront pas**.
- Pire : un cookie `SameSite=None` posé par l'API est un **cookie tiers** vis-à-vis du
  front. **Safari (ITP) le bloque déjà**, et Chrome restreint progressivement les
  cookies tiers ⇒ la session peut casser selon le navigateur.

**Deux options :**

| Option | SameSite | Fiabilité | Recommandation |
| ------ | -------- | --------- | -------------- |
| **A. Domaine personnalisé** : `app.mondomaine.fr` (Vercel) + `api.mondomaine.fr` (Railway) | `Lax` | ✅ Cookies **first-party** (même domaine racine = *same-site*) | **Recommandé** |
| **B. Domaines par défaut** `*.vercel.app` + `*.up.railway.app` | `None; Secure` | ⚠ Cookies tiers, bloqués sur Safari, fragiles sur Chrome | Dépannage / démo seulement |

> **Sous-domaines d'un même domaine racine = *same-site*.** Donc `app.mondomaine.fr`
> et `api.mondomaine.fr` partagent des cookies en `SameSite=Lax` sans être « tiers ».
> C'est de loin la configuration la plus robuste. Prévois un nom de domaine.

> **Option retenue pour ce déploiement : A (domaine personnalisé)** ⇒ `COOKIE_SAMESITE=lax`.

### Changement de code requis — ✅ IMPLÉMENTÉ

Le cookie était figé sur `SameSite=strict` en prod (`auth.cookie.ts`), ce qui **casse
le cross-site**. Il est désormais **paramétrable** via la variable `COOKIE_SAMESITE` :

```ts
// backend/src/modules/auth/auth.cookie.ts  (dans refreshCookieOptions)
const isProd = config.get<string>('NODE_ENV') === 'production';
const sameSite = (config.get<string>('COOKIE_SAMESITE') ??
  (isProd ? 'strict' : 'lax')) as 'strict' | 'lax' | 'none';
return {
  httpOnly: true,
  secure: isProd || sameSite === 'none', // 'none' EXIGE Secure
  sameSite,
  path: '/api/auth',
  maxAge: parseDurationToMs(config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d'),
};
```

- Option A (domaine perso) ⇒ `COOKIE_SAMESITE=lax`.
- Option B (domaines par défaut) ⇒ `COOKIE_SAMESITE=none`.

### 2ᵉ changement de code requis — écouter le port de Railway — ✅ IMPLÉMENTÉ

Railway injecte la variable **`PORT`** et attend que l'app écoute dessus. Le code lisait
`BACKEND_PORT` ; `main.ts` privilégie désormais `PORT` :

```ts
// backend/src/main.ts  (fin de bootstrap)
const port = process.env.PORT
  ? Number(process.env.PORT)
  : (config.get<number>('BACKEND_PORT') ?? 3000);
await app.listen(port, '0.0.0.0'); // 0.0.0.0 : joignable dans le conteneur Railway
```

> Sans ce changement, le healthcheck Railway échoue (l'app écoute sur 3000 alors que
> Railway route vers `$PORT`).

---

## Phase 1 — Préparer le dépôt — ✅ FAIT

Les corrections nécessaires sont **déjà commitées et poussées** sur GitHub
(branche `feat/backend-foundation`, commit `671e302`) :

- `main.ts` → écoute `process.env.PORT` (Railway) sur `0.0.0.0`.
- `auth.cookie.ts` → `SameSite` du cookie paramétrable via `COOKIE_SAMESITE`.
- `env.validation.ts` + `.env.example` → variable `COOKIE_SAMESITE`.
- `frontend/vercel.json` → rewrite SPA (fallback `index.html`).

Builds vérifiés en local (`backend: nest build`, `frontend: tsc -b && vite build`) : OK.

> **Avant de brancher les plateformes**, s'assurer que la branche à déployer est bien
> à jour sur GitHub — Railway et Vercel se connectent au dépôt et déploient au push.
> Si tu déploies depuis `main`, pense à y merger `feat/backend-foundation` d'abord.

---

## Phase 2 — PostgreSQL sur Railway

1. Créer un compte sur https://railway.app (login GitHub) et **New Project**.
2. Dans le projet : **+ New → Database → Add PostgreSQL**. Railway provisionne une
   instance et expose des variables : `DATABASE_URL` (réseau privé),
   `DATABASE_PUBLIC_URL` (proxy public), `PGHOST`, `PGUSER`, etc.
3. Ne rien exposer publiquement d'autre : on utilisera l'URL **privée** entre services
   du même projet (pas de SSL requis, pas d'exposition Internet de la base).

---

## Phase 3 — Backend (API NestJS) sur Railway

1. Dans le **même projet Railway** : **+ New → GitHub Repo** → sélectionner le dépôt EMS.
2. **Settings du service backend** :
   - **Root Directory** : `backend` (⇒ Railway utilise `backend/Dockerfile` et son
     contexte de build ; les migrations et le schéma Prisma y sont).
   - **Builder** : Dockerfile (auto-détecté grâce au `backend/Dockerfile`).
   - Laisser le **Start Command** vide pour l'instant (le `CMD` du Dockerfile applique
     déjà `prisma migrate deploy` puis `node dist/main`).
3. **Variables** du service backend (onglet *Variables*) :

   | Variable | Valeur |
   | -------- | ------ |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (référence l'URL **privée** du service Postgres) |
   | `NODE_ENV` | `production` |
   | `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
   | `JWT_ACCESS_EXPIRES_IN` | `15m` |
   | `JWT_REFRESH_SECRET` | `openssl rand -hex 32` (différent) |
   | `JWT_REFRESH_EXPIRES_IN` | `7d` |
   | `CORS_ORIGIN` | *(rempli en Phase 5, une fois l'URL Vercel connue)* |
   | `COOKIE_SAMESITE` | `lax` (option A) **ou** `none` (option B) |
   | `ADMIN_EMAIL` | email du premier admin |
   | `ADMIN_PASSWORD` | mot de passe fort |

   > `BACKEND_PORT`/`FRONTEND_PORT` : inutiles (défauts Zod OK). Railway fournit `PORT`,
   > désormais lu par `main.ts`.
4. **Déployer** : Railway build l'image et démarre. Le `CMD` applique automatiquement
   les **8 migrations** (`prisma migrate deploy`) sur la base fraîche.
   - Vérifier les logs : les migrations « applied » + `EMS API démarrée`.
5. **Exposer l'API** : *Settings → Networking → Generate Domain*. On obtient
   `https://<backend>.up.railway.app`. Noter cette URL (⇒ base de `VITE_API_URL`).

---

## Phase 4 — Frontend (SPA) sur Vercel

1. **Ajouter le fallback SPA** pour que le rafraîchissement d'une route profonde
   (ex : `/reports`) ne renvoie pas un 404. Créer `frontend/vercel.json` :
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
   Commit + push.
2. Créer un compte https://vercel.com (login GitHub) → **Add New… → Project** →
   importer le dépôt EMS.
3. **Configuration du projet Vercel** :
   - **Root Directory** : `frontend`.
   - **Framework Preset** : *Vite* (auto-détecté).
   - **Build Command** : `npm run build` (défaut) — *Output Directory* : `dist`.
4. **Environment Variables** (onglet *Environment Variables*) :

   | Variable | Valeur | Environnements |
   | -------- | ------ | -------------- |
   | `VITE_API_URL` | `https://<backend>.up.railway.app/api` | Production (+ Preview si besoin) |

   > Rappel : `VITE_*` est **gravée dans le bundle au build**. Toute modif de cette URL
   > impose un **redeploy** du front.
5. **Deploy** → Vercel build et publie sur `https://<projet>.vercel.app`. Noter l'URL.

---

## Phase 5 — Recoller les deux mondes (CORS + URLs)

1. **Backend Railway** : renseigner `CORS_ORIGIN` = l'URL de production Vercel
   (`https://<projet>.vercel.app`, ou `https://app.mondomaine.fr` en option A).
   Plusieurs origines possibles, séparées par des virgules. Railway **redéploie**.
2. **Frontend Vercel** : vérifier que `VITE_API_URL` pointe bien sur le domaine Railway
   (ou `https://api.mondomaine.fr/api` en option A). Redeploy si modifié.
3. **Option A (domaine perso)** — configurer les domaines :
   - Vercel : *Settings → Domains* → ajouter `app.mondomaine.fr` (CNAME fourni par Vercel).
   - Railway : *Settings → Networking → Custom Domain* → `api.mondomaine.fr` (CNAME fourni).
   - Mettre à jour `CORS_ORIGIN=https://app.mondomaine.fr` et
     `VITE_API_URL=https://api.mondomaine.fr/api`, puis redeploy des deux côtés.

---

## Phase 6 — Créer le premier administrateur (seed)

La base est vierge : aucun admin n'existe (cf. §2.3). Sur Railway, exécuter le seed
**une fois**, à l'intérieur du réseau (accès à la base privée + variables `ADMIN_*`).

**Méthode recommandée — Start Command temporaire :**
1. Backend Railway → *Settings → Deploy → Custom Start Command* :
   ```
   sh -c "npx prisma migrate deploy && npx ts-node prisma/seed.ts && node dist/main"
   ```
   (l'image `runner` contient `ts-node` et le dossier `prisma/`, hérités du builder.)
2. Redéployer. Les logs affichent `✅ Admin prêt : <email>`.
3. **Remettre le Start Command à vide** (retour au `CMD` du Dockerfile) pour ne pas
   relancer `ts-node` à chaque boot. Le seed étant **idempotent** (`upsert`), aucun
   risque si on l'oublie, juste un léger surcoût au démarrage.

**Alternative sans ts-node — SQL direct :** générer un hash bcrypt hors-ligne
(`node -e "console.log(require('bcrypt').hashSync('MonMdp',12))"`) puis, dans l'onglet
*Data/Query* du service Postgres Railway :
```sql
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
VALUES (gen_random_uuid(), 'admin@mondomaine.fr', '<hash_bcrypt>', 'Admin', 'EMS', 'ADMIN', true);
```

---

## Phase 7 — Vérifications post-déploiement (smoke tests)

1. **API vivante** : `curl -I https://<backend>.up.railway.app/api` → 200.
2. **Front** : ouvrir l'URL Vercel → la page charge ; rafraîchir sur `/reports` → pas de 404
   (valide `vercel.json`).
3. **CORS** : se connecter depuis le front → aucune erreur « blocked by CORS » en console.
4. **Cookie** : après login, DevTools → Application → Cookies → `ems_refresh_token`
   présent, `HttpOnly` ✔, `Secure` ✔, `SameSite` = `Lax`/`None` selon l'option.
5. **Refresh** : recharger la page une fois connecté → la session est **restaurée**
   (bootstrap via cookie). Si elle ne l'est pas ⇒ problème cross-site (revoir Phase 0).
6. **Login admin** : se connecter avec le compte seedé → accès aux écrans staff.
7. **RBAC / rate-limit** : STUDENT sur une route admin → 403 ; 6 logins ratés → 429.
8. **Parcours métier** : créer une évaluation, la passer, voir le résultat.

---

## Phase 8 — Pièges spécifiques & exploitation

- **Preview deployments Vercel** : chaque preview a une URL unique
  (`ems-git-xxx.vercel.app`) qui **n'est pas** dans `CORS_ORIGIN` ⇒ l'auth échoue sur
  les previews. Solutions : tester l'auth uniquement en production, ou ajouter les URLs
  de preview à `CORS_ORIGIN`, ou (option A) utiliser un domaine stable.
- **Migrations** : toute nouvelle migration commitée est appliquée automatiquement au
  prochain déploiement Railway (`migrate deploy` du `CMD`). Ne jamais `migrate dev` en prod.
- **Sauvegardes** : activer les backups Postgres de Railway (plan payant) ou planifier
  un `pg_dump` régulier via `DATABASE_PUBLIC_URL`. Tester la restauration.
- **Secrets** : gérés dans les *Variables* Railway / Vercel — jamais dans le dépôt.
  Régénérer les secrets JWT s'ils ont fuité.
- **Coûts** : Railway facture à l'usage (la base tourne en continu). Surveiller le quota
  du plan gratuit/Hobby.
- **Logs** : Railway (onglet *Deployments/Logs*) et Vercel (onglet *Logs*) pour le debug.
- **Redéploiement** : un `git push` sur la branche suivie redéploie automatiquement
  backend (Railway) et front (Vercel).

---

## Récapitulatif de l'ordre à suivre

1. Phase 0 → ✅ 2 changements de code (`COOKIE_SAMESITE`, `PORT`) faits · **option A retenue** (`COOKIE_SAMESITE=lax`).
2. Phase 1 → ✅ commité + poussé (`671e302`). Prochaine action réelle : Phase 2.
3. Phase 2 → PostgreSQL sur Railway.
4. Phase 3 → backend sur Railway (root `backend`, variables, domaine généré).
5. Phase 4 → `vercel.json` + frontend sur Vercel (root `frontend`, `VITE_API_URL`).
6. Phase 5 → `CORS_ORIGIN` = URL Vercel ; (option A) domaines perso.
7. Phase 6 → seed admin.
8. Phase 7 → smoke tests.
9. Phase 8 → previews, backups, exploitation.
