-- seed.sql: Demo household + seed recipes for atable
-- Run once after migrations to populate the demo environment.
-- DEMO_HOUSEHOLD_ID = 00000000-0000-0000-0000-000000000000
-- Requires migrations 001, 002, 003 to be applied first.

INSERT INTO households (id, name, join_code, is_demo, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Démo atable',
  'DEMO-0000',
  true,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO recipes (id, title, ingredients, steps, tags, photo_url, household_id, is_seed, created_at)
VALUES
  (
    gen_random_uuid(),
    'Soupe de lentilles corail',
    '250 g de lentilles corail' || chr(10) || '1 oignon' || chr(10) || '2 carottes' || chr(10) || '1 c. à café de cumin' || chr(10) || '1 c. à café de curcuma' || chr(10) || '1 litre de bouillon de légumes' || chr(10) || 'Huile d''olive' || chr(10) || 'Sel, poivre',
    'Faire revenir l''oignon émincé dans l''huile d''olive 5 minutes.' || chr(10) || 'Ajouter les carottes en rondelles, le cumin et le curcuma.' || chr(10) || 'Incorporer les lentilles rincées et le bouillon.' || chr(10) || 'Laisser mijoter 25 minutes à feu doux.' || chr(10) || 'Mixer le tout jusqu''à obtenir une texture veloutée.' || chr(10) || 'Rectifier l''assaisonnement.',
    ARRAY['végétarien', 'soupe', 'rapide'],
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Bowl_of_lentil_soup_with_green_and_red_lentils.jpg/960px-Bowl_of_lentil_soup_with_green_and_red_lentils.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '14 days'
  ),
  (
    gen_random_uuid(),
    'Poulet rôti aux herbes',
    '1 poulet entier (1,5 kg)' || chr(10) || '4 gousses d''ail' || chr(10) || '1 citron' || chr(10) || 'Thym frais' || chr(10) || 'Romarin frais' || chr(10) || '3 c. à soupe d''huile d''olive' || chr(10) || 'Sel, poivre',
    'Préchauffer le four à 200°C.' || chr(10) || 'Mélanger l''huile d''olive avec l''ail écrasé, le thym et le romarin.' || chr(10) || 'Frotter le poulet avec ce mélange, saler et poivrer généreusement.' || chr(10) || 'Glisser le citron coupé en deux dans la cavité.' || chr(10) || 'Enfourner 1h15 en arrosant toutes les 20 minutes.' || chr(10) || 'Laisser reposer 10 minutes avant de découper.',
    ARRAY['viande', 'four', 'dimanche'],
    'https://www.themealdb.com/images/media/meals/nlxald1764112200.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '13 days'
  ),
  (
    gen_random_uuid(),
    'Mousse au chocolat',
    '200 g de chocolat noir (70%)' || chr(10) || '6 œufs' || chr(10) || '1 pincée de sel' || chr(10) || '2 c. à soupe de sucre',
    'Faire fondre le chocolat au bain-marie, laisser tiédir.' || chr(10) || 'Séparer les blancs des jaunes.' || chr(10) || 'Incorporer les jaunes un par un au chocolat fondu.' || chr(10) || 'Monter les blancs en neige ferme avec le sel.' || chr(10) || 'Ajouter le sucre aux blancs à mi-parcours.' || chr(10) || 'Incorporer délicatement les blancs au mélange chocolaté en trois fois.' || chr(10) || 'Réfrigérer au moins 2 heures avant de servir.',
    ARRAY['dessert', 'chocolat', 'rapide'],
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Chocolate_coffee_mousse.jpg/960px-Chocolate_coffee_mousse.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '13 days'
  ),
  (
    gen_random_uuid(),
    'Gratin dauphinois',
    '1 kg de pommes de terre à chair ferme' || chr(10) || '50 cl de crème fraîche liquide' || chr(10) || '2 gousses d''ail' || chr(10) || 'Noix de muscade' || chr(10) || 'Sel, poivre' || chr(10) || 'Beurre pour le plat',
    'Préchauffer le four à 160°C.' || chr(10) || 'Éplucher et trancher les pommes de terre en rondelles fines (2 mm).' || chr(10) || 'Frotter le plat à gratin avec l''ail, puis beurrer.' || chr(10) || 'Disposer les rondelles en couches, saler, poivrer, muscader.' || chr(10) || 'Verser la crème fraîche qui doit presque recouvrir les pommes de terre.' || chr(10) || 'Cuire 1h30 jusqu''à ce que le dessus soit doré et que la lame d''un couteau s''enfonce facilement.',
    ARRAY['four', 'végétarien', 'accompagnement'],
    'https://www.themealdb.com/images/media/meals/qwrtut1468418027.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '12 days'
  ),
  (
    gen_random_uuid(),
    'Tarte aux pommes grand-mère',
    '1 pâte brisée' || chr(10) || '5 pommes (Golden ou Reine des Reinettes)' || chr(10) || '3 œufs' || chr(10) || '150 g de sucre' || chr(10) || '20 cl de crème fraîche' || chr(10) || '1 sachet de sucre vanillé' || chr(10) || 'Cannelle',
    'Préchauffer le four à 180°C.' || chr(10) || 'Étaler la pâte dans un moule à tarte. Piquer le fond.' || chr(10) || 'Éplucher et couper les pommes en quartiers, les disposer sur la pâte.' || chr(10) || 'Battre les œufs avec le sucre, la crème et la vanille.' || chr(10) || 'Verser l''appareil sur les pommes, saupoudrer de cannelle.' || chr(10) || 'Cuire 35 à 40 minutes jusqu''à coloration dorée.',
    ARRAY['dessert', 'four', 'fruits'],
    'https://www.themealdb.com/images/media/meals/qtqwwu1511792650.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '12 days'
  ),
  (
    gen_random_uuid(),
    'Risotto aux champignons',
    '300 g de riz arborio' || chr(10) || '400 g de champignons de Paris' || chr(10) || '1 oignon' || chr(10) || '2 gousses d''ail' || chr(10) || '15 cl de vin blanc sec' || chr(10) || '1 litre de bouillon de volaille chaud' || chr(10) || '50 g de parmesan râpé' || chr(10) || '30 g de beurre' || chr(10) || 'Huile d''olive' || chr(10) || 'Persil frais',
    'Faire revenir l''oignon et l''ail dans l''huile d''olive.' || chr(10) || 'Ajouter les champignons émincés, cuire 5 minutes.' || chr(10) || 'Incorporer le riz, bien nacrer 2 minutes.' || chr(10) || 'Déglacer au vin blanc, laisser absorber.' || chr(10) || 'Ajouter le bouillon chaud louche par louche en remuant constamment.' || chr(10) || 'Après 18 minutes, mantecare avec le beurre et le parmesan.' || chr(10) || 'Parsemer de persil et servir immédiatement.',
    ARRAY['végétarien', 'riz', 'plat'],
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Mushroom_Risotto_%284789415965%29.jpg/960px-Mushroom_Risotto_%284789415965%29.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '11 days'
  ),
  (
    gen_random_uuid(),
    'Salade niçoise',
    '200 g de thon en conserve' || chr(10) || '4 œufs durs' || chr(10) || '200 g de haricots verts cuits' || chr(10) || '2 tomates' || chr(10) || '1 poivron rouge' || chr(10) || '1 concombre' || chr(10) || 'Olives noires' || chr(10) || 'Anchois (optionnel)' || chr(10) || 'Huile d''olive, vinaigre de vin' || chr(10) || 'Basilic',
    'Cuire les haricots verts 7 minutes à l''eau bouillante salée, égoutter.' || chr(10) || 'Couper les tomates, le concombre et le poivron.' || chr(10) || 'Disposer toutes les crudités dans un grand plat.' || chr(10) || 'Ajouter le thon émietté, les œufs coupés en quartiers et les olives.' || chr(10) || 'Préparer la vinaigrette avec l''huile d''olive et le vinaigre.' || chr(10) || 'Assaisonner et décorer de basilic.',
    ARRAY['salade', 'été', 'rapide'],
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Salade_ni%C3%A7oise_%287545098258%29.jpg/960px-Salade_ni%C3%A7oise_%287545098258%29.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '10 days'
  ),
  (
    gen_random_uuid(),
    'Crêpes bretonnes',
    '250 g de farine' || chr(10) || '3 œufs' || chr(10) || '500 ml de lait' || chr(10) || '1 c. à soupe de beurre fondu' || chr(10) || '1 pincée de sel' || chr(10) || 'Beurre pour la cuisson',
    'Mélanger la farine et le sel dans un saladier.' || chr(10) || 'Creuser un puits, y casser les œufs et mélanger.' || chr(10) || 'Incorporer le lait progressivement pour éviter les grumeaux.' || chr(10) || 'Ajouter le beurre fondu, laisser reposer 1 heure.' || chr(10) || 'Cuire chaque crêpe 1 minute de chaque côté dans une poêle beurrée.' || chr(10) || 'Servir avec beurre et sucre, ou confiture.',
    ARRAY['dessert', 'petit-déjeuner', 'rapide'],
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Cr%C3%AApes_of_France_on_Brisbane%2C_Australia.jpg/960px-Cr%C3%AApes_of_France_on_Brisbane%2C_Australia.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '9 days'
  ),
  (
    gen_random_uuid(),
    'Bœuf bourguignon',
    '1 kg de bœuf (paleron ou joue)' || chr(10) || '750 ml de vin rouge de Bourgogne' || chr(10) || '200 g de lardons' || chr(10) || '250 g de champignons de Paris' || chr(10) || '2 oignons' || chr(10) || '2 carottes' || chr(10) || '3 gousses d''ail' || chr(10) || 'Bouquet garni' || chr(10) || 'Farine' || chr(10) || 'Huile, beurre',
    'Faire mariner le bœuf dans le vin avec les légumes et le bouquet garni une nuit.' || chr(10) || 'Le lendemain, égoutter et sécher la viande. Réserver la marinade.' || chr(10) || 'Faire revenir les lardons puis les réserver.' || chr(10) || 'Faire dorer les morceaux de bœuf dans la cocotte.' || chr(10) || 'Singer avec 2 cuillères de farine, bien mélanger.' || chr(10) || 'Ajouter la marinade filtrée, les lardons, cuire 3 heures à feu doux.' || chr(10) || 'Ajouter les champignons 30 minutes avant la fin.',
    ARRAY['viande', 'mijoté', 'dimanche'],
    'https://www.themealdb.com/images/media/meals/vtqxtu1511784197.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '8 days'
  ),
  (
    gen_random_uuid(),
    'Quiche lorraine',
    '1 pâte brisée' || chr(10) || '200 g de lardons fumés' || chr(10) || '3 œufs' || chr(10) || '30 cl de crème fraîche épaisse' || chr(10) || '10 cl de lait' || chr(10) || 'Noix de muscade' || chr(10) || 'Sel, poivre',
    'Préchauffer le four à 180°C.' || chr(10) || 'Foncer un moule à tarte avec la pâte, piquer le fond.' || chr(10) || 'Faire revenir les lardons à la poêle sans matière grasse.' || chr(10) || 'Battre les œufs avec la crème, le lait, la muscade, sel et poivre.' || chr(10) || 'Répartir les lardons sur la pâte.' || chr(10) || 'Verser l''appareil par-dessus.' || chr(10) || 'Cuire 35 minutes jusqu''à ce que la quiche soit bien dorée.',
    ARRAY['four', 'rapide', 'plat'],
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Quiche_lorraine_01.JPG/960px-Quiche_lorraine_01.JPG',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '7 days'
  ),
  (
    gen_random_uuid(),
    'Ratatouille provençale',
    '2 courgettes' || chr(10) || '2 aubergines' || chr(10) || '3 tomates' || chr(10) || '2 poivrons (rouge et vert)' || chr(10) || '2 oignons' || chr(10) || '4 gousses d''ail' || chr(10) || 'Herbes de Provence' || chr(10) || 'Huile d''olive' || chr(10) || 'Sel, poivre',
    'Couper tous les légumes en dés de taille égale.' || chr(10) || 'Faire revenir les oignons et l''ail dans l''huile d''olive.' || chr(10) || 'Ajouter les aubergines, cuire 10 minutes.' || chr(10) || 'Incorporer les poivrons, cuire 5 minutes de plus.' || chr(10) || 'Ajouter les courgettes puis les tomates.' || chr(10) || 'Assaisonner avec les herbes de Provence, sel et poivre.' || chr(10) || 'Laisser mijoter 30 minutes à feu doux à couvert.',
    ARRAY['végétarien', 'été', 'mijoté'],
    'https://www.themealdb.com/images/media/meals/wrpwuu1511786491.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '6 days'
  ),
  (
    gen_random_uuid(),
    'Taboulé libanais',
    '100 g de boulghour fin' || chr(10) || '4 tomates' || chr(10) || '1 gros bouquet de persil plat' || chr(10) || '1 bouquet de menthe fraîche' || chr(10) || '3 oignons verts' || chr(10) || 'Jus de 2 citrons' || chr(10) || '4 c. à soupe d''huile d''olive' || chr(10) || 'Sel',
    'Faire gonfler le boulghour dans de l''eau froide 15 minutes, égoutter.' || chr(10) || 'Hacher finement le persil, la menthe et les oignons verts.' || chr(10) || 'Couper les tomates en tout petits dés.' || chr(10) || 'Mélanger tous les ingrédients dans un saladier.' || chr(10) || 'Assaisonner avec le jus de citron, l''huile d''olive et le sel.' || chr(10) || 'Réfrigérer 1 heure pour que les saveurs se développent.',
    ARRAY['salade', 'été', 'végétarien'],
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flickr_-_cyclonebill_-_Tabbouleh.jpg/960px-Flickr_-_cyclonebill_-_Tabbouleh.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '5 days'
  ),
  (
    gen_random_uuid(),
    'Financiers aux amandes',
    '100 g de beurre' || chr(10) || '150 g de sucre glace' || chr(10) || '60 g de poudre d''amandes' || chr(10) || '50 g de farine' || chr(10) || '4 blancs d''œufs' || chr(10) || '1 c. à café d''extrait d''amande amère',
    'Préchauffer le four à 200°C.' || chr(10) || 'Faire fondre le beurre jusqu''à ce qu''il prenne une couleur noisette.' || chr(10) || 'Mélanger le sucre glace, la poudre d''amandes et la farine.' || chr(10) || 'Incorporer les blancs d''œufs légèrement battus.' || chr(10) || 'Ajouter le beurre noisette tiédi et l''extrait d''amande.' || chr(10) || 'Remplir les moules à financiers aux 3/4.' || chr(10) || 'Cuire 12 à 15 minutes jusqu''à coloration dorée.',
    ARRAY['dessert', 'gâteau', 'amandes'],
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Chocolate_financier.jpg/960px-Chocolate_financier.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '4 days'
  );
