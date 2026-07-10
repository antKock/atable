# Lot 4 — Feature #15b : multi-appartenance complète

> Lire d'abord `00-socle.md` + `handoff/README.md` (Acte 0 §0.4, Acte 2 §2.3–2.5) +
> `handoff/foyer-common.jsx` (ChoixFoyerSheetScreen) + `handoff/foyer-15.jsx`
> (LibraryMultiScreen, MoveRecipeScreen). Prérequis : Lot 3 en staging.

## Objectif

Lever la contrainte « 1 owner = 1 membership » : rejoindre devient additif, la
bibliothèque fusionne les foyers avec filtre, chaque enregistrement choisit son
foyer, une recette peut être déplacée. Aucune migration DB (le schéma du Lot 0
supporte déjà N memberships) — ce lot est applicatif.

## 1. Rejoindre devient additif

- **Avec session existante** (owner connu) : `/join/[code]` et le flow « Créer ou
  rejoindre » du hub **ajoutent un membership à l'owner courant** (plus de nouvelle
  session/owner). Cas gérés : déjà membre du foyer → message « Tu y es déjà » ;
  code invité alors qu'on est membre (et vice-versa) → garder le rôle le plus fort,
  jamais rétrograder silencieusement.
- **Sans session** (device neuf) : comportement actuel (owner + session + membership).
- **Depuis la démo** (stratégie C) : « Créer un foyer » (conversion) → **owner
  neuf** + nouvelle session ; le membership démo est abandonné (le cron le purge).
  Jamais d'ajout de membership sur un owner démo ni de membership démo sur un owner
  réel (guard serveur).
- Hub : « Créer ou rejoindre un foyer » bascule sur la sémantique additive
  (l'écran du Lot 1 réutilise `CreateHouseholdForm`/`CodeEntryForm` avec un
  `onSuccess` qui ne réécrit plus le cookie mais recharge le contexte).
- « Quitter un foyer parmi N » : `LeaveHouseholdDialog` étendu — s'il reste ≥1
  membership, retour au hub (pas à la landing, pas de cookie invalidé).

## 2. Écritures : le foyer devient un paramètre explicite

- `POST /api/recipes` (et les imports qui créent des recettes) : accepter
  `householdId` dans le payload ; validé par `requireMember`. Si absent ET owner
  mono-foyer → fallback sur l'unique membership (compat).
- Lectures fusionnées : `/api/library`, `/api/carousels`, recherche → union des
  foyers de l'owner (`IN (householdIds)`), chaque recette annotée
  `householdId`/`householdName`/`viewerRole`. La fiche `recipes/[id]` : accessible
  si membership sur son foyer (plus seulement le foyer du cookie).
- Décommissionnement : à la fin de ce lot, plus AUCUNE route ne doit dépendre du
  `hid` du JWT ni du header `x-household-id` (grep de contrôle) — les retirer
  (middleware compris) est la dernière étape du lot.

## 3. Choix de foyer à l'enregistrement (maquette 0.4 ; décision n°10)

- Composant `HouseholdPickerDialog` (Dialog, décision n°8) : liste des foyers où
  l'owner est **membre** (nom + « N recettes »), tap = confirme ET enregistre (pas
  de bouton), note verrou « les foyers où tu es invité sont en lecture seule ».
