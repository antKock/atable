import { test, expect } from "@playwright/test";
import { newVisitor, createHouseholdViaUI, uniqueName } from "./helpers/onboarding";
import { getHouseholdByJoinCode } from "./helpers/db";

// Caractérisation écran foyer — RÉÉCRITE au Lot 1 (hub « Toi + Tes foyers »
// + détail de foyer) : le hub liste le foyer, le détail porte le rename
// inline, le code + lien d'invitation, quitter et supprimer.

test("hub → détail : rename inline, code + lien, quitter → session invalidée", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);
  const name = uniqueName("Foyer Avant");
  const code = await createHouseholdViaUI(page, name);
  const renamed = uniqueName("Foyer Renommé");

  // Hub : titre + ligne du foyer → détail
  await page.goto("/household");
  await expect(page.getByRole("heading", { name: "Foyer & profil" })).toBeVisible();
  await page.getByRole("link", { name }).click();
  await page.waitForURL(/\/household\/[0-9a-f-]{36}/);

  // Code + lien d'invitation affichés (détail)
  await expect(page.getByText("Code du foyer")).toBeVisible();
  await expect(page.getByText(code, { exact: true })).toBeVisible();
  await expect(page.getByText("Lien d'invitation")).toBeVisible();
  await expect(page.getByText(new RegExp(`/join/${code}`))).toBeVisible();

  // Rename inline (crayon → input → valider), persistant après reload
  await page.getByRole("button", { name: "Renommer" }).click();
  const nameInput = page.locator('input[maxlength="50"]');
  await nameInput.fill(renamed);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(renamed)).toBeVisible();
  await page.reload();
  await expect(page.getByText(renamed)).toBeVisible();

  // Quitter ce foyer → retour landing, session invalidée (accès /home refusé)
  await page.getByRole("button", { name: "Quitter ce foyer" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Quitter le foyer ?")).toBeVisible();
  await dialog.getByRole("button", { name: "Quitter", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "Essayer l'app" })).toBeVisible();
  await page.goto("/home");
  await page.waitForURL((url) => url.pathname === "/");

  await context.close();
});

test("détail : suppression avec double confirmation → foyer effacé", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);
  const name = uniqueName("Foyer À Supprimer");
  const code = await createHouseholdViaUI(page, name);

  await page.goto("/household");
  await page.getByRole("link", { name }).click();
  await page.waitForURL(/\/household\/[0-9a-f-]{36}/);

  await page.getByRole("button", { name: "Supprimer le foyer" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Supprimer le foyer ?")).toBeVisible();
  await dialog.getByRole("button", { name: "Continuer" }).click();
  await expect(dialog.getByText("Confirmer la suppression")).toBeVisible();
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  expect(await getHouseholdByJoinCode(code)).toBeNull();

  await context.close();
});
