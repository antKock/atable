import { test, expect } from "@playwright/test";
import { newVisitor, createHouseholdViaUI, uniqueName } from "./helpers/onboarding";

// Caractérisation : landing → « Créer un foyer » → nom → /home, cookie posé,
// bannière post-création avec le code d'invitation.
test("onboarding créer : landing → formulaire → /home avec bannière et cookie", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);
  const name = uniqueName("Foyer Création");

  const code = await createHouseholdViaUI(page, name);

  // Bannière post-création : nom du foyer + code d'invitation
  await expect(page.getByText(`Foyer ${name} créé`)).toBeVisible();
  await expect(page.getByText("Code invitation")).toBeVisible();
  await expect(page.getByText(code, { exact: true })).toBeVisible();

  // Cookie de session posé (httpOnly)
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === "atable_session");
  expect(session).toBeTruthy();
  expect(session?.httpOnly).toBe(true);

  await context.close();
});
