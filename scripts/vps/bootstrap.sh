#!/usr/bin/env bash
# Préparation d'un VPS OVH neuf (Debian 12/13) pour héberger Mijote avec Dokploy.
# Voir docs/infra/migration-vps-ovh.md (runbook, étapes 2 et 3).
#
# Idempotent : peut être relancé sans casser ce qui est déjà en place.
# À exécuter en root sur la machine :
#   scp scripts/vps/bootstrap.sh mijote-vps:/tmp/ && ssh mijote-vps 'sudo bash /tmp/bootstrap.sh'
#
# Ce que ça fait :
#   1. mises à jour système + mises à jour de sécurité automatiques
#   2. pare-feu ufw : 22 (SSH), 80/443 (Traefik), 3000 (interface Dokploy,
#      à fermer une fois un domaine HTTPS configuré pour Dokploy)
#   3. swap 2 GB (filet contre l'OOM sur 4 GB de RAM), swappiness 10
#   4. fail2ban sur SSH
#   5. installation de Dokploy (installe Docker + Traefik + sa base + son Redis)

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "À lancer en root (sudo bash bootstrap.sh)" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> 1/5 Système"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl ca-certificates ufw fail2ban unattended-upgrades apt-listchanges htop
# Mises à jour de sécurité automatiques (sans redémarrage automatique).
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true
timedatectl set-timezone Europe/Paris || true

echo "==> 2/5 Pare-feu"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP Traefik' >/dev/null
ufw allow 443/tcp comment 'HTTPS Traefik' >/dev/null
ufw allow 3000/tcp comment 'Dokploy UI (temporaire)' >/dev/null
ufw --force enable >/dev/null
ufw status | sed 's/^/    /'

echo "==> 3/5 Swap"
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

echo "==> 4/5 fail2ban (SSH)"
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban >/dev/null 2>&1 || true

echo "==> 5/5 Dokploy"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^dokploy$'; then
  echo "    déjà installé, on ne relance pas le script Dokploy"
else
  curl -sSL https://dokploy.com/install.sh | sh
fi

echo
echo "==> Terminé."
echo "    Interface Dokploy : http://$(curl -s -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3000"
echo "    (créer le compte admin dès maintenant : la première visite définit l'administrateur)"
