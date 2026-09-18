// Cas du pool OCR « captures d'écran » (lu par build-screenshots.mjs).
//
// Pages web : `start` = où l'utilisateur commence ses captures ("title" : haut de
// la recette, puis saut aux ingrédients ; "ingredients" : directement sur la
// liste), `slices` = nombre maximal de captures. Avec slices: 1, la capture est
// souvent incomplète (cas réel) : la vérité est restreinte au visible.
//
// Rendus fabriqués : voir APP_CASES plus bas (texte injecté = vérité terrain).

export const WEB_CASES = [
  // --- Marmiton
  {
    id: "shot-marmiton-taboule-libanais",
    lang: "fr",
    url: "https://www.marmiton.org/recettes/recette_le-vrai-taboule-libanais_26796.aspx",
    start: "title",
    slices: 3,
  },
  {
    id: "shot-marmiton-carrot-cake",
    lang: "fr",
    url: "https://www.marmiton.org/recettes/recette_veritable-carrot-cake-recette-usa_83584.aspx",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-marmiton-rougail-saucisse",
    lang: "fr",
    url: "https://www.marmiton.org/recettes/recette_rougail-saucisse_22851.aspx",
    start: "ingredients",
    slices: 1,
  },
  {
    id: "shot-marmiton-riz-au-lait",
    lang: "fr",
    url: "https://www.marmiton.org/recettes/recette_riz-au-lait-facile_14999.aspx",
    start: "title",
    slices: 3,
  },
  // --- 750g
  {
    id: "shot-750g-salade-lentilles",
    lang: "fr",
    url: "https://www.750g.com/salade-de-lentilles-r12441.htm",
    start: "title",
    slices: 3,
  },
  {
    id: "shot-750g-quiche-poireaux",
    lang: "fr",
    url: "https://www.750g.com/quiche-aux-poireaux-r2160.htm",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-750g-pizza-maison",
    lang: "fr",
    url: "https://www.750g.com/pizza-maison-r63439.htm",
    start: "ingredients",
    slices: 1,
  },
  // --- CuisineAZ
  {
    id: "shot-cuisineaz-moussaka",
    lang: "fr",
    url: "https://www.cuisineaz.com/recettes/moussaka-facile-23244.aspx",
    start: "ingredients",
    slices: 1,
  },
  {
    id: "shot-cuisineaz-chouquettes",
    lang: "fr",
    url: "https://www.cuisineaz.com/recettes/recette-chouquettes-de-mercotte-du-meilleur-patissier-125563.aspx",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-cuisineaz-crepes",
    lang: "fr",
    url: "https://www.cuisineaz.com/recettes/crepe-facile-78347.aspx",
    start: "ingredients",
    slices: 1,
  },
  // --- Journal des Femmes Cuisine
  {
    id: "shot-jdf-poulet-moutarde",
    lang: "fr",
    url: "https://cuisine.journaldesfemmes.fr/recette/317975-emince-de-poulet-a-la-moutarde",
    start: "title",
    slices: 3,
  },
  {
    id: "shot-jdf-creme-caramel",
    lang: "fr",
    url: "https://cuisine.journaldesfemmes.fr/recette/322707-creme-caramel",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-jdf-tarte-figues",
    lang: "fr",
    url: "https://cuisine.journaldesfemmes.fr/recette/313528-tarte-aux-figues",
    start: "ingredients",
    slices: 1,
  },
  // --- Ptitchef
  {
    id: "shot-ptitchef-curry-lentilles",
    lang: "fr",
    url: "https://www.ptitchef.com/recettes/plat/curry-de-lentilles-corail-au-lait-de-coco-recette-facile-et-cremeuse-fid-1614349",
    start: "ingredients",
    slices: 1,
  },
  {
    id: "shot-ptitchef-focaccia",
    lang: "fr",
    url: "https://www.ptitchef.com/recettes/aperitif/focaccia-moelleuse-aux-tomates-cerises-aux-olives-et-a-l-origan-fid-1614320",
    start: "ingredients",
    slices: 2,
  },
  // --- Cuisine Actuelle
  {
    id: "shot-cuisineactuelle-soupe-oignon",
    lang: "fr",
    url: "https://www.cuisineactuelle.fr/recettes/la-vraie-soupe-a-l-oignon-super-simple-106587",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-cuisineactuelle-crumble-poires",
    lang: "fr",
    url: "https://www.cuisineactuelle.fr/recettes/recette-de-crumble-de-poires-au-pain-depices-218658",
    start: "ingredients",
    slices: 3,
  },
  {
    id: "shot-cuisineactuelle-gateau-invisible",
    lang: "fr",
    url: "https://www.cuisineactuelle.fr/recettes/gateau-invisible-pommes-de-terre-et-oignons-107111",
    start: "ingredients",
    slices: 1,
  },
  // --- Elle à table
  {
    id: "shot-elle-carbonara-haricots",
    lang: "fr",
    url: "https://www.elle.fr/Elle-a-Table/Recettes-de-cuisine/Carbonara-de-haricots-verts-4584480",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-elle-clafoutis-pistache",
    lang: "fr",
    url: "https://www.elle.fr/Elle-a-Table/Recettes-de-cuisine/Clafoutis-a-la-pistache-et-aux-prunes-4558703",
    start: "ingredients",
    slices: 2,
  },
  // --- Femme Actuelle
  {
    id: "shot-femmeactuelle-tarte-peches",
    lang: "fr",
    url: "https://www.femmeactuelle.fr/cuisine/recettes/dessert/tarte-aux-peches-255504",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-femmeactuelle-gaspacho",
    lang: "fr",
    url: "https://www.femmeactuelle.fr/cuisine/recettes/entree/gaspacho-tomate-basilic-254543",
    start: "ingredients",
    slices: 1,
  },
  {
    id: "shot-femmeactuelle-filet-mignon",
    lang: "fr",
    url: "https://www.femmeactuelle.fr/cuisine/recettes/plat/filet-mignon-de-porc-aux-mirabelles-miel-et-romarin-255584",
    start: "ingredients",
    slices: 3,
  },
  // --- Hervé Cuisine
  {
    id: "shot-hervecuisine-tarte-citron",
    lang: "fr",
    url: "https://www.hervecuisine.com/recette/tarte-au-citron-classique/",
    start: "ingredients",
    slices: 3,
  },
  // --- Blogs FR (WordPress + WP Recipe Maker, etc.)
  {
    id: "shot-mesinspirations-poulet-gaston-gerard",
    lang: "fr",
    url: "https://www.mesinspirationsculinaires.com/article-poulet-gaston-gerard.html",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-cuisinonsencouleurs-tarte-prunes",
    lang: "fr",
    url: "https://www.cuisinonsencouleurs.fr/2026/09/tarte-aux-prunes-et-creme-damande-recette-facile.html",
    start: "ingredients",
    slices: 3,
  },
  {
    id: "shot-cuisinonsencouleurs-slata-mechouia",
    lang: "fr",
    url: "https://www.cuisinonsencouleurs.fr/2026/09/slata-mechouia-dip-de-poivrons-a-la-tunisienne.html",
    start: "ingredients",
    slices: 3,
  },
  {
    id: "shot-geraldine-gougeres",
    lang: "fr",
    url: "https://lacuisinedegeraldine.fr/gougeres",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-geraldine-courgettes-farcies",
    lang: "fr",
    url: "https://lacuisinedegeraldine.fr/courgettes-rondes-farcies-a-la-viande-et-sauce-tomate",
    start: "ingredients",
    slices: 1,
  },
  {
    id: "shot-dejeunersoleil-curry-rouge",
    lang: "fr",
    url: "https://www.undejeunerdesoleil.com/2026/08/curry-rouge-thai-porc-poivrons.html",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-dejeunersoleil-cake-citrons",
    lang: "fr",
    url: "https://www.undejeunerdesoleil.com/2026/09/cake-deux-citrons.html",
    start: "ingredients",
    slices: 1,
  },
  {
    id: "shot-recettesdejulie-tarte-myrtilles",
    lang: "fr",
    url: "https://recettesdejulie.fr/49401/tarte-aux-myrtilles-alsacienne/",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-recettesdejulie-tian",
    lang: "fr",
    url: "https://recettesdejulie.fr/36075/tian-de-legumes-a-la-provencale/",
    start: "ingredients",
    slices: 1,
  },
  {
    id: "shot-cuisineculinaire-salade-nicoise",
    lang: "fr",
    url: "https://www.cuisineculinaire.com/salade-nicoise-classique/",
    start: "ingredients",
    slices: 3,
  },
  // --- Sites EN
  {
    id: "shot-bbc-easiest-paella",
    lang: "en",
    url: "https://www.bbcgoodfood.com/recipes/easiest-ever-paella",
    start: "title",
    slices: 3,
  },
  {
    id: "shot-allrecipes-chocolate-chip-cookies",
    lang: "en",
    url: "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-seriouseats-bolognese",
    lang: "en",
    url: "https://www.seriouseats.com/the-best-slow-cooked-bolognese-sauce-recipe",
    start: "ingredients",
    slices: 1,
  },
  {
    id: "shot-budgetbytes-basic-chili",
    lang: "en",
    url: "https://www.budgetbytes.com/basic-chili/",
    start: "ingredients",
    slices: 1,
  },
  {
    id: "shot-budgetbytes-taco-soup",
    lang: "en",
    url: "https://www.budgetbytes.com/taco-soup/",
    start: "ingredients",
    slices: 1,
  },
  {
    id: "shot-recipetin-garlic-prawn-pasta",
    lang: "en",
    url: "https://www.recipetineats.com/creamy-garlic-prawn-pasta/",
    start: "ingredients",
    slices: 3,
  },
  {
    id: "shot-recipetin-monster-cookies",
    lang: "en",
    url: "https://www.recipetineats.com/monster-cookies-recipe/",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-loveandlemons-turkish-eggs",
    lang: "en",
    url: "https://www.loveandlemons.com/turkish-eggs/",
    start: "ingredients",
    slices: 1,
  },
  {
    id: "shot-cookieandkate-blackberry-cobbler",
    lang: "en",
    url: "https://cookieandkate.com/blackberry-cobbler/",
    start: "ingredients",
    slices: 2,
  },
  {
    id: "shot-minimalistbaker-eggplant-bolognese",
    lang: "en",
    url: "https://minimalistbaker.com/eggplant-bolognese/",
    start: "ingredients",
    slices: 2,
  },
  // --- Ajouts
  {
    id: "shot-jdf-spaghettis-bolognaise",
    lang: "fr",
    url: "https://cuisine.journaldesfemmes.fr/recette/312362-spaghettis-sauce-bolognaise",
    start: "ingredients",
    slices: 2,
  },
];

