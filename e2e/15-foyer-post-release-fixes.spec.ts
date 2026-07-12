import { test, expect } from "@playwright/test";
import {
  newVisitor,
  createHouseholdViaUI,
  createFromHub,
  joinFromHub,
  joinViaCode,
  uniqueName,
} from "./helpers/onboarding";
import { getHouseholdByJoinCode, getMemberships, insertRecipe } from "./helpers/db";

// Correctifs post-release du chantier Foyer (Lots 1-4). Un test par bug.

// ── Bug 1 ────────────────────────────────────────────────────────────────
// Créer un foyer depuis le hub (profil) ramène à la Home, pas à l'édition du
// nouveau foyer.
test("bug 1 : créer un foyer depuis le hub redirige vers la Home", async ({ browser }) => {
  const v = await newVisitor(browser);
  await createHouseholdViaUI(v.page, uniqueName("Hub A"));

  const nameB = uniqueName("Hub B");
  await createFromHub(v.page, nameB); // helper vérifie déjà l'URL /home

  await expect(v.page).toHaveURL(/\/home$/);
  // Le hub liste bien les deux foyers.
  await v.page.goto("/household");
  await expect(v.page.getByText(nameB)).toBeVisible();

  await v.context.close();
});

// ── Bug 2 ────────────────────────────────────────────────────────────────
// En multi-foyer, la pill « Foyer » est en PREMIÈRE position de la barre de
// filtres (avant « De saison »).
test("bug 2 : la pill « Foyer » est en première position du filtre", async ({ browser }) => {
  const vb = await newVisitor(browser);
  const codeB = await createHouseholdViaUI(vb.page, uniqueName("Filtre B"));

  const v = await newVisitor(browser);
  const codeA = await createHouseholdViaUI(v.page, uniqueName("Filtre A"));
  const ha = (await getHouseholdByJoinCode(codeA))!;
  await insertRecipe({ householdId: ha.id, title: uniqueName("Plat A") });
  // Rejoindre B additivement pour être en multi-foyer (2 foyers → pill visible).
  await joinFromHub(v.page, codeB);

  await v.page.goto("/library");
  const foyer = v.page.getByRole("button", { name: "Foyer", exact: true });
  const saison = v.page.getByRole("button", { name: "De saison" });
  await expect(foyer).toBeVisible();
  await expect(saison).toBeVisible();

  const foyerBox = await foyer.boundingBox();
  const saisonBox = await saison.boundingBox();
  expect(foyerBox, "pill Foyer présente").not.toBeNull();
  expect(saisonBox, "pill De saison présente").not.toBeNull();
  // Première position = plus à gauche que « De saison ».
  expect(foyerBox!.x).toBeLessThan(saisonBox!.x);

  await vb.context.close();
  await v.context.close();
});

// ── Bugs 4 & 8 ─────────────────────────────────────────────────────────────
// Le hint « Sauvegarde ton accès » s'affiche SOUS la top bar de la Home, et
// disparaît dès qu'on quitte la Home (clic sur le CTA → profil) ; il n'apparaît
// sur aucun autre écran.
test("bugs 4 & 8 : hint sous la top bar, absent hors Home, disparaît à la navigation", async ({
  browser,
}) => {
  const v = await newVisitor(browser);
  const code = await createHouseholdViaUI(v.page, uniqueName("Hints Foyer"));
  const h = (await getHouseholdByJoinCode(code))!;
  // ≥ 3 recettes + pas d'email → hint « Sauvegarde ton accès ».
  for (let i = 0; i < 3; i++) {
    await insertRecipe({ householdId: h.id, title: uniqueName(`R${i}`) });
  }

  await v.page.goto("/home");
  const hint = v.page.getByText("Sauvegarde ton accès");
  await expect(hint).toBeVisible();

  // Bug 8 : le hint est SOUS le titre « Mijote » (top bar), pas au-dessus.
  const title = v.page.getByRole("heading", { name: "Mijote" });
  const titleBox = await title.boundingBox();
  const hintBox = await hint.boundingBox();
  expect(hintBox!.y).toBeGreaterThan(titleBox!.y);

  // Bug 4 : cliquer le CTA « Ajouter un email » → profil, le hint disparaît.
  await v.page.getByRole("link", { name: "Ajouter un email" }).click();
  await v.page.waitForURL(/\/household\/profile/);
  await expect(v.page.getByText("Sauvegarde ton accès")).toHaveCount(0);

  // Le hint n'apparaît sur aucun autre écran (biblio).
  await v.page.goto("/library");
  await expect(v.page.getByText("Sauvegarde ton accès")).toHaveCount(0);
  await expect(v.page.getByText("Cuisinez à plusieurs")).toHaveCount(0);

  await v.context.close();
});

// ── Bug 7 ────────────────────────────────────────────────────────────────
// Retirer deux membres l'un après l'autre depuis le même écran : la seconde
// dialog reste cliquable (pas de `pointer-events:none` collé sur <body>).
test("bug 7 : retirer deux membres à la suite ne fige pas la dialog", async ({ browser }) => {
  const a = await newVisitor(browser);
  const codeA = await createHouseholdViaUI(a.page, uniqueName("Kick Foyer"));
  const ha = (await getHouseholdByJoinCode(codeA))!;

  // B et C rejoignent comme MEMBRES (code membre).
  const b = await newVisitor(browser);
  await joinViaCode(b.page, codeA);
  const c = await newVisitor(browser);
  await joinViaCode(c.page, codeA);
  expect((await getMemberships(ha.id)).length).toBe(3);

  await a.page.goto(`/household/${ha.id}`);
  const memberButtons = a.page.locator('ul[aria-label="Membres"] button');
  await expect(memberButtons).toHaveCount(2); // B et C (A = « toi », non cliquable)

  // Retrait n°1
  await memberButtons.first().click();
  let dialog = a.page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Retirer du foyer" }).click();
  await expect(a.page.locator('ul[aria-label="Membres"] button')).toHaveCount(1);

  // Retrait n°2 — c'est ici que l'app figeait (dialog affichée mais CTA non
  // cliquables : `pointer-events:none` collé sur <body> APRÈS la 1ʳᵉ fermeture,
  // sans que le contenu portalisé ne récupère `auto`). Le clic ci-dessous
  // expirerait (échec) si la dialog était figée.
  await a.page.locator('ul[aria-label="Membres"] button').first().click();
  dialog = a.page.getByRole("dialog");
  const removeBtn = dialog.getByRole("button", { name: "Retirer du foyer" });
  await expect(removeBtn).toBeVisible();
  await removeBtn.click({ timeout: 5000 }); // timeout court si figé → échec explicite
  await expect(a.page.locator('ul[aria-label="Membres"] button')).toHaveCount(0);

  // DB : seul A reste membre.
  const remaining = await getMemberships(ha.id);
  expect(remaining.length).toBe(1);

  await a.context.close();
  await b.context.close();
  await c.context.close();
});
