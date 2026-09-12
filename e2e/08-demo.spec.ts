import { test, expect } from "@playwright/test";
import { newVisitor, openHouseholdDetail } from "./helpers/onboarding";
import { db } from "./helpers/db";
import { loadTestEnv } from "./helpers/env";

// Caractérisation du mode démo : entrée par « Essayer l'app », bannière,
// rename impossible (readOnly), suppression du foyer refusée (403 → toast).
test("démo : « Essayer l'app » → home démo, foyer en lecture seule, suppression refusée", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);

  await page.goto("/");
  await page.getByRole("button", { name: "Essayer l'app" }).click();
  await page.waitForURL(/\/home/);
  await expect(page.getByText("Tu explores un compte démo")).toBeVisible();
  // Recettes seed du foyer démo visibles
  await expect(page.getByText("Mousse au chocolat").first()).toBeVisible();

  // Hub foyer : badge Démo sur la ligne du foyer (sélecteurs adaptés au
  // Lot 1 : hub + détail) ; le détail est en lecture seule (pas de rename)
  await page.goto("/household");
  await expect(page.getByText("Démo", { exact: true })).toBeVisible();
  await openHouseholdDetail(page);
  await expect(page.getByText("Démo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Renommer" })).toHaveCount(0);

  // Le rename est refusé côté SERVEUR, pas seulement masqué dans l'UI
  // (garde démo par défaut de withOwnerAuth — leçon de l'incident 2026-06)
  const householdId = new URL(page.url()).pathname.split("/").pop();
  const rename = await context.request.put(`/api/households/${householdId}`, {
    data: { name: "Démo vandalisée" },
  });
  expect(rename.status()).toBe(403);

  // Suppression refusée côté serveur (403) → toast d'erreur, foyer intact
  await page.getByRole("button", { name: "Supprimer le carnet" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continuer" }).click();
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("Le carnet démo ne peut pas être supprimé.")).toBeVisible();

  const env = loadTestEnv();
  const { data } = await db()
    .from("households")
    .select("id")
    .eq("id", env.DEMO_HOUSEHOLD_ID)
    .maybeSingle();
  expect(data).toBeTruthy();

  // CTA du hint démo = conversion EN UN TAP (spec #23) : owner neuf, carnet au
  // nom par défaut, plus de hint démo. Gardé en dernier : après, on n'est plus
  // en démo.
  await page.goto("/home");
  await page.getByRole("button", { name: "Créer mon carnet" }).click();
  await page.waitForURL(/\/home/);
  await expect(page.getByText("Tu explores un compte démo")).toHaveCount(0);
  await page.goto("/household");
  await expect(page.getByText("Mon carnet", { exact: true })).toBeVisible();
  await expect(page.getByText("Démo", { exact: true })).toHaveCount(0);

  await context.close();
});
