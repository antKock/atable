# Mijote (repo `atable`)

Application de carnets de recettes partagés (web + iOS + Android via Capacitor).
Next.js 16, Supabase (Postgres + Storage), Upstash Redis, OpenAI pour les imports.

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner les variables
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000). Tests : `npm test` (vitest),
`npx tsc --noEmit`, `npm run lint`. Harnais E2E (Playwright + Supabase local) : voir
`e2e/`.

## Déploiement

Push sur `staging` ou `main` → GitHub Actions (`.github/workflows/deploy.yml` : lint,
types, tests, puis image Docker sur GHCR) → Dokploy sur le VPS OVH → vérification du SHA
déployé. `main` est protégée : promotion par PR depuis `staging`.

Runbook, pièges et plan de reprise : `docs/infra/migration-vps-ovh.md`.
Conventions de travail et repères : `CLAUDE.md`.
