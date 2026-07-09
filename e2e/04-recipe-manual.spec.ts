import { test, expect } from "@playwright/test";
import { newVisitor, createHouseholdViaUI, uniqueName } from "./helpers/onboarding";

// Caractérisation du cycle de vie d'une recette saisie manuellement :
// création via le formulaire → visible home + biblio ; édition du titre ;
// suppression avec dialog de confirmation. (Flows IA hors périmètre : sans
// clé OpenAI, l'enrichissement échoue en tâche de fond sans impact UI.)
test("recette manuelle : créer → visible home/biblio → éditer le titre → supprimer", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);
  await createHouseholdViaUI(page, uniqueName("Foyer Recettes"));
  const title = uniqueName("Gratin dauphinois");
  const editedTitle = `${title} (revu)`;

  // Créer : nav « Ajouter » → carte « Saisie manuelle » → formulaire
  await page.goto("/home");
  await page.getByRole("link", { name: "Ajouter", exact: true }).click();
  await page.waitForURL(/\/recipes\/new/);
  await page.getByText("Saisie manuelle").click();
  await page.locator("#title").fill(title);
  await page.locator("#ingredients").fill("1 kg de pommes de terre\n50 cl de crème");
  await page.locator("#steps").fill("Éplucher et trancher.\nEnfourner 1 h à 180°C.");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // Succès → retour home, recette visible (carrousel Récentes)
  await page.waitForURL(/\/home/);
  await expect(page.getByText(title).first()).toBeVisible();

  // Visible en bibliothèque
  await page.goto("/library");
  const card = page.getByRole("link", { name: title });
  await expect(card).toBeVisible();

  // Éditer le titre depuis la fiche
  await card.click();
  await page.waitForURL(/\/recipes\/[0-9a-f-]+$/);
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.waitForURL(/\/edit$/);
  await page.locator("#title").fill(editedTitle);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/recipes\/[0-9a-f-]+$/);
  await expect(page.getByText(editedTitle).first()).toBeVisible();

  // Supprimer (dialog de confirmation) → disparue de la biblio
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Supprimer cette recette ?")).toBeVisible();
  await expect(dialog.getByText("Cette action est irréversible.")).toBeVisible();
  await dialog.getByRole("button", { name: "Supprimer", exact: true }).click();
  await page.waitForURL(/\/home/);
  await page.goto("/library");
  await expect(page.getByRole("link", { name: editedTitle })).toHaveCount(0);

  await context.close();
});
