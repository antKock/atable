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

  // CTA du hint démo = ouverture directe du formulaire « nom du foyer »
  // (conversion), sans repasser par l'accueil. On referme pour la suite.
  await page.getByRole("button", { name: "Créer mon foyer" }).click();
  await expect(page.getByRole("heading", { name: /Donne un nom/ })).toBeVisible();
  await page.getByRole("button", { name: "Annuler" }).click();

  // Hub foyer : badge Démo sur la ligne du foyer (sélecteurs adaptés au
  // Lot 1 : hub + détail) ; le détail est en lecture seule (pas de rename)
  await page.goto("/household");
  await expect(page.getByText("Démo", { exact: true })).toBeVisible();
  await openHouseholdDetail(page);
  await expect(page.getByText("Démo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Renommer" })).toHaveCount(0);

  // Le rename est refusé côté SERVEUR, pas seulement masqué dans l'UI
  // (garde central assertNotDemoMutation — leçon de l'incident 2026-06)
  const householdId = new URL(page.url()).pathname.split("/").pop();
  const rename = await context.request.put(`/api/households/${householdId}`, {
    data: { name: "Démo vandalisée" },
  });
  expect(rename.status()).toBe(403);

  // Suppression refusée côté serveur (403) → toast d'erreur, foyer intact
  await page.getByRole("button", { name: "Supprimer le foyer" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continuer" }).click();
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page.getByText("Le foyer démo ne peut pas être supprimé.")).toBeVisible();

  const env = loadTestEnv();
  const { data } = await db()
    .from("households")
    .select("id")
    .eq("id", env.DEMO_HOUSEHOLD_ID)
    .maybeSingle();
  expect(data).toBeTruthy();

  await context.close();
});
