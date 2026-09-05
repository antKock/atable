# Plan de migration infra — Vercel → VPS OVH + Dokploy

> **Statut : en cours** (décidé le 2026-09-05, lancé le 2026-09-06 — prérequis repo faits et
> vérifiés, VPS à commander). En cas d'écart
> doc ↔ code réel, **le code fait foi**. Le pendant PM (contexte, historique) vit dans le
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
| Cron demo-reset | `vercel.json` | crontab système ou cron Dokploy → `GET /api/cron/demo-reset` avec `CRON_SECRET` | 0 |
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
      aucun autre secret dans l'image ni dans les logs du workflow. Rendre le paquet GHCR
      privé (500 MB de stockage privé gratuit, garder 2-3 tags).
- [x] Vérifier ce qui dépend de Vercel : `after()` fonctionne en Node standalone ; image
      OpenGraph en `runtime nodejs` ; `VERCEL_ENV` utilisé par Sentry (`environment`) → le
      remplacer par `SENTRY_ENVIRONMENT` ; `x-forwarded-for` pour les rate-limits par IP
      (Traefik le pose) ; taille max du body (4,5 MB chez Vercel → à configurer côté
      Traefik / Next).
- [ ] Reprendre `vercel.json` : la région n'a plus d'objet, le cron passe en crontab.
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

## Jour J (runbook, ~1 journée, pilotable depuis Claude Code)

1. **Commander le VPS-1** (API OVH ou espace client), Debian/Ubuntu LTS, clé SSH déposée à
   la création, région Gravelines ou Strasbourg.
2. **Préparer la machine** (SSH) : mises à jour, `ufw` (22/80/443), **swap 2-4 GB**
   (`fallocate` + `mkswap` + `swapon` + `fstab`, `vm.swappiness=10`) : filet contre l'OOM
   même sans build sur place.
3. **Installer Dokploy** (script officiel, installe Docker + Traefik). Créer le jeton API →
   `.env.local` du repo (`DOKPLOY_URL`, `DOKPLOY_TOKEN`), jamais commité.
4. **Créer deux applications** Dokploy (prod, staging) depuis l'image GHCR, coller les
   variables d'environnement, domaines temporaires (`prod-vps.…`, `staging-vps.…`) pour
   tester **sans toucher au DNS de prod**.
5. **Vérifier sur le domaine temporaire** : session, imports URL / Instagram / photo / voix,
   enrichissement (`after()`), partage `/r/`, image OG, `/api/version`,
   `/api/cron/demo-reset` avec le secret, réception d'une erreur test par Sentry,
   rate-limits (l'app voit bien l'IP réelle).
6. **Cron** : `0 3 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET"
   https://<domaine>/api/cron/demo-reset` (ou cron Dokploy). Retirer le cron de
   `vercel.json`.
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
