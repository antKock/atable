#!/usr/bin/env bash
# Veilleur ops Mijote (backlog #27) — rend visibles les erreurs que Sentry ne
# voit pas : Traefik (5xx, lignes ERR), logs des conteneurs app (fail-open
# Redis, erreurs non capturées), et une fois par jour les ABSENCES (sauvegarde,
# crons, disque, certificat) via GET /api/admin/health de chaque app.
#
#   watch.sh tick    # toutes les 5 min (crontab) : logs depuis le dernier passage
#   watch.sh daily   # une fois par jour : santé des apps, disque, certificats
#   watch.sh test    # envoie un événement de test à Sentry
#
# Config : /etc/mijote/watch.env (SENTRY_DSN, ADMIN_API_SECRET, HOSTS_PROD,
# HOSTS_STAGING). Aucune dépendance au-delà de bash, jq, curl, openssl, docker.
# Silencieux quand tout va bien ; journal dans /var/log/mijote-watch.log.
set -uo pipefail

ENV_FILE=/etc/mijote/watch.env
STATE_DIR=/var/lib/mijote-watch
LOG=/var/log/mijote-watch.log
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
: "${SENTRY_DSN:?SENTRY_DSN manquant dans $ENV_FILE}"
: "${HOST_PROD:=mijote.anthonykocken.fr}"
: "${HOST_STAGING:=staging.mijote.anthonykocken.fr}"
: "${DISK_MAX_PCT:=85}"
: "${CERT_MIN_DAYS:=14}"
mkdir -p "$STATE_DIR"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" >> "$LOG"; }

# --- Sentry : envoi d'un événement via l'endpoint store (DSN = https://KEY@HOST/PROJECT)
SENTRY_KEY=$(sed -E 's#https://([^@]+)@.*#\1#' <<<"$SENTRY_DSN")
SENTRY_HOST=$(sed -E 's#https://[^@]+@([^/]+)/.*#\1#' <<<"$SENTRY_DSN")
SENTRY_PROJECT=$(sed -E 's#.*/([0-9]+)$#\1#' <<<"$SENTRY_DSN")
sentry_event() { # level fingerprint message env extra_json
  local level=$1 fp=$2 msg=$3 env=$4 extra=${5:-'{}'}
  local payload
  payload=$(jq -cn --arg id "$(cat /proc/sys/kernel/random/uuid | tr -d -)" \
    --arg ts "$(date -u +%FT%TZ)" --arg level "$level" --arg fp "$fp" --arg msg "$msg" \
    --arg env "$env" --arg host "$(hostname)" --argjson extra "$extra" \
    '{event_id:$id, timestamp:$ts, platform:"other", level:$level, logger:"mijote-watch",
      environment:$env, server_name:$host, message:{formatted:$msg},
      fingerprint:["mijote-watch",$fp], tags:{source:"vps-watch",check:$fp}, extra:$extra}')
  curl -sS -m 15 -o /dev/null -w '' -X POST "https://$SENTRY_HOST/api/$SENTRY_PROJECT/store/" \
    -H "Content-Type: application/json" \
    -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_client=mijote-watch/1.0, sentry_key=$SENTRY_KEY" \
    -d "$payload" || log "sentry: envoi échoué ($fp)"
  log "sentry[$level] $fp — $msg"
}

env_of_host() { case "$1" in "$HOST_PROD") echo production ;; "$HOST_STAGING") echo staging ;; *) echo other ;; esac; }
app_url_of_env() { case "$1" in production) echo "https://$HOST_PROD" ;; staging) echo "https://$HOST_STAGING" ;; esac; }
# Secret admin par app (ADMIN_API_SECRET_STAGING, repli ADMIN_API_SECRET)
admin_secret_of_host() { case "$1" in "$HOST_STAGING") echo "${ADMIN_API_SECRET_STAGING:-${ADMIN_API_SECRET:-}}" ;; *) echo "${ADMIN_API_SECRET:-}" ;; esac; }

container_id() { docker ps -q -f "name=$1" | head -1; }
app_containers() { docker ps --format '{{.Names}}' | grep -E '^mijote-(prod|staging)-[a-z0-9]{6}\.' ; }

