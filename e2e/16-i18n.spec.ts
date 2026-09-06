import { test, expect } from "@playwright/test";
import { newVisitor, createHouseholdViaUI, uniqueName } from "./helpers/onboarding";
import { getHouseholdByJoinCode, insertRecipe } from "./helpers/db";

// Chantier « Version EN » : la locale suit l'appareil. Le serveur E2E tourne
// comme la prod, I18N_EN_ENABLED=1 (pinné dans helpers/env.ts) : sans cookie,
// Accept-Language décide. Les specs FR restent FR parce que le contexte
// Playwright envoie `locale: "fr-FR"` (playwright.config.ts). Le serveur pose
// aussi I18N_PREVIEW_COOKIE=1 : le cookie mijote_locale force la langue.
//
// Le rollback (flag absent → fr quoi qu'il arrive) est couvert en unitaire par
// src/lib/i18n/locale.test.ts (« tout éteint → fr ») : pas de second serveur.

test("i18n : flag ON, un navigateur anglais sans cookie voit la landing en anglais", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    extraHTTPHeaders: { "x-forwarded-for": "10.99.0.1" },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Create a cookbook" })).toBeVisible();
  await context.close();
});

test("i18n : ?lang=en pose le cookie de prévisualisation et bascule la landing en anglais", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);
  await page.goto("/?lang=en");
  // LocalePreviewSwitch recharge sans le paramètre
  await page.waitForURL((url) => !url.searchParams.has("lang"));
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("Mijote");
  await expect(page.getByRole("button", { name: "Try the app" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create a cookbook" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open a cookbook" })).toBeVisible();
  const cookie = (await context.cookies()).find((c) => c.name === "mijote_locale");
  expect(cookie?.value).toBe("en");

  // Retour en FR par le même chemin
  await page.goto("/?lang=fr");
  await page.waitForURL((url) => !url.searchParams.has("lang"));
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("button", { name: "Essayer l'app" })).toBeVisible();
  await context.close();
});

// `baseURL` = http://127.0.0.1:${E2E_PORT} (playwright.config.ts) : ne pas
// figer le port ici.
test("i18n : la page 404 suit la locale", async ({ browser, baseURL }) => {
  const { context, page } = await newVisitor(browser);
  await context.addCookies([{ name: "mijote_locale", value: "en", url: baseURL! }]);
  // Préfixe public : hors session, le proxy redirige toute autre route
  // inconnue vers la landing avant d'atteindre le 404.
  await page.goto("/legal/does-not-exist");
  await expect(page.getByText("This page doesn't exist.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  await context.close();
});

test("i18n : un appareil EN atterrit sur le foyer démo EN (recettes anglaises)", async ({
  browser,
  baseURL,
}) => {
  const { context, page } = await newVisitor(browser);
  await context.addCookies([{ name: "mijote_locale", value: "en", url: baseURL! }]);
  await page.goto("/");
  await page.getByRole("button", { name: "Try the app" }).click();
  await page.waitForURL(/\/home/);
  await expect(page.getByText("You're exploring a demo account")).toBeVisible();
  await expect(page.getByText("Chocolate Mousse").first()).toBeVisible();
  await expect(page.getByText("Mousse au chocolat")).toHaveCount(0);
  // Le foyer EN est gelé comme le FR : renommer → 403
  await page.goto("/household");
  await expect(page.getByText("Demo", { exact: true })).toBeVisible();
  await context.close();
});

// Aperçus de liens partagés : les bots n'envoient pas Accept-Language, alors
// l'appareil ÉMETTEUR glisse sa langue dans l'URL (`?l=en`, hors fr). L'indice
// ne sert qu'aux métadonnées OG — la page reste rendue selon le lecteur.
test("i18n : un partage depuis un appareil EN porte ?l=en, lu seulement par l'aperçu OG", async ({
  browser,
  baseURL,
}) => {
  const { context, page } = await newVisitor(browser);
  const code = await createHouseholdViaUI(page, uniqueName("Foyer OG"));
  const household = await getHouseholdByJoinCode(code);
  if (!household) throw new Error("foyer introuvable en DB");
  const recipeId = await insertRecipe({
    householdId: household.id,
    title: uniqueName("Recette OG"),
    tagName: "Végétarien",
  });

  // Appareil FR : URL nue, comme avant l'indice
  const mintFr = await page.request.post(`/api/recipes/${recipeId}/share`);
  expect(mintFr.ok()).toBe(true);
  const { token, url: urlFr } = (await mintFr.json()) as { token: string; url: string };
  expect(new URL(urlFr).pathname).toBe(`/r/${token}`);
  expect(new URL(urlFr).search).toBe("");

  // Même appareil passé en EN (cookie de prévisualisation) : même jeton, indice ajouté
  await context.addCookies([{ name: "mijote_locale", value: "en", url: baseURL! }]);
  const mintEn = await page.request.post(`/api/recipes/${recipeId}/share`);
  const { url: urlEn } = (await mintEn.json()) as { url: string };
  expect(new URL(urlEn).pathname).toBe(`/r/${token}`);
  expect(new URL(urlEn).searchParams.get("l")).toBe("en");
  await context.close();

  // Bot d'aperçu (UA WhatsApp, Accept-Language fr-FR du harnais) : avec l'indice,
  // OG en anglais ; sans, en français. Dans les deux cas la page reste FR.
  const bot = await newVisitor(browser);
  const botHeaders = { "user-agent": "WhatsApp/2.23.20" };
  const withHint = await (await bot.page.request.get(urlEn, { headers: botHeaders })).text();
  expect(withHint).toContain('property="og:locale" content="en_US"');
  expect(withHint).toContain('property="og:description" content="Vegetarian"');
  expect(withHint).toContain('<html lang="fr"');
  const withoutHint = await (await bot.page.request.get(urlFr, { headers: botHeaders })).text();
  expect(withoutHint).toContain('property="og:locale" content="fr_FR"');
  expect(withoutHint).toContain('property="og:description" content="Végétarien"');
  await bot.context.close();
});
