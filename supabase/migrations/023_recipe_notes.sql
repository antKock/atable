-- Spec #13 — Notes et commentaires dans une recette.
-- Champ texte libre (tips, variantes, précisions), restitué tel qu'enregistré.
ALTER TABLE recipes ADD COLUMN notes TEXT;
