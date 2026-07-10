# CLAUDE.md — Mijote (repo atable)

## Base de connaissance PM (Obsidian)

Le contexte projet complet (produit, architecture, environnements, mobile, ops, historique)
est documenté dans le vault Obsidian d'Anthony :

**`~/projects/anthony-os/Conseil/Perso/Mijote/Contexte codebase (généré)/`** — point d'entrée : `Mijote.md`.

- Ces notes sont **dérivées de cette codebase** et servent de base de connaissance PM.
- **À mettre à jour à chaque jalon** (release, incident, décision structurante, changement
  de statut App Store / Play Store) : au minimum le tableau de statut de `Mijote.md` et la
  timeline de `Historique & Décisions.md`, plus la note thématique concernée.
- Mettre à jour le champ `mis-à-jour:` du frontmatter des notes touchées.
- Le vault a son propre `CLAUDE.md` (conventions : français, wikilinks, commits par palier).

## Backlog — specs par ID

Les specs backlog sont dans **`~/projects/anthony-os/Conseil/Perso/Mijote/Backlog/`** :
une note `.md` par item, avec un `id` numérique unique en frontmatter (plus `zone`, `type`,
`origine`, `voix`, `prio`, `statut`).

- Quand Anthony dit « la #N » ou « spec N », il désigne la note dont le frontmatter
  contient `id: N`. La retrouver :
  `grep -l "^id: N$" ~/projects/anthony-os/Conseil/Perso/Mijote/Backlog/*.md`
- Lire aussi `Stratégie.md` (dossier parent) quand la spec y renvoie.

## Chantier en cours — Foyer (#14 + #15)

Specs d'implémentation par lot dans **`docs/specs/foyer/`** : lire `00-socle.md`
d'abord (contexte, décisions actées, ordre des lots, statuts), puis la spec du lot
demandé. Les maquettes hi-fi sont dans `docs/specs/foyer/handoff/`.

## Repères rapides

- Branche de travail : `staging` (déploiement auto). `main` = prod, **protégée** :
  promotion via `gh pr create` + `gh pr merge --admin`, avec le compte gh **antKock**.
- Migrations DB : `supabase/migrations/`, appliquées via `supabase db push --linked`
  (re-link pour changer d'env staging ↔ prod).
- Les gotchas connus (Vercel, Supabase, Capacitor) sont dans la note
  `Opérations & Pièges.md` du vault — la lire avant toute opération d'infra.
