# Plan de migration infra — Vercel → VPS OVH + Dokploy

> **Statut : en cours** (décidé le 2026-09-05, lancé le 2026-09-06 — VPS prêt, Dokploy en
> HTTPS, **staging et prod déployés et validés sur le VPS, auto-déploiement des deux
> branches** ; reste la période d'observation, le cron et la bascule DNS). Revue infra du
> 2026-09-06 intégrée : `bootstrap.sh` reproduit l'état réel du serveur (règle DOCKER-USER,
> sshd, logs Docker, cron), workflow durci (actions épinglées, `checks` bloquant,
> vérification post-déploiement). En cas d'écart doc ↔ code réel, **le code fait foi**. Le pendant PM (contexte, historique) vit dans le
> vault Obsidian d'Anthony (`Perso/Mijote/Plan migration infra (VPS OVH).md`, backlog #18).

## Pourquoi (déclencheur)

- Vercel Hobby plafonne à **4 h de CPU actif / mois** pour tout le compte (tous projets et
  previews confondus). Au 2026-09-05 : **1 h 11 / 30 j** (25 %), dont ~35 min pour Mijote
  prod ; le reste vient du staging et des autres projets du compte.
- Profil mesuré (Observability Vercel) : la facture est un **forfait par requête** (~30 ms de
  CPU plancher, même pour `/api/version` qui renvoie une constante), pas du calcul lourd. Le
  volume d'invocations pilote le coût. Le middleware n'apparaît pas comme fonction facturée.
- Extrapolation : Hobby tient jusqu'à **~×4-5 d'audience**. Au-delà : Pro (20 $/mois) ou
  migration.
- Hobby est réservé à un usage **non commercial** : toute option payante dans l'app impose
  Pro ou la migration.
- Cible retenue : **VPS OVH + Dokploy**, budget plat ~5 €/mois.

## Cible

| Brique | Aujourd'hui | Cible | Coût |
|---|---|---|---|
| App Next.js (prod + staging) | Vercel | **OVH VPS-1** (2 vCores, 4 GB, 40 GB NVMe, sauvegarde quotidienne, anti-DDoS) + **Dokploy** | 4,57 € TTC/mois (VPS-2 à 8,65 € si build sur place ou ×50) |
| Build | Vercel | **GitHub Actions** (repo public → minutes illimitées) → image Docker sur **GHCR** (gratuit) → le VPS tire l'image | 0 |
| Base Postgres | Supabase free (projet prod dédié, eu-west-1) | **Inchangée en phase 1**. Phase 2 optionnelle : Postgres + PostgREST en conteneurs sur le VPS (code quasi inchangé, latence < 1 ms, sauvegardes Dokploy → Object Storage) | 0 |
| Images (Storage) | Supabase Storage (254 MB / 1 GB free, egress 5 GB/mois) | Hors périmètre de ce plan. Options : OVH Object Storage S3 (~0,007 €/GB, egress gratuit) ou Cloudflare R2 (10 GB gratuits) | ~0 |
| Redis | Upstash free (500 K commandes/mois, sature vers ×6) | Upstash tant que ça tient, puis conteneur Redis via Dokploy | 0 |
| Cron demo-reset | `vercel.json` | crontab système posée par `bootstrap.sh` (`/etc/cron.d/mijote-demo-reset`, 03:00 UTC via garde `date -u` horaire, secret dans `/etc/mijote/cron.env`) → `GET /api/cron/demo-reset` avec `CRON_SECRET` — cf. « Cron demo-reset » | 0 |
| HTTPS / proxy | Vercel | Traefik (inclus dans Dokploy), Let's Encrypt automatique | 0 |
| Erreurs | Sentry | Sentry (inchangé) | 0 |
| Dispo / logs | Dashboard Vercel | Dokploy (logs, métriques, historique des déploiements) ; option Uptime Kuma pour les alertes | 0 |

Pourquoi Dokploy et pas Coolify : même idée (PaaS auto-hébergé avec interface web), mais
**~700 MB** de RAM contre 1 à 1,5 GB. Le tableau de bord sert au suivi ; les manipulations
se font par SSH et par l'API Dokploy.

## Prérequis dans le repo (à faire avant le jour J, sans risque pour Vercel)

- [x] `next.config` : `output: 'standalone'` (image ~200 MB).
- [x] `Dockerfile` multi-stage (deps → build → runner `node:22-alpine`, utilisateur non-root,
      `HOSTNAME=0.0.0.0`).
- [x] Workflow `.github/workflows/deploy.yml` : sur push `main` et `staging` → build de
      l'image → push `ghcr.io/antkock/atable:<branche>-<sha>` → appel API Dokploy (ou SSH)
      pour redéployer. **Repo public** : seuls les `NEXT_PUBLIC_*` passent en `build-arg` ;
      aucun autre secret dans l'image ni dans les logs du workflow. Le paquet GHCR est
      **public** (décision 2026-09-06 : l'image ne contient aucun secret, et un paquet public
      se tire sans identifiant depuis Dokploy). Premier run réussi le 2026-09-06 :
      `ghcr.io/antkock/atable:staging` (amd64, 86 MB compressés).
