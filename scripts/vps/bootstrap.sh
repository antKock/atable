#!/usr/bin/env bash
# Préparation d'un VPS OVH neuf (Debian 12/13) pour héberger Mijote avec Dokploy.
# Voir docs/infra/migration-vps-ovh.md (runbook, étapes 2 et 3 ; section « État
# hors repo » pour ce que ce script reproduit).
#
# Idempotent : peut être relancé sans casser ce qui est déjà en place (aucun
# `ufw reset`, les règles sont vérifiées une à une ; les fichiers de conf sont
# fusionnés ou réécrits à l'identique).
# À exécuter en root sur la machine :
#   scp scripts/vps/bootstrap.sh mijote-vps:/tmp/ && ssh mijote-vps 'sudo bash /tmp/bootstrap.sh'
#
# Variables d'environnement (toutes optionnelles, à passer à sudo : `sudo APP_HOST=… bash …`) :
#   APP_HOST                 hôte public de l'app (ex. mijote.anthonykocken.fr) → installe la
#                            crontab du reset démo (`/etc/cron.d/mijote-demo-reset`). Sans
#                            elle, rien n'est installé.
#   DOKPLOY_INSTALL_SHA256   sha256 attendu de https://dokploy.com/install.sh. Sans elle, le
#                            script télécharge l'installeur, affiche son empreinte et
#                            s'arrête : relire le script, relancer avec l'empreinte.
#   DOCKER_RESTART=1         autorise le redémarrage de Docker si /etc/docker/daemon.json a
#                            changé alors que Docker tourne déjà (coupe brièvement Dokploy,
#                            Traefik et les apps ; sinon la conf s'applique au prochain
#                            redémarrage).
#
# Ce que ça fait :
#   1. mises à jour système + mises à jour de sécurité automatiques
#   2. pare-feu ufw déclaratif : 22 (SSH), 80/443 (Traefik) ; retire 3000 si présent.
#      L'interface Dokploy n'est jamais exposée : HTTPS via Traefik une fois son domaine
#      posé, ou tunnel SSH avant (`ssh -L 3000:127.0.0.1:3000 mijote-vps` puis
#      http://localhost:3000)
#   3. swap 2 GB (filet contre l'OOM sur 4 GB de RAM), swappiness 10
#   4. fail2ban sur SSH
#   5. durcissement sshd (clé uniquement) — seulement si une clé autorisée existe
#   6. Docker : rotation des logs (daemon.json), règle DOCKER-USER persistante qui
#      rejette le port 3000 publié par Docker depuis l'extérieur (Docker contourne ufw),
#      purge hebdomadaire des images
#   7. crontabs demo-reset (03:00 UTC), app-store-sync (10:00 UTC) via `date -u`, et
#      weekly-digest (lundi 07:00 Paris) ; secret dans /etc/mijote/cron.env (root 600)
#   8. installation de Dokploy (installe Docker + Traefik + sa base + son Redis), installeur
#      épinglé par sha256

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer en root (sudo bash bootstrap.sh)" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
APP_HOST="${APP_HOST:-}"
DOKPLOY_INSTALL_SHA256="${DOKPLOY_INSTALL_SHA256:-}"
DOCKER_RESTART="${DOCKER_RESTART:-0}"

warn() { echo "    ⚠ $*" >&2; }

# Écrit $2 (contenu sur stdin) dans $1 seulement s'il change ; renvoie 0 si écrit.
write_if_changed() {
  local dest="$1" tmp
  tmp="$(mktemp)"
  cat > "$tmp"
  if [ ! -s "$tmp" ]; then
    rm -f "$tmp"
    echo "write_if_changed: contenu vide pour $dest, rien d'écrit" >&2
    return 2
  fi
  if [ -f "$dest" ] && cmp -s "$tmp" "$dest"; then
    rm -f "$tmp"
    return 1
  fi
  install -m "${2:-0644}" "$tmp" "$dest"
  rm -f "$tmp"
  return 0
}

echo "==> 1/8 Système"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl ca-certificates ufw fail2ban unattended-upgrades apt-listchanges \
  htop iptables jq cron
# Mises à jour de sécurité automatiques (sans redémarrage automatique).
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
timedatectl set-timezone Europe/Paris || true

