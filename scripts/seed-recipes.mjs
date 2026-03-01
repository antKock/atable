import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (no external dotenv dependency needed)
const envPath = resolve(process.cwd(), ".env.local");
const envVars = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => line.split("=").map((p) => p.trim()))
);

const url = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const key = envVars["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const recipes = [
  {
    title: "Poulet rôti aux herbes",
    ingredients: `1 poulet entier (1,5 kg)
4 gousses d'ail
1 citron
Thym frais
Romarin frais
3 c. à soupe d'huile d'olive
Sel, poivre`,
    steps: `Préchauffer le four à 200°C.
Mélanger l'huile d'olive avec l'ail écrasé, le thym et le romarin.
Frotter le poulet avec ce mélange, saler et poivrer généreusement.
Glisser le citron coupé en deux dans la cavité.
Enfourner 1h15 en arrosant toutes les 20 minutes.
Laisser reposer 10 minutes avant de découper.`,
    tags: ["viande", "four", "dimanche"],
  },
  {
    title: "Soupe de lentilles corail",
    ingredients: `250 g de lentilles corail
1 oignon
2 carottes
1 c. à café de cumin
1 c. à café de curcuma
1 litre de bouillon de légumes
Huile d'olive
Sel, poivre`,
    steps: `Faire revenir l'oignon émincé dans l'huile d'olive 5 minutes.
Ajouter les carottes en rondelles, le cumin et le curcuma.
Incorporer les lentilles rincées et le bouillon.
Laisser mijoter 25 minutes à feu doux.
Mixer le tout jusqu'à obtenir une texture veloutée.
Rectifier l'assaisonnement.`,
    tags: ["végétarien", "soupe", "rapide"],
  },
  {
    title: "Tarte aux pommes grand-mère",
    ingredients: `1 pâte brisée
5 pommes (Golden ou Reine des Reinettes)
3 œufs
150 g de sucre
20 cl de crème fraîche
1 sachet de sucre vanillé
Cannelle`,
    steps: `Préchauffer le four à 180°C.
Étaler la pâte dans un moule à tarte. Piquer le fond.
Éplucher et couper les pommes en quartiers, les disposer sur la pâte.
Battre les œufs avec le sucre, la crème et la vanille.
Verser l'appareil sur les pommes, saupoudrer de cannelle.
Cuire 35 à 40 minutes jusqu'à coloration dorée.`,
    tags: ["dessert", "four", "fruits"],
  },
  {
    title: "Risotto aux champignons",
    ingredients: `300 g de riz arborio
400 g de champignons de Paris
1 oignon
2 gousses d'ail
15 cl de vin blanc sec
1 litre de bouillon de volaille chaud
50 g de parmesan râpé
30 g de beurre
Huile d'olive
Persil frais`,
    steps: `Faire revenir l'oignon et l'ail dans l'huile d'olive.
Ajouter les champignons émincés, cuire 5 minutes.
Incorporer le riz, bien nacrer 2 minutes.
Déglacer au vin blanc, laisser absorber.
Ajouter le bouillon chaud louche par louche en remuant constamment.
Après 18 minutes, mantecare avec le beurre et le parmesan.
Parsemer de persil et servir immédiatement.`,
    tags: ["végétarien", "riz", "plat"],
  },
  {
    title: "Salade niçoise",
    ingredients: `200 g de thon en conserve
4 œufs durs
200 g de haricots verts cuits
2 tomates
1 poivron rouge
1 concombre
Olives noires
Anchois (optionnel)
Huile d'olive, vinaigre de vin
Basilic`,
    steps: `Cuire les haricots verts 7 minutes à l'eau bouillante salée, égoutter.
Couper les tomates, le concombre et le poivron.
Disposer toutes les crudités dans un grand plat.
Ajouter le thon émietté, les œufs coupés en quartiers et les olives.
Préparer la vinaigrette avec l'huile d'olive et le vinaigre.
Assaisonner et décorer de basilic.`,
    tags: ["salade", "été", "rapide"],
  },
  {
    title: "Crêpes bretonnes",
    ingredients: `250 g de farine
3 œufs
500 ml de lait
1 c. à soupe de beurre fondu
1 pincée de sel
Beurre pour la cuisson`,
    steps: `Mélanger la farine et le sel dans un saladier.
Creuser un puits, y casser les œufs et mélanger.
Incorporer le lait progressivement pour éviter les grumeaux.
Ajouter le beurre fondu, laisser reposer 1 heure.
Cuire chaque crêpe 1 minute de chaque côté dans une poêle beurrée.
Servir avec beurre et sucre, ou confiture.`,
    tags: ["dessert", "petit-déjeuner", "rapide"],
  },
  {
    title: "Bœuf bourguignon",
    ingredients: `1 kg de bœuf (paleron ou joue)
750 ml de vin rouge de Bourgogne
200 g de lardons
250 g de champignons de Paris
2 oignons
2 carottes
3 gousses d'ail
Bouquet garni
Farine
Huile, beurre`,
    steps: `Faire mariner le bœuf dans le vin avec les légumes et le bouquet garni une nuit.
Le lendemain, égoutter et sécher la viande. Réserver la marinade.
Faire revenir les lardons puis les réserver.
Faire dorer les morceaux de bœuf dans la cocotte.
Singer avec 2 cuillères de farine, bien mélanger.
Ajouter la marinade filtrée, les lardons, cuire 3 heures à feu doux.
Ajouter les champignons 30 minutes avant la fin.`,
    tags: ["viande", "mijoté", "dimanche"],
  },
  {
    title: "Quiche lorraine",
    ingredients: `1 pâte brisée
200 g de lardons fumés
3 œufs
30 cl de crème fraîche épaisse
10 cl de lait
Noix de muscade
Sel, poivre`,
    steps: `Préchauffer le four à 180°C.
Foncer un moule à tarte avec la pâte, piquer le fond.
Faire revenir les lardons à la poêle sans matière grasse.
Battre les œufs avec la crème, le lait, la muscade, sel et poivre.
Répartir les lardons sur la pâte.
Verser l'appareil par-dessus.
Cuire 35 minutes jusqu'à ce que la quiche soit bien dorée.`,
    tags: ["four", "rapide", "plat"],
  },
  {
    title: "Ratatouille provençale",
    ingredients: `2 courgettes
2 aubergines
3 tomates
2 poivrons (rouge et vert)
2 oignons
4 gousses d'ail
Herbes de Provence
Huile d'olive
Sel, poivre`,
    steps: `Couper tous les légumes en dés de taille égale.
Faire revenir les oignons et l'ail dans l'huile d'olive.
Ajouter les aubergines, cuire 10 minutes.
Incorporer les poivrons, cuire 5 minutes de plus.
Ajouter les courgettes puis les tomates.
Assaisonner avec les herbes de Provence, sel et poivre.
Laisser mijoter 30 minutes à feu doux à couvert.`,
    tags: ["végétarien", "été", "mijoté"],
  },
  {
    title: "Mousse au chocolat",
    ingredients: `200 g de chocolat noir (70%)
6 œufs
1 pincée de sel
2 c. à soupe de sucre`,
    steps: `Faire fondre le chocolat au bain-marie, laisser tiédir.
Séparer les blancs des jaunes.
Incorporer les jaunes un par un au chocolat fondu.
Monter les blancs en neige ferme avec le sel.
Ajouter le sucre aux blancs à mi-parcours.
Incorporer délicatement les blancs au mélange chocolaté en trois fois.
Réfrigérer au moins 2 heures avant de servir.`,
    tags: ["dessert", "chocolat", "rapide"],
  },
  {
    title: "Gratin dauphinois",
    ingredients: `1 kg de pommes de terre à chair ferme
50 cl de crème fraîche liquide
2 gousses d'ail
Noix de muscade
Sel, poivre
Beurre pour le plat`,
    steps: `Préchauffer le four à 160°C.
Éplucher et trancher les pommes de terre en rondelles fines (2 mm).
Frotter le plat à gratin avec l'ail, puis beurrer.
Disposer les rondelles en couches, saler, poivrer, muscader.
Verser la crème fraîche qui doit presque recouvrir les pommes de terre.
Cuire 1h30 jusqu'à ce que le dessus soit doré et que la lame d'un couteau s'enfonce facilement.`,
    tags: ["four", "végétarien", "accompagnement"],
  },
  {
    title: "Taboulé libanais",
    ingredients: `100 g de boulghour fin
4 tomates
1 gros bouquet de persil plat
1 bouquet de menthe fraîche
3 oignons verts
Jus de 2 citrons
4 c. à soupe d'huile d'olive
Sel`,
    steps: `Faire gonfler le boulghour dans de l'eau froide 15 minutes, égoutter.
Hacher finement le persil, la menthe et les oignons verts.
Couper les tomates en tout petits dés.
Mélanger tous les ingrédients dans un saladier.
Assaisonner avec le jus de citron, l'huile d'olive et le sel.
Réfrigérer 1 heure pour que les saveurs se développent.`,
    tags: ["salade", "été", "végétarien"],
  },
  {
    title: "Financiers aux amandes",
    ingredients: `100 g de beurre
150 g de sucre glace
60 g de poudre d'amandes
50 g de farine
4 blancs d'œufs
1 c. à café d'extrait d'amande amère`,
    steps: `Préchauffer le four à 200°C.
Faire fondre le beurre jusqu'à ce qu'il prenne une couleur noisette.
Mélanger le sucre glace, la poudre d'amandes et la farine.
Incorporer les blancs d'œufs légèrement battus.
Ajouter le beurre noisette tiédi et l'extrait d'amande.
Remplir les moules à financiers aux 3/4.
Cuire 12 à 15 minutes jusqu'à coloration dorée.`,
    tags: ["dessert", "gâteau", "amandes"],
  },
  {
    title: "Soupe à l'oignon gratinée",
    ingredients: `1 kg d'oignons
80 g de beurre
1 c. à soupe de farine
20 cl de vin blanc sec
1,5 litre de bouillon de bœuf
Pain rassis en tranches
Gruyère râpé
Sel, poivre`,
    steps: `Émincer finement les oignons.
Faire fondre le beurre dans une cocotte à feu doux.
Faire caraméliser les oignons 40 minutes en remuant régulièrement.
Saupoudrer de farine, bien mélanger.
Déglacer au vin blanc, ajouter le bouillon, cuire 20 minutes.
Répartir la soupe dans des bols allant au four.
Poser les tranches de pain, couvrir de gruyère râpé.
Passer sous le grill jusqu'à gratinage.`,
    tags: ["soupe", "hiver", "plat"],
  },
  {
    title: "Pâtes carbonara",
    ingredients: `400 g de spaghetti
200 g de pancetta ou guanciale
4 jaunes d'œufs
100 g de pecorino romano râpé
Poivre noir fraîchement moulu`,
    steps: `Cuire les pâtes al dente dans une grande quantité d'eau salée.
Faire revenir la pancetta à sec dans une poêle jusqu'à ce qu'elle soit croustillante.
Mélanger les jaunes d'œufs avec le pecorino et beaucoup de poivre.
Égoutter les pâtes en réservant une tasse d'eau de cuisson.
Mélanger les pâtes chaudes avec la pancetta hors du feu.
Ajouter le mélange œufs-fromage et un peu d'eau de cuisson.
Mélanger vigoureusement jusqu'à obtenir une sauce crémeuse.`,
    tags: ["pâtes", "rapide", "plat"],
  },
];

async function seed() {
  console.log(`Insertion de ${recipes.length} recettes…`);

  const { data, error } = await supabase.from("recipes").insert(recipes).select("id, title");

  if (error) {
    console.error("Erreur :", error.message);
    process.exit(1);
  }

  console.log(`✓ ${data.length} recettes insérées :`);
  data.forEach((r) => console.log(`  - ${r.title}`));
}

seed();
