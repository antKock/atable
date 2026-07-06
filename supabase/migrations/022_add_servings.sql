-- Spec #12 — nombre de personnes par recette.
-- Nullable : jamais de valeur par défaut inventée ; rempli par le user
-- (formulaire) ou deviné par le LLM (import / enrichissement).
alter table recipes
  add column servings smallint
  check (servings between 1 and 20);
