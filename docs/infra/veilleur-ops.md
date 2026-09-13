# Veilleur ops (backlog #27) — voir les erreurs silencieuses

Mis en place le 2026-09-13 après l'incident « déconnexion en 500 depuis le 06/09 » : Sentry ne
voit que le code Next ; tout ce qui casse devant (Traefik) ou par absence (cron, sauvegarde) était
invisible.

## Ce qui tourne

| Où | Quoi | Cadence | Sortie |
|---|---|---|---|
| VPS, `/usr/local/bin/mijote-watch tick` (`scripts/vps/watch.sh`) | logs Traefik depuis le dernier passage : réponses **5xx** (issue par hôte/méthode/chemin/statut), lignes **ERR** ; logs des conteneurs app : fail-open Redis, erreurs non capturées | toutes les 5 min | événements **Sentry** (`logger: mijote-watch`, tag `source: vps-watch`) → alerte e-mail ; total 5xx du jour → `POST /api/admin/watch` → `stats_daily.traefik_5xx` (047) |
| VPS, `mijote-watch daily` | `GET /api/admin/health` de prod et staging (voyants de la section Santé : pipeline, crons, démo, **sauvegarde S3**, **bord Traefik**), disque > 85 %, certificats TLS < 14 j | 06:15 UTC | événements Sentry, un par voyant rouge |
| App, `src/proxy.ts` | Redis injoignable → fail open (révocation ignorée) : `Sentry.captureException`, au plus 1/min par instance | à chaque occurrence | issue `proxy-redis-fail-open` |
| App, section Santé + digest du lundi | voyants « Sauvegarde » (dernière `mijote-backups` de l'env, max 26 h) et « Bord (Traefik) » (5xx hier + aujourd'hui, max 2) | à la lecture | `/admin/sante`, e-mail du lundi |

Seuils : `BACKUP_MAX_AGE_H` et `EDGE_5XX_MAX_24H` dans `src/lib/admin/v3/assemble.ts` — une seule
source de vérité, le veilleur ne fait que relayer `ok: false`.

## Installation / mise à jour

```
bash scripts/vps/install-watch.sh        # copie le script, pose /etc/cron.d/mijote-watch
ssh mijote-vps sudo nano /etc/mijote/watch.env   # SENTRY_DSN (= NEXT_PUBLIC_SENTRY_DSN), ADMIN_API_SECRET (prod), ADMIN_API_SECRET_STAGING
ssh mijote-vps sudo mijote-watch test    # un événement de test doit apparaître dans Sentry
```

État : `/var/lib/mijote-watch/` (curseur, compteurs du jour), journal `/var/log/mijote-watch.log`,
erreurs du script `/var/log/mijote-watch.err`.

## Ce que ça ne couvre pas

Une réponse **fausse sans erreur** (page 200 vide, 4xx là où on attend un 303) n'apparaît nulle
part : seule une sonde synthétique jouant les parcours l'attraperait. Elle écrit en prod, donc elle
attend #26 (sondes exclues des stats).