# =====================================================================
# tick : logs depuis le dernier passage
# =====================================================================
tick() {
  local now cursor
  now=$(date -u +%FT%TZ)
  cursor=$(cat "$STATE_DIR/cursor" 2>/dev/null || date -u -d '5 minutes ago' +%FT%TZ)
  local traefik; traefik=$(container_id dokploy-traefik)
  if [ -z "$traefik" ]; then sentry_event error traefik-missing "Conteneur Traefik introuvable" production; return; fi

  # --- 5xx vus par Traefik : une issue par (hôte, méthode, chemin, statut), comptes + exemples
  # (-R + fromjson? : une ligne non JSON ne fait pas avorter jq)
  local lines; lines=$(docker logs --since "$cursor" --until "$now" "$traefik" 2>&1 | grep -a '^{' \
    | jq -rR 'fromjson? | select((.DownstreamStatus|tonumber) >= 500) | [.RequestHost, .RequestMethod, .RequestPath, (.DownstreamStatus|tostring), .ClientHost] | @tsv' 2>/dev/null)
  if [ -n "$lines" ]; then
    # compte du jour par hôte (pour /api/admin/watch)
    while IFS=$'\t' read -r host _; do
      local f="$STATE_DIR/5xx-$host-$(date -u +%F)"; echo $(( $(cat "$f" 2>/dev/null || echo 0) + 1 )) > "$f"
    done <<<"$lines"
    # issues Sentry groupées
    cut -f1-4 <<<"$lines" | sort | uniq -c | sort -rn | head -20 | while read -r n host method path status; do
      local env; env=$(env_of_host "$host")
      local clients; clients=$(awk -F'\t' -v h="$host" -v m="$method" -v p="$path" -v s="$status" '$1==h&&$2==m&&$3==p&&$4==s{print $5}' <<<"$lines" | sort -u | head -3 | paste -sd, -)
      sentry_event error "traefik-5xx/$host/$method $path/$status" \
        "Traefik $status × $n — $method $host$path" "$env" \
        "$(jq -cn --arg n "$n" --arg c "$clients" --arg from "$cursor" --arg to "$now" '{count:($n|tonumber), clients:$c, window:{from:$from,to:$to}}')"
    done
  fi

  # --- lignes ERR de Traefik (ACME, backend, middleware…), hors 5xx déjà comptés et hors
  # « peeking client hello » (connexion TLS abandonnée avant la poignée de main : scanners)
  # et des sondes de /.well-known/acme-challenge/ sur un jeton inconnu (scanner du
  # 2026-09-18 sur l'IP brute : « Cannot retrieve the ACME challenge … », « Unable to get
  # token … missing token »). Un vrai échec de renouvellement s'écrit autrement
  # (« Unable to obtain ACME certificate ») et l'échéance des certificats est vérifiée par `daily`.
  local errs; errs=$(docker logs --since "$cursor" --until "$now" "$traefik" 2>&1 | grep -a 'ERR' | grep -av '^{' \
    | grep -av 'peeking client hello' \
    | grep -av -e 'Cannot retrieve the ACME challenge' -e 'Unable to get token' \
    | sed -E 's/\x1b\[[0-9;]*m//g; s/^[0-9T:.Z-]+ +//' | sed -E 's/(routerName|middlewareName|entryPointName)=[^ ]+//g' | sort | uniq -c | sort -rn | head -10)
  if [ -n "$errs" ]; then
    while read -r n msg; do
      local key; key=$(md5sum <<<"$msg" | cut -c1-10)
      sentry_event error "traefik-err/$key" "Traefik ERR × $n — ${msg:0:200}" production \
        "$(jq -cn --arg n "$n" --arg m "$msg" '{count:($n|tonumber), line:$m}')"
    done <<<"$errs"
  fi

  # --- conteneurs app : fail-open Redis et erreurs non capturées
  for c in $(app_containers); do
    local env=staging; [[ $c == mijote-prod-* ]] && env=production
    local app; app=$(docker logs --since "$cursor" --until "$now" "$c" 2>&1 \
      | grep -aE 'revocation check failed|check failed \(Redis down|^ ?⨯ |UnhandledPromiseRejection|ECONNREFUSED|EAI_AGAIN' \
      | grep -avE 'uncaughtException|unhandledRejection' | head -50)  # déjà capturés par Sentry dans l'app
    [ -z "$app" ] && continue
    local n; n=$(wc -l <<<"$app" | tr -d ' ')
    local key; key=$(head -1 <<<"$app" | sed -E 's/[0-9a-f-]{36}|[0-9]+//g' | md5sum | cut -c1-10)
    sentry_event warning "app-log/$env/$key" "Logs app $env × $n — $(head -1 <<<"$app" | cut -c1-180)" "$env" \
      "$(jq -cn --arg s "$app" --arg c "$c" '{sample:$s, container:$c}')"
  done

  # --- relevé du jour → /api/admin/watch (idempotent, total du jour)
  if [ -n "${ADMIN_API_SECRET:-}" ]; then
    for host in "$HOST_PROD" "$HOST_STAGING"; do
      local f="$STATE_DIR/5xx-$host-$(date -u +%F)"; [ -f "$f" ] || continue
      local secret; secret=$(admin_secret_of_host "$host")
      local total; total=$(cat "$f")
      local sent="$f.sent"; [ "$(cat "$sent" 2>/dev/null)" = "$total" ] && continue
      if curl -sS -m 20 -o /dev/null -f -X POST "https://$host/api/admin/watch" \
          -H "Authorization: Bearer $secret" -H "Content-Type: application/json" \
          -d "$(jq -cn --arg d "$(date -u +%F)" --arg n "$total" '{day:$d, traefik5xx:($n|tonumber)}')"; then
        echo "$total" > "$sent"
      else
        log "watch: POST /api/admin/watch $host échoué (total $total)"
      fi
    done
  fi

  echo "$now" > "$STATE_DIR/cursor"
  find "$STATE_DIR" -name '5xx-*' -mtime +7 -delete 2>/dev/null
}

