import { test, expect } from "@playwright/test";
import { newVisitor, createHouseholdViaUI, uniqueName } from "./helpers/onboarding";

// Caractérisation : un second appareil rejoint avec le code du foyer créé par
// le premier. Saisie tolérante : minuscules + espaces au lieu du tiret.
test("onboarding rejoindre : le code (saisie tolérante) mène au même foyer", async ({
  browser,
}) => {
  const a = await newVisitor(browser);
  const code = await createHouseholdViaUI(a.page, uniqueName("Foyer Join"));

  const b = await newVisitor(browser);
  await b.page.goto("/");
  await b.page.getByRole("button", { name: "Rejoindre un foyer" }).click();
  // « olive 4821 » : minuscules, espace au lieu du tiret — normalisé côté serveur
  await b.page
    .getByPlaceholder("OLIVE-4821")
    .fill(code.toLowerCase().replace("-", " "));
  await b.page.getByRole("button", { name: "Rejoindre", exact: true }).click();
  await b.page.waitForURL(/\/home/);

  // Même foyer : l'écran foyer de B affiche le code de A
  await b.page.goto("/household");
  await expect(b.page.getByText(code, { exact: true })).toBeVisible();

  await a.context.close();
  await b.context.close();
});