- [x] Vérifier ce qui dépend de Vercel : `after()` fonctionne en Node standalone ; image
      OpenGraph en `runtime nodejs` ; `VERCEL_ENV` utilisé par Sentry (`environment`) → le
      remplacer par `SENTRY_ENVIRONMENT` ; `x-forwarded-for` pour les rate-limits par IP
      (Traefik le pose) ; taille max du body (4,5 MB chez Vercel) : **côté app**, garde sur
      `content-length` → 413 (`src/lib/body-limit.ts`, branchée dans `withOwnerAuth`), donc
      plus de dépendance au plafond Vercel ; **côté Traefik, posé le 2026-09-06** sur prod et
      staging via l'API (`application.readTraefikConfig` / `application.updateTraefikConfig`,
      fichier dynamique par app) : middleware `<app>-body-limit` `buffering`
      (`maxRequestBodyBytes: 26214400`, 25 Mo, au-dessus des imports voix ~10 Mo ;
      `memRequestBodyBytes: 1048576`) attaché au routeur websecure (`<app>` = nom du service
      Dokploy, ex. `mijote-prod-9nkv9s`). Vérifié : un corps réel de 30 Mo → 413 Traefik.
      À reposer si Dokploy régénère le fichier (changement de domaine à la bascule DNS).
      Sans ce middleware, Traefik transmet le body en streaming et
      seule la garde applicative s'applique — acceptable, mais le body est alors lu jusqu'au
      413.
- [ ] Reprendre `vercel.json` : la région n'a plus d'objet ; le cron **reste tant que le
      projet Vercel existe** (il tourne sur la même base que la crontab du VPS : deux appels
      par nuit, idempotents) → à retirer **dans la PR de bascule DNS, pas avant**.
- [ ] Liste exhaustive des variables d'environnement par scope (`vercel env pull` prod +
      preview) → à recopier dans Dokploy.

## Vérifié le 2026-09-06 (build local)

Image construite et testée sur le poste (`docker buildx build`, env staging) : 353 MB,
conteneur `healthy`, landing et pages publiques en 200, middleware OK (`/home` → 307 sans
session), session démo créée en base staging, `/api/carousels` et `/api/library` en 200,
`/api/version` renvoie le SHA git, AASA et image OpenGraph servis. **73 MB de RAM au repos**
(estimation initiale : 250 MB).

Pièges rencontrés, déjà corrigés dans le repo :

- Le montage de secret BuildKit exige `docker buildx` (sur le poste : `brew install
  docker-buildx` + lien dans `~/.docker/cli-plugins`). Sur GitHub Actions, buildx est natif.
