-- Besoin #1 (backlog) : l'IA taguait « Végétarien » des recettes au poisson.
-- Le prompt d'enrichissement ne recevait que les NOMS des tags, laissant le
-- modèle deviner leur sémantique. On ajoute une définition courte par tag
-- prédéfini, injectée dans le prompt (source unique : la DB, comme les noms).

ALTER TABLE tags ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE tags AS t
SET description = d.description
FROM (VALUES
  -- Type de plat
  ('Entrée',             'Se sert en début de repas, avant le plat principal'),
  ('Plat principal',     'Plat central et consistant d''un repas'),
  ('Accompagnement',     'Se sert à côté d''un plat principal (riz, légumes, purée…)'),
  ('Dessert',            'Préparation sucrée servie en fin de repas'),
  ('Soupe',              'Préparation liquide ou veloutée, servie chaude ou froide'),
  ('Salade',             'Plat froid assaisonné à base de feuilles, crudités ou ingrédients mélangés'),
  ('Apéro',              'Bouchées ou plats à partager avant le repas'),
  ('Petit-déjeuner',     'Se consomme au petit-déjeuner ou au brunch'),
  ('Goûter',             'Collation sucrée de l''après-midi'),
  ('Boisson',            'Se boit : cocktail, smoothie, jus, café…'),
  ('Sauce / Condiment',  'Préparation destinée à accompagner ou assaisonner d''autres plats'),
  ('Pain / Pâtisserie',  'Boulangerie ou pâtisserie : pain, brioche, viennoiserie…'),
  -- Régime alimentaire
  ('Végétarien',         'STRICT : aucune viande, volaille, poisson, fruit de mer ni gélatine. Une recette contenant du poisson ou des fruits de mer n''est JAMAIS végétarienne. Œufs et produits laitiers autorisés.'),
  ('Végan',              'STRICT : aucun produit d''origine animale — ni viande, volaille, poisson, fruits de mer, œufs, produits laitiers, miel ni gélatine'),
  ('Sans gluten',        'Aucun ingrédient contenant du gluten (blé, orge, seigle, épeautre…)'),
  ('Sans lactose',       'Aucun produit laitier contenant du lactose'),
  ('Léger',              'Peu calorique, adapté à un repas léger'),
  ('Comfort food',       'Plat réconfortant, riche et généreux'),
  -- Protéine principale
  ('Poulet',             'Le poulet ou une autre volaille est la protéine principale'),
  ('Bœuf',               'Le bœuf ou le veau est la protéine principale'),
  ('Porc',               'Le porc (jambon, lardons, saucisse, bacon…) est la protéine principale'),
  ('Agneau',             'L''agneau ou le mouton est la protéine principale'),
  ('Poisson',            'Un poisson (saumon, thon, cabillaud…) est la protéine principale'),
  ('Fruits de mer',      'Crustacés ou coquillages (crevettes, moules, calamars…) en protéine principale'),
  ('Œufs',               'Les œufs sont la protéine principale'),
  ('Tofu / Protéines végétales', 'Tofu, tempeh, seitan ou autres substituts végétaux en protéine principale'),
  ('Légumineuses',       'Lentilles, pois chiches, haricots secs… en protéine principale'),
  -- Cuisine
  ('Française',          'Tradition culinaire française'),
  ('Italienne',          'Tradition culinaire italienne (pâtes, risotto, pizza…)'),
  ('Indienne',           'Tradition culinaire indienne (currys, épices…)'),
  ('Libanaise / Orientale', 'Cuisine libanaise ou moyen-orientale (mezze, houmous…)'),
  ('Mexicaine',          'Cuisine mexicaine ou tex-mex'),
  ('Asiatique',          'Cuisine d''Asie de l''Est ou du Sud-Est (chinoise, japonaise, thaïe…)'),
  ('Africaine',          'Cuisine du continent africain (maghrébine, subsaharienne…)'),
  ('Américaine',         'Cuisine nord-américaine (burgers, BBQ, brunch…)'),
  ('Méditerranéenne',    'Cuisine méditerranéenne (huile d''olive, légumes du soleil, grillades…)'),
  ('Nordique',           'Cuisine scandinave ou d''Europe du Nord'),
  -- Occasion
  ('Rapide',             'Prête en 30 minutes ou moins, préparation et cuisson comprises'),
  ('En batch',           'Se prête au batch cooking et aux grandes quantités'),
  ('Repas de fête',      'Adaptée aux grandes occasions et repas festifs'),
  ('Pique-nique',        'Se transporte facilement et se mange froide'),
  ('Lunchbox',           'Adaptée à une gamelle, froide ou réchauffée, pour le déjeuner'),
  -- Caractéristiques
  ('Pas cher',           'Ingrédients économiques et courants'),
  ('Facile',             'Peu de technique, accessible aux débutants'),
  ('One-pot',            'Se cuisine entièrement dans un seul récipient'),
  ('Sans cuisson',       'Aucune cuisson nécessaire'),
  ('Pour les enfants',   'Plaît généralement aux enfants'),
  ('À congeler',         'Se congèle et se réchauffe bien')
) AS d(name, description)
WHERE t.name = d.name AND t.is_predefined;
