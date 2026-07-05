-- seed.sql: Demo household + 30 enriched seed recipes for Mijote.
-- Auto-generated from the live prod demo (metadata, tags and AI images baked in).
-- Run once after migrations. Recipe images live in Supabase Storage at
-- recipe-photos/generated/<id>/ai-image.webp and must exist in the target
-- project (copied there by the demo build/mirror scripts). Point :supabase_url
-- at the target project before running (default below = prod):
--   psql "$CONN" -v supabase_url=https://<ref>.supabase.co -f supabase/seed.sql
\set supabase_url 'https://qqbzmxufewakkghzmghs.supabase.co'

INSERT INTO households (id, name, join_code, is_demo, created_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'Démo Mijote', 'DEMO-0000', true, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO recipes (id, title, ingredients, steps, generated_image_url, household_id, is_seed, prep_time, cook_time, cost, complexity, seasons, image_prompt, enrichment_status, image_status, source, created_at)
VALUES
  ('d961a749-ff1f-4739-89f1-68d209bd34a2', 'Soupe de lentilles corail', '250 g de lentilles corail
1 oignon
2 carottes
1 c. à café de cumin
1 c. à café de curcuma
1 litre de bouillon de légumes
Huile d''olive
Sel, poivre', 'Faire revenir l''oignon émincé dans l''huile d''olive 5 minutes.
Ajouter les carottes en rondelles, le cumin et le curcuma.
Incorporer les lentilles rincées et le bouillon.
Laisser mijoter 25 minutes à feu doux.
Mixer le tout jusqu''à obtenir une texture veloutée.
Rectifier l''assaisonnement.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/d961a749-ff1f-4739-89f1-68d209bd34a2/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '30 min - 1h', '€', 'facile', ARRAY['hiver','automne']::text[], 'A creamy orange-red lentil soup served in a rustic bowl, garnished with a sprinkle of cumin and a drizzle of olive oil. The bowl is surrounded by a few fresh carrots and an onion, with a wooden spoon resting next to it. The background is softly blurred to highlight the soup, with warm, inviting colors.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 30)),
  ('d18fbb9d-1943-4e1c-a144-de46e15a753c', 'Mousse au chocolat', '200 g de chocolat noir (70%)
6 œufs
1 pincée de sel
2 c. à soupe de sucre', 'Faire fondre le chocolat au bain-marie, laisser tiédir.
Séparer les blancs des jaunes.
Incorporer les jaunes un par un au chocolat fondu.
Monter les blancs en neige ferme avec le sel.
Ajouter le sucre aux blancs à mi-parcours.
Incorporer délicatement les blancs au mélange chocolaté en trois fois.
Réfrigérer au moins 2 heures avant de servir.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/d18fbb9d-1943-4e1c-a144-de46e15a753c/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '20-30 min', 'Aucune', '€€€', 'moyen', ARRAY['ete']::text[], 'A beautifully plated chocolate mousse in a glass serving dish, showcasing a rich dark chocolate color topped with a light dusting of cocoa powder. The mousse is fluffy and airy, with a smooth texture. Garnished with a sprig of mint and small chocolate shavings on the top. The background is softly blurred, emphasizing the dessert, with natural light illuminating the glass.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 29)),
  ('84ec4b1e-f8fa-4e7f-9370-f91e390f7f22', 'Poulet rôti aux herbes', '1 poulet entier (1,5 kg)
4 gousses d''ail
1 citron
Thym frais
Romarin frais
3 c. à soupe d''huile d''olive
Sel, poivre', 'Préchauffer le four à 200°C.
Mélanger l''huile d''olive avec l''ail écrasé, le thym et le romarin.
Frotter le poulet avec ce mélange, saler et poivrer généreusement.
Glisser le citron coupé en deux dans la cavité.
Enfourner 1h15 en arrosant toutes les 20 minutes.
Laisser reposer 10 minutes avant de découper.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/84ec4b1e-f8fa-4e7f-9370-f91e390f7f22/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '1h - 2h', '€€', 'facile', ARRAY['automne','hiver']::text[], 'A beautifully roasted whole chicken with golden-brown skin, garnished with fresh herbs like rosemary and thyme. There are two lemon halves inside the cavity, and the chicken is resting on a wooden cutting board, surrounded by sprigs of herbs. The background features a rustic kitchen setting with warm lighting, creating a cozy atmosphere.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 28)),
  ('a1d05662-13ae-438a-ace5-3d3d873ebccc', 'Tarte aux pommes grand-mère', '1 pâte brisée
5 pommes (Golden ou Reine des Reinettes)
3 œufs
150 g de sucre
20 cl de crème fraîche
1 sachet de sucre vanillé
Cannelle', 'Préchauffer le four à 180°C.
Étaler la pâte dans un moule à tarte. Piquer le fond.
Éplucher et couper les pommes en quartiers, les disposer sur la pâte.
Battre les œufs avec le sucre, la crème et la vanille.
Verser l''appareil sur les pommes, saupoudrer de cannelle.
Cuire 35 à 40 minutes jusqu''à coloration dorée.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/a1d05662-13ae-438a-ace5-3d3d873ebccc/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '30 min - 1h', '€', 'facile', ARRAY['automne','hiver']::text[], 'A golden-brown apple tart presented on a rustic wooden table. The tart is sliced, revealing layers of sweet apples arranged on a creamy custard base, lightly dusted with cinnamon. The edges of the pastry are perfectly crisp, and a few whole apples are artistically placed around for decoration. Warm light highlights the tart''s texture and colors.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 27)),
  ('427ab9ca-440c-4de5-830c-9aee3bcd473a', 'Gratin dauphinois', '1 kg de pommes de terre à chair ferme
50 cl de crème fraîche liquide
2 gousses d''ail
Noix de muscade
Sel, poivre
Beurre pour le plat', 'Préchauffer le four à 160°C.
Éplucher et trancher les pommes de terre en rondelles fines (2 mm).
Frotter le plat à gratin avec l''ail, puis beurrer.
Disposer les rondelles en couches, saler, poivrer, muscader.
Verser la crème fraîche qui doit presque recouvrir les pommes de terre.
Cuire 1h30 jusqu''à ce que le dessus soit doré et que la lame d''un couteau s''enfonce facilement.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/427ab9ca-440c-4de5-830c-9aee3bcd473a/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '30-45 min', '1h - 2h', '€€', 'facile', ARRAY['automne','hiver']::text[], 'A golden-brown gratin dauphinois served in a rustic ceramic dish, with layers of creamy potato slices visible, garnished with a sprinkle of nutmeg on top. The dish is placed on a wooden table, with some fresh herbs around for decoration, and soft light highlighting its creamy texture.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 26)),
  ('593f2f0f-3289-4186-8dcf-5c2fb99ba853', 'Risotto aux champignons', '300 g de riz arborio
400 g de champignons de Paris
1 oignon
2 gousses d''ail
15 cl de vin blanc sec
1 litre de bouillon de volaille chaud
50 g de parmesan râpé
30 g de beurre
Huile d''olive
Persil frais', 'Faire revenir l''oignon et l''ail dans l''huile d''olive.
Ajouter les champignons émincés, cuire 5 minutes.
Incorporer le riz, bien nacrer 2 minutes.
Déglacer au vin blanc, laisser absorber.
Ajouter le bouillon chaud louche par louche en remuant constamment.
Après 18 minutes, mantecare avec le beurre et le parmesan.
Parsemer de persil et servir immédiatement.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/593f2f0f-3289-4186-8dcf-5c2fb99ba853/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '30 min - 1h', '€€', 'facile', ARRAY['printemps','ete','automne','hiver']::text[], 'A creamy mushroom risotto served in a white bowl, with a sprinkle of freshly chopped parsley on top. The risotto is rich and creamy, highlighting the earthy tones of the mushrooms. In the background, a rustic wooden table adds warmth to the scene, while a glass of white wine sits gracefully beside the bowl. The angle of view is slightly above to capture the texture and color of the dish.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 25)),
  ('a3f604fe-f0c4-4816-bf3c-f8e9cde75508', 'Salade niçoise', '200 g de thon en conserve
4 œufs durs
200 g de haricots verts cuits
2 tomates
1 poivron rouge
1 concombre
Olives noires
Anchois (optionnel)
Huile d''olive, vinaigre de vin
Basilic', 'Cuire les haricots verts 7 minutes à l''eau bouillante salée, égoutter.
Couper les tomates, le concombre et le poivron.
Disposer toutes les crudités dans un grand plat.
Ajouter le thon émietté, les œufs coupés en quartiers et les olives.
Préparer la vinaigrette avec l''huile d''olive et le vinaigre.
Assaisonner et décorer de basilic.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/a3f604fe-f0c4-4816-bf3c-f8e9cde75508/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '< 10 min', '< 15 min', '€', 'facile', ARRAY['ete']::text[], 'A beautifully arranged Niçoise salad on a large white plate. The salad features vibrant colors: bright green haricots verts, rich red tomatoes, crisp yellow and green bell peppers, and the deep blue-black of olives. There are quarters of hard-boiled eggs and chunks of canned tuna scattered throughout. Garnished with fresh basil leaves, the dish is drizzled with light olive oil and vinegar. The angle of view is slightly elevated to capture the full spectrum of colors and textures.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 24)),
  ('f3b3410e-1670-4443-880a-40ee5b8d88ef', 'Crêpes bretonnes', '250 g de farine
3 œufs
500 ml de lait
1 c. à soupe de beurre fondu
1 pincée de sel
Beurre pour la cuisson', 'Mélanger la farine et le sel dans un saladier.
Creuser un puits, y casser les œufs et mélanger.
Incorporer le lait progressivement pour éviter les grumeaux.
Ajouter le beurre fondu, laisser reposer 1 heure.
Cuire chaque crêpe 1 minute de chaque côté dans une poêle beurrée.
Servir avec beurre et sucre, ou confiture.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/f3b3410e-1670-4443-880a-40ee5b8d88ef/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '< 15 min', '€', 'facile', ARRAY['printemps','ete','automne','hiver']::text[], 'A stack of golden-brown Breton crêpes served on a rustic wooden plate, drizzled with melted butter and dusted with sugar. A small jar of strawberry jam is placed beside the plate, adding a pop of red color. The scene is slightly top-down, showcasing the texture of the crêpes and the inviting presentation on a textured linen tablecloth.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 23)),
  ('ea9ce007-bf10-4cce-a354-39a73b2c88cf', 'Bœuf bourguignon', '1 kg de bœuf (paleron ou joue)
750 ml de vin rouge de Bourgogne
200 g de lardons
250 g de champignons de Paris
2 oignons
2 carottes
3 gousses d''ail
Bouquet garni
Farine
Huile, beurre', 'Faire mariner le bœuf dans le vin avec les légumes et le bouquet garni une nuit.
Le lendemain, égoutter et sécher la viande. Réserver la marinade.
Faire revenir les lardons puis les réserver.
Faire dorer les morceaux de bœuf dans la cocotte.
Singer avec 2 cuillères de farine, bien mélanger.
Ajouter la marinade filtrée, les lardons, cuire 3 heures à feu doux.
Ajouter les champignons 30 minutes avant la fin.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/ea9ce007-bf10-4cce-a354-39a73b2c88cf/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '> 45 min', '1h - 2h', '€€', 'moyen', ARRAY['automne','hiver']::text[], 'A beautiful bowl of beef bourguignon, rich in deep red wine sauce, garnished with finely chopped parsley. The dish features tender chunks of beef, lardons, and sliced mushrooms, with a glossy finish from the sauce. The vibrant colors of the carrots and onions peek through, set against a rustic wooden table background, captured from a top-down angle.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 22)),
  ('8cdc69bc-bd3e-42c6-901d-dd82319aa578', 'Quiche lorraine', '1 pâte brisée
200 g de lardons fumés
3 œufs
30 cl de crème fraîche épaisse
10 cl de lait
Noix de muscade
Sel, poivre', 'Préchauffer le four à 180°C.
Foncer un moule à tarte avec la pâte, piquer le fond.
Faire revenir les lardons à la poêle sans matière grasse.
Battre les œufs avec la crème, le lait, la muscade, sel et poivre.
Répartir les lardons sur la pâte.
Verser l''appareil par-dessus.
Cuire 35 minutes jusqu''à ce que la quiche soit bien dorée.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/8cdc69bc-bd3e-42c6-901d-dd82319aa578/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '30 min - 1h', '€', 'facile', ARRAY['printemps','ete','automne','hiver']::text[], 'A freshly baked Quiche Lorraine on a wooden table, golden-brown crust with crispy lardons visible on the top, garnished with a sprinkle of fresh herbs. The slice of quiche reveals a creamy filling with a hint of nutmeg. The dish is presented on a rustic ceramic pie plate, with a fork and a side salad in the background. Natural light enhances the colors of the ingredients.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 21)),
  ('c3802e3e-3021-47ab-85da-6c28be765526', 'Ratatouille provençale', '2 courgettes
2 aubergines
3 tomates
2 poivrons (rouge et vert)
2 oignons
4 gousses d''ail
Herbes de Provence
Huile d''olive
Sel, poivre', 'Couper tous les légumes en dés de taille égale.
Faire revenir les oignons et l''ail dans l''huile d''olive.
Ajouter les aubergines, cuire 10 minutes.
Incorporer les poivrons, cuire 5 minutes de plus.
Ajouter les courgettes puis les tomates.
Assaisonner avec les herbes de Provence, sel et poivre.
Laisser mijoter 30 minutes à feu doux à couvert.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/c3802e3e-3021-47ab-85da-6c28be765526/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '< 10 min', '30 min - 1h', '€', 'facile', ARRAY['printemps','ete','automne']::text[], 'A colorful ratatouille served in a rustic bowl, showcasing vibrant diced zucchini, eggplant, tomatoes, red and green bell peppers, and onions. The dish is garnished with fresh herbs, with a drizzle of olive oil. The background features a wooden table and a small bouquet of Provençal herbs to enhance the rustic French aesthetic.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 20)),
  ('17ab1bb8-725b-49f9-9c91-a5364b0358e3', 'Taboulé libanais', '100 g de boulghour fin
4 tomates
1 gros bouquet de persil plat
1 bouquet de menthe fraîche
3 oignons verts
Jus de 2 citrons
4 c. à soupe d''huile d''olive
Sel', 'Faire gonfler le boulghour dans de l''eau froide 15 minutes, égoutter.
Hacher finement le persil, la menthe et les oignons verts.
Couper les tomates en tout petits dés.
Mélanger tous les ingrédients dans un saladier.
Assaisonner avec le jus de citron, l''huile d''olive et le sel.
Réfrigérer 1 heure pour que les saveurs se développent.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/17ab1bb8-725b-49f9-9c91-a5364b0358e3/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '20-30 min', 'Aucune', '€', 'facile', ARRAY['printemps','ete','automne']::text[], 'A vibrant and fresh Lebanese tabbouleh, featuring finely chopped parsley, mint, and onions mixed with diced tomatoes and bulgur. The dish is presented in a large white bowl, garnished with lemon wedges and a drizzle of olive oil, on a rustic wooden table. The colors include deep green from the herbs, bright red from the tomatoes, and golden yellow from the lemon. The photo is taken from a top-down angle.', 'enriched', 'generated', 'unknown', NOW() - (interval '1 day' * 19)),
  ('00000000-0000-0000-0000-000000000013', 'Blanquette de veau', '800 g d''épaule de veau
2 carottes
1 oignon
1 clou de girofle
1 bouquet garni
50 g de beurre
50 g de farine
1 jaune d''œuf
10 cl de crème fraîche
1 citron
Sel, poivre', 'Couper le veau en gros cubes et le mettre dans une cocotte avec de l''eau froide.
Porter à ébullition, écumer, puis ajouter les carottes, l''oignon piqué du clou de girofle et le bouquet garni.
Laisser mijoter 1h30 à feu doux.
Préparer un roux blanc avec le beurre et la farine, puis mouiller avec le bouillon de cuisson.
Lier la sauce hors du feu avec le jaune d''œuf et la crème.
Ajouter un filet de jus de citron, rectifier l''assaisonnement et napper la viande.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000013/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '30-45 min', '1h - 2h', '€€', 'moyen', ARRAY['hiver']::text[], 'A beautifully presented Veal Blanquette in a white ceramic bowl, featuring tender veal chunks coated in a creamy, pale sauce. The dish is garnished with sliced carrots and a sprinkle of finely chopped parsley. The bowl is set on a rustic wooden table, highlighting the warmth of the dish. The background is softly blurred, emphasizing the creamy texture and inviting appearance of the veal.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 18)),
  ('00000000-0000-0000-0000-000000000014', 'Magret de canard, sauce au miel', '2 magrets de canard
3 c. à soupe de miel
2 c. à soupe de vinaigre balsamique
10 cl de bouillon de volaille
Sel, poivre', 'Quadriller la peau des magrets au couteau.
Les saisir côté peau dans une poêle froide, 6 à 8 minutes, jusqu''à ce que la graisse fonde.
Retourner et cuire 3 à 4 minutes côté chair pour une cuisson rosée.
Réserver les magrets et dégraisser la poêle.
Déglacer au vinaigre, ajouter le miel et le bouillon, laisser réduire en sauce sirupeuse.
Trancher les magrets et napper de sauce au miel.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000014/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '< 15 min', '€€', 'facile', ARRAY['automne','hiver']::text[], 'A beautifully plated duck breast with crispy skin, sliced to show its pink interior, drizzled with a glossy honey sauce. The dish is presented on a white plate, with the rich brown sauce pooling around the duck. The colors are warm and inviting, with the golden hue of the honey contrasting against the dark, savory tones of the duck. The setting is simple and elegant, shot from a slightly elevated angle.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 17)),
  ('00000000-0000-0000-0000-000000000015', 'Chili con carne', '500 g de bœuf haché
1 boîte de haricots rouges
1 boîte de tomates concassées
1 oignon
2 gousses d''ail
1 poivron rouge
1 c. à café de cumin
1 c. à café de paprika
1 pincée de piment
Huile d''olive, sel', 'Faire revenir l''oignon, l''ail et le poivron émincés dans l''huile.
Ajouter la viande hachée et la faire dorer.
Incorporer les épices et mélanger.
Ajouter les tomates concassées et laisser mijoter 20 minutes.
Ajouter les haricots rouges égouttés et poursuivre 15 minutes.
Rectifier l''assaisonnement et servir bien chaud.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000015/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '30 min - 1h', '€€', 'facile', ARRAY['hiver','automne']::text[], 'A hearty bowl of Chili con carne with ground beef, kidney beans, and diced tomatoes. The dish is garnished with bits of red bell pepper and a sprinkle of spices. The bowl is rustic and set on a wooden table with a warm, inviting color palette of reds and browns. The dish is steaming slightly, suggesting it''s hot and freshly made, viewed from a slight angle to capture the textures and colors.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 16)),
  ('00000000-0000-0000-0000-000000000016', 'Couscous poulet-merguez', '4 cuisses de poulet
8 merguez
2 carottes
2 courgettes
1 boîte de pois chiches
2 navets
1 oignon
2 c. à soupe de ras-el-hanout
300 g de semoule
Huile d''olive, sel', 'Faire dorer le poulet et l''oignon dans une grande cocotte.
Ajouter les épices, puis les légumes coupés en gros morceaux.
Couvrir d''eau, ajouter les pois chiches et laisser mijoter 45 minutes.
Faire griller les merguez à la poêle.
Préparer la semoule en la gonflant avec de l''eau chaude et un filet d''huile.
Servir la semoule avec les légumes, le bouillon, le poulet et les merguez.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000016/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '30-45 min', '30 min - 1h', '€€', 'moyen', ARRAY['automne','hiver']::text[], 'A vibrant dish featuring golden chicken thighs and grilled merguez sausages on a bed of fluffy couscous. The couscous is topped with a colorful medley of chunky carrots, zucchini, turnips, and chickpeas, all bathed in a fragrant broth. The scene is garnished with spices, emphasizing the dish''s robust flavors, presented in a large rustic bowl, from a slightly elevated angle.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 15)),
  ('00000000-0000-0000-0000-000000000017', 'Burger maison', '4 pains à burger
4 steaks hachés
4 tranches de cheddar
1 oignon rouge
4 feuilles de salade
2 tomates
Ketchup et moutarde
Sel, poivre', 'Former et assaisonner les steaks hachés.
Les cuire à la poêle 3 à 4 minutes de chaque côté.
Déposer une tranche de cheddar sur chaque steak en fin de cuisson pour la faire fondre.
Toaster légèrement les pains.
Garnir avec salade, tomate, oignon, steak et sauces.
Refermer et servir aussitôt.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000017/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '15-30 min', '€', 'facile', ARRAY['ete']::text[], 'A delicious homemade burger displayed on a wooden board. The burger features a golden toasted bun, a perfectly cooked beef patty with melted cheddar cheese on top. Fresh green lettuce, sliced red onion, and juicy red tomato slices are visible, adding vibrant colors. Ketchup and mustard are artistically drizzled on the side of the plate. The burger is presented in an inviting manner, ready to be enjoyed.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 14)),
  ('00000000-0000-0000-0000-000000000018', 'Saumon en papillote', '4 pavés de saumon
1 citron
2 courgettes
1 échalote
Aneth frais
Huile d''olive
Sel, poivre', 'Préchauffer le four à 200°C.
Déposer chaque pavé sur une feuille de papier cuisson.
Ajouter des rondelles de courgette, de l''échalote émincée et des tranches de citron.
Arroser d''huile d''olive, saler, poivrer et parsemer d''aneth.
Fermer hermétiquement les papillotes.
Enfourner 15 à 18 minutes et servir aussitôt.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000018/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '< 15 min', '€€', 'facile', ARRAY['printemps','ete','automne']::text[], 'A beautifully arranged plate of salmon fillets wrapped in parchment paper, with vibrant green spiralized zucchini, thinly sliced onion, and bright lemon segments peeking out. The salmon has a light glaze of olive oil and is garnished with fresh dill. The scene is well-lit and presented from a top-down view, focusing on the fresh, colorful ingredients, accentuated with a soft, neutral background.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 13)),
  ('00000000-0000-0000-0000-000000000019', 'Lasagnes à la bolognaise', '12 feuilles de lasagne
500 g de bœuf haché
1 boîte de tomates concassées
1 oignon
2 gousses d''ail
50 cl de béchamel
100 g de parmesan râpé
Huile d''olive
Sel, poivre', 'Faire revenir l''oignon et l''ail, ajouter la viande et la faire dorer.
Ajouter les tomates et laisser mijoter 20 minutes pour la sauce bolognaise.
Dans un plat, alterner couches de bolognaise, feuilles de lasagne et béchamel.
Terminer par de la béchamel et du parmesan.
Enfourner à 180°C pendant 35 minutes.
Laisser reposer 5 minutes avant de servir.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000019/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '30-45 min', '30 min - 1h', '€€', 'facile', ARRAY['hiver','automne']::text[], 'A rectangular dish of lasagna freshly baked, with layers visible of rich meaty bolognese sauce and creamy béchamel. Topped with a golden, bubbly layer of grated parmesan. The lasagna is garnished with a light drizzle of olive oil, served on a wooden surface. The dish is presented at a slight angle to emphasize the layers, inviting and hearty, with warm shades of orange and brown.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 12)),
  ('00000000-0000-0000-0000-000000000020', 'Pad thaï aux crevettes', '200 g de nouilles de riz
250 g de crevettes décortiquées
2 œufs
100 g de pousses de soja
2 c. à soupe de sauce nuoc-mâm
1 c. à soupe de sauce soja
1 citron vert
50 g de cacahuètes
2 oignons verts', 'Réhydrater les nouilles de riz dans l''eau chaude.
Faire sauter les crevettes dans un wok, réserver.
Brouiller les œufs dans le wok.
Ajouter les nouilles, les sauces et le jus de citron vert.
Incorporer les crevettes et les pousses de soja, faire sauter 2 minutes.
Servir avec cacahuètes concassées et oignons verts.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000020/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '20-30 min', '< 15 min', '€€', 'facile', ARRAY['ete']::text[], 'A beautifully arranged plate of Pad Thaï with shrimp, showcasing the rice noodles stir-fried with vegetables. The dish is garnished with crushed peanuts and sliced green onions. The vibrant colors of the white noodles, pink shrimp, and green sprouts are prominent. The lime is cut in half, placed beside the dish for freshness. The scene is viewed from the top angle, making it eye-catching and appetizing.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 11)),
  ('00000000-0000-0000-0000-000000000021', 'Gnocchis à la crème', '500 g de gnocchis
20 cl de crème fraîche
100 g de parmesan râpé
2 gousses d''ail
Noix de muscade
Huile d''olive
Sel, poivre', 'Cuire les gnocchis dans l''eau bouillante salée jusqu''à ce qu''ils remontent.
Faire revenir l''ail dans l''huile d''olive.
Ajouter la crème et le parmesan, chauffer doucement.
Assaisonner d''une pointe de muscade, sel et poivre.
Égoutter les gnocchis et les mélanger à la sauce.
Servir aussitôt avec un peu de parmesan.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000021/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '< 15 min', '€', 'facile', ARRAY['automne','hiver']::text[], 'A delicious plate of creamy gnocchi, topped with grated parmesan cheese, served in a shallow white dish. The gnocchi are plump and coated in a smooth white cream sauce, flecked with golden bits of sautéed garlic. A sprinkle of grated nutmeg adds a touch of warmth, while a drizzle of olive oil glistens on the surface. The plate is set on a rustic wooden table, with a few scattered cheese shavings around it.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 10)),
  ('00000000-0000-0000-0000-000000000022', 'Curry de pois chiches', '2 boîtes de pois chiches
1 boîte de lait de coco
1 boîte de tomates concassées
1 oignon
2 gousses d''ail
1 morceau de gingembre
2 c. à soupe de curry
Coriandre fraîche
Huile, sel', 'Faire revenir l''oignon, l''ail et le gingembre hachés.
Ajouter le curry et mélanger pour libérer les arômes.
Incorporer les tomates et le lait de coco.
Ajouter les pois chiches égouttés.
Laisser mijoter 20 minutes à feu doux.
Servir avec de la coriandre ciselée et du riz.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000022/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '30 min - 1h', '€', 'facile', ARRAY['printemps','ete','automne','hiver']::text[], 'A vibrant bowl of chickpea curry featuring creamy coconut milk and vibrant red tomatoes. The curry is garnished with fresh chopped cilantro, and you can see pieces of onion, garlic, and ginger. The dish is served in a rustic bowl with a side of fluffy white rice and a wooden spoon, all sitting on a simple, textured tablecloth. The colors are warm and inviting, with hints of yellow from the curry, green from the cilantro, and red from the tomatoes.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 9)),
  ('00000000-0000-0000-0000-000000000023', 'Tartiflette', '1 kg de pommes de terre
1 reblochon
200 g de lardons
2 oignons
10 cl de vin blanc sec
20 cl de crème fraîche
Poivre', 'Cuire les pommes de terre à l''eau, puis les couper en rondelles.
Faire revenir les oignons émincés et les lardons.
Déglacer au vin blanc.
Mélanger pommes de terre, lardons, oignons et crème dans un plat.
Couper le reblochon en deux et le poser croûte vers le haut.
Enfourner à 200°C pendant 25 minutes.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000023/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '30-45 min', '30 min - 1h', '€€', 'moyen', ARRAY['hiver']::text[], 'A golden-brown tartiflette baked in a round dish, with visible layers of creamy potato, crispy bacon, and melted reblochon cheese on top, glistening with a rich golden hue. The dish is placed on a rustic wooden table, surrounded by a light scattering of coarse black pepper. The angle is slightly overhead, allowing a clear view of the bubbling cheese and the crown of crispy edges.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 8)),
  ('00000000-0000-0000-0000-000000000024', 'Velouté de potimarron', '1 potimarron
1 pomme de terre
1 oignon
50 cl de bouillon de légumes
10 cl de crème fraîche
Noix de muscade
Huile d''olive
Sel, poivre', 'Couper le potimarron et la pomme de terre en morceaux.
Faire revenir l''oignon émincé dans l''huile.
Ajouter les légumes et le bouillon.
Laisser cuire 25 minutes jusqu''à ce que tout soit tendre.
Mixer finement avec la crème.
Assaisonner de muscade, sel et poivre.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000024/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '30 min - 1h', '€', 'facile', ARRAY['automne','hiver']::text[], 'A creamy pumpkin soup in a rustic bowl, vibrant orange color, garnished subtly with a sprinkle of nutmeg, served with a drizzle of cream. The bowl is placed on a wooden table with a linen napkin beside it, captured from a slightly elevated angle.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 7)),
  ('00000000-0000-0000-0000-000000000025', 'Soupe à l''oignon gratinée', '6 oignons
50 g de beurre
1 c. à soupe de farine
1 l de bouillon de bœuf
1 verre de vin blanc
4 tranches de pain
150 g de gruyère râpé', 'Émincer les oignons et les faire fondre doucement dans le beurre 20 minutes.
Saupoudrer de farine et mélanger.
Mouiller avec le vin blanc et le bouillon.
Laisser mijoter 20 minutes.
Verser dans des bols, couvrir d''une tranche de pain et de gruyère.
Gratiner au four jusqu''à coloration dorée.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000025/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '20-30 min', '30 min - 1h', '€', 'facile', ARRAY['hiver']::text[], 'A bowl of French onion soup topped with a golden-brown layer of melted gruyère cheese, with crisped bread slices peeking out. The soup is rich and caramel-colored, filled with sliced onions. The presentation is inviting, showcasing the bubbling cheese with a rustic wooden table background.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 6)),
  ('00000000-0000-0000-0000-000000000026', 'Salade de chèvre chaud', '1 bûche de chèvre
4 tranches de pain de campagne
Mélange de salades
Miel
Cerneaux de noix
Vinaigre balsamique
Huile d''olive', 'Couper la bûche de chèvre en rondelles.
Les déposer sur les tranches de pain.
Passer sous le gril du four 5 minutes.
Préparer une vinaigrette à l''huile et au balsamique.
Disposer la salade dans les assiettes.
Ajouter les toasts chauds, un filet de miel et les noix.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000026/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '< 15 min', '€', 'facile', ARRAY['printemps','ete','automne']::text[], 'A visually appealing presentation of a warm goat cheese salad. Featuring toasted slices of rustic country bread topped with golden-brown rounds of goat cheese, drizzled with honey. Surrounding the bread is a vibrant mix of fresh greens, with scattered walnut halves adding texture. A light drizzle of balsamic vinaigrette glistens on the salad. The scene is shot from above, showcasing the contrast of colors and textures, with a warm wooden table in the background.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 5)),
  ('00000000-0000-0000-0000-000000000027', 'Omelette aux fines herbes', '6 œufs
1 c. à soupe de persil
1 c. à soupe de ciboulette
1 noix de beurre
Sel, poivre', 'Battre les œufs en omelette avec sel et poivre.
Ajouter les herbes ciselées.
Faire fondre le beurre dans une poêle.
Verser les œufs et cuire à feu moyen.
Replier l''omelette quand elle est encore baveuse.
Servir aussitôt.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000027/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '< 15 min', '€', 'facile', ARRAY['printemps','ete','automne','hiver']::text[], 'A close-up view of a fluffy omelette folded over, filled with vibrant green chopped herbs like parsley and chives. The omelette is golden yellow with a slight sheen from the butter, resting on a clean white plate. The background is softly blurred, emphasizing the texture and colors of the omelette with a hint of seasoning visible.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 4)),
  ('00000000-0000-0000-0000-000000000028', 'Tarte Tatin', '6 pommes
1 pâte brisée
100 g de sucre
50 g de beurre
1 c. à café de cannelle', 'Préparer un caramel avec le sucre et le beurre dans un moule.
Disposer les quartiers de pommes serrés sur le caramel.
Saupoudrer de cannelle.
Recouvrir de la pâte en rentrant les bords.
Enfourner à 190°C pendant 35 minutes.
Démouler tiède en retournant la tarte.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000028/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '20-30 min', '30 min - 1h', '€', 'facile', ARRAY['automne']::text[], 'A beautifully presented Tarte Tatin, featuring caramelized apples arranged in a circular pattern on top of a golden-brown pastry crust. The apples are glossy and glistening with caramel, with rich shades of amber and brown. The tart is displayed on a rustic wooden table, viewed from a slight angle to emphasize the height and layers of the tart. The background is softly blurred to focus on the dessert.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 3)),
  ('00000000-0000-0000-0000-000000000029', 'Tiramisu', '3 œufs
250 g de mascarpone
100 g de sucre
24 biscuits à la cuillère
30 cl de café fort
Cacao en poudre', 'Séparer les blancs des jaunes.
Blanchir les jaunes avec le sucre, ajouter le mascarpone.
Monter les blancs en neige et les incorporer délicatement.
Tremper les biscuits dans le café.
Alterner couches de biscuits et de crème dans un plat.
Réfrigérer 4 heures et saupoudrer de cacao avant de servir.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000029/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '30-45 min', 'Aucune', '€€', 'facile', ARRAY['ete','automne','hiver']::text[], 'A completed tiramisu in a rectangular glass dish, showcasing alternating layers of coffee-soaked ladyfingers and creamy mascarpone mixture. The top is dusted with a generous layer of cocoa powder, with a rich, dark color contrasting against the light, fluffy cream. The dish is placed on a wooden table, with a few cocoa powder sprinkles around, capturing an inviting and decadent appearance.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 2)),
  ('00000000-0000-0000-0000-000000000030', 'Cookies aux pépites de chocolat', '250 g de farine
125 g de beurre mou
100 g de sucre roux
1 œuf
200 g de pépites de chocolat
1/2 sachet de levure
1 pincée de sel', 'Mélanger le beurre mou avec le sucre.
Ajouter l''œuf et mélanger.
Incorporer la farine, la levure et le sel.
Ajouter les pépites de chocolat.
Former des boules sur une plaque.
Enfourner à 180°C pendant 12 minutes.', :'supabase_url' || '/storage/v1/object/public/recipe-photos/generated/00000000-0000-0000-0000-000000000030/ai-image.webp', '00000000-0000-0000-0000-000000000000', true, '10-20 min', '< 15 min', '€', 'facile', ARRAY['printemps','ete','automne','hiver']::text[], 'A close-up view of freshly baked chocolate chip cookies arranged neatly on a baking tray, golden brown edges with gooey chocolate chips melting slightly, warm and inviting with a soft texture. The background is lightly blurred to focus on the cookies, emphasizing their texture and color.', 'enriched', 'generated', 'manual', NOW() - (interval '1 day' * 1));

-- ---------------------------------------------------------------------------
-- Demo recipe tags (relational model — recipes.tags TEXT[] was dropped in 018).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE seed_tag_mapping (title TEXT, tag_name TEXT);
INSERT INTO seed_tag_mapping (title, tag_name) VALUES
  ('Soupe de lentilles corail',       'Facile'),
  ('Soupe de lentilles corail',       'Rapide'),
  ('Soupe de lentilles corail',       'Légumineuses'),
  ('Soupe de lentilles corail',       'Végétarien'),
  ('Soupe de lentilles corail',       'Soupe'),
  ('Mousse au chocolat',              'Rapide'),
  ('Mousse au chocolat',              'Végétarien'),
  ('Mousse au chocolat',              'Dessert'),
  ('Poulet rôti aux herbes',          'Facile'),
  ('Poulet rôti aux herbes',          'Poulet'),
  ('Poulet rôti aux herbes',          'Plat principal'),
  ('Tarte aux pommes grand-mère',     'Facile'),
  ('Tarte aux pommes grand-mère',     'Végétarien'),
  ('Tarte aux pommes grand-mère',     'Française'),
  ('Tarte aux pommes grand-mère',     'Comfort food'),
  ('Tarte aux pommes grand-mère',     'Dessert'),
  ('Gratin dauphinois',               'Facile'),
  ('Gratin dauphinois',               'Végétarien'),
  ('Gratin dauphinois',               'Française'),
  ('Gratin dauphinois',               'Accompagnement'),
  ('Gratin dauphinois',               'Plat principal'),
  ('Risotto aux champignons',         'Facile'),
  ('Risotto aux champignons',         'Rapide'),
  ('Risotto aux champignons',         'Végétarien'),
  ('Risotto aux champignons',         'Italienne'),
  ('Risotto aux champignons',         'Plat principal'),
  ('Salade niçoise',                  'Facile'),
  ('Salade niçoise',                  'Rapide'),
  ('Salade niçoise',                  'Entrée'),
  ('Salade niçoise',                  'Salade'),
  ('Crêpes bretonnes',                'Facile'),
  ('Crêpes bretonnes',                'Rapide'),
  ('Crêpes bretonnes',                'Végétarien'),
  ('Crêpes bretonnes',                'Petit-déjeuner'),
  ('Crêpes bretonnes',                'Plat principal'),
  ('Crêpes bretonnes',                'Dessert'),
  ('Bœuf bourguignon',                'Bœuf'),
  ('Bœuf bourguignon',                'En batch'),
  ('Bœuf bourguignon',                'Française'),
  ('Bœuf bourguignon',                'Comfort food'),
  ('Bœuf bourguignon',                'Plat principal'),
  ('Bœuf bourguignon',                'Repas de fête'),
  ('Quiche lorraine',                 'Facile'),
  ('Quiche lorraine',                 'Rapide'),
  ('Quiche lorraine',                 'Plat principal'),
  ('Ratatouille provençale',          'Facile'),
  ('Ratatouille provençale',          'Méditerranéenne'),
  ('Ratatouille provençale',          'En batch'),
  ('Ratatouille provençale',          'Rapide'),
  ('Ratatouille provençale',          'Végétarien'),
  ('Ratatouille provençale',          'Plat principal'),
  ('Taboulé libanais',                'Facile'),
  ('Taboulé libanais',                'Végétarien'),
  ('Taboulé libanais',                'Libanaise / Orientale'),
  ('Taboulé libanais',                'Salade'),
  ('Taboulé libanais',                'Léger'),
  ('Blanquette de veau',              'Française'),
  ('Blanquette de veau',              'Plat principal'),
  ('Magret de canard, sauce au miel', 'Sauce / Condiment'),
  ('Magret de canard, sauce au miel', 'Française'),
  ('Magret de canard, sauce au miel', 'Plat principal'),
  ('Chili con carne',                 'Facile'),
  ('Chili con carne',                 'Méditerranéenne'),
  ('Chili con carne',                 'Bœuf'),
  ('Chili con carne',                 'Rapide'),
  ('Chili con carne',                 'Plat principal'),
  ('Couscous poulet-merguez',         'Africaine'),
  ('Couscous poulet-merguez',         'Plat principal'),
  ('Burger maison',                   'Facile'),
  ('Burger maison',                   'Américaine'),
  ('Burger maison',                   'Comfort food'),
  ('Burger maison',                   'Plat principal'),
  ('Saumon en papillote',             'Facile'),
  ('Saumon en papillote',             'Rapide'),
  ('Saumon en papillote',             'Poisson'),
  ('Saumon en papillote',             'Plat principal'),
  ('Lasagnes à la bolognaise',        'Facile'),
  ('Lasagnes à la bolognaise',        'Bœuf'),
  ('Lasagnes à la bolognaise',        'Rapide'),
  ('Lasagnes à la bolognaise',        'Italienne'),
  ('Lasagnes à la bolognaise',        'Comfort food'),
  ('Lasagnes à la bolognaise',        'Plat principal'),
  ('Lasagnes à la bolognaise',        'À congeler'),
  ('Pad thaï aux crevettes',          'Asiatique'),
  ('Pad thaï aux crevettes',          'Plat principal'),
  ('Gnocchis à la crème',             'Facile'),
  ('Gnocchis à la crème',             'Végétarien'),
  ('Gnocchis à la crème',             'Française'),
  ('Gnocchis à la crème',             'Comfort food'),
  ('Gnocchis à la crème',             'Plat principal'),
  ('Curry de pois chiches',           'Facile'),
  ('Curry de pois chiches',           'Rapide'),
  ('Curry de pois chiches',           'Végétarien'),
  ('Curry de pois chiches',           'Comfort food'),
  ('Curry de pois chiches',           'Végan'),
  ('Curry de pois chiches',           'Plat principal'),
  ('Curry de pois chiches',           'Indienne'),
  ('Tartiflette',                     'Française'),
  ('Tartiflette',                     'Comfort food'),
  ('Tartiflette',                     'Plat principal'),
  ('Velouté de potimarron',           'Facile'),
  ('Velouté de potimarron',           'Végétarien'),
  ('Velouté de potimarron',           'Soupe'),
  ('Soupe à l''oignon gratinée',      'Française'),
  ('Soupe à l''oignon gratinée',      'Plat principal'),
  ('Soupe à l''oignon gratinée',      'Soupe'),
  ('Salade de chèvre chaud',          'Facile'),
  ('Salade de chèvre chaud',          'Rapide'),
  ('Salade de chèvre chaud',          'Végétarien'),
  ('Salade de chèvre chaud',          'Entrée'),
  ('Salade de chèvre chaud',          'Française'),
  ('Salade de chèvre chaud',          'Salade'),
  ('Omelette aux fines herbes',       'Facile'),
  ('Omelette aux fines herbes',       'Végétarien'),
  ('Omelette aux fines herbes',       'Petit-déjeuner'),
  ('Omelette aux fines herbes',       'Œufs'),
  ('Tarte Tatin',                     'Végétarien'),
  ('Tarte Tatin',                     'Française'),
  ('Tarte Tatin',                     'Comfort food'),
  ('Tarte Tatin',                     'Dessert'),
  ('Tiramisu',                        'Facile'),
  ('Tiramisu',                        'Végétarien'),
  ('Tiramisu',                        'Française'),
  ('Tiramisu',                        'Comfort food'),
  ('Tiramisu',                        'Dessert'),
  ('Cookies aux pépites de chocolat', 'Facile'),
  ('Cookies aux pépites de chocolat', 'Végétarien'),
  ('Cookies aux pépites de chocolat', 'Dessert');

-- Create any tag that doesn't already exist (case-insensitive against
-- predefined tags) as a demo-household custom tag.
INSERT INTO tags (name, category, is_predefined, household_id)
SELECT DISTINCT m.tag_name, NULL, false, '00000000-0000-0000-0000-000000000000'::uuid
FROM seed_tag_mapping m
WHERE NOT EXISTS (
  SELECT 1 FROM tags tg
  WHERE lower(tg.name) = lower(m.tag_name)
    AND (tg.household_id IS NULL OR tg.household_id = '00000000-0000-0000-0000-000000000000'::uuid)
)
ON CONFLICT (name, household_id) DO NOTHING;

-- Link demo recipes to their tags (prefer the predefined tag on collision).
INSERT INTO recipe_tags (recipe_id, tag_id)
SELECT r.id, match.id
FROM seed_tag_mapping m
JOIN recipes r
  ON r.title = m.title
 AND r.household_id = '00000000-0000-0000-0000-000000000000'::uuid
 AND r.is_seed = true
JOIN LATERAL (
  SELECT tg.id FROM tags tg
  WHERE lower(tg.name) = lower(m.tag_name)
    AND (tg.household_id IS NULL OR tg.household_id = '00000000-0000-0000-0000-000000000000'::uuid)
  ORDER BY tg.is_predefined DESC LIMIT 1
) match ON true
ON CONFLICT DO NOTHING;

DROP TABLE seed_tag_mapping;
