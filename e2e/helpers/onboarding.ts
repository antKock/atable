import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

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
 * Onboarding « Créer un foyer » via l'UI. Retourne le join code (lu dans
 * l'URL /home?code=… posée par POST /api/households).
 */
export async function createHouseholdViaUI(page: Page, name: string): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "Créer un foyer" }).click();
  await page.getByPlaceholder("Ex : Chez nous, Famille Dupont…").fill(name);
  await page.getByRole("button", { name: "Créer le foyer" }).click();
  await page.waitForURL(/\/home/);
  const code = new URL(page.url()).searchParams.get("code");
  expect(code, "le redirect post-création doit porter ?code=").toMatch(/^[A-Z]+-\d{4}$/);
  return code as string;
}

/** Onboarding « Rejoindre un foyer » via le formulaire de saisie de code. */
export async function joinViaCode(page: Page, code: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Rejoindre un foyer" }).click();
  await page.getByPlaceholder("OLIVE-4821").fill(code);
  await page.getByRole("button", { name: "Rejoindre", exact: true }).click();
  await page.waitForURL(/\/home/);
}
