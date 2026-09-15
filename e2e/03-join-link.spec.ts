import { test, expect } from "@playwright/test";
import {
  newVisitor,
  createHouseholdViaUI,
  openHouseholdDetail,
  uniqueName,
} from "./helpers/onboarding";
import { getHouseholdByJoinCode, insertRecipe } from "./helpers/db";

// Caractérisation : /join/[code] → écran d'invitation → membre du foyer.
test("rejoindre par lien : /join/[code] → confirmation → même foyer", async ({ browser }) => {
  const a = await newVisitor(browser);
  const name = uniqueName("Foyer Lien");
  const code = await createHouseholdViaUI(a.page, name);

  const b = await newVisitor(browser);
  await b.page.goto(`/join/${code}`);
  // Refonte 2026-09-15 : le nom du carnet EST le titre, le verbe vit sur le bouton.
  await expect(b.page.getByRole("heading", { name })).toBeVisible();
  // Carnet fraîchement créé : aucune recette → promesse, pas de compteur à zéro.
  await expect(b.page.getByText("Un carnet tout neuf, à remplir ensemble")).toBeVisible();
  await b.page.getByRole("button", { name: "Ouvrir le carnet" }).click();
  await b.page.waitForURL(/\/home/);

  // Le code vit désormais dans l'écran « Inviter » (Lot 3).
  await openHouseholdDetail(b.page);
  await b.page.locator(String.raw`a[href$="/invite"]`).click();
  await b.page.waitForURL(/\/household\/[0-9a-f-]{36}\/invite/);
  await expect(b.page.getByText(code, { exact: true })).toBeVisible();

  await a.context.close();
  await b.context.close();
});

// L'aperçu du carnet : total réel + vignettes. Les recettes insérées n'ont pas
// d'illustration, donc chaque vignette retombe sur dégradé + titre.
test("rejoindre par lien : l'écran montre ce que contient le carnet", async ({ browser }) => {
  const a = await newVisitor(browser);
  const name = uniqueName("Foyer Garni");
  const code = await createHouseholdViaUI(a.page, name);
  const household = await getHouseholdByJoinCode(code);
  const titles = [uniqueName("Tarte"), uniqueName("Soupe"), uniqueName("Gratin")];
  for (const title of titles) {
    await insertRecipe({ householdId: household!.id as string, title });
  }

  const b = await newVisitor(browser);
  await b.page.goto(`/join/${code}`);
  await expect(b.page.getByRole("heading", { name })).toBeVisible();
  await expect(b.page.getByText("3 recettes")).toBeVisible();
  for (const title of titles) {
    await expect(b.page.getByText(title)).toBeVisible();
  }

  await a.context.close();
  await b.context.close();
});

test("rejoindre par lien : code inconnu → message d'erreur", async ({ browser }) => {
  const { context, page } = await newVisitor(browser);
  await page.goto("/join/ZZZZZ-9999");
  await expect(page.getByText("Ce lien ne correspond à aucun carnet")).toBeVisible();
  await context.close();
});
