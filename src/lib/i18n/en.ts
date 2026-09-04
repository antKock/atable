import type { Dictionary } from "./types";

// English (en-US) dictionary. Same shape as `fr.ts`, enforced by `Dictionary`:
// a missing or extra key fails `tsc`. Casual "you" register mirrors the French
// tutoiement. A « carnet » (household) is a "cookbook": the word the
// social-first competitors (ReciMe, Pestle, Whisk) use for the user's own
// collection, and the standard en-US term — decided 2026-09-04 after a wording
// survey (docs/specs/i18n/00-socle.md, décision 7).
export const en: Dictionary = {
  // App
  appName: "Mijote",

  // Navigation
  nav: {
    home: "Home",
    add: "Add",
    library: "Library",
  },

  // Actions
  actions: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    back: "Back",
    addPhoto: "Add a photo",
    replacePhoto: "Replace photo",
    removePhoto: "Remove photo",
    addRecipe: "Add a recipe",
    seeAll: "See all",
    move: "Move",
  },

  // Recipe form
  form: {
    titleLabel: "Title",
    titlePlaceholder: "Recipe name",
    ingredientsLabel: "Ingredients",
    ingredientsHint: "One ingredient per line, Mijote builds the list",
    ingredientsPlaceholder: "// For the dough\n2 cups flour",
    stepsLabel: "Directions",
    stepsHint: "One step per line, Mijote numbers them",
    stepsPlaceholder: "// For the filling\nSlice the onions…",
    notesLabel: "Notes",
    notesHint: "Tips, variations, details — shown as is",
    notesPlaceholder: "Even better reheated the next day…",
    tagsLabel: "Tags",
    servingsQuestion: "How many people?",
    servingsDecrease: "Fewer people",
    servingsIncrease: "More people",
    servingsInput: "Number of people",
    // Form acts (RecipeForm)
    essentials: "The essentials",
    details: "The details",
    detailsHint: "Mijote fills in whatever you leave empty",
    // Stored value "Aucune" of cook time (VALID_COOK_TIMES)
    cookTimeNone: "None",
    required: "required",
    optional: "optional",
  },

  // Recipe detail
  detail: {
    ingredients: "Ingredients",
    servingsSuffix: (n: number) => `— serves ${n}`,
    steps: "Directions",
    notes: "Notes",
    noIngredients: "No ingredients added",
    noSteps: "No steps added",
  },

  // Feedback
  feedback: {
    recipeSaved: "Added to your library",
    recipeUpdated: "Recipe updated",
    recipeDeleted: "Recipe deleted",
    saveError: "Couldn't save the recipe. Try again.",
    updateError: "Couldn't update the recipe. Try again.",
    deleteError: "Couldn't delete the recipe. Try again.",
    photoError: "The photo couldn't be added",
    loadError: "Couldn't load the recipes. Check your connection.",
    photoSaveError: "The photo couldn't be saved",
    photoTooLarge: "The photo is too large",
  },

  // Metadata labels
  metadata: {
    prepTime: "Prep",
    cookTime: "Cook",
    cost: "Cost",
    complexity: "Difficulty",
    seasons: "Seasons",
  },

  // Seasons (display labels by stored value)
  seasons: {
    spring: "Spring",
    summer: "Summer",
    autumn: "Fall",
    winter: "Winter",
    // Stored-value keys
    printemps: "Spring",
    ete: "Summer",
    automne: "Fall",
    hiver: "Winter",
  },

  // Cost levels (en-US)
  cost: {
    low: "$",
    medium: "$$",
    high: "$$$",
  },

  // Complexity levels (display labels by stored value)
  complexity: {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    // Stored-value keys
    facile: "Easy",
    moyen: "Medium",
    difficile: "Hard",
  },

  // Enrichment states
  enrichment: {
    none: "Not enriched",
    pending: "In progress…",
    done: "Enriched",
    error: "Error",
  },

  // Tag categories — keys = canonical `tags.category` values in DB (French,
  // never translated), values = displayed label.
  tagCategories: {
    "Type de plat": "Dish type",
    "Régime alimentaire": "Diet",
    "Protéine principale": "Main protein",
    Cuisine: "Cuisine",
    Occasion: "Occasion",
    Caractéristiques: "Features",
  },
  tags: {
    addPlaceholder: "Add a tag…",
  },

  // Carousels
  carousels: {
    // Group A — algorithmic
    recentes: "Recent",
    plusVues: "Most viewed",
    redecouvrir: "Rediscover",
    // Group B — dish type
    apero: "Appetizers",
    desserts: "Desserts",
    petitDejeuner: "Breakfast",
    boissons: "Drinks",
    soupes: "Soups",
    salades: "Salads",
    gouter: "Snacks",
    // Group B — diet
    vegetarien: "Vegetarian",
    comfortFood: "Comfort food",
    vegan: "Vegan",
    leger: "Light",
    // Group B — main protein
    poulet: "Chicken",
    boeuf: "Beef",
    porc: "Pork",
    agneau: "Lamb",
    poisson: "Fish",
    fruitsDeMer: "Seafood",
    oeufs: "Eggs",
    proteinesVegetales: "Plant proteins",
    legumineuses: "Legumes",
    // Group B — cuisine
    cuisineDuMonde: "World cuisine",
    // Group B — occasion
    rapide: "Quick",
    repasDeFete: "Holiday meals",
    enBatch: "Batch cooking",
    lunchbox: "Lunchbox",
    piqueNique: "Picnic",
    // Group B — features
    pasCher: "Budget-friendly",
    pourLesEnfants: "Kid-friendly",
    onePot: "One-pot",
    sansCuisson: "No-cook",
    aCongeler: "Freezer-friendly",
  },

  // Filters
  filters: {
    deSaison: "In season",
    typeDePlat: "Dish type",
    cuisine: "Cuisine",
    regime: "Diet",
    duree: "Time",
    cout: "Cost",
    foyer: "Cookbook",
    lt30min: "< 30 min",
    "30to60": "30 min - 1h",
    gt60: "> 1h",
    noResults: "No recipe matches the filters",
  },

  // Empty states
  empty: {
    libraryTitle: "Your cookbook is empty",
    libraryBody: "Add your first recipe to fill it.",
    searchTitle: "No results",
    searchBody: "Try another title, ingredient or tag.",
  },

  // Failed data load (offline, server error)
  loadError: {
    title: "Couldn't load your recipes",
    body: "Check your connection and try again.",
    retry: "Try again",
  },

  // Delete confirmation
  deleteDialog: {
    trigger: "Delete this recipe",
    title: "Delete this recipe?",
    body: "This can't be undone.",
    confirm: "Delete",
    cancel: "Cancel",
  },

  // Generic actions
  retry: "Try again",

  // 404
  notFound: {
    body: "This page doesn't exist.",
    backToLanding: "Back to home",
  },

  // Import
  import: {
    title: "New recipe",
    subtitle: "How do you want to add your recipe?",
    screenshot: {
      title: "From a photo",
      description: "Import a screenshot or a photo of a recipe",
      upload: "Choose images",
      uploadHint: "Multiple images allowed — JPG, PNG — 10 MB max",
      sourceTitle: "Add an image",
      takePhoto: "Take a photo",
      fromGallery: "Choose from gallery",
      cancel: "Cancel",
      analyze: "Analyze",
      count: (n: number) => `${n} image${n > 1 ? "s" : ""} selected`,
    },
    voice: {
      title: "Voice dictation",
      description: "Dictate your recipe out loud",
      record: "Tap to dictate",
      recording: "Recording…",
      processing: "Transcribing…",
      stop: "Stop",
      maxDuration: "3 minutes max",
      error: "Couldn't extract the recipe from the audio",
      errorRecording: "Recording failed. Try again.",
      errorNoMic: "Microphone access denied",
      errorUnsupported: "Your browser doesn't support audio recording",
    },
    url: {
      title: "From a link",
      description: "Paste the URL of an online recipe or an Instagram post",
      placeholder: "https://allrecipes.com/… or instagram.com/reel/…",
    },
    manual: {
      title: "Type it in",
      description: "Fill in the form directly",
    },
    divider: "or",
    error: "Couldn't extract the recipe. Try again or type it in manually.",
    errorSiteBlocked:
      "This site blocks automated access. Try a screenshot or type it in manually.",
    errorRateLimit: "Too many requests, try again in a moment.",
    errorImportQuota: "Daily import limit reached. Try again in 24 hours.",
    errorSiteUnreachable: "Couldn't reach the site. Check the URL and try again.",
  },

  // Search
  search: {
    placeholder: "Search for a recipe…",
    clearAriaLabel: "Clear search",
    ariaLabel: "Search for a recipe",
  },

  // Photo manager
  photoManager: {
    regenerate: "Regenerate",
    regenerateScheduled: "Regeneration scheduled",
    replace: "Replace",
    remove: "Delete",
    regenerateAriaLabel: "Regenerate the image",
    replaceAriaLabel: "Replace the photo",
    removeAriaLabel: "Delete the photo",
    orGenerated: "or Mijote will generate one",
  },

  // Photo picker
  photoPicker: {
    camera: "Camera",
    gallery: "Photo gallery",
  },

  // Landing screen
  landing: {
    title: "Mijote",
    tagline: "Your recipes",
    subtitle: "Gathered as if by magic",
    tryApp: "Try the app",
    createHousehold: "Create a cookbook",
    joinHousehold: "Open a cookbook",
  },

  // Join via invite link
  joinLink: {
    hero: (name: string) => `Open “${name}”?`,
    confirm: "Open",
    notFound: "This link doesn't match any cookbook",
    backToLanding: "Back to home",
    guestNote: "Read-only, live",
  },

  // Join household
  join: {
    enterCode: "Enter a code",
    placeholder: "OLIVE-4821",
    preview: (name: string) => `Found “${name}” — Open it?`,
    confirm: "Open",
    notFound: "This code doesn't match any cookbook",
    rateLimited: "Too many attempts, try again later",
    invalidFormat: "Invalid format — e.g. OLIVE-4821",
    searching: "Searching…",
    enterHeading: ["Enter your", "cookbook code"],
    enterBody: "Ask a member of the cookbook for their invite code. You'll get instant access to the shared recipes.",
  },

  // Household
  household: {
    created: "Cookbook created",
    code: "Code",
    copy: "Copy",
    copied: "Copied!",
    namePlaceholder: "E.g. Family recipes, Our kitchen…",
    nameLabel: "Cookbook name",
    createTitle: "Create a cookbook",
    createError: "Couldn't create the cookbook. Try again.",
    createSubmit: "Create the cookbook",
    createHeading: ["Name your", "cookbook"],
    createBody: "A cookbook to share with the people close to you. Your recipes end up together, in one place.",
    nameEmpty: "The name can't be empty",
    menu: "Cookbook & profile",
    menuButton: "Cookbook & profile",
    shareCode: "Cookbook code",
    inviteLink: "Invite link",
    leaveHousehold: "Leave this cookbook",
    rename: "Rename",
    renameTitle: "Rename the cookbook",
    renameSuccess: "Cookbook renamed",
    renameError: "Couldn't rename the cookbook",
    leaveConfirm: "Leave the cookbook?",
    leaveBody: "You'll need to open it again with a code or a link to get the recipes back.",
    leaveAction: "Leave",
    demoLabel: "Demo",
    deleteHousehold: "Delete the cookbook",
    deleteConfirmTitle: "Delete the cookbook?",
    deleteConfirmBody: "All the recipes in this cookbook and every device's access will be deleted.",
    deleteContinue: "Continue",
    deleteFinalTitle: "Confirm deletion",
    deleteFinalBody:
      "This can't be undone. The cookbook and all its recipes will be permanently lost.",
    deleteFinalAction: "Delete permanently",
    leaveError: "Something went wrong. Try again.",
    // Hub "You + Your cookbooks"
    sectionYou: "You",
    sectionHouseholds: "Your cookbooks",
    accessSaved: "Access saved",
    accessToSave: "Save my access",
    createOrJoin: "Create or open a cookbook",
    homeFoyers: {
      section: "Display",
      entry: "Cookbooks shown on Home",
      title: "Shown on Home",
      note: "Choose which cookbooks' recipes appear on Home.",
      minWarning: "At least one cookbook must stay shown.",
      done: "Done",
      summaryAll: "All",
      summaryCount: (shown: number, total: number) => `${shown} of ${total}`,
    },
    membersSection: "Members",
    guestsSection: "Guests",
    youSuffix: "(you)",
    inviteEntry: "Invite someone",
    guestReadOnly: "You can view the recipes live, but not edit them.",
    invite: {
      title: "Invite someone",
      memberBlockTitle: "As a member",
      memberBlockDesc: "Views and edits recipes.",
      guestBlockTitle: "As a guest",
      guestBlockDesc: "Read-only, live.",
      note: "To remove someone later, go to Members — no need to change the link.",
    },
    memberAction: {
      subtitleMember: "Member · views and edits",
      subtitleGuest: "Guest · read-only",
      toGuest: "Make guest (read-only)",
      toMember: "Make member (can edit)",
      remove: "Remove from the cookbook",
      removeBody: "Removing them cuts their access immediately.",
      roleError: "Couldn't change the role. Try again.",
      removeError: "Couldn't remove this member. Try again.",
      lastMember: "Not possible: they're the last member of the cookbook.",
    },
    roles: {
      member: "member",
      guest: "guest",
    },
    rolesCap: {
      member: "Member",
      guest: "Guest",
    },
    peopleCount: (n: number) => `${n} ${n > 1 ? "people" : "person"}`,
    recipeCount: (n: number) => `${n} recipe${n > 1 ? "s" : ""}`,
    join: {
      alreadyMember: "You already have access to this cookbook.",
      added: (name: string) => `You now have access to “${name}”.`,
      upgraded: "You're now a member of this cookbook.",
    },
    picker: {
      saveTitle: "Which cookbook?",
      moveTitle: "Move to…",
      lockNote: "Cookbooks where you're a guest are read-only.",
      current: "Current",
      required: "Choose a destination cookbook.",
      moveError: "Couldn't move the recipe. Try again.",
      moved: (name: string) => `Recipe moved to “${name}”.`,
      readOnlyDestination: "This cookbook is read-only.",
    },
  },

  // "Create or open" screen (from the hub)
  switchHousehold: {
    title: "Create or open",
    body: "The cookbook will be added to your cookbooks. You keep access to all the ones you've already opened.",
    create: "Create a cookbook",
    join: "Open a cookbook",
  },

  // Profile ("You")
  profile: {
    title: "Your profile",
    nameLabel: "Your name",
    nameHint:
      "Your name is shown to the other members of your cookbooks. Leave it empty and you'll get a default alias.",
    saved: "Profile updated",
    saveError: "Couldn't save your profile. Try again.",
    nameInvalid: "Invalid name — 50 characters max.",
    emailSection: "Recover your access",
    emailLabel: "Recovery email",
    emailPlaceholder: "you@email.com",
    emailHint:
      "Your email is only used to recover your access if you change or lose your device. We'll send you a link only then — no password, no account.",
    emailInvalid: "Invalid email address.",
    logout: "Log out",
    logoutConfirmTitle: "Log out?",
    logoutConfirmBody: "This device will be logged out. You can get your cookbooks back with your recovery email.",
    logoutConfirmBodyNoEmail:
      "This device will be logged out. Without a recovery email you may lose access to your cookbooks — consider adding one first.",
    logoutAction: "Log out",
  },

  // Owner merge (#14 §5)
  merge: {
    title: "Bringing your cookbooks together",
    body: (email: string) =>
      `This email is already used by another profile. Enter the code we just sent to ${email} to merge both accesses into one identity.`,
    codeLabel: "Code received by email",
    success: "Your cookbooks are now together",
    codeInvalid: "Invalid or expired code. Try again, or resend an email.",
  },

  // Access recovery (#14)
  recovery: {
    forkBody: "With an invite code from someone close, or the email you had saved.",
    forkCode: "I have an invite code",
    forkEmail: "Recover with my email",
    title: "Recover my access",
    body: "Enter the email you had saved. We'll send you a link to get your cookbook back on this device.",
    emailPlaceholder: "you@email.com",
    send: "Send the link",
    sendError: "Couldn't send the link. Try again.",
    rateLimited: "Too many attempts, try again later",
    checkTitle: "Check your inbox",
    checkBody: "We sent a sign-in link to this address:",
    checkHint: "Open it to confirm — that's it.",
    codePrompt: "Reading your email on another device?",
    codePromptHint: "Enter the code you received instead.",
    codeLabel: "6-digit code",
    codeInvalid: "Invalid or expired code.",
    resend: "Resend",
    resendIn: (seconds: number) =>
      `Resend · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
    consuming: "Signing in…",
    consumeErrorTitle: "This link is no longer valid",
    consumeErrorBody:
      "It may have expired (15 minutes) or already been used. Request a new one from “Open a cookbook”.",
    backToLanding: "Back to home",
  },

  // Home hints
  hints: {
    share: {
      title: "Cook together",
      body: "Share your cookbook: everyone's recipes end up in the same place, live.",
      cta: "Invite someone",
    },
    email: {
      title: "Save your access",
      body: "Add an email and you'll get this cookbook back even if you change devices. No account, no password.",
      cta: "Add an email",
      dismissToast: "You'll find this in your profile",
    },
    install: {
      label: "Install the Mijote app",
      cta: "Install",
    },
    dismiss: "Close",
  },

  // Demo
  demo: {
    title: "You're exploring a demo account",
    body: "Recipes added here aren't kept. Create your own cookbook to keep yours.",
    cta: "Create my cookbook",
    frozen: "This action isn't available in the demo.",
  },

  // Recipe sharing
  share: {
    action: "Share",
    linkCopied: "Link copied",
    shareError: "Sharing failed",
    save: "Save this recipe",
    reminderLabel: "Recipe to save",
    haveHousehold: "I already have a cookbook — open it",
    addToHousehold: "Add to my cookbook",
    adding: "Adding…",
    added: "Added to your cookbook",
    viewMyHousehold: "View my cookbook",
    alreadyOwned: "Already in your cookbook",
    addError: "Couldn't add the recipe. Try again.",
    notFoundTitle: "Recipe not found",
    notFoundBody: "This share link is no longer valid.",
  },

  // Install-app banner (iOS web users)
  installBanner: {
    codeTitle: "One more step",
    codeBody: "Open Mijote and enter this code to get your cookbook back:",
    reopenStore: "Reopen the App Store",
    codeCopied: "Code copied",
    copyCode: "Copy the code",
    dismiss: "Later",
  },

  // Import loading screen (ImportLoading)
  importLoading: {
    phrases: [
      "Simmering…",
      "Bubbling away in the pot…",
      "Smells good already…",
      "Something's sizzling in there…",
      "Magic happening on low heat…",
      "Almost done…",
      "Hang on, dinner's nearly served…",
    ],
    subline: "Putting the ingredients and steps in the right place",
    ariaLabel: "Import in progress",
  },

  // API route error messages (sent to the client as is)
  api: {
    serverError: "Server error",
    invalidData: "Invalid data",
    codeInvalidFormat: "Invalid code format",
    demoNotDeletable: "The demo cookbook can't be deleted.",
    leaveFailed: "Couldn't leave the cookbook",
    deleteFailed: "Couldn't delete the cookbook",
    photoRequired: "Photo required",
    photoTooLarge: "Photo too large (4 MB max)",
    imageFormatUnsupported: "Unsupported image format",
    audioRequired: "Audio file required",
    audioTooLarge: "Audio file too large (10 MB max)",
    audioFormatUnsupported: "Unsupported audio format",
    screenshotExtractFailed: "Couldn't extract the recipe from the images",
    tokenMissing: "Missing token",
    recipeNotFound: "Recipe not found",
    targetHouseholdMissing: "Missing destination cookbook",
  },

  // Zod validation messages (schemas/recipe.ts, schemas/import.ts)
  validation: {
    titleRequired: "Title is required",
    titleTooLong: "Title is too long (200 characters max)",
    textTooLong: "Text is too long (10,000 characters max)",
    servingsInvalid: "Invalid number of people",
    imageTooLarge: "Image too large",
    imageRequired: "At least one image is required",
    imagesMax: "5 images max",
    urlInvalid: "Invalid URL",
    httpsOnly: "Only HTTPS URLs are accepted",
  },

  // Access-recovery emails (#14)
  email: {
    recovery: {
      subject: "Get your cookbook back on Mijote",
      title: "Get your cookbook back",
      body: "To get your Mijote cookbook back on a new device, tap the button — that's it.",
      cta: "Open Mijote",
    },
    merge: {
      subject: "Bringing your cookbooks together",
      title: "Bringing your cookbooks together",
      body: "You entered this email from your profile. Confirm to merge your two accesses into one identity.",
      cta: "Merge my cookbooks",
    },
    openLink: "Open this link:",
    otherDevice: "Reading this on another device?",
    useCode: "Enter this code in Mijote instead:",
    expires: "This link and code expire in 15 minutes.",
    notYou: "Didn't ask for this? Ignore this email — your cookbook is safe and sound.",
  },

  // Accessibility
  a11y: {
    backButton: "Back",
    mainNav: "Main navigation",
    recipePhoto: (title: string) => `Photo of ${title}`,
    recipeCard: (title: string) => title,
    carousel: (theme: string) => `${theme} recipes`,
  },
};
