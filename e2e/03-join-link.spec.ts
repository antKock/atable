import { test, expect } from "@playwright/test";
import {
  newVisitor,
  createHouseholdViaUI,
  openHouseholdDetail,
  uniqueName,
} from "./helpers/onboarding";

// Caractérisation : /join/[code] → écran de confirmation → membre du foyer.
test("rejoindre par lien : /join/[code] → confirmation → même foyer", async ({ browser }) => {
  const a = await newVisitor(browser);
  const name = uniqueName("Foyer Lien");
  const code = await createHouseholdViaUI(a.page, name);

  const b = await newVisitor(browser);
  await b.page.goto(`/join/${code}`);
  await expect(b.page.getByRole("heading", { name: `Ouvrir « ${name} » ?` })).toBeVisible();
  await b.page.getByRole("button", { name: "Ouvrir", exact: true }).click();
  await b.page.waitForURL(/\/home/);

  // Le code vit désormais dans l'écran « Inviter » (Lot 3).
  await openHouseholdDetail(b.page);
  await b.page.locator(String.raw`a[href$="/invite"]`).click();
  await b.page.waitForURL(/\/household\/[0-9a-f-]{36}\/invite/);
  await expect(b.page.getByText(code, { exact: true })).toBeVisible();

  await a.context.close();
  await b.context.close();
});

test("rejoindre par lien : code inconnu → message d'erreur", async ({ browser }) => {
  const { context, page } = await newVisitor(browser);
  await page.goto("/join/ZZZZZ-9999");
  await expect(page.getByText("Ce lien ne correspond à aucun carnet")).toBeVisible();
  await context.close();
});