# =====================================================================
# daily : absences et dérives lentes
# =====================================================================
daily() {
  # --- santé des apps (seuils dans l'app : assembleV3 → /api/admin/health)
  if [ -n "${ADMIN_API_SECRET:-}" ]; then
    for env in production staging; do
      local url; url=$(app_url_of_env "$env")
      local secret; secret=$(admin_secret_of_host "${url#https://}")
      local body; body=$(curl -sS -m 90 -f -H "Authorization: Bearer $secret" "$url/api/admin/health" 2>/dev/null)
      if [ -z "$body" ]; then sentry_event error "health-unreachable/$env" "GET /api/admin/health injoignable ($env)" "$env"; continue; fi
      jq -r '.checks | to_entries[] | select(.value.ok == false) | "\(.key)\t\(.value.detail)"' <<<"$body" | while IFS=$'\t' read -r check detail; do
        [ -z "$check" ] && continue
        # Staging : données de test (pipeline IA, seed démo) et aucun cron posé sur le VPS
        # (demo-reset / app-store-sync ne visent que la prod) → seuls sauvegarde, bord et
        # Instagram comptent. Le crédit Apify est celui du même compte : alerté par la prod seule.
        [ "$env" = staging ] && case "$check" in pipeline|demo|crons|apify) continue ;; esac
        sentry_event error "health/$env/$check" "Santé $env — $check : $detail" "$env" "$(jq -c '.checks' <<<"$body")"
      done
      log "health $env: $(jq -r '.ok' <<<"$body")"
    done
  fi

  # --- disque
  local pct; pct=$(df -P / | awk 'NR==2{gsub("%","",$5); print $5}')
  [ "${pct:-0}" -ge "$DISK_MAX_PCT" ] && sentry_event error disk-usage "Disque VPS à ${pct} % (max $DISK_MAX_PCT)" production "$(df -h / | jq -Rs '{df:.}')"

  # --- certificats TLS
  for host in "$HOST_PROD" "$HOST_STAGING"; do
    local notafter; notafter=$(echo | openssl s_client -connect "$host:443" -servername "$host" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -z "$notafter" ]; then sentry_event error "cert/$host" "Certificat TLS illisible pour $host" "$(env_of_host "$host")"; continue; fi
    local days=$(( ( $(date -d "$notafter" +%s) - $(date +%s) ) / 86400 ))
    [ "$days" -lt "$CERT_MIN_DAYS" ] && sentry_event error "cert/$host" "Certificat TLS de $host expire dans $days j ($notafter)" "$(env_of_host "$host")"
    log "cert $host: $days j"
  done
}

case "${1:-}" in
  tick) tick ;;
  daily) daily ;;
  test) sentry_event info test "Événement de test du veilleur ($(date -u +%FT%TZ))" staging '{"hello":"world"}'; echo "envoyé, voir Sentry" ;;
  *) echo "usage : watch.sh tick|daily|test" >&2; exit 2 ;;
esac
