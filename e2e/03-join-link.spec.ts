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
  await expect(b.page.getByRole("heading", { name: `Rejoindre « ${name} » ?` })).toBeVisible();
  await b.page.getByRole("button", { name: "Rejoindre", exact: true }).click();
  await b.page.waitForURL(/\/home/);

  // Sélecteur adapté au Lot 1 : le code vit dans le détail, plus dans le hub
  await openHouseholdDetail(b.page);
  await expect(b.page.getByText(code, { exact: true })).toBeVisible();

  await a.context.close();
  await b.context.close();
});

test("rejoindre par lien : code inconnu → message d'erreur", async ({ browser }) => {
  const { context, page } = await newVisitor(browser);
  await page.goto("/join/ZZZZZ-9999");
  await expect(page.getByText("Ce lien ne correspond à aucun foyer")).toBeVisible();
  await context.close();
});
