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
  // Fork « Ouvrir un carnet » (Lot 2) : code d'invitation OU récup email
  await b.page.getByRole("button", { name: "Ouvrir un carnet" }).click();
  await b.page.getByRole("button", { name: "J'ai un code d'invitation" }).click();
  // « olive 4821 » : minuscules, espace au lieu du tiret — normalisé côté serveur
  await b.page
    .getByPlaceholder("OLIVE-4821")
    .fill(code.toLowerCase().replace("-", " "));
  await b.page.getByRole("button", { name: "Ouvrir", exact: true }).click();
  await b.page.waitForURL(/\/home/);

  // Même foyer : le code vit désormais dans l'écran « Inviter » (Lot 3 : les
  // blocs code/lien du détail sont remplacés par l'entrée « Inviter »).
  await openHouseholdDetail(b.page);
  await b.page.locator(String.raw`a[href$="/invite"]`).click();
  await b.page.waitForURL(/\/household\/[0-9a-f-]{36}\/invite/);
  await expect(b.page.getByText(code, { exact: true })).toBeVisible();

  await a.context.close();
  await b.context.close();
});
