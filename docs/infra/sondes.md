# Sondes — exclure Anthony et les agents des stats (backlog #26)

Depuis le 2026-09-13. Une **sonde** est un appareil d'Anthony ou un agent (curl, Playwright)
qui teste la prod. Marquée explicitement, elle n'écrit **aucune** mesure.

## Se marquer

| Qui | Comment | Durée |
|---|---|---|
| Un appareil (téléphone, navigateur) | ouvrir `https://mijote.anthonykocken.fr/?probe=1` (idem staging) → cookie `mijote_probe=1` ; la landing affiche « Sonde · hors stats » | 1 an |
| **Le shell iOS / Android** (pas de barre d'adresse, cookie jar propre) | depuis Notes ou Messages, **taper un lien universel avec `?probe=1`**, ex. `https://mijote.anthonykocken.fr/join/PROBE-0000?probe=1` : il s'ouvre dans l'app, le proxy pose le cookie dans le jar du shell (depuis le 2026-09-15, `?probe=1` est accepté sur toute page, pas seulement la landing). En plus, **un owner marqué `is_probe`** (l'owner admin d'Anthony l'est) n'écrit jamais dans le journal des événements (#28), cookie ou pas | 1 an |
| Un script, un agent | en-tête `x-mijote-probe: 1` sur chaque requête (le harnais E2E le pose par défaut, `newVisitor(browser, { probe: false })` pour un vrai visiteur) | par requête |

Le proxy (`src/proxy.ts`) traduit les deux en `x-probe: 1` sur la requête interne ; un `x-probe`
venu du client est retiré. Tout le code serveur lit `isProbeHeaders(request.headers)` ou
`isProbeRequest()` (`src/lib/probe*.ts`), jamais le cookie.

## Effets (migration 048)

- Landing : bras A/B attribué (pour voir les deux écrans) mais **pas comptée** ; aucun compteur
  `stats_daily` (`trackStat`).
- `owners.is_probe` et `households.is_probe` posés à la création (créer, rejoindre, démo, carnet
  additif) → `owner_is_real()` faux, foyer traité comme un foyer `test%` (carnets, recettes,
  pipeline, série quotidienne, vue `v3_recipe_people`).
- Pas de ping d'activité (`daily_activity`), pas de vue de recette ; la plateforme de la session
  reste `unknown` → exclue des essais démo comme un client non-navigateur (041).
- **Comptés quand même** : les coûts IA (argent réel), les recettes ajoutées dans la démo
  (`demo_recipes_added`), les stats App Store.

## Rétroactif

L'owner admin d'Anthony et son foyer (`ADMIN_HOUSEHOLD_IDS`) ont été marqués `is_probe` le
2026-09-13 : son usage personnel historique sort des cohortes et des comptes de recettes.