- Déclenchement : au submit de `RecipeForm` (create) et à la fin des imports —
  brancher dans `NewRecipeFlow`/`RecipeForm.handleSubmit` : si
  `membershipsMember.length > 1` → dialog avant le POST ; sinon POST direct
  (mono-foyer : le dialog n'apparaît JAMAIS).
- Pas de foyer par défaut, pas de mémorisation du dernier choix.

## 4. Bibliothèque multi-foyer (maquette 2.3 ; décision n°11)

- `FilterState` (`src/lib/filters.ts`) : + `foyerIds: string[]` (vide = tous, rien
  de coché — pas d'option « Tous les foyers »). Sync URL comme les autres filtres.
- `FilterBar` : pill « Foyer » (badge compteur), Popover en wrap de pills-boutons
  avec Check — **exactement le pattern des catégories existantes**, multi-select.
  La pill n'apparaît que si l'owner a >1 foyer.
- `RecipeCard`/`LibraryContent` : **label texte discret** = nom du foyer sous le
  titre (vue biblio uniquement, jamais la home), affiché seulement si >1 foyer.
  Le label porte aussi le signal lecture seule en vue fiche (bandeau existant du
  Lot 3) — pas d'œil sur les cards.
- Home : carrousels mélangés, aucun marqueur (maquette 0.1).

## 5. Déplacer une recette (maquette 2.4)

- Extraire la pill d'actions du hero (`recipes/[id]/page.tsx`, `heroOverlay`
  construit inline) en composant client `RecipeActionPill` ; ajouter la 4ᵉ icône
  `FolderInput` « Déplacer » (membres du foyer de la recette uniquement).
- Ouvre `HouseholdPickerDialog` (réutilisé) : foyer actuel marqué « Actuel »,
  destinations = foyers `member` ≠ actuel.
- `PATCH /api/recipes/[id]/move { householdId }` : requireMember sur source ET
  destination, puis :
  - update `recipes.household_id` ;
  - **déplacer les objets Storage** : les images sont rangées par foyer (cf. la
    duplication dans `/api/recipes/copy`) — copier vers le chemin du foyer cible,
    mettre à jour les URLs de la recette, supprimer les objets source ;
  - les tags (`recipe_tags`) suivent la recette (vérifier que les tags ne sont pas
    foyer-scopés ; s'ils le sont, recréer comme le fait copy).
- Copy lecture-seule générique si tentative sur une recette d'un foyer invité
  (« jamais de nom de foyer cité »).

## 6. Divers UI

- Hub : N foyers listés avec compteurs et rôles (déjà prêt depuis le Lot 1).
- Desktop ≥ md : rien à faire de spécial (Dialog partout, décision n°8).
- Renommer les foyers : déjà couvert (InlineEditableField, membres only).

## Tests

- E2E « la totale » (owner membre de A et B, invité de C) :
  1. rejoindre B depuis le hub avec un code → hub liste A+B, session conservée ;
  2. créer une recette → dialog de choix → dans B → visible dans B seulement ;
  3. biblio : mélange A+B+C, filtre « Foyer » multi-select (URL persistée), labels
     d'origine corrects ;
  4. déplacer une recette A → B : fiche à jour, images accessibles (URLs 200),
     absente de A ; « Déplacer » absent sur une recette de C (invité) ;
  5. C (invité) jamais proposé comme destination (création + déplacement) ;
  6. quitter B → hub liste A, recettes de B disparues de la biblio ;
  7. mono-foyer : jamais de dialog de choix, pas de pill Foyer, pas de labels ;
  8. démo : conversion → owner neuf (le hub du converti ne liste PAS la démo).
- Unit : logique de fallback householdId, mergeabilité des rôles au re-join,
  filtres avec foyerIds.
- Caractérisation : toujours verte (les flows mono-foyer ne changent pas).

## Points de vigilance

- Le déplacement Storage est la partie la plus fragile (s'inspirer de copy, qui a
  déjà résolu ces chemins) ; transactionnel best-effort : d'abord copier, puis
  updater la DB, puis supprimer la source — jamais l'inverse.
- Vérifier `/api/recipes/copy` (invité → copier, backlog) : doit cibler un foyer
  explicite maintenant que l'owner en a plusieurs — l'adapter au passage si trivial,
  sinon noter au backlog.
- Après décommissionnement de `x-household-id` : re-vérifier `admin/stats`
  (`ADMIN_HOUSEHOLD_IDS` compare des household ids — adapter le gating admin à
  l'owner ou aux memberships).

## Definition of Done

DoD commune + E2E ci-dessus + grep « x-household-id / payload.hid » vide (hors
commentaires historiques) + non-régression complète de la caractérisation.
