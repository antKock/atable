# Lot 1 — Acte 0 : hub « Toi + Tes foyers », détail foyer, profil

> Lire d'abord `00-socle.md` + `handoff/README.md` (Acte 0) + `handoff/foyer-common.jsx`
> (maquettes 0.1, 0.2, 0.2b, 0.3). Prérequis : Lot 0 en staging, vérifié.

## Objectif

Refondre l'écran `/household` en hub, ajouter le détail de foyer et le profil.
Encore mono-foyer à ce stade (la liste « Tes foyers » a 1 entrée) — mais l'UI est
construite d'emblée pour N foyers et les rôles.

## 1. Home — accès via icône Réglages (maquette 0.1)

- `src/app/(app)/home/page.tsx` : remplacer le glyphe `Users` (lucide) du header par
  une icône **Réglages** (`Settings`), même Link vers `/household`, même hitbox.
- Pill de nav inchangée. Pas de sélecteur de foyer sur la home (décision : le foyer
  ne se filtre qu'en bibliothèque, Lot 4).

## 2. Hub `/household` (maquette 0.2)

Refonte de `household/HouseholdMenuContent.tsx` + `(app)/household/page.tsx`
(les données viennent désormais de `getOwnerContext()` : owner + memberships,
enrichis des noms de foyers, nb de personnes = memberships du foyer, nb de recettes).

- Titre « Foyer & profil » (`TopBar` = header existant de la page).
- **Section « Toi »** : une ligne carte → navigue vers `/household/profile`.
  Titre = nom de l'owner (ou alias auto), sous-titre « Nom & sauvegarde d'accès ».
  (Le statut « Accès sauvegardé / Sauvegarder mon accès » arrive au Lot 2 avec
  l'email — prévoir le sous-titre comme slot.)
- **Section « Tes foyers »** : une ligne par membership (nom du foyer, sous-titre =
  `RolePill` + « N personnes · M recettes »), chevron → `/household/[id]`.
  Dernière ligne : **« Créer ou rejoindre un foyer »** (accent) → pour ce lot,
  réutiliser les flows existants `CreateHouseholdForm`/`CodeEntryForm` dans un
  écran dédié (sémantique actuelle conservée : changer de foyer ; l'additivité
  arrive au Lot 4).
- Nouveau composant `RolePill` (membre = olive/accent, invité = neutre + œil —
  cf. `handoff/foyer-kit.jsx`) : posé maintenant, réutilisé aux Lots 3/4.
- **La liste des appareils (`DeviceList`) disparaît** (décision n°5). Supprimer
  `DeviceList`, `DeviceListItem`, et `DELETE /api/devices/[id]` + son cache Redis
  d'appel. Fenêtre assumée sans « kick » jusqu'au Lot 3 (le retrait de membre le
  réintroduit en mieux). Le check `revoked:<sid>` du middleware reste (inerte).

## 3. Détail d'un foyer `/household/[id]` (maquette 0.2b)

- Nom éditable inline (`InlineEditableField`, réutilisé tel quel) ; badge/readOnly
  si démo (comportement actuel conservé).
- Sous-titre : « Membre · N personnes » (rôle du viewer dans CE foyer).
- **Membres listés inline** : une ligne par owner ayant un membership sur ce foyer —
  nom ou alias, « (toi) » pour soi, `RolePill`, chevron **inerte pour ce lot**
  (l'action rôle-aware arrive au Lot 3).
- Blocs invitation : conserver `CodeDisplay` + `InviteLinkDisplay` actuels dans ce
  lot (l'écran « Inviter » à 2 liens les remplace au Lot 3).
- Bas d'écran : « Quitter ce foyer » et « Supprimer le foyer » — réutiliser
  `LeaveHouseholdDialog` (double confirmation conservée, oblig. App Store).
- Accès refusé si le foyer n'est pas dans les memberships du viewer → notFound.

## 4. Profil `/household/profile` (maquette 0.3)

- **Nom** : input unique, placeholder = alias auto. `PUT /api/owner { name }`
  (nouvelle route sous `withOwnerAuth` + `assertNotDemoMutation`). Vide → NULL en DB
  → alias affiché. Copy : « Laisse vide et on te donne un alias par défaut. »
- **Alias auto** : `src/lib/alias.ts` — fonction pure `aliasForOwner(ownerId)`,
  dérivée déterministe (hash simple de l'UUID → « Adjectif Animal », liste ~40×40 en
  français, ton sobre — pas de wording « rigolo »). Unit-testée (stabilité,
  distribution grossière).
- **PAS de champ email dans ce lot** : il arrive au Lot 2 avec la récup + fusion
  (éviter l'état intermédiaire « email stocké, collision sans fusion »).
- Pas d'avatar (décision revue).

## 5. Démo (stratégie C, part UI)

- Hub démo = vue gelée : ligne « Toi » absente (pas de profil démo), section foyer
  réduite (nom readOnly), pas de « Créer ou rejoindre » MAIS le CTA de conversion
  existant (bannière démo) reste le chemin de sortie. « Quitter » conservé.
- Serveur : `PUT /api/owner` et toute mutation refusées via `assertNotDemoMutation`.

## Tests

- E2E : hub (1 foyer listé, compteurs corrects), navigation détail, rename foyer
  (caractérisation adaptée si sélecteurs changent — seule modification tolérée),
  profil (poser un nom, le vider → alias stable), 2 sessions du même foyer se voient
  dans les membres, quitter/supprimer depuis le détail, démo gelée (profil
  inaccessible, mutation → 403).
- Unit : `aliasForOwner`.
- Vérifier que la caractérisation « écran foyer » est mise à jour en conséquence
  (c'est le SEUL lot autorisé à réécrire ces tests-là, puisque l'écran change).

## Points de vigilance

- `HouseholdMenuContent` actuel prend `devices` en props — la page serveur change de
  requêtes (memberships + counts au lieu de device_sessions). Compter les recettes
  par foyer en une requête groupée, pas N+1.
- Les owners issus du backfill Lot 0 n'ont pas de nom → la liste des membres
  affichera des alias. C'est voulu (doublon de membre inoffensif, fusion au Lot 2).

## Definition of Done

DoD commune du socle + suite E2E complète verte (caractérisation ajustée comprise).
