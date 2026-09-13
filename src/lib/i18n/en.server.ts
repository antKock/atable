import type { ServerDictionary } from "./types";

// English server-side namespaces — same shape as `fr.server.ts`, enforced by
// `ServerDictionary` (a missing or extra key fails `tsc`).
export const enServer: ServerDictionary = {
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
    memberNotFound: "Member not found",
    targetHouseholdMissing: "Missing destination cookbook",
    unauthorized: "Unauthorized",
    forbidden: "Forbidden",
    invalidAction: "Invalid action",
    bodyTooLarge: "Request body too large",
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
    tagNameRequired: "Tag name is required",
    tagNameTooLong: "Tag name too long (50 characters max)",
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
};
