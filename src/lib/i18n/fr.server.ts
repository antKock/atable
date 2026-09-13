// Espaces de noms SERVEUR du dictionnaire FR (revue 2026-09-12, lot 4) :
// messages d'API, validation zod, e-mails, catalogue de carrousels. Jamais
// importés par le client — ils ne sont plus embarqués dans le bundle (14 % de
// fr.ts). Même contrat que fr.ts : `as const`, `Widen<typeof frServer>` =
// `ServerDictionary`, une clé manquante dans en.server.ts = erreur tsc.
// Toujours UNE locale par requête (`getT()` renvoie fr ou en en entier), pas
// de découpage par domaine : décision documentée dans docs/specs/i18n/00-socle.md.

export const frServer = {
  // Messages d'erreur des routes API (renvoyés au client tels quels)
  api: {
    serverError: "Erreur serveur",
    invalidData: "Données invalides",
    codeInvalidFormat: "Format de code invalide",
    demoNotDeletable: "Le carnet démo ne peut pas être supprimé.",
    leaveFailed: "Impossible de quitter le carnet",
    deleteFailed: "Impossible de supprimer le carnet",
    photoRequired: "Photo requise",
    photoTooLarge: "Photo trop volumineuse (max 4 Mo)",
    imageFormatUnsupported: "Format d'image non supporté",
    audioRequired: "Fichier audio requis",
    audioTooLarge: "Fichier audio trop volumineux (max 10 Mo)",
    audioFormatUnsupported: "Format audio non supporté",
    screenshotExtractFailed: "Impossible d'extraire la recette depuis les images",
    tokenMissing: "Token manquant",
    recipeNotFound: "Recette introuvable",
    memberNotFound: "Membre introuvable",
    targetHouseholdMissing: "Carnet cible manquant",
    unauthorized: "Non autorisé",
    forbidden: "Accès refusé",
    invalidAction: "Action invalide",
    bodyTooLarge: "Requête trop volumineuse",
  },

  // Messages de validation zod (schemas/recipe.ts, schemas/import.ts)
  validation: {
    titleRequired: "Le titre est requis",
    titleTooLong: "Le titre est trop long (200 caractères max)",
    textTooLong: "Texte trop long (10 000 caractères max)",
    servingsInvalid: "Nombre de personnes invalide",
    imageTooLarge: "Image trop volumineuse",
    imageRequired: "Au moins une image est requise",
    imagesMax: "Maximum 5 images",
    urlInvalid: "URL invalide",
    tagNameRequired: "Le nom du tag est requis",
    tagNameTooLong: "Nom de tag trop long (50 caractères max)",
    httpsOnly: "Seules les URLs HTTPS sont acceptées",
  },

  // Emails de récupération (#14) — copy arbitrée (proposition A « Carte Mijote »)
  email: {
    recovery: {
      subject: "Retrouve ton carnet sur Mijote",
      title: "Retrouve ton carnet",
      body: "Pour retrouver ton carnet Mijote sur un nouvel appareil, appuie sur le bouton, et c'est tout.",
      cta: "Ouvrir Mijote",
    },
    merge: {
      subject: "On réunit tes carnets",
      title: "On réunit tes carnets",
      body: "Tu as saisi cet email depuis ton profil. Confirme pour réunir tes deux accès en une seule identité.",
      cta: "Réunir mes carnets",
    },
    openLink: "Ouvre ce lien :",
    otherDevice: "Tu lis ce mail sur un autre appareil ?",
    useCode: "Saisis plutôt ce code dans Mijote :",
    expires: "Ce lien et ce code expirent dans 15 minutes.",
    notYou: "Tu n'as rien demandé ? Ignore ce mail — ton carnet reste bien au chaud.",
  },

  // Carousels
  carousels: {
    // Groupe A — algorithmiques
    recentes: "Récentes",
    plusVues: "Les plus vues",
    redecouvrir: "Redécouvrir",
    // Groupe B — type de plat
    apero: "Apéro",
    desserts: "Desserts",
    petitDejeuner: "Petit-déjeuner",
    boissons: "Boissons",
    soupes: "Soupes",
    salades: "Salades",
    gouter: "Goûter",
    // Groupe B — régime
    vegetarien: "Végétarien",
    comfortFood: "Comfort food",
    vegan: "Végan",
    leger: "Léger",
    // Groupe B — protéine principale
    poulet: "Poulet",
    boeuf: "Bœuf",
    porc: "Porc",
    agneau: "Agneau",
    poisson: "Poisson",
    fruitsDeMer: "Fruits de mer",
    oeufs: "Œufs",
    proteinesVegetales: "Protéines végétales",
    legumineuses: "Légumineuses",
    // Groupe B — cuisine
    cuisineDuMonde: "Cuisine du monde",
    // Groupe B — occasion
    rapide: "Rapide",
    repasDeFete: "Repas de fête",
    enBatch: "En batch",
    lunchbox: "Lunchbox",
    piqueNique: "Pique-nique",
    // Groupe B — caractéristiques
    pasCher: "Pas cher",
    pourLesEnfants: "Pour les enfants",
    onePot: "One-pot",
    sansCuisson: "Sans cuisson",
    aCongeler: "À congeler",
  },
} as const;
