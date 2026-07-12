# Rapport de déploiement en production — EMS

> Document de référence pour la mise en production de la plateforme EMS
> (Évaluation Management Système). Rédigé à partir de l'état réel du dépôt
> (branche `feat/backend-foundation`, juillet 2026). Aucune étape n'est omise :
> chaque décision est argumentée, et tous les cas de figure sont couverts.

---

## 0. Résumé exécutif

EMS est un **monorepo** composé de :

| Brique          | Techno réelle (constatée dans le code)                          | Rôle en prod |
| --------------- | -------------------------------------------------------------- | ------------ |
| `backend/`      | NestJS 11, Prisma 6 (`@prisma/client`), JWT/Passport, bcrypt, helmet, throttler | API REST sous `/api` |
| `frontend/`     | React 19, Vite 8, Tailwind 4, servi par **nginx:alpine** (SPA) | Fichiers statiques |
| Base de données | PostgreSQL 16 (`postgres:16-alpine`)                            | Persistance |
| Orchestration   | `docker-compose.yml` + Dockerfiles multi-stage (déjà écrits)   | Assemblage |

**Bonne nouvelle** : l'ossature de déploiement existe déjà (Dockerfiles multi-stage
optimisés, `migrate deploy` au démarrage, healthcheck Postgres, helmet, validation
d'env « fail-fast », rate-limiting, RBAC). **Le socle est sain.**

**Mais** le `docker-compose.yml` et le code sont aujourd'hui calibrés pour **dev/démo
sur `localhost`**. Sept points doivent impérativement être corrigés avant une vraie
prod (voir §2). Ce rapport les traite un par un, puis déroule le déploiement complet.

---

## 1. Cartographie de l'existant (ce qui est déjà prêt)

Avant de lister les manques, il faut créditer ce qui est correct — pour ne PAS le refaire :

- **Dockerfile backend** (`backend/Dockerfile`) : multi-stage (builder → runner),
  `npm ci`, `prisma generate`, `npm run build`, image runner `node:22-slim` en
  `NODE_ENV=production`, `openssl` présent pour le moteur Prisma, et surtout
  `CMD ["sh","-c","npx prisma migrate deploy && node dist/main"]` → **les migrations
  s'appliquent automatiquement au démarrage**. C'est le bon comportement prod.
- **Dockerfile frontend** (`frontend/Dockerfile`) : build Vite puis service statique
  nginx, avec `nginx.conf` en mode SPA (`try_files … /index.html`). Correct.
- **Sécurité applicative** déjà en place dans `backend/src/main.ts` :
  helmet, CORS `credentials`, préfixe global `/api`, `ValidationPipe`
  (`whitelist` + `forbidNonWhitelisted` + `transform`), `enableShutdownHooks()`.
- **`env.validation.ts`** : validation Zod « fail-fast » (l'app refuse de démarrer si
  une variable manque ou si un secret JWT fait moins de 16 caractères).
- **Rate-limiting** : `ThrottlerModule` global (100 req/min/IP) + limites strictes
  5/min sur `/auth/login` et `/auth/register` (anti-brute-force).
- **RBAC** : `JwtAuthGuard` + `RolesGuard` + `@Roles()`.
- **Prisma** : 8 migrations versionnées dans `backend/prisma/migrations/`, IDs en UUID
  (anti-IDOR), déconnexion propre via `onModuleDestroy`.

---

## 2. Écarts BLOQUANTS à corriger AVANT tout déploiement

> Ces sept points ne sont pas « optionnels » : en l'état, l'application **ne
> fonctionnera pas** derrière un vrai nom de domaine, ou exposera des failles.
> Chacun est argumenté et accompagné du correctif exact.

### 2.1 — CORS figé sur `localhost` (BLOQUANT)

Dans `backend/src/main.ts` :

```ts
app.enableCors({
  origin: `http://localhost:${config.get<number>('FRONTEND_PORT')}`,
  credentials: true,
});
```

**Problème** : en prod le front est servi depuis `https://ems.mondomaine.fr`, pas
depuis `http://localhost:5173`. Toute requête du navigateur sera **bloquée par CORS**.

**Correctif** : introduire une variable `CORS_ORIGIN` (ou `FRONTEND_URL`) et l'utiliser.