// Pages essayées puis écartées (gardées ici pour mémoire, non capturées) :
//  - hervecuisine.com/recette/naan-au-fromage-indien : JSON-LD sans étapes
//  - cuisine-addict.com/fajitas-au-poulet-et-courgettes : JSON-LD ≠ affichage (8 % / 0 %)
//  - gourmandiseassia.fr, croquantfondantgourmand.com, chefnini.com, smittenkitchen.com : pas de JSON-LD Recipe
//  - bbcgoodfood.com/recipes/cauliflower-soup : capture unique sans élément de recette visible (pub)
//  - food52.com/recipes/15493-… : 404 ; thekitchn.com : 403 (anti-robot)
//  - ricardocuisine.com (2 recettes), bonappetit.com : étapes du JSON-LD introuvables à l'affichage
//  - mesinspirationsculinaires.com/…flan…, hervecuisine.com/…gateau-invisible-courgette : appariement
//    partiel ou captures sans étapes, retirés pour garder le volume d'images raisonnable

// Pages Instagram publiques tentées sans connexion (--instagram).
export const INSTAGRAM_PROBES = [
  "https://www.instagram.com/hervecuisine/",
  "https://www.instagram.com/p/C7z1Y5xNq3A/",
];

// --- Rendus fabriqués ----------------------------------------------------------
// Instagram bloque la consultation des publications sans connexion (voir
// --instagram) : les légendes sont reproduites par un gabarit local.
// Convention de vérité : les émojis décoratifs (✅, 1️⃣, 🔥…) et les puces sont
// retirés ; les lignes de bavardage d'une conversation (« merci ! ») aussi.
const RB = "rédigée pour le banc";
const LICENSE_RB = "texte original rédigé pour le banc (aucune source tierce)";
const LICENSE_WIKI =
  "CC BY-SA 4.0 (Wikibooks / Wikilivres) — texte légèrement adapté (liens retirés)";

