export const t = {
  // App
  appName: "atable",

  // Navigation
  nav: {
    home: "Accueil",
    add: "Ajouter",
    library: "Bibliothèque",
  },

  // Actions
  actions: {
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    back: "Retour",
    addPhoto: "Ajouter une photo",
    replacePhoto: "Remplacer la photo",
    removePhoto: "Retirer la photo",
    addRecipe: "Ajouter une recette",
    seeAll: "Voir tout",
  },

  // Recipe form
  form: {
    titleLabel: "Titre",
    titlePlaceholder: "Nom de la recette",
    titleRequired: "(requis)",
    ingredientsLabel: "Ingrédients",
    ingredientsPlaceholder: "Un ingrédient par ligne…",
    ingredientsOptional: "(optionnel)",
    stepsLabel: "Préparation",
    stepsPlaceholder: "Une étape par ligne…",
    stepsOptional: "(optionnel)",
    tagsLabel: "Tags",
    tagsOptional: "(optionnel)",
    photoOptional: "(optionnel)",
  },

  // Recipe detail
  detail: {
    ingredients: "Ingrédients",
    steps: "Préparation",
    noIngredients: "Aucun ingrédient ajouté",
    noSteps: "Aucune étape ajoutée",
  },

  // Feedback
  feedback: {
    recipeSaved: "Ajoutée à votre bibliothèque",
    recipeUpdated: "Recette mise à jour",
    recipeDeleted: "Recette supprimée",
    saveError: "Impossible d'enregistrer la recette. Veuillez réessayer.",
    updateError: "Impossible de mettre à jour la recette. Veuillez réessayer.",
    deleteError: "Impossible de supprimer la recette. Veuillez réessayer.",
    photoError: "La photo n'a pas pu être ajoutée",
    loadError: "Impossible de charger les recettes. Vérifiez votre connexion.",
  },

  // Metadata labels
  metadata: {
    prepTime: "Prép.",
    cookTime: "Cuisson",
    cost: "Coût",
    complexity: "Difficulté",
    seasons: "Saisons",
  },

  // Seasons (display labels by stored value)
  seasons: {
    spring: "Printemps",
    summer: "Été",
    autumn: "Automne",
    winter: "Hiver",
    // Stored-value keys
    printemps: "Printemps",
    ete: "Été",
    automne: "Automne",
    hiver: "Hiver",
  },

  // Cost levels
  cost: {
    low: "€",
    medium: "€€",
    high: "€€€",
  },

  // Complexity levels (display labels by stored value)
  complexity: {
    easy: "Facile",
    medium: "Moyen",
    hard: "Difficile",
    // Stored-value keys
    facile: "Facile",
    moyen: "Moyen",
    difficile: "Difficile",
  },

  // Enrichment states
  enrichment: {
    none: "Non enrichi",
    pending: "En cours…",
    done: "Enrichi",
    error: "Erreur",
  },

  // Tag categories
  tagCategories: {
    dishType: "Type de plat",
    diet: "Régime alimentaire",
    protein: "Protéine principale",
    cuisine: "Cuisine",
    occasion: "Occasion",
    features: "Caractéristiques",
  },

  // Carousels
  carousels: {
    nouvelles: "Nouvelles",
    recentes: "Récentes",
    redecouvrir: "Redécouvrir",
    rapide: "Rapide",
    vegetarien: "Végétarien",
    comfortFood: "Comfort food",
    pasCher: "Pas cher",
    apero: "Apéro",
    desserts: "Desserts",
    cuisineItalienne: "Cuisine italienne",
    cuisineDuMonde: "Cuisine du monde",
    petitDejeuner: "Petit-déjeuner",
    boissons: "Boissons",
  },

  // Filters
  filters: {
    deSaison: "De saison",
    typeDePlat: "Type de plat",
    cuisine: "Cuisine",
    regime: "Régime",
    duree: "Durée",
    cout: "Coût",
    lt30min: "< 30 min",
    "30to60": "30 min - 1h",
    gt60: "> 1h",
    noResults: "Aucune recette ne correspond aux filtres",
  },

  // Empty states
  empty: {
    libraryTitle: "Votre bibliothèque est vide",
    libraryBody: "Commencez par ajouter une recette que vous aimez.",
    searchTitle: "Aucun résultat",
    searchBody: "Essayez avec un autre titre, ingrédient ou tag.",
  },

  // Delete confirmation
  deleteDialog: {
    title: "Supprimer cette recette ?",
    body: "Cette action est irréversible.",
    confirm: "Supprimer",
    cancel: "Annuler",
  },

  // Generic actions
  retry: "Réessayer",

  // Import
  import: {
    title: "Nouvelle recette",
    subtitle: "Comment souhaitez-vous ajouter votre recette ?",
    screenshot: {
      title: "Depuis une photo",
      description: "Importez une capture d'écran ou photo de recette",
      upload: "Choisir des images",
      uploadHint: "Plusieurs images possibles — JPG, PNG — max 10 Mo",
      analyze: "Analyser",
      count: (n: number) =>
        `${n} image${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""}`,
    },
    url: {
      title: "Depuis un lien",
      description: "Collez l'URL d'une recette en ligne",
      placeholder: "https://marmiton.org/recette/...",
    },
    manual: {
      title: "Saisie manuelle",
      description: "Remplir le formulaire directement",
    },
    divider: "ou",
    loading: "Extraction de la recette en cours…",
    error:
      "Impossible d'extraire la recette. Réessayez ou saisissez-la manuellement.",
  },

  // Search
  search: {
    placeholder: "Rechercher une recette…",
    clearAriaLabel: "Effacer la recherche",
    ariaLabel: "Rechercher une recette",
  },

  // Photo manager
  photoManager: {
    regenerate: "Régénérer",
    regenerateScheduled: "Régénération prévue",
    replace: "Remplacer",
    remove: "Supprimer",
    regenerateAriaLabel: "Régénérer l'image",
    replaceAriaLabel: "Remplacer la photo",
    removeAriaLabel: "Supprimer la photo",
  },

  // Photo picker
  photoPicker: {
    camera: "Appareil photo",
    gallery: "Galerie de photos",
  },

  // Landing screen
  landing: {
    title: "atable",
    subtitle: "Votre bibliothèque de recettes personnelle",
    tryApp: "Essayer l'app",
    createHousehold: "Créer un foyer",
    joinHousehold: "Rejoindre un foyer",
  },

  // Join via invite link
  joinLink: {
    hero: (name: string) => `Rejoindre « ${name} » ?`,
    confirm: 'Rejoindre',
    notFound: 'Ce lien ne correspond à aucun foyer',
    backToLanding: "Retour à l'accueil",
  },

  // Join household
  join: {
    enterCode: "Entrer un code",
    placeholder: "OLIVE-4821",
    preview: (name: string) => `Foyer « ${name} » trouvé — Rejoindre ?`,
    confirm: "Rejoindre",
    notFound: "Ce code ne correspond à aucun foyer",
    rateLimited: "Trop de tentatives, réessayez plus tard",
    invalidFormat: "Format invalide — ex : OLIVE-4821",
    searching: "Recherche en cours…",
  },

  // Household
  household: {
    created: "Foyer créé",
    code: "Code",
    copy: "Copier",
    copied: "Copié !",
    namePlaceholder: "Ex : Chez nous, Famille Dupont…",
    nameLabel: "Nom du foyer",
    createTitle: "Créer un foyer",
    createSuccess: (name: string) => `Foyer ${name} créé`,
    inviteCodeLabel: "Code invitation",
    inviteLinkCopied: "Lien d'invitation copié !",
    shareTitle: (name: string) => `Rejoindre mon foyer « ${name} » sur atable`,
    createError: "Impossible de créer le foyer. Veuillez réessayer.",
    menu: "Mon foyer",
    menuButton: "Menu du foyer",
    shareCode: "Code du foyer",
    inviteLink: "Lien d'invitation",
    devices: "Appareils connectés",
    leaveHousehold: "Quitter le foyer",
    rename: "Renommer",
    renameTitle: "Renommer le foyer",
    renameSuccess: "Foyer renommé",
    renameError: "Impossible de renommer le foyer",
    revokeDevice: "Révoquer",
    revokeDeviceConfirm: "Révoquer cet appareil ?",
    deviceRevoked: "Appareil révoqué",
    leaveConfirm: "Quitter le foyer ?",
    leaveBody: "Vous devrez rejoindre avec un code ou un lien pour accéder à nouveau aux recettes.",
    leaveAction: "Quitter",
    demoLabel: "Démo",
    currentDevice: "cet appareil",
    revokeBody: "Cette action est irréversible.",
    revokeError: "Impossible de révoquer l'appareil",
    leaveLastMemberTitle: "Supprimer le foyer ?",
    leaveLastMemberBody: "Toutes les recettes seront définitivement supprimées.",
    leaveLastMemberAction: "Supprimer définitivement",
    leaveError: "Une erreur s'est produite. Veuillez réessayer.",
  },

  // Accessibility
  a11y: {
    backButton: "Retour",
    mainNav: "Navigation principale",
    recipePhoto: (title: string) => `Photo de ${title}`,
    recipeCard: (title: string) => title,
    carousel: (theme: string) => `Recettes ${theme}`,
  },
} as const;
