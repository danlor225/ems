# ============================================================
#  Frontend React/Vite — image multi-stage.
#  Stage 1 : build des fichiers statiques.
#  Stage 2 : nginx sert le build (SPA avec fallback index.html).
# ============================================================

# ---------- Builder ----------
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL est "gravé" dans le bundle au moment du build.
# Le navigateur (sur l'hôte) appellera donc l'API via localhost:3000.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------- Runner ----------
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
