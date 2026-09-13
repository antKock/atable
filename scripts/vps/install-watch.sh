#!/usr/bin/env bash
# Installe / met à jour le veilleur ops sur le VPS (backlog #27). À lancer DEPUIS LE POSTE :
#   bash scripts/vps/install-watch.sh
# Copie watch.sh dans /usr/local/bin, pose la crontab, crée /etc/mijote/watch.env s'il
# manque (à compléter : SENTRY_DSN = NEXT_PUBLIC_SENTRY_DSN de l'app, ADMIN_API_SECRET =
# celui des apps Dokploy). Idempotent.
set -euo pipefail
HOST=${VPS_HOST:-mijote-vps}
scp -q "$(dirname "$0")/watch.sh" "$HOST:/tmp/mijote-watch.sh"
ssh "$HOST" 'sudo bash -s' <<'REMOTE'
set -euo pipefail
install -m 0755 /tmp/mijote-watch.sh /usr/local/bin/mijote-watch
mkdir -p /etc/mijote /var/lib/mijote-watch
if [ ! -f /etc/mijote/watch.env ]; then
  cat > /etc/mijote/watch.env <<'ENV'
# Veilleur ops (scripts/vps/watch.sh). Jamais commité.
SENTRY_DSN=
ADMIN_API_SECRET=
ADMIN_API_SECRET_STAGING=
HOST_PROD=mijote.anthonykocken.fr
HOST_STAGING=staging.mijote.anthonykocken.fr
ENV
  chmod 0600 /etc/mijote/watch.env
  echo "→ compléter /etc/mijote/watch.env (SENTRY_DSN, ADMIN_API_SECRET)"
fi
cat > /etc/cron.d/mijote-watch <<'CRON'
# Veilleur ops Mijote (backlog #27) — logs Traefik/app toutes les 5 min, absences une fois par jour.
*/5 * * * * root /usr/local/bin/mijote-watch tick >/dev/null 2>>/var/log/mijote-watch.err
15 6 * * * root /usr/local/bin/mijote-watch daily >/dev/null 2>>/var/log/mijote-watch.err
CRON
chmod 0644 /etc/cron.d/mijote-watch
echo "installé : /usr/local/bin/mijote-watch, /etc/cron.d/mijote-watch"
REMOTE
