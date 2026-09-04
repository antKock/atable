# Chantier « Version EN » — Socle commun

> **À lire en premier par toute session Claude Code travaillant sur un lot.**
> Ce document porte le contexte partagé et les décisions actées ; chaque lot a sa
> spec (`01-…` à `04-…`). En cas d'écart doc ↔ code réel, **le code fait foi**.

## Objectif

Proposer Mijote en anglais (en-US) aux personnes dont l'appareil est en anglais,
sans rien changer pour la base installée française. Cadré le 2026-09-04.

## Décisions actées (Anthony, 2026-09-04)

1. **La langue suit l'appareil, point.** Résolution stateless par `Accept-Language`
   à chaque requête. Pas de préférence stockée (pas de `owners.locale`), pas de
   sélecteur in-app, pas de cookie de préférence utilisateur. Une même personne
   peut voir Mijote en FR sur un appareil et en EN sur un autre : accepté.
2. **Les recettes gardent leur langue source.** L'import IA n'a plus le droit
   d'exiger « en français » : il conserve la langue de la source. Le contenu
   utilisateur n'est jamais traduit.
3. **Variante : en-US.** Coût affiché `$ / $$ / $$$`. Aucune conversion d'unités
   (données utilisateur).
4. **Tags : clé canonique FR en base, inchangée.** `recipes.tags TEXT[]` et
   `tags.name` continuent de stocker les libellés français ; l'affichage passe par
   un mapping statique `nom canonique → libellé par locale` pour les tags
   prédéfinis. Les tags libres restent tels que saisis. Pas de migration de données.
5. **L'admin reste en français** (`src/app/admin`, `src/lib/admin`, `charts.tsx`).
6. **Pas de routes `/en/…`.** Les deep links (`/r/[token]`, `/join/CODE`, Universal
   Links, Share Extension, `allowNavigation`) sont partagés entre langues. Le SEO
   web EN n'est pas un objectif (acquisition = stores, localisés par storefront).
7. **« Carnet » se dit « cookbook »** (décidé 2026-09-04 après relevé du vocabulaire
   concurrent : ReciMe, Pestle, Whisk/Samsung Food, Recipe Keeper, Mela, Saffron
   disent « cookbook » pour la collection personnelle ; « recipe book » est le
   mot des templates Notion/GoodNotes et de la fiche ASO, « recipe box » est
   marginal). Un carnet = *a cookbook*, plusieurs = *your cookbooks*.
8. **Aucun test manuel par Anthony.** Chaque lot est vérifié par la session Claude
   avec Playwright (copy en contexte + captures) ; les doutes sont remontés
   explicitement. Seul livrable à relecture humaine : la traduction des pages
   légales (Lot 3).

## Mécanisme de résolution de la langue

Un seul chemin pour web, PWA et shell Capacitor : le WebView natif charge l'URL
Vercel distante (`capacitor.config.ts`) et envoie `Accept-Language` d'après la
langue de l'appareil, exactement comme un navigateur.

```
resolveLocale(cookie, acceptLanguage, env) :
  1. si I18N_PREVIEW_COOKIE=1 et cookie mijote_locale ∈ {fr, en} → cookie   (staging/dev)
  2. si I18N_EN_ENABLED=1 → première langue de Accept-Language : fr* → fr, sinon en
  3. sinon → fr
```

- `I18N_EN_ENABLED` : interrupteur de mise en service. Absent en prod jusqu'à la
  fin du Lot 4 → rien ne change pour personne. Posé en dernier.
- `I18N_PREVIEW_COOKIE` : outil de vérification (Playwright, staging). Le composant
  `LocalePreviewSwitch` pose le cookie depuis `?lang=en|fr` puis recharge. Jamais
  posé en prod.
- Aucune modification de `src/middleware.ts` : `getLocale()` lit `cookies()` /
  `headers()` directement (Server Components, layouts, route handlers).
- Le layout racine rend `<html lang>` et monte `LocaleProvider` avec la locale
  seule (les dictionnaires contiennent des fonctions → non sérialisables RSC ; le
  client importe `fr`/`en` lui-même).

## Architecture i18n (`src/lib/i18n/`)