// Légende Instagram déjà utilisée par prepare-fixtures.mjs (INSTA_CAPTION).
const INSTA_COURGETTES = `PÂTES À LA CRÈME DE COURGETTES 🔥 la recette parfaite pour la semaine, prête en 20 min chrono ⏱️

Pour 4 personnes il te faut :
✅ 400g de penne
✅ 2 courgettes moyennes
✅ 1 oignon
✅ 2 gousses d'ail
✅ 20cl de crème fraîche légère
✅ 60g de parmesan + un peu pour servir
✅ huile d'olive, sel, poivre, basilic frais

On fait revenir l'oignon et l'ail émincés dans un filet d'huile d'olive, on ajoute les courgettes coupées en petits dés, on laisse cuire 10 min à feu moyen. Pendant ce temps on cuit les pâtes al dente (garde une louche d'eau de cuisson 😉). On mixe la moitié des courgettes avec la crème et le parmesan, on remet tout dans la poêle avec les pâtes, on détend avec l'eau de cuisson et hop c'est prêt 🤌

Astuce : ajoute des pignons torréfiés pour le croquant, ça change tout !!

Tu testes ? Dis-le moi en commentaire 👇👇
#pasta #recettefacile #courgettes #batchcooking #mangersain #recettesemaine #foodlover #cuisinemaison`;

const INSTA_COOKIES = `COOKIES AVOINE BANANE CHOCO 🍪 sans sucre ajouté, 3 ingrédients de base !!

👉 Pour 12 cookies :
• 2 bananes bien mûres
• 150 g de flocons d'avoine
• 50 g de pépites de chocolat noir
• 1 c. à café de cannelle
• 1 pincée de sel

1️⃣ Préchauffe ton four à 180°C
2️⃣ Écrase les bananes à la fourchette
3️⃣ Ajoute l'avoine, la cannelle, le sel et les pépites, mélange
4️⃣ Forme 12 petits tas sur une plaque avec papier cuisson
5️⃣ Enfourne 15 min, laisse refroidir avant de décoller

Enregistre la recette pour plus tard 📌
.
.
#cookies #healthyfood #recettesaine #sanssucre #goutersain #avoine #banane`;

