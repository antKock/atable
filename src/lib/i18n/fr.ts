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
    move: "Déplacer",
  },

  // Recipe form
  form: {
    titleLabel: "Titre",
    titlePlaceholder: "Nom de la recette",
    ingredientsLabel: "Ingrédients",
    ingredientsHint: "Un ingrédient par ligne, Mijote dresse la liste",
    // The placeholder demonstrates the "// Nom" section syntax by example
    // rather than spelling it out in the always-on hint — it's an advanced,
    // low-key convention, so showing it in the empty field is enough.
    ingredientsPlaceholder: "// Pour la pâte\n250 g de farine",
    stepsLabel: "Préparation",
    stepsHint: "Une étape par ligne, Mijote les numérote",
    stepsPlaceholder: "// Pour la garniture\nÉmincer les oignons…",
    notesLabel: "Notes",
    notesHint: "Astuces, variantes, précisions — affichées telles quelles",
    notesPlaceholder: "Encore meilleur réchauffé le lendemain…",
    tagsLabel: "Tags",
    servingsQuestion: "Pour combien de personnes ?",
    servingsDecrease: "Moins de personnes",
    servingsIncrease: "Plus de personnes",
    servingsInput: "Nombre de personnes",
  },

  // Recipe detail
  detail: {
    ingredients: "Ingrédients",
    servingsSuffix: (n: number) => `— pour ${n} pers.`,
    steps: "Préparation",
    notes: "Notes",
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

  // Filters
  filters: {
    deSaison: "De saison",
    typeDePlat: "Type de plat",
    cuisine: "Cuisine",
    regime: "Régime",
    duree: "Durée",
    cout: "Coût",
    foyer: "Foyer",
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

  // Failed data load (offline, server error) — distinct from the empty state:
  // a user with 50 recipes must never see "add your first recipe" on a 500.
  loadError: {
    title: "Impossible de charger tes recettes",
    body: "Vérifie ta connexion et réessaie.",
    retry: "Réessayer",
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
      sourceTitle: "Ajouter une image",
      takePhoto: "Prendre une photo",
      fromGallery: "Choisir dans la galerie",
      cancel: "Annuler",
      analyze: "Analyser",
      count: (n: number) =>
        `${n} image${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""}`,
    },
    voice: {
      title: "Dictée vocale",
      description: "Dicte ta recette à voix haute",
      record: "Appuie pour dicter",
      recording: "Enregistrement en cours…",
      processing: "Transcription en cours…",
      stop: "Arrêter",
      maxDuration: "3 minutes max",
      error: "Impossible d'extraire la recette depuis l'audio",
      errorRecording: "L'enregistrement a échoué. Réessaie.",
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
    // Code invité (Lot 3) : la confirmation dit que l'accès est en lecture seule
    guestNote: 'En lecture seule, en direct',
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
    createError: "Impossible de créer le foyer. Réessaie.",
    menu: "Foyer & profil",
    menuButton: "Foyer & profil",
    shareCode: "Code du foyer",
    inviteLink: "Lien d'invitation",
    leaveHousehold: "Quitter ce foyer",
    rename: "Renommer",
    renameTitle: "Renommer le foyer",
    renameSuccess: "Foyer renommé",
    renameError: "Impossible de renommer le foyer",
    leaveConfirm: "Quitter le foyer ?",
    leaveBody: "Tu devras rejoindre avec un code ou un lien pour accéder à nouveau aux recettes.",
    leaveAction: "Quitter",
    demoLabel: "Démo",
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
    // Hub « Toi + Tes foyers » (chantier foyer, Lot 1)
    sectionYou: "Toi",
    sectionHouseholds: "Tes foyers",
    // Sous-titre de la ligne « Toi » selon owners.recovery_email (Lot 2)
    accessSaved: "Accès sauvegardé",
    accessToSave: "Sauvegarder mon accès",
    createOrJoin: "Créer ou rejoindre un foyer",
    // Réglage « foyers affichés sur l'accueil » (multi-foyer) — hub + dialog
    homeFoyers: {
      section: "Affichage",
      entry: "Foyers affichés sur l'accueil",
      title: "Affichés sur l'accueil",
      note: "Choisis les foyers dont les recettes apparaissent sur l'accueil.",
      minWarning: "Au moins un foyer doit rester affiché.",
      done: "Terminé",
      // Sous-titre de l'entrée : « Tous » ou « N sur M »
      summaryAll: "Tous",
      summaryCount: (shown: number, total: number) => `${shown} sur ${total}`,
    },
    membersSection: "Membres",
    guestsSection: "Invités",
    youSuffix: "(toi)",
    // Entrée « Inviter » depuis le détail du foyer (Lot 3, membres only)
    inviteEntry: "Inviter quelqu'un",
    // Bandeau lecture seule affiché à un invité sur le détail d'un foyer (Lot 3)
    guestReadOnly: "Tu peux consulter les recettes en direct, mais pas les modifier.",
    // Écran plein « Inviter » à deux liens (Lot 3, maquette 2.1)
    invite: {
      title: "Inviter quelqu'un",
      memberBlockTitle: "Comme membre",
      memberBlockDesc: "Consulte et modifie les recettes.",
      guestBlockTitle: "Comme invité",
      guestBlockDesc: "Lecture seule, en direct.",
      note: "Pour retirer quelqu'un plus tard, va dans Membres — pas besoin de changer le lien.",
    },
    // Dialog d'action sur un membre (Lot 3, maquette 2.2 / MemberActionScreen)
    memberAction: {
      subtitleMember: "Membre · consulte et modifie",
      subtitleGuest: "Invité · lecture seule",
      toGuest: "Passer en invité (lecture seule)",
      toMember: "Passer en membre (peut modifier)",
      remove: "Retirer du foyer",
      removeBody: "La retirer coupe son accès immédiatement.",
      roleError: "Impossible de changer le rôle. Réessaie.",
      removeError: "Impossible de retirer ce membre. Réessaie.",
      lastMember: "Impossible : c'est le dernier membre du foyer.",
    },
    // Pas de `as Record<MembershipRole, string>` : l'assertion compilerait même
    // avec une clé manquante. Le `as const` du fichier suffit à l'indexation.
    roles: {
      member: "membre",
      guest: "invité",
    },
    rolesCap: {
      member: "Membre",
      guest: "Invité",
    },
    peopleCount: (n: number) => `${n} personne${n > 1 ? "s" : ""}`,
    recipeCount: (n: number) => `${n} recette${n > 1 ? "s" : ""}`,
    // Rejoindre devient additif (Lot 4, §1) : messages du re-join.
    join: {
      alreadyMember: "Tu fais déjà partie de ce foyer.",
      added: (name: string) => `Tu as rejoint « ${name} ».`,
      upgraded: "Tu es maintenant membre de ce foyer.",
    },
    // Dialog de choix de foyer (maquette 0.4 / 2.4, Lot 4) : enregistrement et
    // déplacement d'une recette. Réutilise ui/dialog (décision n°8).
    picker: {
      saveTitle: "Dans quel foyer ?",
      moveTitle: "Déplacer vers…",
      lockNote: "Les foyers où tu es invité sont en lecture seule.",
      current: "Actuel",
      // 422 serveur : plusieurs foyers membres mais aucun choix transmis.
      required: "Choisis un foyer de destination.",
      moveError: "Impossible de déplacer la recette. Réessaie.",
      moved: (name: string) => `Recette déplacée vers « ${name} ».`,
      // Copie lecture seule générique (jamais de nom de foyer cité, §5).
      readOnlyDestination: "Ce foyer est en lecture seule.",
    },
  },

  // Écran « Créer ou rejoindre » (depuis le hub — sémantique additive, Lot 4 :
  // le foyer s'ajoute à tes foyers, l'appareil ne quitte rien)
  switchHousehold: {
    title: "Créer ou rejoindre",
    body: "Le foyer s'ajoutera à tes foyers. Tu gardes l'accès à tous ceux que tu as déjà rejoints.",
    create: "Créer un foyer",
    join: "Rejoindre un foyer",
  },

  // Profil (« Toi »)
  profile: {
    title: "Ton profil",
    nameLabel: "Ton nom",
    nameHint:
      "Ton nom apparaît auprès des autres membres de tes foyers. Laisse vide et on te donne un alias par défaut.",
    saved: "Profil mis à jour",
    saveError: "Impossible d'enregistrer ton profil. Réessaie.",
    nameInvalid: "Nom invalide — 50 caractères maximum.",
    // Email de secours (#14) — saisi ici, AUCUN envoi à la saisie
    emailSection: "Retrouver ton accès",
    emailLabel: "Email de secours",
    emailPlaceholder: "ton@email.fr",
    emailHint:
      "Ton email sert uniquement à retrouver ton accès si tu changes ou perds ton appareil. On t'enverra un lien seulement à ce moment-là — pas de mot de passe, pas de compte.",
    emailInvalid: "Adresse email invalide.",
    // Déconnexion (même gabarit que « Quitter le foyer »)
    logout: "Se déconnecter",
    logoutConfirmTitle: "Se déconnecter ?",
    logoutConfirmBody: "Cet appareil sera déconnecté. Tu pourras retrouver tes foyers avec ton email de secours.",
    logoutConfirmBodyNoEmail:
      "Cet appareil sera déconnecté. Sans email de secours, tu risques de perdre l'accès à tes foyers — pense à en ajouter un avant.",
    logoutAction: "Se déconnecter",
  },

  // Fusion d'owners (#14, §5) — déclenchée depuis le profil quand l'email est
  // déjà utilisé par un autre profil
  merge: {
    title: "On réunit tes foyers",
    body: (email: string) =>
      `Cet email est déjà utilisé par un autre profil. Saisis le code qu'on vient d'envoyer à ${email} pour réunir les deux accès en une seule identité.`,
    codeLabel: "Code reçu par email",
    success: "Tes foyers sont réunis",
    codeInvalid: "Code invalide ou expiré. Réessaie, ou renvoie un email.",
  },

  // Récupération d'accès (#14) — fork onboarding + écrans de récup
  recovery: {
    // Écran « Rejoindre un foyer » (fork)
    forkBody: "Avec le code d'invitation d'un proche, ou l'email que tu avais sauvegardé.",
    forkCode: "J'ai un code d'invitation",
    forkEmail: "Récupérer avec mon email",
    // Saisie de l'email
    title: "Récupérer mon accès",
    body: "Entre l'email que tu avais sauvegardé. On t'envoie un lien pour retrouver ton foyer sur cet appareil.",
    emailPlaceholder: "ton@email.fr",
    send: "Envoyer le lien",
    sendError: "Impossible d'envoyer le lien. Réessaie.",
    rateLimited: "Trop de tentatives, réessaie plus tard",
    // Écran « Vérifie tes mails » (anti-énumération : identique que l'email
    // existe ou non)
    checkTitle: "Vérifie tes mails",
    checkBody: "On a envoyé un lien de connexion à cette adresse :",
    checkHint: "Ouvre-le pour confirmer — c'est tout.",
    codePrompt: "Tu lis tes mails sur un autre appareil ?",
    codePromptHint: "Saisis plutôt le code reçu.",
    codeLabel: "Code à 6 chiffres",
    codeInvalid: "Code invalide ou expiré.",
    resend: "Renvoyer",
    resendIn: (seconds: number) =>
      `Renvoyer · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
    // Magic-link /recover/[token]
    consuming: "Connexion en cours…",
    consumeErrorTitle: "Ce lien n'est plus valide",
    consumeErrorBody:
      "Il a peut-être expiré (15 minutes) ou déjà servi. Refais une demande depuis « Rejoindre un foyer ».",
    backToLanding: "Retour à l'accueil",
  },

  // Hints home (#14, décision n°9) : un hint principal à la fois
  hints: {
    share: {
      title: "Cuisinez à plusieurs",
      body: "Invite les gens de ton foyer : vos recettes se retrouvent au même endroit, en direct.",
      cta: "Inviter quelqu'un",
    },
    email: {
      title: "Sauvegarde ton accès",
      body: "Ajoute un email et tu retrouveras ce foyer même si tu changes d'appareil. Pas de compte, pas de mot de passe.",
      cta: "Ajouter un email",
      dismissToast: "Tu retrouveras ça dans ton profil",
    },
    install: {
      label: "Installe l'app Mijote",
      cta: "Installer",
    },
    dismiss: "Fermer",
  },

  // Démo — stratégie C « monde gelé » : la surface foyer/membership/profil est
  // coupée pour les sessions démo (guard serveur central assertNotDemoMutation)
  demo: {
    // Hint démo (HintCard variante `demo`, rendu sur /home par HomeHints),
    // gabarit « hint classique » comme partage/email pour être plus visible et
    // explicite : c'est un compte de test dont les recettes ne sont pas
    // conservées. Non dismissable — état démo ET seul chemin de conversion :
    // son CTA ouvre directement la création de foyer (→ owner neuf).
    title: "Tu explores un compte démo",
    body: "Les recettes ajoutées ici ne sont pas conservées. Crée ton foyer pour garder les tiennes.",
    cta: "Créer mon foyer",
    frozen: "Cette action n'est pas disponible dans la démo.",
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
    // Step 1 (mini-strip) : voir hints.install
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