echo "==> 2/8 Pare-feu (ufw, déclaratif)"
# Pas de `ufw --force reset` : on vérifie chaque règle attendue et on n'ajoute que ce
# qui manque (`ufw allow` est idempotent : « Skipping adding existing rule »). Pour
# repartir de zéro volontairement : `ufw --force reset` à la main, puis relancer.
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP Traefik' >/dev/null
ufw allow 443/tcp comment 'HTTPS Traefik' >/dev/null
# Port 3000 (interface Dokploy) : plus jamais ouvert — on retire une éventuelle règle
# posée par une version précédente de ce script (par numéro, en ordre décroissant).
while read -r num; do
  [ -n "$num" ] && ufw --force delete "$num" >/dev/null
done < <(ufw status numbered | grep -E '^\[ *[0-9]+\] +3000/tcp' | sed -E 's/^\[ *([0-9]+)\].*/\1/' | sort -rn)
ufw --force enable >/dev/null
ufw status | sed 's/^/    /'

echo "==> 3/8 Swap"
if ! swapon --show | grep -q '/swapfile'; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
fi
grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
sysctl -q -p /etc/sysctl.d/99-swap.conf
free -h | sed 's/^/    /'

echo "==> 4/8 fail2ban (SSH)"
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban >/dev/null 2>&1 || true

echo "==> 5/8 sshd (authentification par clé uniquement)"
# Garde-fou : on ne coupe les mots de passe que si au moins une clé publique est
# autorisée quelque part (root ou un utilisateur de /home), sinon on s'enfermerait dehors.
has_authorized_key=0
for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do
  if [ -f "$f" ] && grep -qE '^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-|sk-)' "$f"; then
    has_authorized_key=1
    break
  fi
done
if [ "$has_authorized_key" -eq 1 ]; then
  mkdir -p /etc/ssh/sshd_config.d
  # Nommé 00-… et non 99-… : sshd garde la PREMIÈRE valeur rencontrée pour chaque
  # mot-clé, et `Include sshd_config.d/*.conf` lit les fichiers par ordre lexical ;
  # un 99-… serait dominé par 50-cloud-init.conf s'il posait les mêmes clés.
  sshd_changed=0
  if write_if_changed /etc/ssh/sshd_config.d/00-mijote.conf <<'EOF'
# Posé par scripts/vps/bootstrap.sh (repo atable) : clé SSH uniquement.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  then sshd_changed=1; fi
  if sshd -t; then
    if [ "$sshd_changed" -eq 1 ]; then
      systemctl reload ssh 2>/dev/null || systemctl reload sshd
    fi
    # Valeurs effectives (détecte une directive plus prioritaire ailleurs).
    sshd -T 2>/dev/null | grep -iE '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin) ' | sed 's/^/    /'
  else
    rm -f /etc/ssh/sshd_config.d/00-mijote.conf
    warn "sshd -t a échoué : drop-in retiré, configuration inchangée"
  fi
else
  warn "aucune clé dans authorized_keys : durcissement sshd SAUTÉ (déposer une clé puis relancer)"
fi

echo "==> 6/8 Docker (logs, DOCKER-USER, purge)"
# 6a. Rotation des logs des conteneurs. Fusion prudente : les clés existantes de
# daemon.json sont conservées, on ne pose que les nôtres. Docker (installé ensuite
# par Dokploy) lit ce fichier au démarrage ; il ne s'applique qu'aux conteneurs créés
# après (Dokploy recrée les siens à chaque déploiement).
mkdir -p /etc/docker
current='{}'
if [ -s /etc/docker/daemon.json ]; then
  if ! current="$(jq -c . /etc/docker/daemon.json)"; then
    echo "/etc/docker/daemon.json n'est pas un JSON valide : corriger à la main" >&2
    exit 1
  fi
fi
if jq -n --argjson cur "$current" \
    '$cur * {"log-driver":"json-file","log-opts":{"max-size":"20m","max-file":"5"}}' \
    | write_if_changed /etc/docker/daemon.json; then
  echo "    daemon.json mis à jour"
  if systemctl is-active --quiet docker; then
    if [ "$DOCKER_RESTART" = "1" ]; then
      systemctl restart docker
    else
      warn "Docker tourne : la nouvelle conf des logs s'appliquera au prochain redémarrage (ou DOCKER_RESTART=1)"
    fi
  fi
fi

