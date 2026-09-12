# Migration base et photos — Supabase → VPS OVH (Postgres + PostgREST + Object Storage)

> **Statut : staging basculé le 2026-09-12** (voir « Journal »). Prod : pas encore, bascule
> sur décision d'Anthony (quelques minutes de gel des écritures). Suite du plan
> `docs/infra/migration-vps-ovh.md` (phase 2). En cas d'écart doc ↔ réel, **le code fait foi**.

## Pourquoi

- Gain financier nul (Supabase free), mais : latence base locale (< 1 ms au lieu d'allers-retours
  vers eu-west-1 à chaque requête), fin de l'auto-pause du projet staging, et surtout **des
  sauvegardes réelles** — le free tier Supabase n'en fournit aucune.
- Ce que Supabase portait réellement : Postgres attaqué **uniquement côté serveur** via
  PostgREST avec la clé service role (`from()` / `rpc()`), et le bucket Storage public
  `recipe-photos`. Pas d'Auth Supabase (sessions maison + magic links Resend), pas d'Edge
  Functions, pas de Realtime. Le harnais E2E tournait déjà sur un Supabase local.

## Cible

| Brique | Avant | Après |
|---|---|---|
| Base | Supabase (projet par env) | Service Dokploy **Postgres 17** par env (`mijote-staging-db`, `mijote-prod-db`), volume Docker, réseau interne |
| Accès base | supabase-js → PostgREST Supabase | **postgrest-js** (`src/lib/supabase/server.ts`) → service Dokploy **PostgREST v14** par env (`mijote-<env>-postgrest`, image `postgrest/postgrest:v14.18`), **sans domaine** : joignable seulement sur le réseau Docker `dokploy-network` |
| Auth PostgREST | clé service role Supabase | JWT `role: service_role` (HS256, exp 2036) signé avec `PGRST_JWT_SECRET` du service ; rôles Postgres de `scripts/vps/postgrest-roles.sql` |
| Photos | Supabase Storage (bucket public) | **OVH Object Storage S3**, région GRA, un bucket par env (`mijote-photos-staging`, `mijote-photos`), objets en **ACL `public-read`**, versioning activé ; `src/lib/storage/photos.ts` |
| Sauvegardes | aucune (free tier) | **Dokploy Backups** : `pg_dump -Fc` nocturne (02:30 UTC) vers le bucket **`mijote-backups`** (destination `ovh-mijote-backups`), 14 derniers conservés |
| Migrations | `supabase db push --linked` | `supabase db push --db-url postgres://…` **depuis le VPS** (la base n'est pas exposée) — cf. « Migrations » |

Variables d'environnement (app) : `DATABASE_REST_URL` + `DATABASE_REST_KEY` (base),
`S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` / `S3_PUBLIC_URL` / `S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY` (photos). Tant qu'elles sont absentes, le code retombe sur Supabase
(`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) : c'est ce qui permet de
basculer staging puis prod avec la même image. `env-check` vérifie les couples.

## Pièges vérifiés le 2026-09-12

- **OVH n'implémente pas les bucket policies** (`PutBucketPolicy` → `NotImplemented`) et
  l'ACL `public-read` **au niveau bucket n'ouvre que le listing**, pas les objets. Il faut
  l'ACL `public-read` **sur chaque objet** (upload, copie et script de migration le font).
  URL publique : `https://<bucket>.s3.gra.io.cloud.ovh.net/<clé>` (le style path
  `s3.gra…/<bucket>/<clé>` répond 400).
- **Un bucket par environnement** : les foyers et recettes démo ont des ids fixes identiques
  en staging et en prod (`00000000-…-e001`), donc les clés `generated/<id>/…` entreraient en
  collision dans un bucket partagé.
- **Dump depuis Supabase** : l'hôte direct `db.<ref>.supabase.co` est IPv6 seulement
  (injoignable depuis la VM Docker du Mac) → passer par le pooler IPv4
  `aws-1-eu-west-1.pooler.supabase.com:5432` avec l'utilisateur `<rôle>.<ref>`. Le CLI
  `supabase db dump` impose `SET ROLE postgres` (impossible avec un rôle non superuser) →
  `pg_dump` brut dans `docker run postgres:17-alpine`. Le mot de passe `postgres` n'est pas
  connu (le CLI utilise un rôle de connexion temporaire via l'API de management) → créer un
  rôle de lecture `mijote_dump` (BYPASSRLS + SELECT sur `public` et `supabase_migrations`)
  par `POST /v1/projects/<ref>/database/query` avec le jeton `sbp_` du trousseau (entrée
  « Supabase CLI », valeur préfixée `go-keyring-base64:`). **Supprimer ce rôle après la
  migration.**
- Le projet Supabase staging (Vibe-antKoc) est partagé avec d'autres essais : exclure les
  tables étrangères (`-T "public.pousse_*"`).
- Le dump contient `CREATE SCHEMA public` → remplacer par `IF NOT EXISTS` avant restauration.
- `pg_dump --no-privileges` : les GRANT/REVOKE Supabase (dont la 039) ne sont pas repris,
  c'est voulu — `postgrest-roles.sql` recrée un modèle minimal (service_role tout,
  anon/authenticated rien, EXECUTE retiré de PUBLIC par défaut).
- API Dokploy : `application.saveEnvironment` exige `buildArgs`, `buildSecrets`,
  `createEnvFile` ; `destination.create` veut `additionalFlags: []` ; `backup.create`
  répond `null` **mais crée** la planification (vérifier `postgres.one` → `backups` avant de
  rappeler, sinon doublon).
- `keepLatestCount` : rétention gérée par Dokploy, pas par une règle de cycle de vie S3.

## Runbook — basculer un environnement

Fait pour staging le 2026-09-12 ; à rejouer pour prod (`<env>` = `prod`, ref Supabase
`qqbzmxufewakkghzmghs`, `.env.local`).

1. **Postgres** : `POST postgres.create` (name `mijote-<env>-db`, db `mijote`, user `mijote`,
   mot de passe aléatoire, image `postgres:17-alpine`, env Dokploy « Mijote/production »),
   puis `postgres.deploy`. Noter l'`appName` généré (`mijote-<env>-db-xxxxxx`) : c'est
   l'hôte sur le réseau Docker.
2. **Dump Supabase** (rôle `mijote_dump` créé via l'API de management, cf. pièges) :
   ```sh
   docker run --rm -e PGURL="postgresql://mijote_dump.<ref>:<pw>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres" \
     postgres:17-alpine sh -c 'pg_dump "$PGURL" --schema-only --no-owner --no-privileges -n public -n supabase_migrations' > schema.sql
   # idem --data-only pour data.sql ; sed CREATE SCHEMA → IF NOT EXISTS
   ```
3. **Restauration** sur le VPS (`scp` puis `docker exec -i <conteneur> psql -U mijote -d mijote`) :
   schéma, données, puis `scripts/vps/postgrest-roles.sql` avec
   `-v authenticator_password='<aléatoire>'`. Contrôler les comptes (recipes, households,
   owners, `supabase_migrations.schema_migrations` = nombre de migrations du repo).
4. **PostgREST** : `application.create` (sourceType `docker`, name `mijote-<env>-postgrest`),
   `application.saveDockerProvider` (image `postgrest/postgrest:v14.18`),
   `application.saveEnvironment` avec `PGRST_DB_URI=postgres://authenticator:<pw>@<hôte db>:5432/mijote`,
   `PGRST_DB_SCHEMAS=public`, `PGRST_DB_ANON_ROLE=anon`, `PGRST_JWT_SECRET=<64 hex>`,
   `PGRST_SERVER_PORT=3000`, `PGRST_DB_POOL=10`, `PGRST_LOG_LEVEL=warn` ; `application.deploy`.
   **Aucun domaine.** Vérifier depuis le conteneur de l'app : sans JWT → 401, avec le JWT
   service_role → 200.
5. **JWT** : `{ role: "service_role", iss: "mijote", exp: 2036 }` signé HS256 avec
   `PGRST_JWT_SECRET` (snippet Node dans le journal). C'est `DATABASE_REST_KEY`.
6. **Photos** : créer le bucket (`CreateBucket` + versioning), puis
   `node scripts/migrate-photos-to-s3.mjs --env <fichier env>` (idempotent, `--dry-run`).
7. **Sauvegarde** : `backup.create` (schedule `30 2 * * *`, prefix `postgres/mijote-<env>`,
   destination `ovh-mijote-backups`, keepLatestCount 14), `backup.manualBackupPostgres`,
   vérifier l'objet `.sql.gz` (format custom, `pg_restore`).
8. **Gel + resynchronisation finale** (prod) : redéployer l'app avec `DATABASE_REST_*` et
   `S3_*` ; juste avant, re-dumper les données (étapes 2-3, `TRUNCATE` puis rechargement) et
   relancer le script photos pour rattraper les écritures intermédiaires.
9. **URLs en base** (sur la base cible, via `docker exec … psql`) :
   ```sql
   UPDATE recipes SET photo_url = replace(photo_url, '<supabase>/storage/v1/object/public/recipe-photos/', '<S3_PUBLIC_URL>/')
     WHERE photo_url LIKE '<supabase>/storage/v1/object/public/recipe-photos/%';
   -- idem generated_image_url
   ```
10. **Variables Dokploy de l'app** : ajouter `DATABASE_REST_URL=http://<appName postgrest>:3000`,
    `DATABASE_REST_KEY`, `S3_*` ; retirer `NEXT_PUBLIC_SUPABASE_URL` /
    `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` ; `application.deploy`.
    Contrôler : `/api/version`, Sentry `env-check` silencieux, une page recette avec image
    S3, un upload de photo, une recherche, `/admin/stats` (RPC).
11. **Après une semaine** : supprimer le rôle `mijote_dump` côté Supabase, puis le projet
    Supabase (Anthony).

## Migrations SQL après la bascule

La base n'est pas exposée hors du VPS. Depuis le poste :
```sh
ssh mijote-vps "sudo docker exec -i \$(sudo docker ps -q -f name=mijote-<env>-db) psql -U mijote -d mijote" < supabase/migrations/044_xxx.sql
```
puis insérer la ligne dans `supabase_migrations.schema_migrations` (version, name) pour
garder l'historique cohérent — ou installer le CLI Supabase sur le VPS et utiliser
`supabase db push --db-url postgres://mijote:<pw>@localhost:<port>/mijote` (port publié le
temps de l'opération via `externalPort`). Toujours **migration avant code** pour les ajouts,
**après** pour les suppressions (règle inchangée).

## Restaurer une sauvegarde

```sh
# télécharger l'objet .sql.gz depuis mijote-backups (S3), puis sur le VPS :
gunzip -c dump.sql.gz | sudo docker exec -i <conteneur db> pg_restore -U mijote -d mijote --clean --if-exists --no-owner
# puis rejouer scripts/vps/postgrest-roles.sql (les rôles sont au niveau cluster, pas dans le dump)
```

## Reste / dette

- Scripts d'exploitation encore sur supabase-js Storage : `restore-demo-from-staging.mjs`,
  `demo-en/demo-en.mjs`, `sync-staging-demo-from-prod.mjs`, `backfill-webp.mjs`. À adapter
  au module S3 (ou à réécrire contre la base VPS) avant le prochain usage.
- `supabase/seed.sql` (E2E) construit les URLs d'images avec `:'supabase_url'` — inchangé
  tant que le harnais E2E tourne sur Supabase local.
- Retirer `@supabase/supabase-js` et le pilote Supabase de `lib/storage/photos.ts` une fois
  la prod basculée et le harnais E2E migré (Postgres + PostgREST + MinIO en Docker).

## Journal

- **2026-09-12** — Anthony crée le projet Public Cloud et l'utilisateur S3 (`user-MtAPHvgGrJFc`,
  identifiants dans `.env.local`). Buckets `mijote-photos-staging`, `mijote-photos`,
  `mijote-backups` créés (le bucket auto-généré `acid-chadwick`, vide, peut être supprimé).
  Staging : Postgres `mijote-staging-db-iglfwv` + PostgREST `mijote-staging-postgrest-a0e0eu`
  (ids Dokploy `NQBJf_5Vp1g6kYYWGZzsC` / `U3yisnOG-1stMmk7LBTw7`), dump restauré (74 recettes,
  9 foyers, 24 owners, 43 migrations, 48 fonctions), 133 photos (187 Mo) copiées, sauvegarde
  planifiée (`sT_8vpZjVanuPaomaL_h6`) et testée. Code : commit `c8e20f2`.
- **2026-09-12, 18 h 30** — **Staging basculé** : données resynchronisées (TRUNCATE +
  rechargement), 74 URLs d'images réécrites vers S3, variables Dokploy posées (Supabase
  retirées), redéploiement. Vérifié : session démo, liste et fiche recette (RPC
  `track_recipe_view`), image S3 servie, création foyer + recette + **upload photo → objet
  public S3**, suppression du foyer → objet effacé ; env-check silencieux (hors deux absences
  déjà connues) ; **51 E2E verts** en local sur le repli Supabase. Le projet Supabase staging
  n'est plus utilisé par l'app (le dev local avec `.env.staging.local` pointe encore dessus :
  la base VPS n'est pas joignable hors du VPS).
