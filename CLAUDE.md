# CLAUDE.md — Mijote (repo atable)

## Base de connaissance PM (Obsidian)

Le contexte projet complet (produit, architecture, environnements, mobile, ops, historique)
est documenté dans le vault Obsidian d'Anthony :

**`~/projects/anthony-os/Mijote/Contexte codebase (généré)/`** — point d'entrée : `Mijote.md`.

- Ces notes sont **dérivées de cette codebase** et servent de base de connaissance PM.
- **À mettre à jour à chaque jalon** (release, incident, décision structurante, changement
  de statut App Store / Play Store) : au minimum le tableau de statut de `Mijote.md` et la
  timeline de `Historique & Décisions.md`, plus la note thématique concernée.
- Mettre à jour le champ `mis-à-jour:` du frontmatter des notes touchées.
- Le vault a son propre `CLAUDE.md` (conventions : français, wikilinks, commits par palier).

## Repères rapides

- Branche de travail : `staging` (déploiement auto). `main` = prod, **protégée** :
  promotion via `gh pr create` + `gh pr merge --admin`, avec le compte gh **antKock**.
- Migrations DB : `supabase/migrations/`, appliquées via `supabase db push --linked`
  (re-link pour changer d'env staging ↔ prod).
- Les gotchas connus (Vercel, Supabase, Capacitor) sont dans la note
  `Opérations & Pièges.md` du vault — la lire avant toute opération d'infra.
