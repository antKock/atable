import { test, expect } from "@playwright/test";
import { newVisitor, createHouseholdViaUI, uniqueName } from "./helpers/onboarding";
import { getHouseholdByJoinCode } from "./helpers/db";

// Caractérisation écran foyer — hub « Toi + Tes foyers » + détail de foyer.
// Lot 3 : le rename inline reste sur le détail ; le code + lien d'invitation
// migrent vers l'écran plein « Inviter » (entrée « Inviter quelqu'un »).

test("hub → détail : rename inline, invitation (code + lien), dernier membre = pas de « Quitter »", async ({
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

  // Code + lien d'invitation : écran « Inviter » (bloc membre = join_code).
  // Les labels « Code du foyer » / « Lien d'invitation » apparaissent 2× (membre
  // + invité) : on assert le code membre (unique) et son URL /join.
  await page.locator(String.raw`a[href$="/invite"]`).click();
  await page.waitForURL(/\/household\/[0-9a-f-]{36}\/invite/);
  await expect(page.getByText(code, { exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`/join/${code}`))).toBeVisible();
  await page.goBack();
  await page.waitForURL(/\/household\/[0-9a-f-]{36}$/);

  // Rename inline (crayon → input → valider), persistant après reload
  await page.getByRole("button", { name: "Renommer" }).click();
  const nameInput = page.locator('input[maxlength="50"]');
  await nameInput.fill(renamed);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(renamed)).toBeVisible();
  await page.reload();
  await expect(page.getByText(renamed)).toBeVisible();

  // Dernier membre du foyer : « Quitter » est masqué (partir supprimerait le
  // foyer — arbitrage 2026-07), seule « Supprimer le foyer » reste (la
  // suppression + déconnexion est couverte par le test suivant).
  await expect(page.getByRole("button", { name: "Quitter ce foyer" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Supprimer le foyer" })).toBeVisible();

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
