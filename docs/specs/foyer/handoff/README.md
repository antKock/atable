# Handoff: Mijote — Le foyer (features #14 récup. d'accès + #15 multi-foyer) · v5

## Overview
Refonte de l'écran **foyer** (`/household`) pour porter deux features qui convergent au même
endroit : **#14 récupération d'accès** (survivre à la perte du téléphone via un email de secours
100 % optionnel) et **#15 multi-foyer à rôles** (appartenir à plusieurs foyers, en *membre* ou
*invité*). Les deux reposent sur le même primitif de données `owner_id`.

## À lire pour Claude Code (dans l'IDE, codebase `atable`)
Les fichiers de ce bundle (`Mijote - Foyer.html` + `foyer-*.jsx`) sont des **références de
design en HTML/React-inline** : ils montrent le rendu et le comportement voulus — **ce n'est PAS
du code de prod à copier**. La tâche = **recréer ces écrans dans la codebase existante**
(Next.js App Router / React / Tailwind 4 / shadcn / Radix) **en réutilisant ses composants et
son design system**, pas en portant le HTML. Le doc HTML s'ouvre dans un navigateur pour voir
les écrans et leurs états ; ce README est **auto-suffisant** pour implémenter sans le reste de
la conversation.

- Chemins réels des composants à réutiliser / modifier : voir **« Contexte codebase »** ci-dessous.
- En cas d'écart doc ↔ composant réel, **le composant réel fait foi**.
- Si un composant ne se réutilise pas tel quel → **ARRÊTE-TOI ET PRÉVIENS** (cf. Principe).

