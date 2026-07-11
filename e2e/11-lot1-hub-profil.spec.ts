import { test, expect } from "@playwright/test";
import {
  newVisitor,
  createHouseholdViaUI,
  joinViaCode,
  openHouseholdDetail,
  uniqueName,
} from "./helpers/onboarding";
import { getHouseholdByJoinCode, insertRecipe } from "./helpers/db";

// Lot 1 foyer : hub « Toi + Tes foyers », détail de foyer (membres inline),
// profil (nom + alias auto), démo gelée (stratégie C).

test("hub : le foyer est listé avec rôle membre et compteurs corrects", async ({
  browser,
}) => {
  const a = await newVisitor(browser);
  const name = uniqueName("Foyer Compteurs");
  const code = await createHouseholdViaUI(a.page, name);
  const household = await getHouseholdByJoinCode(code);
  await insertRecipe({ householdId: household!.id, title: uniqueName("Recette") });

  await a.page.goto("/household");
  await expect(a.page.getByRole("heading", { name: "Foyer & profil" })).toBeVisible();
  const row = a.page.getByRole("link", { name });
  await expect(row).toContainText("membre");
  await expect(row).toContainText("1 personne · 1 recette");
  await expect(a.page.getByText("Créer ou rejoindre un foyer")).toBeVisible();

  // Un second appareil rejoint → 2 personnes, même compteur de recettes
  const b = await newVisitor(browser);
  await joinViaCode(b.page, code);
  await a.page.reload();
  await expect(a.page.getByRole("link", { name })).toContainText(
    "2 personnes · 1 recette",
  );

  await a.context.close();
  await b.context.close();
});

test("détail : 2 sessions du même foyer se voient dans les membres", async ({
  browser,
}) => {
  const a = await newVisitor(browser);
  const name = uniqueName("Foyer Membres");
  const code = await createHouseholdViaUI(a.page, name);
  const b = await newVisitor(browser);
  await joinViaCode(b.page, code);

  await openHouseholdDetail(a.page);
  await expect(a.page.getByText(`Membre · 2 personnes`)).toBeVisible();
  const members = a.page.getByRole("list", { name: "Membres" }).getByRole("listitem");
  await expect(members).toHaveCount(2);
  // « (toi) » marque la propre ligne du viewer, une seule fois
  await expect(a.page.getByText("(toi)")).toHaveCount(1);

  // L'autre session voit la même liste depuis son propre contexte
  await openHouseholdDetail(b.page);
  await expect(
    b.page.getByRole("list", { name: "Membres" }).getByRole("listitem"),
  ).toHaveCount(2);

  await a.context.close();
  await b.context.close();
});

test("profil : poser un nom puis le vider → retour à un alias stable", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);
  await createHouseholdViaUI(page, uniqueName("Foyer Profil"));

  // Sans nom : la ligne « Toi » du hub porte l'alias auto (= placeholder profil)
  await page.goto("/household/profile");
  const input = page.getByLabel("Ton nom");
  const alias = await input.getAttribute("placeholder");
  expect(alias, "l'alias auto sert de placeholder").toMatch(/^\S+ \S+$/);

  // Poser un nom → visible au hub (ligne Toi) et dans les membres du détail
  await input.fill("Anthony");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Profil mis à jour")).toBeVisible();
  await page.goto("/household");
  await expect(page.getByRole("link", { name: "Anthony" })).toBeVisible();
  await openHouseholdDetail(page);
  await expect(page.getByText("Anthony")).toBeVisible();
  await expect(page.getByText("(toi)")).toBeVisible();

  // Vider le nom → l'alias revient, identique (dérivé stable de l'owner)
  await page.goto("/household/profile");
  await page.getByLabel("Ton nom").fill("");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Profil mis à jour")).toBeVisible();
  await page.goto("/household");
  await expect(page.getByRole("link", { name: alias! })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: alias! })).toBeVisible();
  await page.goto("/household/profile");
  await expect(page.getByLabel("Ton nom")).toHaveAttribute("placeholder", alias!);

  await context.close();
});

test("démo gelée : hub réduit, profil inaccessible, mutation profil → 403", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);
  await page.goto("/");
  await page.getByRole("button", { name: "Essayer l'app" }).click();
  await page.waitForURL(/\/home/);

  // Hub gelé : pas de ligne « Toi », pas de « Créer ou rejoindre »
  await page.goto("/household");
  await expect(page.getByRole("heading", { name: "Foyer & profil" })).toBeVisible();
  await expect(page.getByText("Toi", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Créer ou rejoindre un foyer")).toHaveCount(0);
  await expect(page.getByText("Démo", { exact: true })).toBeVisible();

  // Vue solo : le détail démo ne liste jamais les autres visiteurs (chaque
  // session démo crée son propre owner+membership, purgés à 30 j par le cron)
  const other = await newVisitor(browser);
  await other.page.goto("/");
  await other.page.getByRole("button", { name: "Essayer l'app" }).click();
  await other.page.waitForURL(/\/home/);
  await openHouseholdDetail(page);
  await expect(
    page.getByRole("list", { name: "Membres" }).getByRole("listitem"),
  ).toHaveCount(1);
  await expect(page.getByText("Membre · 1 personne")).toBeVisible();
  await other.context.close();

  // Profil inaccessible (l'écran n'existe pas pour une session démo).
  // Le statut HTTP peut rester 200 (notFound() streamé après l'envoi du
  // shell) : on asserte sur le contenu — page 404, aucun formulaire profil.
  await page.goto("/household/profile");
  await expect(page.getByText("Cette page n'existe pas.")).toBeVisible();
  await expect(page.getByLabel("Ton nom")).toHaveCount(0);

  // Mutation profil refusée par le guard serveur central (stratégie C)
  const api = await context.request.put("/api/owner", { data: { name: "Intrus" } });
  expect(api.status()).toBe(403);

  // L'écran « Créer ou rejoindre » est coupé aussi par URL directe
  await page.goto("/household/switch");
  await expect(page.getByText("Cette page n'existe pas.")).toBeVisible();

  await context.close();
});
