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

  // Carousels
  carousels: {
    recent: "Récentes",
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

  // Search
  search: {
    placeholder: "Rechercher une recette…",
    clearAriaLabel: "Effacer la recherche",
    ariaLabel: "Rechercher une recette",
  },

  // Photo picker
  photoPicker: {
    camera: "Appareil photo",
    gallery: "Galerie de photos",
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