const INSTA_ORZO = `one-pan lemon chicken orzo 🍋 dinner in 30 min and only one pan to wash!

SERVES 4
- 4 boneless chicken thighs
- 1 tbsp olive oil
- 1 onion, diced
- 3 garlic cloves, minced
- 1 1/2 cups orzo
- 3 cups chicken stock
- zest and juice of 1 lemon
- 2 big handfuls of spinach
- 1/3 cup grated parmesan

Season the chicken and sear in the oil 5 min per side, then set aside. Soften the onion and garlic in the same pan. Stir in the orzo, stock and lemon zest, nestle the chicken back in, cover and simmer 15 min. Stir through the spinach, parmesan and lemon juice and serve!

full recipe on my blog, link in bio 🔗
#onepan #orzo #easydinner #weeknightdinner #lemonchicken`;

export const APP_CASES = [
  {
    id: "shot-notes-gateau-yaourt",
    subtype: "app-notes",
    look: "Apple Notes iOS",
    lang: "fr",
    source_site: RB,
    license: LICENSE_RB,
    display: `# Gâteau au yaourt de mamie
Pour 6 personnes
## Ingrédients
- 1 pot de yaourt nature
- 2 pots de sucre
- 3 pots de farine
- 3 œufs
- 1/2 pot d'huile
- 1 sachet de levure chimique
- 1 sachet de sucre vanillé
## Préparation
1. Préchauffer le four à 180 °C.
2. Verser le yaourt dans un saladier et garder le pot pour mesurer.
3. Ajouter le sucre, le sucre vanillé et les œufs, bien mélanger.
4. Incorporer la farine et la levure, puis l'huile.
5. Verser dans un moule beurré et cuire 35 min.

Astuce : on peut ajouter le zeste d'un citron.`,
    truth: {
      title: "Gâteau au yaourt de mamie",
      servings: 6,
      ingredients: [
        "1 pot de yaourt nature",
        "2 pots de sucre",
        "3 pots de farine",
        "3 œufs",
        "1/2 pot d'huile",
        "1 sachet de levure chimique",
        "1 sachet de sucre vanillé",
      ],
      steps: [
        "Préchauffer le four à 180 °C.",
        "Verser le yaourt dans un saladier et garder le pot pour mesurer.",
        "Ajouter le sucre, le sucre vanillé et les œufs, bien mélanger.",
        "Incorporer la farine et la levure, puis l'huile.",
        "Verser dans un moule beurré et cuire 35 min.",
      ],
      notes: "Astuce : on peut ajouter le zeste d'un citron.",
    },
  },
  {
    id: "shot-notes-tarte-citron-meringuee",
    subtype: "app-notes",
    look: "Apple Notes iOS",
    dark: true,
    lang: "fr",
    folder: "Recettes",
    date: "3 août 2026 à 21:15",
    source_site: RB,
    license: LICENSE_RB,
    note: "sections d'ingrédients ; étapes en paragraphes libres (une ligne de vérité par paragraphe)",
    display: `# Tarte citron meringuée
8 parts
## Pâte sablée
- 250 g de farine
- 125 g de beurre mou
- 70 g de sucre glace
- 1 œuf
- 1 pincée de sel
## Crème citron
- 4 citrons jaunes (jus + zeste de 2)
- 3 œufs
- 150 g de sucre
- 25 g de maïzena
- 80 g de beurre
## Meringue
- 3 blancs d'œufs
- 150 g de sucre

La pâte : sabler farine, sel et beurre du bout des doigts. Ajouter le sucre glace puis l'œuf, former une boule. Filmer et laisser 1 h au frais.
Étaler, foncer le moule, piquer et cuire à blanc 20 min à 180°.
La crème : chauffer le jus et les zestes. Fouetter œufs, sucre et maïzena, verser le jus chaud dessus, remettre sur le feu jusqu'à épaississement. Hors du feu ajouter le beurre en morceaux.
Verser sur le fond de tarte refroidi.
Meringue : monter les blancs en neige, ajouter le sucre en 3 fois jusqu'à ce que ce soit bien brillant.
Pocher sur la crème et dorer 5 min sous le grill (surveiller !!)`,
    truth: {
      title: "Tarte citron meringuée",
      servings: 8,
      ingredients: [
        "// Pâte sablée",
        "250 g de farine",
        "125 g de beurre mou",
        "70 g de sucre glace",
        "1 œuf",
        "1 pincée de sel",
        "// Crème citron",
        "4 citrons jaunes (jus + zeste de 2)",
        "3 œufs",
        "150 g de sucre",
        "25 g de maïzena",
        "80 g de beurre",
        "// Meringue",
        "3 blancs d'œufs",
        "150 g de sucre",
      ],
      steps: [
        "La pâte : sabler farine, sel et beurre du bout des doigts. Ajouter le sucre glace puis l'œuf, former une boule. Filmer et laisser 1 h au frais.",
        "Étaler, foncer le moule, piquer et cuire à blanc 20 min à 180°.",
        "La crème : chauffer le jus et les zestes. Fouetter œufs, sucre et maïzena, verser le jus chaud dessus, remettre sur le feu jusqu'à épaississement. Hors du feu ajouter le beurre en morceaux.",
        "Verser sur le fond de tarte refroidi.",
        "Meringue : monter les blancs en neige, ajouter le sucre en 3 fois jusqu'à ce que ce soit bien brillant.",
        "Pocher sur la crème et dorer 5 min sous le grill (surveiller !!)",
      ],
      notes: null,
    },
  },
  {
    id: "shot-notes-banana-bread-en",
    subtype: "app-notes",
    look: "Apple Notes iOS",
    lang: "en",
    folder: "Folders",
    date: "September 2, 2026 at 8:03 AM",
    source_url: "https://en.wikibooks.org/wiki/Cookbook:Banana_Bread_I",
    source_site: "en.wikibooks.org",
    license: LICENSE_WIKI,
    note: "recette Wikibooks recopiée dans Notes (liste à cocher pour les ingrédients) ; volumes seulement, colonnes poids et pourcentages omises",
    display: `# Banana Bread
[ ] 1 cup white sugar
[ ] ½ cup butter, softened
[ ] 3 bananas (the riper the better), mashed
[ ] 2 eggs
[ ] 2 cups all-purpose flour
[ ] ½ tsp baking soda
[ ] ⅓ cup sour milk or buttermilk
[ ] ¼ tsp salt
[ ] 1 tsp vanilla extract

1. Preheat oven to 350°F (175°C).
2. Lightly grease an 8 x 4-inch (20 x 10 cm) loaf pan.
3. Combine all ingredients into a large mixing bowl. Beat well.
4. Pour batter into pan.
5. Bake on middle shelf of oven for 60 minutes, or until a toothpick inserted into the center of the loaf comes out clean.

Tip: ½ cup nuts may also be added to the mixture`,
    truth: {
      title: "Banana Bread",
      servings: null,
      ingredients: [
        "1 cup white sugar",
        "½ cup butter, softened",
        "3 bananas (the riper the better), mashed",
        "2 eggs",
        "2 cups all-purpose flour",
        "½ tsp baking soda",
        "⅓ cup sour milk or buttermilk",
        "¼ tsp salt",
        "1 tsp vanilla extract",
      ],
      steps: [
        "Preheat oven to 350°F (175°C).",
        "Lightly grease an 8 x 4-inch (20 x 10 cm) loaf pan.",
        "Combine all ingredients into a large mixing bowl. Beat well.",
        "Pour batter into pan.",
        "Bake on middle shelf of oven for 60 minutes, or until a toothpick inserted into the center of the loaf comes out clean.",
      ],
      notes: "Tip: ½ cup nuts may also be added to the mixture",
    },
  },
  {
    id: "shot-imessage-curry-poulet",
    subtype: "app-messages",
    look: "Messages iOS (iMessage)",
    lang: "fr",
    contact: "Julie Martin",
    fromBottom: true,
    source_site: RB,
    license: LICENSE_RB,
    note: "recette éclatée en plusieurs bulles, bavardage autour (exclu de la vérité)",
    messages: [
      { day: "Aujourd'hui 18:40" },
      { from: "me", text: "Tu m'envoies ta recette de curry ? 🙏" },
      { from: "them", text: "Oui ! Curry de poulet coco (pour 4)" },
      {
        from: "them",
        text: "600 g de blancs de poulet\n1 oignon\n2 gousses d'ail\n1 morceau de gingembre\n2 c. à soupe de pâte de curry rouge\n400 ml de lait de coco\n1 poivron rouge\ncoriandre fraîche\nriz basmati",
      },
      {
        from: "them",
        text: "Tu fais revenir l'oignon, l'ail et le gingembre dans un peu d'huile\nTu ajoutes la pâte de curry 1 min\nPuis le poulet en morceaux, tu le fais dorer\nTu verses le lait de coco et le poivron en lanières, 15 min à feu doux\nCoriandre au moment de servir, avec le riz",
      },
      { from: "me", text: "Top merci !!" },
      { from: "them", text: "Si c'est trop fort mets un peu de sucre 😉" },
    ],
    truth: {
      title: "Curry de poulet coco",
      servings: 4,
      ingredients: [
        "600 g de blancs de poulet",
        "1 oignon",
        "2 gousses d'ail",
        "1 morceau de gingembre",
        "2 c. à soupe de pâte de curry rouge",
        "400 ml de lait de coco",
        "1 poivron rouge",
        "coriandre fraîche",
        "riz basmati",
      ],
      steps: [
        "Tu fais revenir l'oignon, l'ail et le gingembre dans un peu d'huile",
        "Tu ajoutes la pâte de curry 1 min",
        "Puis le poulet en morceaux, tu le fais dorer",
        "Tu verses le lait de coco et le poivron en lanières, 15 min à feu doux",
        "Coriandre au moment de servir, avec le riz",
      ],
      notes: "Si c'est trop fort mets un peu de sucre",
    },
  },
  {
    id: "shot-whatsapp-pates-pesto",
    subtype: "app-messages",
    look: "WhatsApp",
    dark: true,
    lang: "fr",
    contact: "Maman",
    presence: "vu aujourd'hui à 09:12",
    avatarColor: "#8e6fbf",
    fromBottom: true,
    source_site: RB,
    license: LICENSE_RB,
    messages: [
      { day: "Hier" },
      { from: "them", text: "Voilà la recette du pesto 🌿", time: "19:02" },
      {
        from: "them",
        time: "19:03",
        text: "Pâtes au pesto maison\n\nPour 4 :\n- 1 gros bouquet de basilic\n- 50 g de pignons de pin\n- 60 g de parmesan râpé\n- 1 gousse d'ail\n- 10 cl d'huile d'olive\n- 400 g de spaghetti\n- sel, poivre",
      },
      {
        from: "them",
        time: "19:05",
        text: "1) Faire griller les pignons à sec 2 min\n2) Mixer le basilic, l'ail, les pignons et le parmesan\n3) Ajouter l'huile petit à petit, saler poivrer\n4) Cuire les pâtes, garder un peu d'eau de cuisson\n5) Mélanger hors du feu en détendant avec l'eau de cuisson",
      },
      { from: "me", text: "Merci maman ❤️", time: "19:20" },
      {
        from: "them",
        text: "Le pesto se garde 3 jours au frigo avec un filet d'huile dessus",
        time: "19:21",
      },
    ],
    truth: {
      title: "Pâtes au pesto maison",
      servings: 4,
      ingredients: [
        "1 gros bouquet de basilic",
        "50 g de pignons de pin",
        "60 g de parmesan râpé",
        "1 gousse d'ail",
        "10 cl d'huile d'olive",
        "400 g de spaghetti",
        "sel, poivre",
      ],
      steps: [
        "Faire griller les pignons à sec 2 min",
        "Mixer le basilic, l'ail, les pignons et le parmesan",
        "Ajouter l'huile petit à petit, saler poivrer",
        "Cuire les pâtes, garder un peu d'eau de cuisson",
        "Mélanger hors du feu en détendant avec l'eau de cuisson",
      ],
      notes: "Le pesto se garde 3 jours au frigo avec un filet d'huile dessus",
    },
  },
  {
    id: "shot-imessage-pancakes-en",
    subtype: "app-messages",
    look: "Messages iOS (iMessage)",
    lang: "en",
    contact: "Grandma Ruth",
    fromBottom: true,
    source_site: RB,
    license: LICENSE_RB,
    messages: [
      { day: "Today 10:14 AM" },
      { from: "them", text: "Here's my pancake recipe honey" },
      {
        from: "them",
        text: "Fluffy Buttermilk Pancakes\nMakes about 10\n\n2 cups flour\n2 tbsp sugar\n2 tsp baking powder\n1 tsp baking soda\n1/2 tsp salt\n2 cups buttermilk\n2 eggs\n1/4 cup melted butter",
      },
      {
        from: "them",
        text: "Whisk the dry ingredients in a big bowl.\nIn another bowl whisk buttermilk, eggs and melted butter.\nPour wet into dry and stir just until combined, lumps are fine!\nLet the batter rest 10 minutes.\nCook 1/4 cup at a time on a buttered griddle over medium heat, flip when bubbles form.",
      },
      { from: "me", text: "Thank you!! making them sunday" },
      { from: "them", text: "Keep them warm in a 200F oven while you finish the batch ❤️" },
    ],
    truth: {
      title: "Fluffy Buttermilk Pancakes",
      servings: 10,
      ingredients: [
        "2 cups flour",
        "2 tbsp sugar",
        "2 tsp baking powder",
        "1 tsp baking soda",
        "1/2 tsp salt",
        "2 cups buttermilk",
        "2 eggs",
        "1/4 cup melted butter",
      ],
      steps: [
        "Whisk the dry ingredients in a big bowl.",
        "In another bowl whisk buttermilk, eggs and melted butter.",
        "Pour wet into dry and stir just until combined, lumps are fine!",
        "Let the batter rest 10 minutes.",
        "Cook 1/4 cup at a time on a buttered griddle over medium heat, flip when bubbles form.",
      ],
      notes: "Keep them warm in a 200F oven while you finish the batch",
    },
  },
  {
    id: "shot-insta-pates-courgettes",
    subtype: "instagram",
    look: "Instagram (publication, légende dépliée)",
    lang: "fr",
    username: "lacuisinedelea",
    location: "Lyon, France",
    likes: "Aimé par camille.cuisine et 3 482 autres personnes",
    avatar: "#e8a87c",
    photoBg: "radial-gradient(circle at 40% 45%,#f4e3b5 0,#c9d98a 30%,#6b8f3a 60%,#3e4f25 100%)",
    photoEmoji: "🍝",
    source_url: null,
    source_site: `${RB} (légende de prepare-fixtures.mjs)`,
    license: LICENSE_RB,
    note: "étapes en un seul paragraphe narratif : vérité découpée par phrase ; émojis retirés de la vérité",
    display: INSTA_COURGETTES,
    truth: {
      title: "PÂTES À LA CRÈME DE COURGETTES",
      servings: 4,
      ingredients: [
        "400g de penne",
        "2 courgettes moyennes",
        "1 oignon",
        "2 gousses d'ail",
        "20cl de crème fraîche légère",
        "60g de parmesan + un peu pour servir",
        "huile d'olive, sel, poivre, basilic frais",
      ],
      steps: [
        "On fait revenir l'oignon et l'ail émincés dans un filet d'huile d'olive, on ajoute les courgettes coupées en petits dés, on laisse cuire 10 min à feu moyen.",
        "Pendant ce temps on cuit les pâtes al dente (garde une louche d'eau de cuisson).",
        "On mixe la moitié des courgettes avec la crème et le parmesan, on remet tout dans la poêle avec les pâtes, on détend avec l'eau de cuisson et hop c'est prêt",
      ],
      notes: "Astuce : ajoute des pignons torréfiés pour le croquant, ça change tout !!",
    },
  },
  {
    id: "shot-insta-cookies-avoine",
    subtype: "instagram",
    look: "Instagram (publication, légende dépliée)",
    dark: true,
    lang: "fr",
    username: "healthy.by.ines",
    likes: "Aimé par sport_et_saveurs et 12 907 autres personnes",
    avatar: "#9fc5a8",
    photoBg: "radial-gradient(circle at 50% 50%,#d9b38c 0,#a0703f 45%,#4a2f1a 100%)",
    photoEmoji: "🍪",
    photoHeight: 300,
    when: "11 septembre",
    commentsLabel: "Voir les 1 208 commentaires",
    source_site: RB,
    license: LICENSE_RB,
    note: "étapes numérotées par émojis 1️⃣…5️⃣ (retirés de la vérité), mode sombre",
    display: INSTA_COOKIES,
    truth: {
      title: "COOKIES AVOINE BANANE CHOCO",
      servings: 12,
      ingredients: [
        "2 bananes bien mûres",
        "150 g de flocons d'avoine",
        "50 g de pépites de chocolat noir",
        "1 c. à café de cannelle",
        "1 pincée de sel",
      ],
      steps: [
        "Préchauffe ton four à 180°C",
        "Écrase les bananes à la fourchette",
        "Ajoute l'avoine, la cannelle, le sel et les pépites, mélange",
        "Forme 12 petits tas sur une plaque avec papier cuisson",
        "Enfourne 15 min, laisse refroidir avant de décoller",
      ],
      notes: null,
    },
  },
  {
    id: "shot-insta-lemon-orzo-en",
    subtype: "instagram",
    look: "Instagram (post, caption expanded)",
    lang: "en",
    username: "weeknight.with.sam",
    location: "Brooklyn, New York",
    likes: "Liked by foodie_jess and 8,211 others",
    avatar: "#f2c14e",
    photoBg: "radial-gradient(circle at 45% 50%,#fff6c9 0,#f5d76e 35%,#8fb35a 65%,#2f3d1f 100%)",
    photoEmoji: "🍋",
    commentsLabel: "View all 342 comments",
    when: "September 9",
    source_site: RB,
    license: LICENSE_RB,
    note: "étapes en paragraphe narratif : vérité découpée par phrase",
    display: INSTA_ORZO,
    truth: {
      title: "one-pan lemon chicken orzo",
      servings: 4,
      ingredients: [
        "4 boneless chicken thighs",
        "1 tbsp olive oil",
        "1 onion, diced",
        "3 garlic cloves, minced",
        "1 1/2 cups orzo",
        "3 cups chicken stock",
        "zest and juice of 1 lemon",
        "2 big handfuls of spinach",
        "1/3 cup grated parmesan",
      ],
      steps: [
        "Season the chicken and sear in the oil 5 min per side, then set aside.",
        "Soften the onion and garlic in the same pan.",
        "Stir in the orzo, stock and lemon zest, nestle the chicken back in, cover and simmer 15 min.",
        "Stir through the spinach, parmesan and lemon juice and serve!",
      ],
      notes: null,
    },
  },
  {
    id: "shot-app-chili-sin-carne",
    subtype: "app-other",
    look: "appli de recettes (fiche avec quantités en colonne)",
    lang: "fr",
    accent: "#ff6b35",
    photoBg: "radial-gradient(circle at 50% 50%,#d8553a 0,#9c2f1e 50%,#3b1a12 100%)",
    photoEmoji: "🌶️",
    meta: ["⏱ 35 min", "Facile", "Végétarien"],
    servingsLabel: "Portions",
    ingredientsLabel: "Ingrédients",
    stepsLabel: "Préparation",
    notesLabel: "Astuce",
    qtyRe:
      /^((?:\d+(?:[.,/]\d+)?|une?)(?: (?:g|ml|cl|c\. à soupe|c\. à café|gousses|pincée|boîte))?) (.*)$/,
    source_site: RB,
    license: LICENSE_RB,
    note: "quantités en colonne à gauche, séparées du nom ; section « Pour servir »",
    truth: {
      title: "Chili sin carne",
      servings: 4,
      ingredients: [
        "1 oignon rouge",
        "2 gousses d'ail",
        "1 poivron rouge",
        "2 c. à soupe d'huile d'olive",
        "400 g de haricots rouges égouttés",
        "150 g de maïs",
        "400 g de tomates concassées",
        "1 c. à café de cumin",
        "1 c. à café de paprika fumé",
        "1 pincée de piment de Cayenne",
        "// Pour servir",
        "1 avocat",
        "1 citron vert",
        "Coriandre fraîche",
        "Riz ou tortillas",
      ],
      steps: [
        "Émincer l'oignon, l'ail et le poivron.",
        "Les faire revenir 5 min dans l'huile à feu moyen.",
        "Ajouter les épices et remuer 1 min.",
        "Verser les tomates, les haricots et le maïs, laisser mijoter 20 min à couvert.",
        "Rectifier l'assaisonnement et servir avec l'avocat en tranches, le citron vert et la coriandre.",
      ],
      notes: "Encore meilleur réchauffé le lendemain.",
    },
  },
  {
    id: "shot-pdf-quiche-lorraine-wikilivres",
    subtype: "app-other",
    look: "PDF (app Fichiers)",
    lang: "fr",
    fileName: "quiche-lorraine.pdf",
    source_url: "https://fr.wikibooks.org/wiki/Livre_de_cuisine/Quiche_lorraine",
    source_site: "fr.wikibooks.org",
    license: LICENSE_WIKI,
    note: "PDF imprimé depuis Wikilivres, police serif ; le paragraphe d'introduction n'est pas dans la vérité (description, pas une note)",
    html: `<h1 style="font-size:26px;margin:0 0 12px">Quiche Lorraine</h1>
<p style="font-size:14px;line-height:1.45;text-align:justify">La recette traditionnelle de la quiche lorraine ne contient ni lait, ni fromage bien que l'on remplace souvent la crème fraîche par du lait demi-écrémé pour la rendre plus légère.</p>
<h2 style="font-size:19px;border-bottom:1px solid #aaa;margin:18px 0 8px">Ingrédients</h2>
<ul style="font-size:14px;line-height:1.5;padding-left:20px;margin:0">
<li>1 pâte brisée ou pâte feuilletée</li>
<li>200 grammes de lard fumé coupé en tout petits dés</li>
<li>1/2 litre de crème fraîche, 10 cl de crème maigre</li>
<li>4 œufs</li>
<li>sel, poivre, noix de muscade</li></ul>
<h2 style="font-size:19px;border-bottom:1px solid #aaa;margin:18px 0 8px">Préparation</h2>
<ol style="font-size:14px;line-height:1.5;padding-left:22px;margin:0">
<li>Sortir préalablement la pâte que vous avez choisi, pour la mettre à température ambiante.</li>
<li>Étaler la pâte et la disposer au fond d'un moule à tarte.</li>
<li>Cuire à blanc la pâte dans votre moule, dans le four pendant 15 à 20 minutes à 180°C, disposer des poids sur la pâte pour éviter qu'elle gonfle trop.</li>
<li>La sortir et réserver.</li>
<li>À la poêle et à feu moyen faites blanchir vos lardons, puis égouttez la matière grasse.</li>
<li>Disposer les lardons dans le fond de tarte.</li>
<li>Dans un récipient, battre avec un fouet les œufs entiers comme pour une omelette et ajouter la crème fraîche puis la crème maigre et poivrer (il faut éviter de trop saler l'appareil à cause du sel contenu dans le lardon).</li>
<li>Verser l'appareil obtenu dans le moule à tarte sur la pâte.</li>
<li>Faire cuire la quiche une quarantaine de minutes au four préchauffé à 180°C.</li></ol>
<h2 style="font-size:19px;border-bottom:1px solid #aaa;margin:18px 0 8px">Remarques</h2>
<p style="font-size:14px;line-height:1.45;text-align:justify">Si vous voulez l'adoucir encore davantage, incorporez moitié lard, moitié jambon blanc coupé en petits morceaux, et ajoutez le fromage râpé.</p>`,
    truth: {
      title: "Quiche Lorraine",
      servings: null,
      ingredients: [
        "1 pâte brisée ou pâte feuilletée",
        "200 grammes de lard fumé coupé en tout petits dés",
        "1/2 litre de crème fraîche, 10 cl de crème maigre",
        "4 œufs",
        "sel, poivre, noix de muscade",
      ],
      steps: [
        "Sortir préalablement la pâte que vous avez choisi, pour la mettre à température ambiante.",
        "Étaler la pâte et la disposer au fond d'un moule à tarte.",
        "Cuire à blanc la pâte dans votre moule, dans le four pendant 15 à 20 minutes à 180°C, disposer des poids sur la pâte pour éviter qu'elle gonfle trop.",
        "La sortir et réserver.",
        "À la poêle et à feu moyen faites blanchir vos lardons, puis égouttez la matière grasse.",
        "Disposer les lardons dans le fond de tarte.",
        "Dans un récipient, battre avec un fouet les œufs entiers comme pour une omelette et ajouter la crème fraîche puis la crème maigre et poivrer (il faut éviter de trop saler l'appareil à cause du sel contenu dans le lardon).",
        "Verser l'appareil obtenu dans le moule à tarte sur la pâte.",
        "Faire cuire la quiche une quarantaine de minutes au four préchauffé à 180°C.",
      ],
      notes:
        "Si vous voulez l'adoucir encore davantage, incorporez moitié lard, moitié jambon blanc coupé en petits morceaux, et ajoutez le fromage râpé.",
    },
  },
];