```ts
// main.ts
app.enableCors({
  origin: config.get<string>('CORS_ORIGIN')?.split(',') ?? true,
  credentials: true,
});
```

Et l'ajouter au schéma Zod (`env.validation.ts`) :

```ts
CORS_ORIGIN: z.string().url().or(z.string().min(1)), // ex: https://ems.mondomaine.fr
```

### 2.2 — `VITE_API_URL` gravée sur `localhost:3000` (BLOQUANT)

Le bundle React embarque l'URL de l'API **au moment du build** (`frontend/src/lib/api.ts`
lit `import.meta.env.VITE_API_URL`). Dans `docker-compose.yml` :

```yaml
args:
  VITE_API_URL: http://localhost:${BACKEND_PORT}/api
```

**Problème** : le navigateur d'un utilisateur distant ne peut pas joindre *ton*
`localhost`. Il faut l'URL publique de l'API, **en HTTPS** :
`https://ems.mondomaine.fr/api` (ou `https://api.mondomaine.fr/api`).

**Correctif** : passer `VITE_API_URL` en variable d'environnement de build (voir la
config prod §5), jamais en dur.

### 2.3 — Aucun compte ADMIN ne peut être créé (BLOQUANT fonctionnel)

`auth.service.ts` → `register()` crée **toujours** un `STUDENT` (rôle par défaut du
schéma). La création d'utilisateurs avec rôle passe par `/api/users` qui exige déjà
d'être **ADMIN**. → **Problème de l'œuf et de la poule** : sur une base vierge, aucun
admin n'existe et aucun ne peut être créé par l'API.

**Correctif** : ajouter un **script de seed** idempotent qui crée le premier admin à
partir de variables d'env, exécuté une fois après la première migration.

```ts
// backend/prisma/seed.ts (à créer)
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
async function main() {
  const email = process.env.ADMIN_EMAIL!.toLowerCase();
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 12);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, firstName: 'Admin', lastName: 'EMS', role: Role.ADMIN },
  });
  console.log('✅ Admin seedé:', email);
}
main().finally(() => prisma.$disconnect());
```