# 6b. Port 3000 : Docker publie l'interface Dokploy sur 0.0.0.0:3000 et court-circuite
# ufw (chaîne FORWARD). La chaîne DOCKER-USER est le seul endroit que Docker respecte
# et ne vide jamais. REJECT (tcp-reset) et non DROP : avec DROP un navigateur qui garde
# l'ancienne adresse http://…:3000 charge indéfiniment. L'interface publique est
# détectée à chaque démarrage (route par défaut) pour ne pas figer « ens3 ».
# Le trafic local (tunnel SSH → 127.0.0.1:3000) et celui de Traefik (réseau Docker)
# ne passent pas par cette interface et restent permis.
cat > /usr/local/sbin/docker-user-firewall.sh <<'EOF'
#!/bin/sh
# Posé par scripts/vps/bootstrap.sh (repo atable). Idempotent (-C avant -I).
set -eu
iface="$(ip -o route get 1.1.1.1 2>/dev/null | sed -n 's/.*dev \([^ ]*\).*/\1/p')"
if [ -z "$iface" ]; then
  echo "docker-user-firewall: interface publique introuvable (pas de route par défaut)" >&2
  exit 1
fi
iptables -N DOCKER-USER 2>/dev/null || true
set -- -i "$iface" -p tcp -m conntrack --ctorigdstport 3000 -j REJECT --reject-with tcp-reset
if ! iptables -C DOCKER-USER "$@" 2>/dev/null; then
  iptables -I DOCKER-USER "$@"
fi
# Docker ajoute lui-même `-j RETURN` en fin de chaîne ; on le garantit si la chaîne
# a été créée ici avant Docker.
iptables -C DOCKER-USER -j RETURN 2>/dev/null || iptables -A DOCKER-USER -j RETURN
EOF
chmod 755 /usr/local/sbin/docker-user-firewall.sh
write_if_changed /etc/systemd/system/docker-user-firewall.service <<'EOF' || true
[Unit]
Description=Règle DOCKER-USER : rejette le port 3000 (Dokploy) depuis l'extérieur
# Après Docker (qui crée la chaîne et le saut FORWARD → DOCKER-USER) et relancé
# avec lui (PartOf) ; fonctionne aussi avant l'installation de Docker.
After=network-online.target docker.service
Wants=network-online.target
PartOf=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/docker-user-firewall.sh

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now docker-user-firewall.service >/dev/null
systemctl restart docker-user-firewall.service
iptables -S DOCKER-USER | sed 's/^/    /'

# 6c. Purge hebdomadaire des images (chaque déploiement en tire une nouvelle).
cat > /etc/cron.d/mijote-docker-prune <<'EOF'
# Posé par scripts/vps/bootstrap.sh (repo atable) : images de plus de 7 jours non utilisées.
0 4 * * 0 root command -v docker >/dev/null && docker image prune -af --filter until=168h >/dev/null 2>&1
EOF
chmod 644 /etc/cron.d/mijote-docker-prune

echo "==> 7/8 Crons demo-reset + app-store-sync + weekly-digest"
# Secret lu depuis un fichier root-only, jamais dans la crontab ni dans ce script.
install -d -m 700 /etc/mijote
if [ ! -f /etc/mijote/cron.env ]; then
  cat > /etc/mijote/cron.env <<'EOF'
# Posé par scripts/vps/bootstrap.sh (repo atable). Fichier root:root 600.
# CRON_SECRET : même valeur que la variable CRON_SECRET de l'application (Dokploy),
# celle que les routes /api/cron/* attendent en `Authorization: Bearer`.
CRON_SECRET=
EOF
  chmod 600 /etc/mijote/cron.env
  warn "/etc/mijote/cron.env créé avec un CRON_SECRET vide : le renseigner (le cron échouera en 401 tant qu'il est vide)"
fi
chown root:root /etc/mijote/cron.env
chmod 600 /etc/mijote/cron.env
if [ -n "$APP_HOST" ]; then
  # Heure UTC quelle que soit la zone du système (Europe/Paris ici) : le cron Debian
  # (3.0pl1) ne supporte pas `CRON_TZ`, donc la ligne tourne toutes les heures et ne
  # fait quelque chose qu'à 03 h UTC (`date -u`). Aligné sur le moniteur Sentry Crons
  # `demo-reset` (0 3 * * * UTC, marge 30 min), insensible aux changements d'heure.
  # `\%` : dans une crontab, `%` non échappé est un saut de ligne.
  cat > /etc/cron.d/mijote-demo-reset <<EOF
