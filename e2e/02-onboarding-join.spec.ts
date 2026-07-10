import { test, expect } from "@playwright/test";
import {
  newVisitor,
  createHouseholdViaUI,
  openHouseholdDetail,
  uniqueName,
} from "./helpers/onboarding";

// Caractérisation : un second appareil rejoint avec le code du foyer créé par
// le premier. Saisie tolérante : minuscules + espaces au lieu du tiret.
test("onboarding rejoindre : le code (saisie tolérante) mène au même foyer", async ({
  browser,
}) => {
  const a = await newVisitor(browser);
  const code = await createHouseholdViaUI(a.page, uniqueName("Foyer Join"));

  const b = await newVisitor(browser);
  await b.page.goto("/");
  // Fork « Rejoindre un foyer » (Lot 2) : code d'invitation OU récup email
  await b.page.getByRole("button", { name: "Rejoindre un foyer" }).click();
  await b.page.getByRole("button", { name: "J'ai un code d'invitation" }).click();
  // « olive 4821 » : minuscules, espace au lieu du tiret — normalisé côté serveur
  await b.page
    .getByPlaceholder("OLIVE-4821")
    .fill(code.toLowerCase().replace("-", " "));
  await b.page.getByRole("button", { name: "Rejoindre", exact: true }).click();
  await b.page.waitForURL(/\/home/);

  // Même foyer : le détail du foyer de B affiche le code de A
  // (sélecteur adapté au Lot 1 : le code vit dans le détail, plus dans le hub)
  await openHouseholdDetail(b.page);
  await expect(b.page.getByText(code, { exact: true })).toBeVisible();

  await a.context.close();
  await b.context.close();
});