| Fichier | Rôle |
|---|---|
| `fr.ts` | Dictionnaire FR existant (`t`, `as const`). **Ne change pas de forme.** |
| `en.ts` | `export const en: Dictionary` — le compilateur refuse toute clé manquante |
| `types.ts` | `Dictionary = Widen<typeof fr>` (littéraux élargis en `string`, fonctions conservées) |
| `locale.ts` | `Locale`, `LOCALES`, `DEFAULT_LOCALE`, `resolveLocale()` pur + `parseAcceptLanguage()` — testé vitest |
| `server.ts` | `getLocale()` (mémoïsé par requête via `cache`), `getT()` |
| `client.tsx` | `LocaleProvider`, `useLocale()`, `useT()`, `LocalePreviewSwitch` |
| `index.ts` | `dictionaries`, ré-exports |

Convention d'usage :
- Server Component / route handler : `const t = await getT()`.
- Client Component : `const t = useT()` (contexte ; défaut `fr` hors provider, ce
  qui couvre `global-error.tsx`).
- Interdit après le Lot 1 : `import { t } from "@/lib/i18n/fr"` hors tests et
  hors admin.

## Ordre des lots

| # | Spec | Contenu | Statut |
|---|---|---|---|
| 0 | `01-lot0-socle.md` | Plomberie ci-dessus, `en.ts` complet, layout racine, pilote `LandingScreen` + pages d'erreur, spec E2E `16-i18n` | staging |
| 1 | `02-lot1-interface.md` | Migration des 73 imports statiques, extraction des chaînes en dur (52 fichiers hors admin), énumérations, alias EN, messages d'erreur API, emails | à faire |
| 2 | `03-lot2-ia-donnees.md` | Prompts « langue source conservée », mapping libellés des tags prédéfinis, vérification par le bench `scripts/bench/` | à faire |
| 3 | `04-lot3-contenu.md` | Foyer démo EN, landing/support/join/recover/`/r`, légal (relecture Anthony), `offline.html` | à faire |
| 4 | `05-lot4-natif-stores.md` | `en.lproj` + `InfoPlist.strings` (3 permissions), titre Share Extension, Android optionnel, captures, fiches stores, `I18N_EN_ENABLED=1` en prod | à faire |

**À la fin de chaque lot : mettre à jour la colonne Statut** (`staging` quand
déployé sur staging, `done` quand promu en prod — convention backlog).

## État des lieux au cadrage (2026-09-04)

- `fr.ts` : 21 Ko, ~350 feuilles, importé statiquement dans 73 fichiers.
- 52 fichiers `.ts/.tsx` avec des chaînes FR en dur hors `fr.ts` — les plus gros :
  `legal/confidentialite` (179 lignes), `admin/stats` (hors périmètre), `support`,
  `api/households/*`, `owner-context.ts`, `queries/recovery.ts`, `import.ts`,
  `email/send.ts`, `with-owner-auth.ts`, `HomeHints.tsx`, `alias.ts`.
- Prompts IA en FR exigeant une sortie « en français » : `import.ts:44`
  (`EXTRACTION_SYSTEM_PROMPT`), `enrichment.ts:27` (`buildSystemPrompt`).
- Valeurs stockées neutres : saisons `printemps/ete/automne/hiver`, coût `€/€€/€€€`,
  complexité `facile/moyen/difficile`, temps `30 min/1h…`. Tables d'affichage déjà
  dans `fr.ts` (`seasons`, `cost`, `complexity`).
- Natif iOS : 3 `*UsageDescription` FR dans `ios/App/App/Info.plist`, titre
  « Importer dans Mijote » dans `ShareViewController.swift:63`, seul `Base.lproj`.
  Android : `strings.xml` ne contient que « Mijote ».
- `public/offline.html` bundlé dans l'app native (`webDir: "public"`).
- Fiche App Store EN déjà rédigée : `docs/marketing/fiche-app-store-en.md`.

## Contrat de non-régression

- `npm run lint`, `npx tsc --noEmit`, `npm test` (CI).
- Suite Playwright `e2e/` verte avant et après chaque lot, sans modifier les specs
  de caractérisation existantes (mêmes libellés FR : la locale par défaut du
  harnais reste `fr`).
- `I18N_PREVIEW_COOKIE=1` est posé par `playwright.config.ts` pour que
  `16-i18n.spec.ts` puisse forcer `en` via le cookie.

## Hors périmètre

Sélecteur de langue in-app, préférence persistée, traduction du contenu
utilisateur, conversion d'unités, SEO EN, admin.
