# CLAUDE.md — Mijote (repo atable)

## Base de connaissance PM (Obsidian)

Le contexte projet complet (produit, architecture, environnements, mobile, ops, historique)
est documenté dans le vault Obsidian d'Anthony :

**`~/projects/anthony-os/Perso/Mijote/Contexte codebase (généré)/`** — point d'entrée : `Mijote.md`.

- Ces notes sont **dérivées de cette codebase** et servent de base de connaissance PM.
- **À mettre à jour à chaque jalon** (release, incident, décision structurante, changement
  de statut App Store / Play Store) : au minimum le tableau de statut de `Mijote.md` et la
  timeline de `Historique & Décisions.md`, plus la note thématique concernée.
- Mettre à jour le champ `mis-à-jour:` du frontmatter des notes touchées.
- Le vault a son propre `CLAUDE.md` (conventions : français, wikilinks, commits par palier).

## Backlog — specs par ID

Les specs backlog sont dans **`~/projects/anthony-os/Perso/Mijote/Backlog/`** :
une note `.md` par item, avec un `id` numérique unique en frontmatter (plus `zone`, `type`,
`origine`, `voix`, `prio`, `statut`).

- Quand Anthony dit « la #N » ou « spec N », il désigne la note dont le frontmatter
  contient `id: N`. La retrouver :
  `grep -l "^id: N$" ~/projects/anthony-os/Perso/Mijote/Backlog/*.md`
- Lire aussi `Stratégie.md` (dossier parent) quand la spec y renvoie.

## Chantiers livrés (specs par lot dans `docs/specs/`)

- **Foyer (#14 + #15)** — `docs/specs/foyer/` (lire `00-socle.md`) : owners/memberships,
  rôles membre/invité, e-mail de secours, multi-carnets. **En prod depuis juillet 2026.**
- **Version EN** — `docs/specs/i18n/` (lire `00-socle.md`) : la langue suit l'appareil
  (`Accept-Language`, stateless, flag `I18N_EN_ENABLED`), recettes en langue source,
  « carnet » = « cookbook ». **En prod depuis le 2026-09-05.** Règles à respecter :
  - toute chaîne visible va dans `src/lib/i18n/fr.ts` **et** `en.ts` (`Dictionary` typé,
    clé manquante = erreur `tsc`) ; jamais `import { t } from "@/lib/i18n/fr"` hors tests,
    admin, scripts et défauts de schémas — `useT()` côté client, `await getT()` côté serveur ;
  - une valeur stockée (enum, tag) ne se traduit pas en base : libellé via `labels.ts`
    ou une table `t.xxx` indexée par la valeur stockée ;
  - deux foyers démo (FR `DEMO_HOUSEHOLD_ID`, EN `DEMO_HOUSEHOLD_ID_EN`) ; recettes seed
    intouchables (`assertNotDemoSeedMutation`), alerte Sentry du cron sous 30 seed ;
    restauration : `scripts/restore-demo-from-staging.mjs` (FR), `scripts/demo-en/demo-en.mjs`
    (EN).

## Repères rapides

- Branche de travail : `staging` (déploiement auto). `main` = prod, **protégée** :
  promotion via `gh pr create` + `gh pr merge --admin`, avec le compte gh **antKock**.
- Migrations DB : `supabase/migrations/`, appliquées via `supabase db push --linked`
  (re-link pour changer d'env staging ↔ prod).
- Les gotchas connus (Vercel, Supabase, Capacitor) sont dans la note
  `Opérations & Pièges.md` du vault — la lire avant toute opération d'infra.
  Vercel : CLI installée (`/opt/homebrew/bin/vercel`, compte antkock) — **jamais `npx vercel`**
  en non-interactif (a déjà vidé la session). App Store Connect : `scripts/apple-connect.mjs`
  (`get`, `post`, `patch` — clé Admin dans `.env.local`) ; les textes de fiche font foi dans
  `docs/marketing/fiche-app-store.md` (FR) et `fiche-app-store-en.md` (EN), **ASC d'abord,
  la fiche ensuite**. App Privacy n'a pas d'API.
- Plan de migration infra Vercel → VPS OVH + Dokploy (non déclenché, analyse coûts du
  2026-09-05) : `docs/infra/migration-vps-ovh.md` — à lire avant tout chantier « hébergement »,
  « coûts » ou « quitter Vercel ».
