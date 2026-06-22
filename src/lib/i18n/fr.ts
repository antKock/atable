export const t = {
  // App
  appName: "Mijote",

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
    ingredientsLabel: "Ingrédients",
    ingredientsPlaceholder: "Un ingrédient par ligne…",
    stepsLabel: "Préparation",
    stepsPlaceholder: "Une étape par ligne…",
    tagsLabel: "Tags",
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
    recipeSaved: "Ajoutée à ta bibliothèque",
    recipeUpdated: "Recette mise à jour",
    recipeDeleted: "Recette supprimée",
    saveError: "Impossible d'enregistrer la recette. Réessaie.",
    updateError: "Impossible de mettre à jour la recette. Réessaie.",
    deleteError: "Impossible de supprimer la recette. Réessaie.",
    photoError: "La photo n'a pas pu être ajoutée",
    loadError: "Impossible de charger les recettes. Vérifie ta connexion.",
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
    libraryTitle: "La cocotte est vide",
    libraryBody: "Ajoute ta première recette pour démarrer ta bibliothèque.",
    searchTitle: "Aucun résultat",
    searchBody: "Essaie avec un autre titre, ingrédient ou tag.",
  },

  // Delete confirmation
  deleteDialog: {
    trigger: "Supprimer cette recette",
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
    subtitle: "Comment veux-tu ajouter ta recette ?",
    screenshot: {
      title: "Depuis une photo",
      description: "Importe une capture d'écran ou photo de recette",
      upload: "Choisir des images",
      uploadHint: "Plusieurs images possibles — JPG, PNG — max 10 Mo",
      analyze: "Analyser",
      count: (n: number) =>
        `${n} image${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""}`,
    },
    voice: {
      title: "Dictée vocale",
      description: "Dicte ta recette à voix haute",
      record: "Appuie pour dicter",
      recording: "Enregistrement en cours…",
      stop: "Arrêter",
      maxDuration: "3 minutes max",
      error: "Impossible d'extraire la recette depuis l'audio",
      errorNoMic: "Accès au microphone refusé",
      errorUnsupported: "Ton navigateur ne supporte pas l'enregistrement audio",
    },
    url: {
      title: "Depuis un lien",
      description: "Colle l'URL d'une recette en ligne ou d'un post Instagram",
      placeholder: "https://marmiton.org/… ou instagram.com/reel/…",
    },
    manual: {
      title: "Saisie manuelle",
      description: "Remplir le formulaire directement",
    },
    divider: "ou",
    error:
      "Impossible d'extraire la recette. Réessaie ou saisis-la manuellement.",
    errorSiteBlocked:
      "Ce site bloque l'accès automatique. Essaie avec une capture d'écran ou la saisie manuelle.",
    errorRateLimit:
      "Trop de requêtes, réessaie dans quelques instants.",
    errorImportQuota:
      "Limite quotidienne d'imports atteinte. Réessaie dans 24h.",
    errorSiteUnreachable:
      "Impossible d'accéder au site. Vérifie l'URL et réessaie.",
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
    title: "Mijote",
    tagline: "Tes recettes",
    subtitle: "Réunies comme par magie",
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
    rateLimited: "Trop de tentatives, réessaie plus tard",
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
    shareTitle: (name: string) => `Rejoindre mon foyer « ${name} » sur Mijote`,
    createError: "Impossible de créer le foyer. Réessaie.",
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
    leaveBody: "Tu devras rejoindre avec un code ou un lien pour accéder à nouveau aux recettes.",
    leaveAction: "Quitter",
    demoLabel: "Démo",
    currentDevice: "cet appareil",
    revokeBody: "Cette action est irréversible.",
    revokeError: "Impossible de révoquer l'appareil",
    deleteHousehold: "Supprimer le foyer",
    deleteConfirmTitle: "Supprimer le foyer ?",
    deleteConfirmBody:
      "Toutes les recettes du foyer et l'accès de tous les appareils seront supprimés.",
    deleteContinue: "Continuer",
    deleteFinalTitle: "Confirmer la suppression",
    deleteFinalBody:
      "Cette action est irréversible. Le foyer et toutes ses recettes seront définitivement perdus.",
    deleteFinalAction: "Supprimer définitivement",
    leaveError: "Une erreur s'est produite. Réessaie.",
  },

  // Recipe sharing
  share: {
    action: "Partager",
    linkCopied: "Lien copié",
    shareError: "Le partage a échoué",
    // Public share page (/r/<token>)
    save: "Enregistrer cette recette",
    reminderLabel: "Recette à enregistrer",
    haveHousehold: "J'ai déjà un foyer — le rejoindre",
    addToHousehold: "Ajouter à mon foyer",
    adding: "Ajout en cours…",
    added: "Ajoutée à ton foyer",
    viewMyHousehold: "Voir mon foyer",
    alreadyOwned: "Déjà dans ton foyer",
    addError: "Impossible d'ajouter la recette. Réessaie.",
    notFoundTitle: "Recette introuvable",
    notFoundBody: "Ce lien de partage n'est plus valide.",
  },

  // Install-app banner (iOS web users). Two steps: invite to install, then —
  // once they tap install — reveal the foyer code for session continuity into
  // the fresh app WebView (separate cookie jar from Safari).
  installBanner: {
    title: "Garde Mijote sur ton iPhone",
    body: "Installe l'app pour garder tes recettes à portée de main, même hors connexion.",
    install: "Installer l'app",
    // Step 2 — after tapping install
    codeTitle: "Encore une étape",
    codeBody: "Ouvre Mijote et rejoins ton foyer avec ce code :",
    reopenStore: "Rouvrir l'App Store",
    codeCopied: "Code copié",
    copyCode: "Copier le code",
    dismiss: "Plus tard",
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
