# Image de production Mijote (auto-hébergement, cf. docs/infra/migration-vps-ovh.md).
#
# Build : les variables NEXT_PUBLIC_* sont inlinées dans le bundle client, elles
# doivent donc être fournies au build (build-arg). Elles sont publiques par
# nature. Aucun autre secret ne doit passer en build-arg : le repo est public et
# les couches de l'image sont lisibles. Le jeton Sentry (upload des source maps)
# passe par un secret BuildKit, qui ne laisse rien dans l'image.
#
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
#     --build-arg NEXT_PUBLIC_SENTRY_DSN=https://... \
#     --build-arg NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging \
#     --build-arg GIT_COMMIT_SHA=$(git rev-parse HEAD) \
#     --secret id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
#     -t mijote .
#
# Run : toutes les autres variables (SUPABASE_SERVICE_ROLE_KEY, OPENAI_*, …)
# sont lues à l'exécution, à fournir via l'environnement du conteneur.

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
# npm ci a besoin des devDependencies pour `next build` (typescript, tailwind…).
COPY package.json package-lock.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG GIT_COMMIT_SHA
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT \
    GIT_COMMIT_SHA=$GIT_COMMIT_SHA \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT \
    NEXT_TELEMETRY_DISABLED=1

# Le secret n'existe que le temps de cette commande (jamais dans une couche).
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    if [ -s /run/secrets/SENTRY_AUTH_TOKEN ]; then \
      export SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)"; \
    fi && npm run build

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Sortie standalone : server.js + node_modules tracés. `public/` et
# `.next/static` ne sont pas inclus par Next, on les copie à côté.
# (`opengraph-image.tsx` lit `public/cocotte-illustration.svg` via process.cwd().)
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# `/api/version` est force-dynamic et sans dépendance externe : sonde idéale.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/version >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