## Fidélité
**Hi-fi.** Couleurs, typographie, espacements et interactions sont dérivés du code réel
(`globals.css`, composants existants) — à recréer fidèlement avec les libs de la codebase.
Les photos de recette sont des placeholders dégradés (l'app a ses vraies images).

> **v5** (revue 3) : membres listés sur la fiche foyer (plus d'écran séparé) ; « Rejoindre un
> foyer » recentré comme la home ; install = « Installe l'app Mijote » (iOS only) ; « Créer ou
> rejoindre » ouvre le fork onboarding ; sous-titres du hub avec tag de rôle en tête.
> **v4** : email saisi au profil sans envoi ; hub Toi + Tes foyers ; détail
> foyer avec membres inline + chevrons + **Quitter ET Supprimer** (oblig. App Store) ;
> action membre **rôle-aware** (invité⇄membre) ; **fusion uniquement depuis le profil** ;
> récup email inconnu = même écran (anti-énumération) ; hints déclinés (**install** mini +
> **partage/email**, tous dismissables définitivement) ; filtre foyer **multi-select** aligné
> `FilterBar` ; marqueur = label texte discret ; **Déplacer** = 4ᵉ icône dans
> la **pill d'actions** de la fiche (pas de menu ⋯) ; desktop = sheet → dialog ; profil empty-state.

## ⚠️ Lis ça d'abord — deux features, un seul écran

**#14 — Récupération d'accès** et **#15 — Multi-foyer à rôles** convergent sur `/household`
et le même primitif `owner_id`. Structuré en 3 actes : **Acte 0 (tronc commun)** → **Acte 1 (#14)** → **Acte 2 (#15)**.

> **Principe** : réutiliser le DS et les composants existants au maximum ; ne créer du neuf
> (sur la logique du DS) que là où c'est pertinent. Si un composant ne se réutilise PAS tel
> quel (couplage `household_id`, route qui force l'auth…) — **ARRÊTE-TOI ET PRÉVIENS** avec
> le composant, la raison, et l'option de refacto minimale. Pas de refonte silencieuse.

## Statut & fidélité

- **Hi-fi review doc** dérivé de l'existant. **Pas du code de prod à copier** — recrée avec
  les composants Mijote (Next.js / React / Tailwind 4 / shadcn / Radix).
- En cas d'écart doc ↔ composant réel, **le composant réel fait foi**.
- Specs sources : `id:14` (Récupération d'accès au foyer), `id:15` (Multi-foyer à rôles).

---

## Contexte data — le primitif à poser (les DEUX en dépendent)

- **`owner_id` — jour 1.** Le foyer appartient à un `owner_id` abstrait ; le `device_session`
  n'est qu'une **session** pointant vers cet owner. Mappé 1:1 au départ → **onboarding inchangé**.
- **`membership(owner_id, foyer_id, rôle)` — jour 1**, même à 1 ligne. Multi-foyer = retirer
  la contrainte « 1 seule » → additif.
- **Owner = « membre »** : porte un **nom** (facultatif, vide → alias auto) et un **email**
  (1 max, propre à #14). Ni compte ni email requis pour exister. **Pas d'avatar** (décision revue).

---

## Contexte codebase (réutilisé)

| Élément | Fichier source | Réutilisation |
|---|---|---|
| Écran foyer (à refondre) | `household/HouseholdMenuContent.tsx` + `(app)/household/page.tsx` | Devient le hub **Toi + Tes foyers** ; supprime la liste plate et la section « ce foyer ». |
| Nom éditable inline | `household/InlineEditableField.tsx` | Nom de foyer, nom de membre. |
| Lien / code de partage | `InviteLinkDisplay.tsx`, `CodeDisplay.tsx` | Grammaire des blocs de lien ; **2 liens par rôle** (#15). |
| Quitter le foyer | `LeaveHouseholdDialog.tsx` | « Quitter » dans le détail d'un foyer ; à étendre « quitter parmi N ». |
| Onboarding / fork | `auth/LandingScreen.tsx`, `CreateHouseholdForm.tsx`, `CodeEntryForm.tsx` | **Fork #14** = ajouter « J'ai déjà un foyer » au `LandingScreen` (hi-fi, cocotte SVG). Forms crème = grammaire des écrans récup. |
| Home (accès foyer + hint) | `(app)/home/page.tsx` (icône top-right) + `app/InstallAppBanner.tsx` | Remplacer le glyphe `Users` par une **icône Réglages** ; **réutiliser la grammaire `InstallAppBanner`** pour le hint email. |
| Card recette + filtres | `RecipeCard.tsx` + `LibraryContent.tsx` + `FilterBar.tsx` | **Marqueur label** (nom du foyer) + **pill « Foyer »** dans la `FilterBar` (pattern `Popover` existant). |
| Choix de foyer | *(nouveau)* — `ImportSelector`/`RecipeForm`/`NewRecipeFlow` + menu ⋯ fiche | Composant **« choix de foyer »** (sheet mobile / dialog desktop). |
| Copier une recette | `api/recipes/copy/route.ts` (`/r/[token]`) | Base de « invité → copier » (hors périmètre 1ʳᵉ livraison). |
| Dialog / sheet | `ui/dialog.tsx` (Radix) | Bascule responsive : bottom-sheet `< md`, dialog centré `≥ md`. |
| Tokens | `globals.css` | `--btn-gradient`, `--card-gradient`, `--accent`, `--border`, `--radius` (14px), Fraunces/Inter/DM Mono. |

---

## ACTE 0 — Tronc commun

### 0.1 — Accès foyer via icône Réglages
- Header `/home` réel (grand « Mijote » Fraunces + icône à droite) : **remplacer le glyphe
  `Users` par une icône Réglages** (engrenage). Pill nav **inchangée** (3 actions).
- **Multi-foyer** : option d'un sélecteur de foyer à gauche de l'engrenage, avec entrée
  **« Tous les foyers »** ; nom long tronqué (ellipsis).

### 0.2 — Écran foyer refondé (hub) = Toi + Tes foyers
- **Toi** : nom (→ profil) + statut « Accès sauvegardé / Sauvegarder mon accès » (→ profil).
- **Tes foyers** : liste de tous les foyers, **tous égaux et ouvrables**. Rôle invité marqué.
- **Détail d'un foyer** (tap) : nom éditable, **membres listés inline avec chevrons** (tappables →
  action rôle), **Inviter**, puis **Quitter** ET **Supprimer le foyer** (membre ; oblig. App Store,
  cf. `LeaveHouseholdDialog` double confirmation). En invité : label **« Invité · N personnes »**,
  bandeau lecture-seule, pas d'inviter/édition, **seul « Quitter »**.
- ⚠️ Vérifier la non-régression du mono-foyer démo (`isDemo`).

### 0.3 — Profil (« Toi »)
- **Nom** (vide → alias auto ; **pas d'avatar**). Wording : pas de « rigolo » (« alias par défaut »).
- **Email de secours saisi ICI.** **Aucun envoi à la saisie** — on stocke l'adresse. Le lien de
  connexion ne part qu'à la récup sur un nouveau device (Acte 1). Copy explicite « sert seulement
  à retrouver ton accès, pas de compte, pas de mot de passe ».

### 0.4 — Composant « choix de foyer »
- **Bottom sheet à l'enregistrement** (import + saisie manuelle), déclenché après « Enregistrer ».
- **Pas de « foyer par défaut »** — on choisit à chaque fois. **Une recette = un seul foyer**
  (pas de multi-foyer par recette au départ). Changer plus tard = **flow « Déplacer » (2.4)**.
- Foyer invité = **jamais une destination** (grisé + explication).
- Mono-foyer → le sheet n'apparaît jamais.

---

## ACTE 1 — Feature #14 (récupération d'accès)

### 1.1 — Hints (jamais forcés)
- **Trois hints** cohabitent, tous dismissables et qui **ne reviennent plus** une fois fermés :
  - **install** : mini-bandeau une ligne, **toujours au-dessus** du hint principal (existant, `InstallAppBanner`) ;
  - **partage** / **email** : le hint principal, **un seul à la fois**.
- **Règle** : hint **partage jusqu'à ~3 recettes**, puis **email** (si aucun email posé).
- **CTA email** → ouvre le **profil** (0.3). Au dismiss : toast « Tu retrouveras ça dans ton profil ».
- Le style (icône + titre + corps + CTA) est **à généraliser** ; install et partage reprennent ce gabarit.

### 1.2 — Fork d'onboarding (device neuf, clé anti-doublon)
- `LandingScreen` (hi-fi, cocotte SVG, wordmark) + **« J'ai déjà un foyer »** sous « Créer un foyer ».
- Écran « J'ai déjà un foyer » : **copy générique** (rejoindre le foyer d'un proche *ou* retrouver
  le sien). **CTA principal = code d'invitation** ; secondaire = récup email.
- Sans ce fork, le device neuf recrée un owner → fusion forcée.

### 1.3 — Récupérer par email
- Saisie de l'email → **envoi du magic-link + code** (repli si mails lus sur un autre appareil :
  WebView Capacitor ≠ cookie jar Safari).
- Écran « Vérifie tes mails » : **email sur sa propre ligne**, magic-link principal, encart code
  6 chiffres, renvoi avec compte à rebours.

### 1.4 — Collision d'email → fusion
- **Cadrage v4** : la fusion se déclenche **uniquement quand, depuis le profil**, on saisit un
  email **déjà utilisé par un autre profil** → lien+code → **union** des foyers. **À la récup
  sur un nouvel appareil : pas de fusion** — simple reconnexion à ce profil.
- **Email inconnu à la récup → exactement le même écran** de confirmation (anti-énumération : ne jamais révéler si une adresse existe).
- Pas de liste d'appareils.

---

## ACTE 2 — Feature #15 (multi-foyer à rôles)

### 2.0 — Rôles
- **Membre** = consulte + modifie. **Invité** = lecture seule, live. `RolePill` : membre = olive,
  invité = neutre + œil. Nommage conservé **invité / membre**.
- Découpe possible : livrer le rôle **invité (lecture seule)** avant la multi-appartenance complète.

### 2.1 — Inviter dans un foyer
- Atteint depuis **détail du foyer → « Inviter quelqu'un »**.
- **2 liens stables distincts** (membre / invité). Rejoindre = **join-link bearer** (pattern
  `/r/token`, mais crée une **adhésion durable**). Invitation via le canal du partageur (WhatsApp…).
- **Révocation = supprimer le `membership`** (indépendant du lien). Pas de régénération au lancement.

### 2.2 — Membres & révocation
- Groupes **Membres** / **Invités**, **sans avatars**, **chevron** sur chaque ligne. Tap → sheet
  **rôle-aware** : sur un membre → « passer en invité » ; sur un invité → « passer en membre » ;
  + « retirer » (supprime le `membership`).

### 2.3 — Bibliothèque multi-foyer
- **Mélangée + filtre**. Le **filtre foyer = pill « Foyer » dans la `FilterBar`**, **multi-select**,
  popover = **wrap de pills-boutons** (exactement comme Type / Cuisine — pas une checklist).
  Pas de « Tous les foyers » : non filtré = rien de coché.
- **Marqueur d'origine = label texte discret** (nom du foyer), **jamais couleur ni œil**.
- **Bibliothèque uniquement** — rien sur la home.

### 2.4 — Déplacer une recette
- **Pas de menu ⋯** : la fiche a une **pill blanche** (Partager · Éditer · Supprimer) — on y
  **ajoute « Déplacer »** comme 4ᵉ icône (`FolderInput`). Réutilise le **choix de foyer** (0.4).
  Copy lecture-seule **générique** (jamais de nom de foyer cité). Impossible vers un foyer invité.

### 2.5 — Desktop / tablette
- Le contenu d'une **sheet** (choix de foyer, déplacer, action membre) → **dialog centré** (Radix).
  Bascule `< md` / `≥ md`. **L'écran « Inviter » est déjà plein** — il ne change pas.

---

## État & modèle de données (ce que le dev doit poser)

**Schéma (additif, non destructif)**
- `owner` : identité abstraite. Champs UI : `name` (nullable → alias auto côté affichage),
  `recovery_email` (nullable, unique par owner, propre à #14).
- `device_session` : pointe vers un `owner_id` (1 owner ↔ N sessions/appareils).
- `membership(owner_id, household_id, role)` avec `role ∈ {membre, invité}`. **Dès le jour 1**,
  même avec une seule ligne. Multi-foyer (#15) = simplement autoriser N lignes par owner.
- `recipe.household_id` inchangé (1 recette = 1 foyer). « Déplacer » = update de ce champ.

**États écran principaux**
- Home : `hasEmail` (owner.recovery_email ?), `installDismissed` / `shareHintDismissed` /
  `emailHintDismissed` (persistés, cf. pattern `mijote_install_dismissed`), `recipeCount` (règle partage→email à ~3).
- Foyer : liste des `membership` de l'owner (nom, rôle, nb personnes, nb recettes), `currentRole` par foyer.
- Biblio : `selectedFoyerIds: string[]` (vide = tous), réutilise `FilterState`.
- Récup / fusion : `emailEntry`, `linkSent`, `codeEntry`, `isMerge` (email déjà pris — **profil uniquement**).

**Règles métier à ne pas rater**
- Saisir l'email **n'envoie rien** ; l'envoi (magic-link + code) se fait à la **récup sur nouvel appareil**.
- **Fusion** uniquement si email déjà pris **saisi depuis le profil**. Récup nouvel appareil = reconnexion, pas de fusion.
- Récup email **inconnu** → **même écran** de confirmation (anti-énumération).
- **Invité** = jamais une cible d'écriture (grisé dans choix de foyer / déplacer ; pas d'inviter/édition/suppression).
- **Repli code obligatoire** (WebView Capacitor ≠ cookie jar Safari).

## Ordre d'implémentation suggéré
1. **Data** : `owner_id` + `membership` (1 ligne), sans changement d'onboarding visible.
2. **Acte 0** : accès home (icône Réglages) + hub Toi/Tes foyers + détail foyer + profil (nom + email stocké).
3. **#14** : hints (install/partage/email) → profil ; fork onboarding (« Rejoindre un foyer ») ; récup (magic-link + code) ; fusion (profil).
4. **#15 — rôle invité d'abord** : 2 liens, membres + révocation, lecture seule ; puis multi-appartenance complète (choix de foyer, filtre biblio, déplacer).

---

## Design tokens (tous dans `globals.css`)

```
--background        #F5F1E8   (crème)
--foreground        #1A1A18   (ink)
--primary/accent    #6E7A38   (olive)
--muted-foreground  #6B6E68
--border            #E5DED6
--radius            14px
--card-gradient     linear-gradient(168deg, #FFFFFF, #F5F7F0)
--btn-gradient      linear-gradient(155deg, #7d8c40, #5d6a2e)
Fraunces (titres) · Inter (sans) · DM Mono (code / lien)
```

## Points « au designer » tranchés (validés en revue)
1. Accès foyer → **icône Réglages** (pas d'avatar, pas de 4ᵉ item de nav).
2. Récup → magic-link + repli code ; **email saisi dans le profil, sans envoi**.
3. Choix de foyer → **sheet à l'enregistrement, pas de « par défaut »**, 1 recette = 1 foyer.
4. Rôles → **invité / membre** ; 2 liens distincts.
5. Marqueur biblio → **label texte**, lecture-seule en vue complète seulement.
6. Responsive → **sheet (mobile) / dialog (desktop)**.

## Fichiers de ce bundle
- `Mijote - Foyer.html` — document de revue (3 actes + décisions + caveats).
- `foyer-kit.jsx` — primitives (tokens, icônes, phone frame, header, cards, rows, sheet, dialog…).
- `foyer-common.jsx` — Acte 0 · `foyer-14.jsx` — Acte 1 · `foyer-15.jsx` — Acte 2.
- `cocotte-illustration.svg` — asset de marque (landing hi-fi).
