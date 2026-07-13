import { test, expect } from "@playwright/test";
import { newVisitor, createHouseholdViaUI, uniqueName } from "./helpers/onboarding";

// Caractérisation : landing → « Créer un carnet » → nom → /home, cookie posé.
// L'ancienne bannière post-création (code d'invitation en clair) a été retirée ;
// c'est le hint « partage » de la Home qui prend le relais (foyer à 0 recette).
test("onboarding créer : landing → formulaire → /home avec hint partage et cookie", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);
  const name = uniqueName("Foyer Création");

  await createHouseholdViaUI(page, name);

  // Redirection Home sans query (?code=… supprimé avec la bannière).
  await expect(page).toHaveURL(/\/home$/);
  // Plus d'ancienne bannière post-création.
  await expect(page.getByText(`Carnet ${name} créé`)).toHaveCount(0);
  await expect(page.getByText("Code invitation")).toHaveCount(0);
  // Nouveau hint partage (server-gated, sous la top bar).
  await expect(page.getByText("Cuisinez à plusieurs")).toBeVisible();
  await expect(page.getByRole("link", { name: "Inviter quelqu'un" })).toBeVisible();

  // Cookie de session posé (httpOnly)
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === "atable_session");
  expect(session).toBeTruthy();
  expect(session?.httpOnly).toBe(true);

  await context.close();
});