- `src/lib/email/send.ts` importe un helper de `e2e/` → le dossier `e2e/` doit rester dans le
  contexte Docker (ne pas l'exclure dans `.dockerignore`).
- Le client OpenAI s'instanciait au chargement du module et faisait échouer `next build`
  sans clé (« collecting page data »). Il est désormais instancié à la première utilisation
  (`src/lib/openai.ts`, Proxy) : **aucun secret n'est nécessaire au build**.
- `docker run --env-file` ne retire pas les guillemets : les fichiers `.env.*.local` sont
  quotés, il faut les nettoyer avant de les passer à un conteneur (Dokploy n'a pas ce
  problème, les variables y sont saisies sans guillemets).
- Le SHA git est passé en `GIT_COMMIT_SHA` au build ; `next.config.ts` le prend en relais de
  `VERCEL_GIT_COMMIT_SHA` pour `NEXT_PUBLIC_BUILD_ID`.

Outil : `scripts/ovh.mjs <METHOD> <path> [json]` appelle l'API OVH signée avec les clés de
`.env.local` (droits restreints : `/me`, `/vps/*`, `/domain/zone/anthonykocken.fr/*`).

GitHub : environnements `staging` et `production` créés, variables `NEXT_PUBLIC_SUPABASE_URL`
et `NEXT_PUBLIC_SENTRY_DSN` posées (valeurs publiques). Secrets par environnement :
`DOKPLOY_URL`, `DOKPLOY_TOKEN`, `DOKPLOY_APP_ID` (posés le 2026-09-06 ; les applications
créées depuis une image n'ont pas de webhook, le workflow appelle `application.deploy`).
Variable optionnelle `APP_URL` (origine publique de l'app) : active la vérification
post-déploiement du workflow (cf. « Sécurité du déploiement »). Clé SSH du VPS générée sur
le poste : `~/.ssh/mijote_vps` (clé publique à déposer à la commande du VPS).

## État du serveur (2026-09-06)

- **VPS** : `vps-64df9538.vps.ovh.net`, VPS-1 2027 (2 vCores, 4 GB, 40 GB NVMe), Gravelines
  (os-gra6), Debian 13, IPv4 `217.182.206.61`. Accès : `ssh mijote-vps` (entrée dans
  `~/.ssh/config`, utilisateur `debian`, sudo sans mot de passe, clé `~/.ssh/mijote_vps`).
- **Piège à la commande** : la clé SSH saisie sur le bon de commande n'a pas été installée
  (aucun utilisateur n'acceptait la clé). Corrigé par une **réinstallation via l'API**
  (`POST /vps/{name}/rebuild` avec `imageId` Debian 13 + `publicSshKey` +
  `doNotSendPassword`), refusée tant que la tâche `deliverVm` tourne, ~3 min ensuite.
- **Préparation** : `scripts/vps/bootstrap.sh` exécuté (mises à jour, ufw 22/80/443,
  swap 2 GB, fail2ban, Dokploy v0.30.5). Au repos après installation : ~1,4 GB de RAM
  utilisés. La version du 2026-09-06 du script ajoute (à **rejouer sur le serveur** pour
  aligner l'hôte, cf. « État hors repo ») : règle DOCKER-USER en unité systemd, sshd par
  clé uniquement, rotation des logs Docker, purge hebdo des images, crontab demo-reset,
  installeur Dokploy épinglé par sha256. Le port 3000 n'est plus ouvert dans ufw (une règle
  héritée est retirée au relancement).
- **DNS temporaires** (A, TTL 300, créés via `scripts/ovh.mjs`) : `staging-vps.mijote`,
  `prod-vps.mijote`, `dokploy.mijote` → `217.182.206.61`. Les CNAME `mijote` et
  `staging.mijote` pointent toujours vers Vercel.
- **Dokploy** : `https://dokploy.mijote.anthonykocken.fr` (domaine + Let's Encrypt posés via
  `settings.assignDomainServer` ; compte admin créé par Anthony à la première visite ; jeton
  API dans `.env.local` : `DOKPLOY_URL`, `DOKPLOY_TOKEN`). Outil : `scripts/dokploy.mjs
  <GET|POST> <procédure> [json]` ; le document OpenAPI est servi par
  `GET settings.getOpenApiDocument` (pas `/api/openapi.json`).
- **Port 3000** : Docker contourne ufw pour les ports publiés, donc la règle ufw ne suffit
  pas. Bloqué par une règle `DOCKER-USER` (`iptables -I DOCKER-USER -i <iface> -p tcp -m
  conntrack --ctorigdstport 3000 -j REJECT --reject-with tcp-reset`), rendue persistante
  par l'unité systemd `docker-user-firewall.service` (`After=docker.service`,
  `PartOf=docker.service` : re-posée à chaque redémarrage de Docker). Posée à la main le
  2026-09-06 avec `-i ens3` ; `bootstrap.sh` la reproduit désormais en détectant l'interface
  publique à chaque démarrage (`ip route get 1.1.1.1`, script
  `/usr/local/sbin/docker-user-firewall.sh`) pour ne pas figer `ens3`. **REJECT et non
  DROP** : avec DROP, un navigateur qui garde l'ancienne adresse `http://…:3000` charge
  indéfiniment puis plante (vécu le 2026-09-06) ; avec REJECT il échoue immédiatement.
  L'interface n'est joignable qu'en HTTPS, sans port : `https://dokploy.mijote.anthonykocken.fr`
  — ou, avant qu'un domaine soit posé (ou si Traefik est en panne), par tunnel SSH :
  `ssh -L 3000:127.0.0.1:3000 mijote-vps` puis `http://localhost:3000` (le trafic local
  ne traverse pas la règle).
- **Application staging** (projet Dokploy « Mijote », environnement `production`, id
  `q6amHZ0Z755R83fMCJ77_`) : source Docker `ghcr.io/antkock/atable:staging`, variables
  recopiées depuis le scope preview de Vercel (`vercel env pull`, sans `VERCEL_*`/`TURBO_*`)
  + `SENTRY_ENVIRONMENT=staging` + `I18N_PREVIEW_COOKIE=1`, domaine
  `https://staging-vps.mijote.anthonykocken.fr` (port interne 3000, Let's Encrypt).
  **Validé le 2026-09-06** : pages publiques, middleware, session démo (cookie `Secure` +
  `HttpOnly`), carrousels, bibliothèque, AASA, assetlinks, image OG, manifest, `?lang=en` ;
  conteneur `healthy`, ~110 MB de RAM ; ~1,8 GB utilisés sur le serveur au total.
- **Auto-déploiement vérifié** : push sur `staging` → GitHub Actions construit l'image →
  `POST /api/application.deploy` (secrets GitHub `DOKPLOY_URL`, `DOKPLOY_TOKEN`,
  `DOKPLOY_APP_ID` de l'environnement `staging`) → Dokploy tire le tag et redémarre.
- **Application prod** (id `ljbUvq7lNn0TeTeIYBv6g`) : créée le 2026-09-06 après la promotion
  `staging` → `main` (PR #114, `26b8646`) qui a produit l'image `ghcr.io/antkock/atable:main`.
  Variables du scope production de Vercel + `SENTRY_ENVIRONMENT=production`, domaine
  `https://prod-vps.mijote.anthonykocken.fr` (Let's Encrypt). **Validée contre la base prod** :
  `/api/version` = SHA de `main`, pages publiques, middleware, session démo, `/home`,
  carrousels, AASA, image OG, manifest. Secrets GitHub de l'environnement `production`
  posés (auto-déploiement à chaque push sur `main`). Le cron demo-reset reste sur Vercel
  jusqu'à la bascule DNS (cf. « Cron demo-reset »).

### Variables obligatoires (Dokploy, prod ET staging, avant bascule)

À vérifier dans l'UI Dokploy (Environment) sur les deux applications — celles-ci ne sont
pas toutes dans l'export `vercel env pull` :

| Variable | Valeur | Pourquoi |
|---|---|---|
| `I18N_EN_ENABLED` | `1` | Version EN en service (langue = appareil). Sans elle, tout est en FR |
| `DEMO_HOUSEHOLD_ID_EN` | id du foyer démo EN | Démo EN et reset du foyer EN par le cron |
| `APP_ORIGIN` | `https://mijote.anthonykocken.fr` (staging : `https://staging.mijote.anthonykocken.fr`) | Origine canonique des liens absolus (magic links, partage, Open Graph) ; coupe court aux en-têtes du proxy. **Sur les domaines temporaires, mettre l'origine temporaire**, puis la vraie dans la PR de bascule |
| `CRON_SECRET` | même valeur que `/etc/mijote/cron.env` sur le VPS (et que Vercel tant qu'il existe) | **Obligatoire** : sans elle, `/api/cron/demo-reset` refuse tout appel |
| `SENTRY_ENVIRONMENT` | `production` / `staging` | `VERCEL_ENV` n'existe plus |
| `DEMO_SEED_MIN` | optionnelle (défaut 30) | Seuil d'alerte Sentry sur les recettes seed ; valeur illisible ⇒ 30 + warn dans les logs (avant : alerte désactivée en silence) |

Contrôle après déploiement (langue suit l'appareil) :

```sh
curl -sH "Accept-Language: en-US" https://<host>/ | grep -o 'lang="[a-z]*"'   # → lang="en"
curl -s https://<host>/ | grep -o 'lang="[a-z]*"'                              # → lang="fr"
```
- **Alerte « Dokploy tombé »** (2026-09-06, ~07:00) : fausse alerte. Dokploy et Traefik
  n'ont pas redémarré (6 h d'uptime, 0 restart), aucun OOM, swap inutilisé. Le premier
  déploiement prod avait lieu à cet instant : `prod-vps` répondait 502 le temps du démarrage
  du conteneur, et le tirage/extraction de l'image (2 vCores) peut ralentir l'interface
  quelques dizaines de secondes. fail2ban ne concerne que SSH (35 bans en 6 h, bruit
  Internet normal).

## Bilan de risque Vercel → VPS (2026-09-06, vérifié sur les domaines temporaires)

| Point | Résultat |
|---|---|
| Origine des liens absolus (magic links, partage) | **Bug** : `request.nextUrl.origin` vaut `https://0.0.0.0:3000` derrière Traefik. Corrigé par `src/lib/request-origin.ts` (`x-forwarded-proto` / `x-forwarded-host`, repli `host`), utilisé par `/api/recovery/request`, `/api/owner/email`, `/api/recipes/[id]/share`. Vérifié sur staging-vps |
| Redirections construites avec `request.url` dans les routes API (`/api/auth/session` DELETE, `/api/auth/session/clear`) | **Bug** (même cause) : déconnexion renvoyée vers `0.0.0.0`. Corrigé avec `getRequestOrigin`. Les redirections du middleware, elles, étaient correctes (Next y applique les en-têtes transmis) |
| **Garde-fou centralisé** | Règle ESLint (`no-restricted-syntax`, `src/**`) : `nextUrl.origin` et `new URL(chemin, request.url)` sont interdits hors `src/lib/request-origin.ts` ; la CI refuse toute réintroduction. Le middleware utilise aussi `getRequestOrigin` par cohérence |
| IP client pour les rate-limits | OK : Traefik pose `x-forwarded-for` (mon IP limitée au 6e essai, l'IP du VPS non) |
| Cookies `Secure`/`HttpOnly`, HTTP→HTTPS (301), HSTS, gzip | OK |
| AASA, assetlinks, image OG, manifest, offline | OK |
| `after()` (enrichissement, mail de récupération) | Fonctionne en Node ; risque uniquement pendant un redéploiement. `stopGracePeriodSwarm` porté à **90 s** sur les deux apps (défaut Docker : 10 s) |
| Sentry | Source maps non envoyées (pas de `SENTRY_AUTH_TOKEN` dans GitHub) : traces minifiées pour les erreurs du VPS. À poser si besoin |
| Non testable depuis le poste | Imports Instagram / photo / capture / voix, Share Extension iOS → essais Anthony sur `prod-vps` avant la bascule |
| Mémoire | Le graphique OVH compte le cache : réel ~1,7 GB utilisés dont Dokploy ~840 MB ; les deux Mijote ~170 MB à elles deux |
| Timeouts Traefik | `readTimeout` par défaut 60 s sur l'entrypoint : un import voix de ~10 Mo depuis un mobile lent pouvait être coupé. **Posé le 2026-09-06** : `entryPoints.websecure.transport.respondingTimeouts.readTimeout: 180s` dans la config statique Traefik de Dokploy (`settings.updateTraefikConfig` + `settings.reloadTraefik`), vérifié après reload (prod-vps, staging-vps, dokploy en 200) |
| Taille max du body | Garde applicative `content-length` → 413 (`src/lib/body-limit.ts`, warning Sentry par route) ; middleware Traefik `buffering` (`maxRequestBodyBytes` 25 Mo, `memRequestBodyBytes` 1 Mo) **posé le 2026-09-06** sur les deux apps via `application.updateTraefikConfig` (fichier dynamique par app, attaché au routeur websecure) — à reposer si Dokploy régénère la config (changement de domaine) . Réponse 413 : `{ code: "BODY_TOO_LARGE", maxBytes }` (le front peut brancher dessus). Un corps `chunked` (sans `content-length`) échappe à la garde applicative : le middleware Traefik est la vraie borne |
| Rate limits par IP | `getClientIp()` (`src/lib/request-ip.ts`) lit `x-real-ip` posé par Traefik, puis le premier `x-forwarded-for`. Si un CDN est un jour posé devant Traefik, déclarer ses plages dans `entryPoints.web(secure).forwardedHeaders.trustedIPs`, sinon XFF forgeable ⇒ quotas contournables ou verrouillage global |

## Observation après bascule (capteurs et calendrier)

Capteurs en place (2026-09-06) :

- **Sentry** : tag `runtime` (`vps` posé par le Dockerfile, `vercel` sinon) sur les événements
  serveur, edge et client → filtre `runtime:vps` pour isoler ce qui vient du VPS. Moniteur
  **Crons** `demo-reset` (`Sentry.withMonitor`, crontab `0 3 * * *` UTC, marge 30 min) : alerte
  si le cron ne tourne pas ou dépasse 10 min. Source maps : ajouter le secret GitHub
  `SENTRY_AUTH_TOKEN` (environnements `staging` et `production`) pour des traces lisibles.
- **Traefik** : journal d'accès **des réponses 4xx/5xx uniquement** (JSON, stdout) → `sudo docker
  logs --since 24h dokploy-traefik | grep '"DownstreamStatus":5'` pour les 5xx.
- **Application** : `sudo docker service logs --since 24h mijote-prod-9nkv9s | grep -iE
  "error|unhandled"`.
- **Base** : requête « enrichissements bloqués » (recettes `pending`/`processing` créées il y a
  plus de 15 min) et répartition des statuts des recettes des dernières 24 h — script dans la
  conversation du 2026-09-06, à rejouer.
- **Dashboard** `/admin/stats` : pings DAU, coûts IA, funnel démo. Un trou = les clients
  n'atteignent plus l'API.
- **Externe (à activer par Anthony)** : un moniteur d'uptime hors du VPS (Sentry Uptime,
  UptimeRobot…) sur `/api/version` du vrai domaine après bascule.

Calendrier :

| Échéance | Vérifier |
|---|---|
| T+2 h | Sentry `runtime:vps` sans nouvelle issue ; pings DAU qui arrivent dans `/admin/stats` (preuve que les apps iOS/Android suivent le DNS) ; aucun 5xx Traefik |
| T+12 h | Enrichissements bloqués = 0 ; lignes `ai_costs` récentes (imports, images) ; mémoire et disque stables (`free -m`, `df -h`) |
| T+24 h | Le cron demo-reset a tourné à 03:00 UTC (check-in Sentry OK, `stats_daily` alimenté, 30 recettes seed présentes) ; DAU du jour comparable aux jours précédents ; un e-mail de récupération reçu avec un lien sur le bon domaine |
| T+48 h | Taux d'erreur Sentry vs semaine précédente ; certificats Let's Encrypt OK ; uptime 100 % ; puis retirer les domaines de Vercel (garder le projet) |

## Cron demo-reset

- **Sur le VPS** : `bootstrap.sh` (lancé avec `APP_HOST=<hôte>`) pose
  `/etc/cron.d/mijote-demo-reset` : une ligne horaire `0 * * * *` qui ne fait quelque
  chose qu'à 03 h UTC (`[ "$(date -u +%H)" = "03" ]`), puis `curl -fsS -H "Authorization:
  Bearer $CRON_SECRET" https://<APP_HOST>/api/cron/demo-reset`. Le cron Debian (3.0pl1) ne
  supporte pas `CRON_TZ` : cette garde donne 03:00 UTC quelle que soit la zone du système
  (Europe/Paris) et sans dérive aux changements d'heure, alignée sur le moniteur Sentry
  Crons `demo-reset` (03:00 UTC, marge 30 min). Le secret est lu depuis
  `/etc/mijote/cron.env` (root, 600), créé vide par le script : le renseigner, même valeur
  que `CRON_SECRET` de l'application Dokploy. **Fait le 2026-09-06** sur le VPS avec
  `APP_HOST=prod-vps.mijote.anthonykocken.fr` (secret identique à Vercel prod) : à
  relancer avec le domaine définitif dans la PR de bascule DNS. Sans `APP_HOST`, rien
  n'est installé.
- **Test manuel** : `sudo sh -c '. /etc/mijote/cron.env; curl -fsS -H "Authorization: Bearer
  $CRON_SECRET" https://<hôte>/api/cron/demo-reset'`.
- **Vercel** : le cron de `vercel.json` continue de tourner sur la **même base** tant que le
  projet Vercel existe (deux resets par nuit, idempotents : sans conséquence, mais deux
  check-ins Sentry). À retirer de `vercel.json` **dans la PR de bascule DNS**, pas avant :
  c'est le filet si la crontab du VPS ne tourne pas.

## Rollback par tag

Chaque déploiement publie deux tags : `ghcr.io/antkock/atable:<branche>` (mobile) et
`ghcr.io/antkock/atable:<branche>-<sha12>` (immuable). L'application Dokploy suit le tag
de branche ; pour revenir en arrière :

1. Retrouver le SHA du déploiement précédent : `gh run list --workflow "Deploy (Docker)"
   --branch main --limit 5` (colonne commit) ou `git log --oneline main -5`.
2. Dans Dokploy → application → **Provider** (Docker) : remplacer l'image par
   `ghcr.io/antkock/atable:main-<sha12>` (12 premiers caractères), enregistrer, **Deploy**.
   Par l'API (procédure et champ à confirmer dans `settings.getOpenApiDocument`) :
   `node scripts/dokploy.mjs POST application.update '{"applicationId":"…",
   "dockerImage":"ghcr.io/antkock/atable:main-<sha12>"}'` puis
   `node scripts/dokploy.mjs POST application.deploy '{"applicationId":"…"}'`.
3. Vérifier `curl -s https://<hôte>/api/version` → `{"buildId":"<sha complet>"}`.
4. Pour revenir au fil de l'eau : remettre `ghcr.io/antkock/atable:main`. Tant que l'app
   pointe sur un tag figé, **les pushes sur `main` ne la mettent plus à jour** (le workflow
   appelle `application.deploy`, qui retire le tag configuré).

Les images ne sont purgées sur le VPS qu'après 7 jours (`docker image prune --filter
until=168h`, hebdo) et jamais sur GHCR : le rollback reste possible à tout moment.

## Sécurité du déploiement

- **Actions épinglées par SHA** (`uses: owner/action@<sha> # vX.Y.Z`) dans `deploy.yml` et
  `ci.yml` : un tag peut être déplacé, pas un SHA. Mise à jour à la main :
  `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` (déréférencer via `git/tags/<sha>` si le
  tag est annoté).
- **Job `checks` bloquant** dans `deploy.yml` (lint, `tsc --noEmit`, vitest) : `build` a
  `needs: checks`, rien n'est publié si la CI échoue. `ci.yml` ne tourne plus que sur les
  pull requests (plus de double exécution sur `push`). ⚠ Si une branch protection de `main`
  exige le check « checks » du workflow « CI », la repointer sur « Deploy (Docker) / checks »
  ou la laisser sur les PR (à vérifier dans Settings → Branches, pas d'API utilisée ici).
- **Vérification post-déploiement** : si la variable d'environnement GitHub `APP_URL` est
  définie (ex. `https://prod-vps.mijote.anthonykocken.fr`, à passer sur le vrai domaine à
  la bascule), le workflow interroge `$APP_URL/api/version` toutes les 10 s pendant 5 min
  jusqu'à lire le `buildId` = SHA du commit, sinon le job échoue (déploiement resté sur
  l'ancienne image, conteneur qui ne démarre pas…).
- **Recommandé (manuel, UI GitHub)** : Settings → Environments → `production` → *Required
  reviewers* (Anthony) : tout déploiement sur `main` attend une approbation ; le job `build`
  (qui porte l'environnement) reste en attente, l'image n'est pas publiée avant.
- **Scripts locaux** : `scripts/ovh.mjs` et `scripts/dokploy.mjs` refusent les opérations
  destructives (rebuild/reinstall/terminate/reboot/DELETE ; `*.delete/remove/stop/reload/
  redeploy/cleanAll/saveEnvironment`) sans `--yes` (code de sortie 2).

## État hors repo (ce qui ne vit que sur l'hôte ou dans Dokploy)

| Élément | Où | Reproduit par `bootstrap.sh` ? |
|---|---|---|
| Règle DOCKER-USER port 3000 + unité `docker-user-firewall.service` | hôte | **Oui** (détection d'interface, idempotent) |
| ufw 22/80/443, swap 2 GB, fail2ban, unattended-upgrades | hôte | Oui |
| sshd clé uniquement (`/etc/ssh/sshd_config.d/00-mijote.conf`) | hôte | Oui (si une clé est autorisée ; `sshd -t` avant reload) |
| `/etc/docker/daemon.json` (json-file, 20m × 5) | hôte | Oui (fusion, redémarrage Docker seulement avec `DOCKER_RESTART=1`) |
| Purge hebdo des images (`/etc/cron.d/mijote-docker-prune`) | hôte | Oui |
| Crontab demo-reset + `/etc/mijote/cron.env` | hôte | Oui (fichier secret créé vide, **à renseigner**) |
| Dokploy (version, compte admin, domaine `dokploy.…`, Let's Encrypt) | hôte / Dokploy | Installation oui (sha256 exigé) ; compte, domaine et jeton API : **manuel** |
| Applications Dokploy (image, port 3000, domaines, `stopGracePeriodSwarm` 90 s) | Dokploy | **Non** — UI / API |
| Variables d'environnement des apps (cf. « Variables obligatoires ») | Dokploy | **Non** — UI / API |
| Labels Traefik (limite de body 25 Mo), timeouts Traefik | Dokploy | **Non** — UI, cf. prérequis / risques |
| Secrets et variables GitHub (`DOKPLOY_*`, `APP_URL`, `SENTRY_AUTH_TOKEN`) | GitHub | Non — UI / `gh secret set` |

## Jour J (runbook, ~1 journée, pilotable depuis Claude Code)

1. **Commander le VPS-1** (API OVH ou espace client), Debian/Ubuntu LTS, clé SSH déposée à
   la création, région Gravelines ou Strasbourg.
2. **Préparer la machine** : `scripts/vps/bootstrap.sh` (mises à jour, `ufw` 22/80/443,
   **swap 2 GB**, fail2ban, sshd par clé, Docker logs + règle DOCKER-USER, crontab avec
   `APP_HOST=<hôte>`). Sans `DOKPLOY_INSTALL_SHA256`, il s'arrête après avoir téléchargé
   l'installeur Dokploy et affiché son sha256.
3. **Installer Dokploy** : relire `/tmp/dokploy-install.sh`, relancer le script avec
   `DOKPLOY_INSTALL_SHA256=<empreinte>`. Créer le compte admin via tunnel SSH
   (`ssh -L 3000:127.0.0.1:3000 mijote-vps`), puis le jeton API → `.env.local` du repo
   (`DOKPLOY_URL`, `DOKPLOY_TOKEN`), jamais commité.
4. **Créer deux applications** Dokploy (prod, staging) depuis l'image GHCR, coller les
   variables d'environnement, domaines temporaires (`prod-vps.…`, `staging-vps.…`) pour
   tester **sans toucher au DNS de prod**.
5. **Vérifier sur le domaine temporaire** : session, imports URL / Instagram / photo / voix,
   enrichissement (`after()`), partage `/r/`, image OG, `/api/version`,
   `/api/cron/demo-reset` avec le secret, réception d'une erreur test par Sentry,
   rate-limits (l'app voit bien l'IP réelle).
6. **Cron** : crontab posée par `bootstrap.sh` (`APP_HOST`), secret dans
   `/etc/mijote/cron.env` — cf. « Cron demo-reset ». Retirer le cron de `vercel.json`
   dans la PR de bascule DNS.
7. **Bascule DNS** (API OVH, zone du domaine) : `mijote` et `staging.mijote` → IP du VPS
   (TTL abaissé à 300 s la veille). Let's Encrypt se déclenche dans Dokploy.
8. **Apps mobiles : rien à rebuild.** Les coquilles Capacitor chargent l'URL web ; tant que
   le domaine ne change pas, iOS et Android suivent instantanément. Vérifier quand même
   `/api/aasa` et `/api/assetlinks` derrière Traefik (Content-Type, pas de redirection).
9. **Retirer les domaines côté Vercel** après 24 h sans incident ; garder le projet Vercel
   quelques semaines (rollback = remettre les enregistrements DNS).
10. Mettre à jour la doc : ce fichier, `CLAUDE.md` (repères rapides), le vault (notes
    « Environnements & Déploiement », « Opérations & Pièges », « Historique & Décisions ») et
    la mémoire Claude Code.

## Phase 2 (optionnelle) — base sur le VPS

- Postgres + PostgREST en conteneurs Dokploy ; supabase-js pointe sur PostgREST (URL + JWT
  `service_role` signé avec le secret PostgREST). Migrations : `supabase db push --db-url …`.
  Les RPC (`demo_stats_rollup`, fonctions stats) sont exposées de la même manière.
- **Sauvegarde nocturne testée par une restauration réelle avant de couper Supabase.**
  Dokploy → dump planifié → Object Storage S3.
- Bénéfices : latence (l'aller-retour Paris ↔ Irlande disparaît), un seul fournisseur, plus
  de plafond d'egress API Supabase (5 GB/mois, à surveiller vers ×50 si on reste dessus).
- Coût : responsabilité des sauvegardes et des mises à jour de Postgres.

## Modèle de coûts (mesures du 2026-09-05, 30 jours de prod hors démo)

- Base : 36 owners actifs, 40 appareils, 259 recettes créées, 371 imports Instagram,
  172 images IA. Deux foyers font 50 % des créations.
- OpenAI app : **3,09 $ / 30 j** (image 1,89 · structuration Instagram 0,63 · OCR 0,34 ·
  métadonnées 0,11 · crawler 0,10). Le bench (`scripts/bench/`) ajoute ~2 $ hors app.
  **1,1 ct par image**, **1,2 ct par recette**, **~10 ct par owner actif et par mois**.
- Apify : 1,1 $ / 30 j (~0,3 ct par scrape) sur 5 $ de crédit gratuit, sans dépassement
  possible. Levier : récupérer la légende (`og:description`) **depuis le téléphone**
  (79 % des appareils actifs sont natifs) et garder Apify en repli. Testé 2/2 depuis une IP
  résidentielle (légendes complètes de 3 900 et 1 360 caractères). Audio et vidéo des reels :
  **abandonnés** (l'URL vidéo n'est pas dans le HTML, elle est chargée par GraphQL
  authentifié).
- Projection mensuelle sur VPS (1 $ = 0,92 €), hors licence Apple (99 €/an) :
  ×1 ≈ 8 € · ×5 ≈ 19,5 € · ×10 ≈ 33,5 € · ×50 ≈ 169 €. Règle : **un payeur à 2,99 €/mois
  finance ~20 utilisateurs gratuits**.

## Alternatives écartées (et pourquoi)

- **Vercel Pro (20 $)** : zéro effort, le crédit inclus couvre l'usage ; devient obligatoire
  en cas de monétisation sans migration. Reste la sortie de secours.
- **Cloudflare Workers + OpenNext (5 $)** : plan gratuit inutilisable (10 ms de CPU par
  requête, sous le plancher de 30 ms) ; inconnues de compatibilité Next 16 (Sentry,
  `after()`, image OG). À revalider sur une branche avant d'y aller.
- **Railway / Fly.io (~5 $ + usage)** : dashboard géré sans serveur, mais facture à l'usage.
- **Coolify** : trop lourd pour un VPS-1.
- **Postgres managé OVH** (Web Cloud 7,91 € ; Public Cloud ~15-20 €) : injustifié pour
  500 MB de données.

## Pièges connus

- Build Next.js = 2 à 3 GB de RAM : **ne pas builder sur le VPS-1** sans swap. Préférer
  GitHub Actions.
- Repo public : aucun secret en `build-arg`, logs de workflow lisibles par tous.
- `x-forwarded-for` : sans le header posé par Traefik, tous les rate-limits par IP voient la
  même adresse.
- Upstash free sature vers ×6 d'audience → Redis local.
- Supabase free se met en pause après 7 jours sans requête : le cron quotidien l'évite.
- Sentry : `VERCEL_ENV` disparaît → définir `SENTRY_ENVIRONMENT` explicitement.
- Stores : aucune action, le domaine ne change pas.

## Autonomie Claude Code

- **API OVH** (`api.ovh.com`, client Node officiel) : VPS (reboot, réinstallation,
  snapshots), zone DNS, Object Storage. Clé de consommateur à **restreindre** à `/vps/*` et
  `/domain/zone/*`.
- **SSH** vers le VPS : tout ce qui se passe dans la machine.
- **API Dokploy** : déploiements, logs, variables, sauvegardes.
- Jetons dans `.env.local` (gitignoré), comme pour App Store Connect.