Déclencher **une seule fois** après déploiement :
`docker compose exec backend npx ts-node prisma/seed.ts`
(ou compiler le seed et l'exécuter en JS). **Alternative** manuelle si on ne veut pas
toucher au code : insérer la ligne en SQL via Adminer avec un hash bcrypt généré à part.

### 2.4 — Pas de terminaison TLS / HTTPS (BLOQUANT sécurité)

nginx front écoute en **HTTP port 80** uniquement ; le backend en 3000 nu. Or :
- les JWT et mots de passe transiteraient **en clair** ;
- `credentials: true` + cookies sécurisés exigent HTTPS ;
- les navigateurs modernes dégradent les fonctionnalités en HTTP.

**Correctif** : placer un **reverse proxy TLS** devant tout (Caddy ou Traefik =
certificats Let's Encrypt automatiques ; ou nginx + certbot). Détail au §6.

### 2.5 — PostgreSQL et Adminer exposés publiquement (BLOQUANT sécurité)

Dans `docker-compose.yml` :

```yaml
postgres:
  ports: ["${POSTGRES_PORT}:5432"]   # ⚠ base exposée sur l'hôte
adminer:
  ports: ["8080:8080"]               # ⚠ console DB accessible publiquement
```

**Problème** : en prod, exposer 5432 sur Internet = surface d'attaque directe sur la
base. Adminer accessible publiquement = porte d'entrée admin sur les données.

**Correctif prod** :
- **Supprimer** le mapping `ports` de `postgres` : les autres conteneurs y accèdent
  par le réseau Docker interne (`postgres:5432`), personne d'autre n'en a besoin.
- **Retirer complètement le service `adminer`** de la stack prod (ou le mettre derrière
  le proxy avec authentification + restriction IP, réservé à la maintenance).

### 2.6 — Refresh token en `localStorage` → ✅ CORRIGÉ (cookie httpOnly)

**Problème initial** : `frontend/src/lib/tokenStore.ts` stockait le refresh token en
`localStorage`, accessible au JavaScript donc **volable par XSS** (or c'est la clé de
session longue durée : le jeton le plus sensible).

**Correctif appliqué** (option robuste retenue) : le refresh token est désormais posé
et lu **exclusivement dans un cookie `httpOnly` + `Secure` (prod) + `SameSite` +
`path=/api/auth`** par le backend. Le JavaScript n'y a plus aucun accès.
- Backend : `auth.cookie.ts` (options + durée de vie alignée sur `JWT_REFRESH_EXPIRES_IN`),
  `cookieParser()` dans `main.ts`, `auth.controller.ts` (login pose le cookie ;
  refresh/logout le lisent/effacent), DTO `refresh-token.dto.ts` supprimé.
- Frontend : `tokenStore.ts` ne garde que l'access token en mémoire ; `api.ts`,
  `authApi.ts` et `AuthContext.tsx` s'appuient sur le cookie (`withCredentials`).

> **Note cross-site** : `SameSite=strict` convient au déploiement recommandé (front +
> API sur la **même origine** via le reverse proxy). En hébergement cross-site (Cas C,
> front CDN + API séparée), il faudrait passer le cookie en `SameSite=None; Secure` et
> ajuster la config CORS en conséquence.

### 2.7 — Throttler en mémoire → incompatible multi-instance (LIMITE de scalabilité)

`app.module.ts` : `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])` stocke les
compteurs **en RAM du process**. Tant qu'il y a **une seule instance** backend, c'est
parfait. Dès qu'on **scale horizontalement** (2+ conteneurs derrière un load balancer),
chaque instance a son propre compteur → la limite réelle est multipliée par le nombre
d'instances. **Correctif quand on scalera** : `@nestjs/throttler` + storage Redis
(`@nest-lab/throttler-storage-redis`). Pas bloquant pour un déploiement mono-instance.

---

## 3. Prérequis d'infrastructure (à réunir AVANT de commencer)

| Prérequis | Détail | Pourquoi |
| --------- | ------ | -------- |
| **Serveur** | VPS Linux (Ubuntu 22.04/24.04 LTS), min. 2 vCPU / 4 Go RAM / 40 Go SSD | Postgres + Node + nginx + build Docker |
| **Docker** | Docker Engine ≥ 24 + plugin Compose v2 | La stack est conteneurisée |
| **Nom de domaine** | ex. `ems.mondomaine.fr` (+ éventuellement `api.mondomaine.fr`) | HTTPS, CORS, cookies |
| **DNS** | Enregistrement A/AAAA du domaine → IP publique du serveur | Résolution + Let's Encrypt |
| **Ports ouverts** | 80 et 443 entrants (pare-feu/UFW). **PAS** 5432 ni 3000 ni 8080 | Surface d'attaque minimale |
| **Secrets** | Secrets JWT (`openssl rand -hex 32`), mot de passe Postgres fort, identifiants admin | Sécurité |
| **Sauvegarde** | Emplacement de stockage des dumps (disque distant / S3) | Reprise après incident |

**Argument** : on n'ouvre QUE 80/443. Tout le reste (base, API, Adminer) reste sur le
réseau Docker interne ou derrière le proxy. C'est le principe de **moindre exposition**.

---

## 4. Choix de la cible de déploiement (tous les cas)

Trois scénarios réalistes. **Le cas A est recommandé** vu que l'outillage Docker
existe déjà.

### Cas A — VPS unique, Docker Compose + reverse proxy (RECOMMANDÉ)

- **Principe** : un seul serveur héberge Postgres + backend + frontend + un proxy TLS
  (Caddy/Traefik), tous en conteneurs.
- **Avantages** : réutilise l'existant à 90 %, coût faible, simple à opérer,
  reproductible. HTTPS automatique.
- **Inconvénients** : mono-serveur (pas de HA), scaling vertical seulement.
- **Pour qui** : mise en prod initiale, établissement/école, charge modérée. ✅

### Cas B — Plateforme managée (PaaS : Render / Railway / Fly.io / Scalingo)

- **Principe** : la base Postgres est un service managé (backups inclus) ; backend et
  frontend sont déployés comme services via leurs Dockerfiles.
- **Avantages** : backups/patchs/TLS gérés par la plateforme, scaling simplifié,
  moins d'ops.
- **Inconvénients** : coût supérieur, `DATABASE_URL` fournie par la plateforme (souvent
  avec SSL obligatoire → vérifier `?sslmode=require`), quelques adaptations d'env.
- **Pour qui** : équipe sans ops dédié voulant déléguer l'infra.

### Cas C — Frontend statique (CDN) + backend/API séparés

- **Principe** : le build Vite est poussé sur un hébergeur statique (Netlify / Vercel /
  Cloudflare Pages / S3+CloudFront) ; l'API tourne sur un VPS ou PaaS.
- **Avantages** : front ultra-rapide et mondialement distribué, découplage clair.
- **Inconvénients** : deux domaines/déploiements à gérer, CORS et cookies **cross-site**
  à configurer finement (`SameSite=None; Secure`), plus de pièces mobiles.
- **Pour qui** : besoin de perf front élevée / trafic géographiquement dispersé.

> La suite du rapport déroule le **Cas A** de bout en bout. Les cas B et C réutilisent
> les mêmes correctifs (§2) ; seules changent la couche proxy et la provenance de
> `DATABASE_URL`.

---

## 5. Déploiement pas-à-pas (Cas A)

### Étape 5.0 — Geler le code et committer les changements en cours

`git status` montre des modifications **non commitées** :
`schema.prisma`, `EvaluationWizard.tsx`, et surtout une **nouvelle migration non
commitée** `20260708140420_hide_result_by_default/`.

> ⚠ **On ne déploie jamais un dépôt sale.** La migration doit être versionnée, sinon
> `migrate deploy` sur le serveur ne la connaîtra pas (ou pire, incohérence entre le
> schéma et les migrations). Commit + push sur la branche de release d'abord.

```bash
git add backend/prisma backend/prisma/migrations frontend/src/features/evaluations/EvaluationWizard.tsx
git commit -m "chore(db): migration hide_result_by_default + ajustements"
```

### Étape 5.1 — Provisionner le serveur

```bash
# Sur le VPS (Ubuntu)
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh          # Docker + Compose v2
sudo usermod -aG docker $USER                    # (se reconnecter ensuite)
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443
sudo ufw enable                                  # pare-feu : 22/80/443 uniquement
```

### Étape 5.2 — Récupérer le code

```bash
git clone <url-du-depot> ems && cd ems
git checkout <branche-ou-tag-de-release>
```

### Étape 5.3 — Fabriquer le `.env` de production

Sur la base de `.env.example`, mais avec de **vrais secrets** et les **URLs publiques** :

```dotenv
# --- PostgreSQL ---
POSTGRES_USER=ems_prod
POSTGRES_PASSWORD=<mot_de_passe_fort_genere>
POSTGRES_DB=ems_prod
POSTGRES_PORT=5432                # interne uniquement (plus exposé, voir 5.4)

# --- Backend ---
BACKEND_PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://ems_prod:<mdp>@postgres:5432/ems_prod?schema=public

# --- JWT (générés : openssl rand -hex 32) ---
JWT_ACCESS_SECRET=<64_hex>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<autre_64_hex>
JWT_REFRESH_EXPIRES_IN=7d

# --- Nouveaux (voir §2.1 / §2.2) ---
CORS_ORIGIN=https://ems.mondomaine.fr
VITE_API_URL=https://ems.mondomaine.fr/api

# --- Frontend ---
FRONTEND_PORT=5173               # interne ; le proxy expose 443

# --- Seed admin (voir §2.3) ---
ADMIN_EMAIL=admin@mondomaine.fr
ADMIN_PASSWORD=<mot_de_passe_admin_fort>
```

> **Argument sécurité** : ce fichier contient tous les secrets. Il ne doit **jamais**
> être commité (`.gitignore` couvre déjà `.env`). Droits restreints : `chmod 600 .env`.
> Pour une prod exigeante, utiliser un gestionnaire de secrets (Docker secrets,
> Vault, SSM) plutôt qu'un fichier plat.

### Étape 5.4 — Créer un `docker-compose.prod.yml` (durcissement)

Un fichier d'override qui **applique les correctifs §2.5** sans casser le dev :

```yaml
services:
  postgres:
    ports: []                    # ❌ ne plus exposer 5432 sur l'hôte
  adminer:
    profiles: ["maintenance"]    # ❌ ne démarre pas par défaut en prod
  backend:
    environment:
      CORS_ORIGIN: ${CORS_ORIGIN}
    healthcheck:                 # supervision de l'API
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
  frontend:
    build:
      args:
        VITE_API_URL: ${VITE_API_URL}   # ✅ URL publique HTTPS, plus localhost
```

Lancement :

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Étape 5.5 — Vérifier l'application des migrations

Le backend exécute `prisma migrate deploy` à son démarrage (CMD du Dockerfile).
Contrôler :

```bash
docker compose logs backend | grep -i migrat
# Doit lister les 8 migrations "applied" sans erreur, puis "EMS API démarrée…"
```

> **Cas d'échec fréquent** : la base n'est pas prête. `depends_on … service_healthy`
> couvre déjà ce cas via le healthcheck Postgres — mais si une migration échoue,
> le conteneur backend s'arrête ; consulter les logs, corriger, `up -d` à nouveau.

### Étape 5.6 — Seeder le premier admin (une seule fois)

```bash
docker compose exec backend npx ts-node prisma/seed.ts
# ou, si ts-node absent dans l'image runner, exécuter le seed compilé / via SQL Adminer
```

---

## 6. Reverse proxy + HTTPS (corrige §2.4)

Placer **Caddy** devant la stack : certificats Let's Encrypt automatiques, redirection
HTTP→HTTPS, en-têtes sécurisés. Ajouter au compose prod :

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on: [frontend, backend]
volumes:
  caddy_data:
```

`Caddyfile` — un seul domaine, l'API sous `/api`, le reste vers le front (SPA) :

```
ems.mondomaine.fr {
    encode gzip
    handle /api/* {
        reverse_proxy backend:3000
    }
    handle {
        reverse_proxy frontend:80
    }
}
```

> **Argument** : router `/api/*` vers le backend et tout le reste vers nginx front
> permet d'avoir **une seule origine** (`https://ems.mondomaine.fr`). Cela simplifie
> CORS (§2.1) et évite les cookies cross-site (§2.6). Caddy obtient et **renouvelle
> automatiquement** le certificat TLS. Alternative équivalente : Traefik (labels) ou
> nginx + certbot (plus manuel).

Une fois Caddy en place, la variable `VITE_API_URL=https://ems.mondomaine.fr/api`
(§5.3) devient cohérente : le navigateur appelle la même origine, en HTTPS.

---

## 7. Base de données : migrations, sauvegardes, restauration

### 7.1 — Migrations

- **Application** : automatique au boot via `prisma migrate deploy` (jamais
  `migrate dev` en prod : `deploy` n'altère pas l'historique, ne réinitialise rien).
- **Règle d'or** : toute évolution du schéma passe par une migration commitée, testée
  en staging, puis déployée. **Ne jamais** modifier la base à la main en prod.

### 7.2 — Sauvegardes (indispensable)

```bash
# Dump quotidien (cron sur l'hôte)
docker compose exec -T postgres pg_dump -U ems_prod ems_prod \
  | gzip > /backups/ems_$(date +%F).sql.gz
```

> **Argument** : sans sauvegarde, un `docker compose down -v` malencontreux ou une
> corruption efface tout. Le volume `ems_pgdata` seul ne protège pas d'une erreur
> humaine. Planifier un cron **quotidien**, tester la restauration, stocker **hors
> serveur** (rotation 7/30 jours). En Cas B (PaaS), les backups sont souvent inclus —
> vérifier la rétention.

### 7.3 — Restauration (à répéter en test)

```bash
gunzip -c /backups/ems_2026-07-10.sql.gz \
  | docker compose exec -T postgres psql -U ems_prod ems_prod
```

---

## 8. Vérification post-déploiement (smoke tests)

À exécuter systématiquement après chaque mise en prod :

1. **Santé API** : `curl -I https://ems.mondomaine.fr/api` → 200.
2. **TLS** : certificat valide (cadenas navigateur ; `curl -Iv` sans warning).
3. **Front** : la page charge, pas d'erreur 404 sur refresh d'une route profonde
   (valide le fallback SPA `try_files`).
4. **CORS** : login depuis le vrai domaine sans erreur console « blocked by CORS ».
5. **Auth complet** : connexion admin (compte seedé) → `/api/auth/me` renvoie le profil.
6. **Refresh** : laisser expirer l'access token (15 min) → l'appli se re-authentifie
   sans reconnexion (intercepteur `api.ts`).
7. **Rate-limit** : 6 logins ratés d'affilée → 429 (throttler `5/min`).
8. **RBAC** : un STUDENT sur `/api/auth/admin-only` → 403.
9. **Parcours métier** : créer une évaluation, la passer côté étudiant, voir le résultat.
10. **Persistance** : `docker compose restart` → les données sont toujours là (volume).

---

## 9. Exploitation : logs, supervision, mises à jour, rollback

### 9.1 — Logs & supervision

- `restart: unless-stopped` est déjà en place → redémarrage auto des conteneurs.
- Logs : `docker compose logs -f --tail=100 backend`. Pour la durée, brancher un
  collecteur (Loki/Grafana, ou le monitoring du PaaS). L'API log déjà son démarrage.
- Healthchecks : Postgres (déjà) + backend (ajouté §5.4) permettent à Docker/au proxy
  de savoir si un service est sain.

### 9.2 — Mise à jour applicative

```bash
git pull                                   # ou checkout du nouveau tag
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# migrate deploy s'exécute au boot ; images reconstruites ; bascule quasi sans coupure
```

### 9.3 — Rollback

- **Code** : redéployer le tag précédent (`git checkout <tag-1>` + rebuild).
- **Base** : les migrations Prisma ne se « dé-migrent » pas automatiquement. En cas de
  migration destructrice fautive → restaurer le dump d'avant déploiement (§7.3).
  **D'où l'importance d'un dump juste avant chaque déploiement à migration.**

---

## 10. Checklist de durcissement sécurité (récapitulatif)

- [ ] Secrets JWT/DB forts et uniques, générés (`openssl rand -hex 32`) — pas ceux du `.env.example`.
- [ ] `.env` en `chmod 600`, hors Git (déjà ignoré).
- [ ] HTTPS obligatoire (Caddy/Traefik) + redirection HTTP→HTTPS.
- [ ] Postgres **non exposé** (mapping `ports` retiré en prod).
- [ ] Adminer **absent** de la prod (profil maintenance uniquement).
- [ ] CORS restreint au domaine réel (`CORS_ORIGIN`).
- [ ] Pare-feu : seuls 22/80/443 ouverts.
- [ ] Rate-limiting actif (déjà) ; envisager Redis si multi-instance.
- [ ] Sauvegardes DB quotidiennes + restauration testée.
- [x] Refresh token en cookie `httpOnly/Secure/SameSite` — plus de `localStorage` (§2.6). ✅
- [ ] En-têtes de sécurité (helmet déjà ; vérifier CSP si XSS est une préoccupation).
- [ ] Mises à jour système régulières (`apt upgrade`, images de base rebuild).

---

## 11. Montée en charge (au-delà du mono-serveur)

Quand la charge l'exigera :
1. **Throttler → Redis** (§2.7) pour cohérence multi-instance.
2. **Plusieurs instances backend** derrière le proxy (Caddy/Traefik load-balance).
   ⚠ `prisma migrate deploy` au boot doit alors être **découplé** (une tâche de
   migration one-shot avant le rollout) pour éviter que N instances migrent en même
   temps.
3. **Postgres managé** ou réplication + pooling (PgBouncer) pour tenir les connexions.
4. **CDN** devant le front (ou passage au Cas C).
5. **Observabilité** : métriques (Prometheus), traces, alerting.

---

## 12. Go / No-Go — synthèse décisionnelle

| Bloquant | Statut requis avant go-live |
| -------- | --------------------------- |
| §2.1 CORS paramétrable | ✅ corrigé dans le code |
| §2.2 `VITE_API_URL` publique | ✅ via build arg prod |
| §2.3 Seed admin | ✅ script créé + exécuté |
| §2.4 HTTPS/TLS | ✅ proxy en place |
| §2.5 Postgres/Adminer non exposés | ✅ override prod |
| Migration `hide_result_by_default` commitée | ✅ §5.0 |
| Sauvegardes opérationnelles | ✅ §7 |
| Smoke tests passés | ✅ §8 |

**Tant que les cases ci-dessus ne sont pas cochées, c'est NO-GO.** Une fois toutes
vertes → **GO** pour la production.

---

*Fin du rapport. Les correctifs de code (§2.1, §2.2, §2.3) et les fichiers d'infra
(`docker-compose.prod.yml`, `Caddyfile`, `prisma/seed.ts`) ne sont pas encore présents
dans le dépôt : ils constituent le travail d'implémentation à réaliser avant le
premier déploiement.*
