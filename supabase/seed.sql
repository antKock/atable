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
    'Tarte aux pommes',
    'Pâte brisée : 250 g' || chr(10) || 'Pommes : 5 (type golden)' || chr(10) || 'Beurre : 50 g' || chr(10) || 'Sucre : 80 g' || chr(10) || 'Cannelle : 1 c. à café',
    'Préchauffer le four à 180 °C.' || chr(10) || 'Étaler la pâte dans un moule et piquer le fond.' || chr(10) || 'Peler et trancher les pommes finement.' || chr(10) || 'Disposer les tranches en rosace, saupoudrer de sucre et de cannelle, parsemer de noisettes de beurre.' || chr(10) || 'Enfourner 35 min jusqu''à dorure.',
    ARRAY['Dessert', 'Classique', 'Automne'],
    'https://www.themealdb.com/images/media/meals/wxywrq1468235321.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '10 days'
  ),
  (
    gen_random_uuid(),
    'Ratatouille',
    'Courgettes : 2' || chr(10) || 'Aubergine : 1' || chr(10) || 'Poivrons rouges : 2' || chr(10) || 'Tomates : 4' || chr(10) || 'Oignon : 1' || chr(10) || 'Ail : 3 gousses' || chr(10) || 'Huile d''olive : 4 c. à soupe',
    'Couper tous les légumes en rondelles ou en dés.' || chr(10) || 'Faire revenir l''oignon et l''ail dans l''huile d''olive 5 min.' || chr(10) || 'Ajouter les poivrons, puis les courgettes et l''aubergine.' || chr(10) || 'Incorporer les tomates, saler, poivrer et laisser mijoter 30 min à feu doux.' || chr(10) || 'Ajuster l''assaisonnement et servir chaud ou froid.',
    ARRAY['Légumes', 'Provençal', 'Été'],
    'https://www.themealdb.com/images/media/meals/wrpwuu1511786491.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '9 days'
  ),
  (
    gen_random_uuid(),
    'Bœuf bourguignon',
    'Bœuf à braiser : 1 kg' || chr(10) || 'Lardons : 200 g' || chr(10) || 'Champignons : 200 g' || chr(10) || 'Vin rouge (Bourgogne) : 75 cl' || chr(10) || 'Oignons grelots : 200 g' || chr(10) || 'Carottes : 2' || chr(10) || 'Bouquet garni : 1',
    'Faire mariner le bœuf dans le vin avec les légumes 2 h.' || chr(10) || 'Faire revenir les lardons et les oignons, réserver.' || chr(10) || 'Saisir le bœuf égoutté sur toutes les faces.' || chr(10) || 'Ajouter la marinade, les légumes, le bouquet garni. Couvrir et cuire 2 h à 160 °C.' || chr(10) || 'Ajouter les champignons 20 min avant la fin. Servir avec des pommes vapeur.',
    ARRAY['Viande', 'Mijoté', 'Hiver'],
    'https://www.themealdb.com/images/media/meals/uyqrrv1511553350.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '8 days'
  ),
  (
    gen_random_uuid(),
    'Crème brûlée',
    'Crème liquide entière : 50 cl' || chr(10) || 'Jaunes d''œufs : 6' || chr(10) || 'Sucre : 100 g + pour brûler' || chr(10) || 'Gousse de vanille : 1',
    'Infuser la vanille dans la crème chauffée 15 min.' || chr(10) || 'Fouetter les jaunes avec le sucre jusqu''à blanchiment.' || chr(10) || 'Verser la crème tiède sur les jaunes en mélangeant doucement.' || chr(10) || 'Répartir dans des ramequins et cuire au bain-marie 40 min à 150 °C.' || chr(10) || 'Réfrigérer 2 h, saupoudrer de sucre et brûler au chalumeau.',
    ARRAY['Dessert', 'Classique'],
    null,
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '7 days'
  ),
  (
    gen_random_uuid(),
    'Quiche lorraine',
    'Pâte brisée : 1 rouleau' || chr(10) || 'Lardons fumés : 200 g' || chr(10) || 'Crème fraîche : 20 cl' || chr(10) || 'Œufs : 3' || chr(10) || 'Gruyère râpé : 80 g' || chr(10) || 'Noix de muscade : 1 pincée',
    'Foncer la pâte dans un moule et précuire 10 min à 180 °C.' || chr(10) || 'Faire revenir les lardons à sec.' || chr(10) || 'Mélanger crème, œufs, muscade, sel, poivre.' || chr(10) || 'Garnir le fond de tarte avec les lardons, verser l''appareil, parsemer de gruyère.' || chr(10) || 'Cuire 30 min à 180 °C.',
    ARRAY['Tartes salées', 'Classique'],
    null,
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '6 days'
  ),
  (
    gen_random_uuid(),
    'Soupe à l''oignon',
    'Oignons : 1 kg' || chr(10) || 'Bouillon de bœuf : 1,5 l' || chr(10) || 'Beurre : 50 g' || chr(10) || 'Farine : 2 c. à soupe' || chr(10) || 'Pain de campagne : 4 tranches' || chr(10) || 'Gruyère râpé : 150 g' || chr(10) || 'Vin blanc sec : 10 cl',
    'Émincer les oignons et les faire caraméliser dans le beurre 30 min à feu moyen.' || chr(10) || 'Saupoudrer de farine, mélanger 2 min.' || chr(10) || 'Déglacer au vin blanc, ajouter le bouillon chaud.' || chr(10) || 'Laisser mijoter 20 min, assaisonner.' || chr(10) || 'Verser dans des bols, déposer une tranche de pain grillée, recouvrir de gruyère et gratiner au four.',
    ARRAY['Soupe', 'Hiver', 'Classique'],
    null,
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '5 days'
  ),
  (
    gen_random_uuid(),
    'Salade niçoise',
    'Thon en boîte : 200 g' || chr(10) || 'Œufs durs : 4' || chr(10) || 'Tomates cerises : 200 g' || chr(10) || 'Haricots verts cuits : 200 g' || chr(10) || 'Olives noires : 80 g' || chr(10) || 'Anchois : 8 filets' || chr(10) || 'Vinaigrette à la moutarde : 4 c. à soupe',
    'Égoutter le thon et l''effeuiller.' || chr(10) || 'Couper les tomates en deux, les œufs en quartiers.' || chr(10) || 'Disposer tous les ingrédients harmonieusement dans un grand plat.' || chr(10) || 'Assaisonner de vinaigrette et servir immédiatement.',
    ARRAY['Salade', 'Été', 'Méditerranéen'],
    null,
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '4 days'
  ),
  (
    gen_random_uuid(),
    'Coq au vin',
    'Poulet fermier : 1 (découpé)' || chr(10) || 'Vin rouge : 75 cl' || chr(10) || 'Lardons : 150 g' || chr(10) || 'Champignons de Paris : 250 g' || chr(10) || 'Oignon : 2' || chr(10) || 'Ail : 4 gousses' || chr(10) || 'Bouquet garni : 1',
    'Faire mariner le poulet dans le vin avec aromates 1 h.' || chr(10) || 'Faire dorer les morceaux de poulet égouttés, réserver.' || chr(10) || 'Faire revenir lardons et oignons. Ajouter l''ail, saupoudrer de farine.' || chr(10) || 'Remettre le poulet, verser la marinade, ajouter le bouquet garni.' || chr(10) || 'Couvrir et mijoter 45 min. Ajouter les champignons 15 min avant la fin.',
    ARRAY['Volaille', 'Mijoté', 'Classique'],
    'https://www.themealdb.com/images/media/meals/qspttq1511386819.jpg',
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '3 days'
  ),
  (
    gen_random_uuid(),
    'Madeleines',
    'Farine : 150 g' || chr(10) || 'Sucre : 150 g' || chr(10) || 'Beurre fondu : 150 g' || chr(10) || 'Œufs : 3' || chr(10) || 'Levure chimique : 1 sachet' || chr(10) || 'Zeste de citron : 1',
    'Fouetter les œufs avec le sucre jusqu''à ce que le mélange blanchisse.' || chr(10) || 'Incorporer la farine et la levure tamisées, puis le beurre fondu tiède et le zeste de citron.' || chr(10) || 'Réfrigérer la pâte 1 h.' || chr(10) || 'Beurrer les moules, remplir aux 3/4.' || chr(10) || 'Cuire 12 min à 200 °C — la bosse se forme à la chaleur initiale.',
    ARRAY['Dessert', 'Biscuit', 'Goûter'],
    null,
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '2 days'
  ),
  (
    gen_random_uuid(),
    'Croissants maison',
    'Farine T45 : 500 g' || chr(10) || 'Beurre de tourage : 250 g' || chr(10) || 'Lait tiède : 200 ml' || chr(10) || 'Levure fraîche : 20 g' || chr(10) || 'Sucre : 50 g' || chr(10) || 'Sel : 10 g' || chr(10) || 'Beurre fondu : 30 g',
    'Dissoudre la levure dans le lait tiède, laisser activer 10 min.' || chr(10) || 'Mélanger farine, sucre, sel, puis le lait levuré et le beurre fondu. Pétrir 10 min. Réfrigérer 1 h.' || chr(10) || 'Étaler la pâte, incorporer le beurre de tourage par tourage (6 tours).' || chr(10) || 'Abaisser et découper des triangles, rouler en croissants.' || chr(10) || 'Laisser lever 2 h à température ambiante, dorer et cuire 18 min à 200 °C.',
    ARRAY['Viennoiserie', 'Boulangerie', 'Petit-déjeuner'],
    null,
    '00000000-0000-0000-0000-000000000000',
    true,
    NOW() - interval '1 day'
  );
