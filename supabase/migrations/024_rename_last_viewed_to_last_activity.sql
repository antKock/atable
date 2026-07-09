-- Spec #9 (carrousels homepage) : last_viewed_at ne couvre pas que la
-- consultation — la valeur vaut « créée OU ouverte » (et de futurs bumps :
-- édition, mode cuisine…). On renomme vers un nom honnête. Le signal
-- « réellement ouverte » reste porté par view_count (0 = jamais ouverte).
ALTER TABLE recipes RENAME COLUMN last_viewed_at TO last_activity_at;

UPDATE recipes
SET last_activity_at = created_at
WHERE last_activity_at IS NULL;

-- DEFAULT now() : toute recette démarre avec activité = insertion, quel que
-- soit le chemin de création (formulaire, imports, copie de partage) — aucun
-- code applicatif à maintenir à l'insert.
ALTER TABLE recipes ALTER COLUMN last_activity_at SET DEFAULT now();
ALTER TABLE recipes ALTER COLUMN last_activity_at SET NOT NULL;
