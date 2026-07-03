# ============================================================
#  Backend NestJS — image multi-stage.
#  Stage 1 (builder) : installe TOUTES les deps, génère le client
#  Prisma, compile TypeScript.
#  Stage 2 (runner)  : image finale, exécute l'app compilée.
# ============================================================

# ---------- Builder ----------
FROM node:22-slim AS builder
WORKDIR /app

# Outils de build (bcrypt = module natif) + openssl (moteur Prisma).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl \
  && rm -rf /var/lib/apt/lists/*

# On copie d'abord package*.json pour profiter du cache Docker :
# tant qu'ils ne changent pas, npm ci n'est pas relancé.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ---------- Runner ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# openssl requis au runtime par le moteur Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# On récupère depuis le builder : dépendances, build, schéma + migrations.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Au démarrage : applique les migrations puis lance l'API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
