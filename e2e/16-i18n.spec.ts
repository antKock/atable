import { test, expect } from "@playwright/test";
import { newVisitor } from "./helpers/onboarding";

// Chantier « Version EN », Lot 0 : la locale suit l'appareil. Le serveur E2E
// tourne avec I18N_PREVIEW_COOKIE=1 (playwright.config.ts) — le cookie
// mijote_locale force la langue ; I18N_EN_ENABLED n'est PAS posé, donc sans
// cookie tout reste fr même avec un Accept-Language anglais.

test("i18n : sans cookie, un navigateur anglais voit toujours le FR (EN non activé)", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "en-US",
    extraHTTPHeaders: { "x-forwarded-for": "10.99.0.1" },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("button", { name: "Créer un carnet" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Create a recipe book" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open a recipe book" })).toBeVisible();
  const cookie = (await context.cookies()).find((c) => c.name === "mijote_locale");
  expect(cookie?.value).toBe("en");

  // Retour en FR par le même chemin
  await page.goto("/?lang=fr");
  await page.waitForURL((url) => !url.searchParams.has("lang"));
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("button", { name: "Essayer l'app" })).toBeVisible();
  await context.close();
});

test("i18n : la page 404 suit la locale", async ({ browser }) => {
  const { context, page } = await newVisitor(browser);
  await context.addCookies([
    { name: "mijote_locale", value: "en", url: "http://127.0.0.1:3100" },
  ]);
  // Préfixe public : hors session, le middleware redirige toute autre route
  // inconnue vers la landing avant d'atteindre le 404.
  await page.goto("/legal/does-not-exist");
  await expect(page.getByText("This page doesn't exist.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  await context.close();
});
