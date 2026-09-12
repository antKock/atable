#!/bin/sh
# Tunnel ssh vers les PostgREST du VPS (docs/infra/migration-supabase-vps.md,
# « Accès depuis le poste ») : prod sur 127.0.0.1:3100, staging sur 127.0.0.1:3101.
# Les ports sont publiés par Dokploy sur le VPS et rejetés depuis l'extérieur
# (règle DOCKER-USER de bootstrap.sh) : seul ce tunnel y donne accès.
#
#   scripts/vps/tunnel.sh          # premier plan, Ctrl-C pour fermer
#   scripts/vps/tunnel.sh -f       # arrière-plan (kill "$(pgrep -f 'ssh -N.*mijote-vps')" pour fermer)
#
# Les scripts d'exploitation (restore-demo, demo-en, sync-staging-demo…) et
# `npm run dev` lisent DATABASE_REST_URL/KEY dans .env.local (prod) ou
# .env.staging.local (staging), qui pointent sur ces ports.
exec ssh -N "$@" -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
  -L 3100:127.0.0.1:3100 -L 3101:127.0.0.1:3101 mijote-vps
