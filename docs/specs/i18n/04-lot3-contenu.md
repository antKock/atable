# Lot 3 — Contenu (livré sur staging le 2026-09-04)

> Contexte et décisions : `00-socle.md`.

## Fait

- **Foyer démo EN** : second foyer `is_demo` (id fixe
  `00000000-0000-0000-0000-00000000e000`, « Mijote Demo »), 30 recettes seed
  traduites en en-US par le modèle texte de prod (`scripts/demo-en/demo-en.mjs
  translate` → `scripts/demo-en/recipes.en.json`, versionné et relisible ;
  unités métriques conservées, Title Case). Les images générées des recettes
  FR sont **réutilisées** (mêmes fichiers Storage — les seed ne sont jamais
  supprimées), les tags résolus par nom canonique. `apply --env staging|prod`
  idempotent (upsert par id fixe). **Appliqué sur staging** ; prod au Lot 4.
- `/api/demo/session` : un appareil EN atterrit sur le foyer EN si
  `DEMO_HOUSEHOLD_ID_EN` est posé, sinon sur le FR (jamais vide).
- Cron `demo-reset` : purge des non-seed, comptage/alerte seed (< 30 → Sentry
  fatal, message avec la commande de restauration FR ou EN) et purge des
  owners sur les DEUX foyers. Rollup stats appelé par foyer.
- Seed E2E : foyer EN + 3 recettes (`scripts/seed-e2e.mjs`,
  `DEMO_HOUSEHOLD_ID_EN` dans `.env.test.example`) ; test « un appareil EN
  atterrit sur la démo EN ».
- **Pages publiques** : `/support` et `/legal/confidentialite` servies dans la
  langue de l'appareil, même URL (`content-fr.tsx` / `content-en.tsx` +
  `generateMetadata`) ; `/r/[token]` (description OG : libellés de tags
  traduits, repli `t.share.ogFallback`) ; `public/offline.html` bilingue via
  `navigator.language` (servie hors ligne par Capacitor, donc sans
  `Accept-Language`) ; manifest PWA dynamique (`src/app/manifest.ts` →
  `/manifest.webmanifest`, remplace `public/manifest.json`).
- Variables Vercel **staging** posées le 2026-09-04 : `DEMO_HOUSEHOLD_ID_EN`,
  `I18N_PREVIEW_COOKIE=1` (prévisualisation `?lang=en` sur staging — utile pour
  les captures App Store du Lot 4 sur appareil réel).

## Limitations connues

- ~~`demo_stats_rollup` par foyer (max FR/EN)~~ — corrigé le 2026-09-05 par la
  migration 038 (variante `uuid[]`, un seul appel pour tous les foyers démo ;
  ancienne signature conservée en alias). Appliquée sur staging ; **à appliquer
  sur prod avant la promotion** (migration avant code).
- La traduction de la politique de confidentialité est un texte à valeur
  juridique : **relecture d'Anthony avant l'activation EN** (checklist Lot 4).
- La landing de campagne `/recettes-insta` (FR, hors chantier) n'est pas
  traduite.

## Vérification

tsc, lint, 590 unit, **50/50 E2E** ; captures iPhone : home + bibliothèque
démo EN, support EN, politique EN, page hors-ligne EN ; manifest EN via curl.
Piège rencontré : le cache Turbopack de `.next-e2e` corrompu par les
renommages (`page.tsx` → `content-fr.tsx`) bloquait la compilation de
`/recipes/[id]/edit` — `rm -rf .next-e2e` règle le problème (webpack n'était
pas affecté ; staging Vercel a buildé normalement).
