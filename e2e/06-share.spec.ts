import { test, expect } from "@playwright/test";
import { newVisitor, createHouseholdViaUI, uniqueName } from "./helpers/onboarding";
import { getHouseholdByJoinCode, getRecipeByTitle, insertRecipe } from "./helpers/db";

// Caractérisation partage : mint du share_token, page publique /r/[token]
// sans cookie, copie dans un autre foyer, badge « déjà dans ton foyer ».
test("partage : mint du token → page publique → copie depuis un autre foyer", async ({
  browser,
}) => {
  // Foyer A avec une recette
  const a = await newVisitor(browser);
  const codeA = await createHouseholdViaUI(a.page, uniqueName("Foyer Partage A"));
  const householdA = await getHouseholdByJoinCode(codeA);
  if (!householdA) throw new Error("foyer A introuvable en DB");
  const title = uniqueName("Recette partagée");
  const recipeId = await insertRecipe({ householdId: householdA.id, title });

  // Mint du share_token (même endpoint que le bouton « Partager » de la fiche)
  const mint = await a.page.request.post(`/api/recipes/${recipeId}/share`);
  expect(mint.ok()).toBe(true);
  const { token, url } = (await mint.json()) as { token: string; url: string };
  expect(url).toContain(`/r/${token}`);
  const inDb = await getRecipeByTitle(householdA.id, title);
  expect(inDb?.share_token).toBe(token);

  // Page publique sans cookie : recette lisible + CTA visiteur
  const guest = await newVisitor(browser);
  await guest.page.goto(`/r/${token}`);
  await expect(guest.page.getByText(title).first()).toBeVisible();
  await expect(
    guest.page.getByRole("button", { name: "Enregistrer cette recette" }),
  ).toBeVisible();
  await guest.context.close();

  // Foyer B : « Ajouter à mon carnet » → recette copiée
  const b = await newVisitor(browser);
  const codeB = await createHouseholdViaUI(b.page, uniqueName("Foyer Partage B"));
  const householdB = await getHouseholdByJoinCode(codeB);
  if (!householdB) throw new Error("foyer B introuvable en DB");
  await b.page.goto(`/r/${token}`);
  await b.page.getByRole("button", { name: "Ajouter à mon carnet" }).click();
  await expect(b.page.getByText("Ajoutée à ton carnet")).toBeVisible();
  const copy = await getRecipeByTitle(householdB.id, title);
  expect(copy).toBeTruthy();
  expect(copy?.id).not.toBe(recipeId);
  await b.context.close();

  // Depuis le foyer d'origine : badge passif, pas de CTA
  await a.page.goto(`/r/${token}`);
  await expect(a.page.getByText("Déjà dans ton carnet")).toBeVisible();
  await a.context.close();
});
