import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { getHouseholdByName } from "./db";

/**
 * Chaque « visiteur » E2E = un contexte navigateur isolé (cookies propres)
 * avec une IP simulée unique via x-forwarded-for : les rate-limits par IP
 * (join 5/h, création de foyer 5/h) sont lus depuis ce header par les routes,
 * et une IP partagée ferait dérailler la suite en 429.
 */
export async function newVisitor(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  const ip = `10.${rand(254)}.${rand(254)}.${1 + rand(253)}`;
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const page = await context.newPage();
  return { context, page };
}

function rand(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}

/** Nom unique par run pour éviter les collisions entre runs successifs. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${rand(999)}`;
}

/**
 * Onboarding « Créer un foyer » via l'UI. Redirige vers /home (sans query) et
 * retourne le join code relu en DB par le nom du foyer.
 */
export async function createHouseholdViaUI(page: Page, name: string): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "Créer un foyer" }).click();
  await page.getByPlaceholder("Ex : Chez nous, Famille Dupont…").fill(name);
  await page.getByRole("button", { name: "Créer le foyer" }).click();
  await page.waitForURL(/\/home/);
  const household = await getHouseholdByName(name);
  expect(household?.join_code, "le foyer créé doit avoir un join_code").toMatch(/^[A-Z]+-\d{4}$/);
  return household!.join_code as string;
}

/**
 * Depuis le hub « Foyer & profil », ouvre le détail du (premier) foyer.
 * Exclut les lignes « Toi » (/profile) et « Créer ou rejoindre » (/switch).
 */
export async function openHouseholdDetail(page: Page): Promise<void> {
  await page.goto("/household");
  await page
    .locator('a[href^="/household/"]:not([href$="/profile"]):not([href$="/switch"])')
    .first()
    .click();
  await page.waitForURL(/\/household\/[0-9a-f-]{36}/);
}

/**
 * Onboarding « Rejoindre un foyer » via le code d'invitation — passe par le
 * fork du Lot 2 (code OU récupération email).
 */
export async function joinViaCode(page: Page, code: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Rejoindre un foyer" }).click();
  await page.getByRole("button", { name: "J'ai un code d'invitation" }).click();
  await page.getByPlaceholder("OLIVE-4821").fill(code);
  await page.getByRole("button", { name: "Rejoindre", exact: true }).click();
  await page.waitForURL(/\/home/);
}

/**
 * Rejoindre ADDITIVEMENT depuis le hub (Lot 4) : l'owner courant ajoute un
 * foyer, la session est conservée, le hub liste tous ses foyers. Passe par
 * /household/switch (« Créer ou rejoindre »).
 */
export async function joinFromHub(page: Page, code: string): Promise<void> {
  await openSwitchScreen(page);
  await page.getByRole("button", { name: "Rejoindre un foyer" }).click();
  await page.getByPlaceholder("OLIVE-4821").fill(code);
  await page.getByRole("button", { name: "Rejoindre", exact: true }).click();
  // Additif → retour au hub (pas de nouvelle session). Attendre que le hub soit
  // RÉELLEMENT chargé (pas seulement l'URL) : la redirection additive passe par
  // window.location, et un goto suivant qui court-circuite ce chargement en vol
  // avorte (net::ERR_ABORTED).
  await page.waitForURL(/\/household(\?|$|\/)/);
  await expect(page.getByRole("heading", { name: "Foyer & profil" })).toBeVisible();
}

/** Ouvre « Créer ou rejoindre un foyer » depuis le hub (nav SPA fiable). */
async function openSwitchScreen(page: Page): Promise<void> {
  await page.goto("/household");
  await page.getByRole("link", { name: "Créer ou rejoindre un foyer" }).click();
  await page.waitForURL(/\/household\/switch/);
}

/**
 * Créer ADDITIVEMENT un foyer depuis le hub (Lot 4) : ajoute un foyer à l'owner
 * courant, redirige vers la Home (créer depuis le profil ramène à l'accueil).
 * Retourne l'id du nouveau foyer (relu en DB par le nom).
 */
export async function createFromHub(page: Page, name: string): Promise<string> {
  await openSwitchScreen(page);
  await page.getByRole("button", { name: "Créer un foyer" }).click();
  await page.getByPlaceholder("Ex : Chez nous, Famille Dupont…").fill(name);
  await page.getByRole("button", { name: "Créer le foyer" }).click();
  await page.waitForURL(/\/home/);
  const household = await getHouseholdByName(name);
  expect(household?.id, "le foyer créé depuis le hub doit exister en DB").toBeTruthy();
  return household!.id as string;
}

/** Pose l'email de secours depuis le profil (aucun envoi attendu). */
export async function setRecoveryEmail(page: Page, email: string): Promise<void> {
  await page.goto("/household/profile");
  await page.getByLabel("Email de secours").fill(email);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Profil mis à jour")).toBeVisible();
}

/**
 * Ouvre l'écran de récupération par email depuis la landing et envoie la
 * demande — laisse la page sur « Vérifie tes mails ».
 */
export async function requestRecovery(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Rejoindre un foyer" }).click();
  await page.getByRole("button", { name: "Récupérer avec mon email" }).click();
  await page.getByLabel("Email de secours").fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("heading", { name: "Vérifie tes mails" })).toBeVisible();
}
