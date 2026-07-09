import { test, expect } from "@playwright/test";
import { newVisitor, createHouseholdViaUI, uniqueName } from "./helpers/onboarding";
import { getHouseholdByJoinCode, insertRecipe, getPredefinedTagId } from "./helpers/db";

// Caractérisation biblio : recherche texte (locale, PAS dans l'URL), filtre
// tag, filtre « De saison » — l'état des filtres est reflété dans l'URL.
test("bibliothèque : recherche, filtre tag et « De saison » reflétés dans l'URL", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);
  const code = await createHouseholdViaUI(page, uniqueName("Foyer Biblio"));
  const household = await getHouseholdByJoinCode(code);
  if (!household) throw new Error("foyer introuvable en DB");

  // « toutes saisons » = recette toujours « De saison » ; l'autre jamais
  const tarte = uniqueName("Tarte à la tomate");
  const boeuf = uniqueName("Boeuf bourguignon");
  await insertRecipe({
    householdId: household.id,
    title: tarte,
    seasons: ["printemps", "ete", "automne", "hiver"],
    tagName: "Végétarien",
  });
  await insertRecipe({ householdId: household.id, title: boeuf, seasons: [] });

  await page.goto("/library");
  await expect(page.getByRole("link", { name: tarte })).toBeVisible();
  await expect(page.getByRole("link", { name: boeuf })).toBeVisible();

  // Recherche texte : filtrage local, non reflété dans l'URL
  const search = page.getByRole("searchbox", { name: "Rechercher une recette" });
  await search.fill("Tarte");
  await expect(page.getByRole("link", { name: boeuf })).toHaveCount(0);
  await expect(page.getByRole("link", { name: tarte })).toBeVisible();
  expect(page.url()).not.toContain("Tarte");
  await page.getByRole("button", { name: "Effacer la recherche" }).click();
  await expect(page.getByRole("link", { name: boeuf })).toBeVisible();

  // Filtre tag (pill « Régime » → option « Végétarien ») → ?tags=<id>
  const vegetarienId = await getPredefinedTagId("Végétarien");
  await page.getByRole("button", { name: /^Régime/ }).click();
  await page.getByRole("button", { name: "Végétarien", exact: true }).click();
  await page.waitForURL((url) => url.searchParams.get("tags") === vegetarienId);
  await expect(page.getByRole("link", { name: boeuf })).toHaveCount(0);
  await expect(page.getByRole("link", { name: tarte })).toBeVisible();
  // Désélection → le param disparaît
  await page.getByRole("button", { name: "Végétarien", exact: true }).click();
  await page.waitForURL((url) => !url.searchParams.has("tags"));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: boeuf })).toBeVisible();

  // Filtre « De saison » → ?season=1, et l'état survit à un reload
  await page.getByRole("button", { name: "De saison" }).click();
  await page.waitForURL(/season=1/);
  await expect(page.getByRole("link", { name: boeuf })).toHaveCount(0);
  await expect(page.getByRole("link", { name: tarte })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "De saison" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("link", { name: tarte })).toBeVisible();
  await expect(page.getByRole("link", { name: boeuf })).toHaveCount(0);

  await context.close();
});
