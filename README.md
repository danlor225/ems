# EMS — Évaluation Management Système

Plateforme web d'évaluation de niveau pour étudiants : passage de QCM chronométrés,
correction automatique, résultats et administration complète.

## 🧱 Stack technique

| Couche       | Technologies                                                                 |
| ------------ | ---------------------------------------------------------------------------- |
| Frontend     | React, TypeScript, Vite, Tailwind CSS, React Router, React Hook Form, Zod, TanStack Query |
| Backend      | NestJS, TypeScript, Prisma ORM, JWT, Passport, bcrypt                        |
| Base de données | PostgreSQL                                                                |
| Outils       | Docker, Docker Compose, Git                                                  |

## 📁 Structure du dépôt (monorepo)

```
ems/
├── backend/    # API NestJS
├── frontend/   # Application React
└── docker-compose.yml
```

## 🚀 Démarrage rapide (dev)

> Prérequis : Docker Desktop installé et démarré.

```bash
# 1. Cloner le dépôt
git clone <url> ems && cd ems

# 2. Créer le fichier d'environnement à partir du modèle
cp .env.example .env   # puis remplir les valeurs

# 3. Lancer toute la stack
docker compose up
```

## 👥 Rôles

- **STUDENT** — passe des évaluations, consulte ses résultats.
- **TEACHER** — gère matières, questions, examens, sessions ; consulte les résultats.
- **ADMIN** — tout ce que fait TEACHER + gestion des utilisateurs, rôles et journaux.

## 📌 État du projet

🚧 En cours de développement — Phase 2 : initialisation du socle.