# Posé par scripts/vps/bootstrap.sh (repo atable). Reset quotidien du foyer démo à
# 03:00 UTC (moniteur Sentry Crons \`demo-reset\`, marge 30 min). Secret : /etc/mijote/cron.env.
0 * * * * root [ "\$(date -u +\%H)" = "03" ] || exit 0; set -a; . /etc/mijote/cron.env; set +a; curl -fsS -m 600 -H "Authorization: Bearer \$CRON_SECRET" "https://${APP_HOST}/api/cron/demo-reset" >/dev/null
EOF
  chmod 644 /etc/cron.d/mijote-demo-reset
  echo "    installé : https://${APP_HOST}/api/cron/demo-reset à 03:00 UTC"
  # Stats App Store (backlog #19) : Apple publie les données de J-1 dans la matinée,
  # d'où 10:00 UTC (moniteur Sentry Crons `app-store-sync`, marge 30 min). Même secret.
  # Sans clé App Store Connect dans l'app (staging), la route répond 503 : inoffensif.
  cat > /etc/cron.d/mijote-app-store-sync <<EOF
# Posé par scripts/vps/bootstrap.sh (repo atable). Rapatriement quotidien des stats
# App Store à 10:00 UTC (moniteur Sentry Crons \`app-store-sync\`). Secret : /etc/mijote/cron.env.
0 * * * * root [ "\$(date -u +\%H)" = "10" ] || exit 0; set -a; . /etc/mijote/cron.env; set +a; curl -fsS -m 600 -H "Authorization: Bearer \$CRON_SECRET" "https://${APP_HOST}/api/cron/app-store-sync" >/dev/null
EOF
  chmod 644 /etc/cron.d/mijote-app-store-sync
  echo "    installé : https://${APP_HOST}/api/cron/app-store-sync à 10:00 UTC"
  # Digest hebdo du dashboard (stats v3 §4.9) : lundi 07:00 heure de Paris — ici
  # l'heure LOCALE du système (Europe/Paris) est voulue, pas d'astuce `date -u`.
  # Idempotent par semaine ISO côté route : un second passage ne renvoie rien.
  cat > /etc/cron.d/mijote-weekly-digest <<EOF
# Posé par scripts/vps/bootstrap.sh (repo atable). Digest hebdo du dashboard, lundi
# 07:00 heure de Paris (fuseau système). Secret : /etc/mijote/cron.env.
0 7 * * 1 root set -a; . /etc/mijote/cron.env; set +a; curl -fsS -m 300 -H "Authorization: Bearer \$CRON_SECRET" "https://${APP_HOST}/api/cron/weekly-digest" >/dev/null
EOF
  chmod 644 /etc/cron.d/mijote-weekly-digest
  echo "    installé : https://${APP_HOST}/api/cron/weekly-digest le lundi à 07:00 (Paris)"
else
  echo "    APP_HOST non fourni : crontab demo-reset non installée (relancer avec APP_HOST=<hôte>)"
fi

echo "==> 8/8 Dokploy"
# Dokploy tourne en service Swarm : le conteneur s'appelle `dokploy.1.<id>`.
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qE '^dokploy(\.[0-9]+\.|$)'; then
  echo "    déjà installé, on ne relance pas le script Dokploy"
else
  # Installeur épinglé : on ne pipe jamais un script distant dans sh sans l'avoir lu.
  installer=/tmp/dokploy-install.sh
  curl -fsSL https://dokploy.com/install.sh -o "$installer"
  actual="$(sha256sum "$installer" | awk '{print $1}')"
  if [ -z "$DOKPLOY_INSTALL_SHA256" ]; then
    echo
    echo "    Installeur téléchargé dans $installer, sha256 : $actual"
    echo "    Le lire, puis relancer : sudo DOKPLOY_INSTALL_SHA256=$actual bash $0"
    echo "    (tout ce qui précède est en place ; seule l'installation de Dokploy reste)"
    exit 1
  fi
  if [ "$actual" != "$DOKPLOY_INSTALL_SHA256" ]; then
    echo "    sha256 de l'installeur Dokploy inattendu : $actual (attendu $DOKPLOY_INSTALL_SHA256)" >&2
    echo "    L'installeur a changé : le relire avant de fournir la nouvelle empreinte." >&2
    exit 1
  fi
  sh "$installer"
  # Docker vient d'être installé : la chaîne DOCKER-USER existe désormais, on repose la règle.
  systemctl restart docker-user-firewall.service
fi

echo
echo "==> Terminé."
echo "    Interface Dokploy (jamais exposée sur :3000) :"
echo "      - avant domaine : ssh -L 3000:127.0.0.1:3000 mijote-vps  →  http://localhost:3000"
echo "      - ensuite       : https://dokploy.<domaine> (Settings → Server → domaine + Let's Encrypt)"
echo "    (créer le compte admin dès maintenant : la première visite définit l'administrateur)"
