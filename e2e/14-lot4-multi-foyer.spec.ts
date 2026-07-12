import { test, expect } from "@playwright/test";
import {
  newVisitor,
  createHouseholdViaUI,
  createFromHub,
  joinFromHub,
  uniqueName,
} from "./helpers/onboarding";
import {
  db,
  getHouseholdByJoinCode,
  getMemberships,
  getRecipeByTitle,
  insertRecipe,
} from "./helpers/db";

// Lot 4 (#15b) — multi-appartenance complète : rejoindre est ADDITIF, écritures
// à foyer explicite, biblio fusionnée + filtre, déplacement d'une recette.

test("la totale (API) : rejoindre additif A+B+C, écritures ciblées, déplacement, gardes invité", async ({
  browser,
}) => {
  // Foyers B (membre) et C (invité) créés par d'autres visiteurs — pour leurs codes.
  const vb = await newVisitor(browser);
  const codeB = await createHouseholdViaUI(vb.page, uniqueName("Foyer B"));
  const hb = (await getHouseholdByJoinCode(codeB))!;
  const vc = await newVisitor(browser);
  const codeC = await createHouseholdViaUI(vc.page, uniqueName("Foyer C"));
  const hc = (await getHouseholdByJoinCode(codeC))!;

  // V crée A, puis rejoint B (membre) et C (invité) ADDITIVEMENT depuis le hub.
  const v = await newVisitor(browser);
  const codeA = await createHouseholdViaUI(v.page, uniqueName("Foyer A"));
  const ha = (await getHouseholdByJoinCode(codeA))!;
  const vOwnerId = (await getMemberships(ha.id))[0].owner_id;

  await joinFromHub(v.page, codeB);
  await joinFromHub(v.page, hc.guest_join_code as string);

  // Un SEUL owner (session conservée) désormais membre de A et B, invité de C.
  expect((await getMemberships(ha.id)).some((m) => m.owner_id === vOwnerId)).toBe(true);
  expect((await getMemberships(hb.id)).find((m) => m.owner_id === vOwnerId)?.role).toBe("member");
  expect((await getMemberships(hc.id)).find((m) => m.owner_id === vOwnerId)?.role).toBe("guest");

  // Écritures : sans choix en multi-foyer → 422 ; ciblé B (membre) → 201 ;
  // ciblé C (invité) → 403 (jamais une destination d'écriture).
  const noChoice = await v.page.request.post("/api/recipes", {
    data: { title: uniqueName("sans choix") },
  });
  expect(noChoice.status()).toBe(422);
  const inB = await v.page.request.post("/api/recipes", {
    data: { title: "RB multi", householdId: hb.id },
  });
  expect(inB.status()).toBe(201);
  const inC = await v.page.request.post("/api/recipes", {
    data: { title: "RC refus", householdId: hc.id },
  });
  expect(inC.status()).toBe(403);

  expect(await getRecipeByTitle(hb.id, "RB multi")).not.toBeNull();
  expect(await getRecipeByTitle(ha.id, "RB multi")).toBeNull();

  // Déplacer A → B : 200, la recette bascule dans B et disparaît de A.
  const rA = await insertRecipe({ householdId: ha.id, title: uniqueName("Déménage") });
  const move = await v.page.request.patch(`/api/recipes/${rA}/move`, {
    data: { householdId: hb.id },
  });
  expect(move.status()).toBe(200);
  const moved = await db().from("recipes").select("household_id").eq("id", rA).single();
  expect(moved.data?.household_id).toBe(hb.id);

  // Déplacer DEPUIS un foyer invité (C) → 403 (pas membre de la source).
  const rC = await insertRecipe({ householdId: hc.id, title: uniqueName("Chez C") });
  const fromC = await v.page.request.patch(`/api/recipes/${rC}/move`, {
    data: { householdId: hb.id },
  });
  expect(fromC.status()).toBe(403);

  // Déplacer VERS un foyer invité (C) → 403 (jamais une destination).
  const rB = await insertRecipe({ householdId: hb.id, title: uniqueName("vers C") });
  const toC = await v.page.request.patch(`/api/recipes/${rB}/move`, {
    data: { householdId: hc.id },
  });
  expect(toC.status()).toBe(403);

  await vb.context.close();
  await vc.context.close();
  await v.context.close();
});

test("choix de foyer à l'enregistrement : dialog en multi-foyer, jamais en mono-foyer", async ({
  browser,
}) => {
  // Multi : V membre de A et B.
  const vb = await newVisitor(browser);
  const codeB = await createHouseholdViaUI(vb.page, uniqueName("Foyer B choix"));
  const hb = (await getHouseholdByJoinCode(codeB))!;
  const nameB = "Foyer B choix " + hb.id.slice(0, 4);
  // Renomme B avec un nom repérable pour le dialog.
  await db().from("households").update({ name: nameB }).eq("id", hb.id);

  const v = await newVisitor(browser);
  const codeA = await createHouseholdViaUI(v.page, uniqueName("Foyer A choix"));
  const ha = (await getHouseholdByJoinCode(codeA))!;
  await joinFromHub(v.page, codeB);

  // Création via l'UI (saisie manuelle) → le dialog de choix apparaît (2 foyers).
  const title = uniqueName("Recette choisie");
  await v.page.goto("/recipes/new");
  await v.page.getByText("Saisie manuelle").click();
  await v.page.locator("#title").fill(title);
  await v.page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(v.page.getByText("Dans quel foyer ?")).toBeVisible();
  // Tap sur B = confirme ET enregistre (pas de bouton).
  await v.page.getByRole("dialog").getByRole("button", { name: new RegExp(nameB) }).click();
  await v.page.waitForURL(/\/home/);

  expect(await getRecipeByTitle(hb.id, title)).not.toBeNull();
  expect(await getRecipeByTitle(ha.id, title)).toBeNull();

  // Mono-foyer : jamais de dialog, ni de pill « Foyer ».
  const mono = await newVisitor(browser);
  await createHouseholdViaUI(mono.page, uniqueName("Foyer Mono"));
  const monoTitle = uniqueName("Recette mono");
  await mono.page.goto("/recipes/new");
  await mono.page.getByText("Saisie manuelle").click();
  await mono.page.locator("#title").fill(monoTitle);
  await mono.page.getByRole("button", { name: "Enregistrer" }).click();
  // Pas de dialog → navigation directe.
  await mono.page.waitForURL(/\/home/);
  await expect(mono.page.getByText("Dans quel foyer ?")).toHaveCount(0);
  await mono.page.goto("/library");
  await expect(mono.page.getByRole("button", { name: "Foyer", exact: true })).toHaveCount(0);

  await vb.context.close();
  await v.context.close();
  await mono.context.close();
});

test("bibliothèque multi-foyer : pill Foyer, filtre (URL persistée), labels d'origine", async ({
  browser,
}) => {
  const vb = await newVisitor(browser);
  const codeB = await createHouseholdViaUI(vb.page, uniqueName("Biblio B"));
  const hb = (await getHouseholdByJoinCode(codeB))!;
  const nameB = "Biblio B " + hb.id.slice(0, 4);
  await db().from("households").update({ name: nameB }).eq("id", hb.id);

  const v = await newVisitor(browser);
  const codeA = await createHouseholdViaUI(v.page, uniqueName("Biblio A"));
  const ha = (await getHouseholdByJoinCode(codeA))!;
  await joinFromHub(v.page, codeB);

  const titleA = uniqueName("Plat A");
  const titleB = uniqueName("Plat B");
  await insertRecipe({ householdId: ha.id, title: titleA });
  await insertRecipe({ householdId: hb.id, title: titleB });

  await v.page.goto("/library");
  // Mélange A + B visible, avec le label d'origine B sous le titre.
  await expect(v.page.getByText(titleA)).toBeVisible();
  await expect(v.page.getByText(titleB)).toBeVisible();
  await expect(v.page.getByText(nameB).first()).toBeVisible();

  // Filtre « Foyer » multi-select : ne garder que B → URL foyers=<B>.
  await v.page.getByRole("button", { name: "Foyer", exact: true }).click();
  await v.page.getByRole("button", { name: nameB }).click();
  await expect(v.page).toHaveURL(new RegExp(`foyers=${hb.id}`));
  await expect(v.page.getByText(titleB)).toBeVisible();
  await expect(v.page.getByText(titleA)).toHaveCount(0);

  await vb.context.close();
  await v.context.close();
});

test("quitter un foyer parmi N : session conservée, retour au hub, recettes disparues", async ({
  browser,
}) => {
  const vb = await newVisitor(browser);
  const codeB = await createHouseholdViaUI(vb.page, uniqueName("Quit B"));
  const hb = (await getHouseholdByJoinCode(codeB))!;

  const v = await newVisitor(browser);
  const codeA = await createHouseholdViaUI(v.page, uniqueName("Quit A"));
  const ha = (await getHouseholdByJoinCode(codeA))!;
  const vOwnerId = (await getMemberships(ha.id))[0].owner_id;
  await joinFromHub(v.page, codeB);

  const titleB = uniqueName("Recette de B");
  await insertRecipe({ householdId: hb.id, title: titleB });

  // Quitter B (parmi A+B) : 200, redirect vers le hub, session PAS invalidée.
  const leave = await v.page.request.delete(`/api/households/${hb.id}?action=leave`);
  expect(leave.status()).toBe(200);
  expect(await leave.json()).toEqual({ ok: true, redirect: "/household" });
  expect((await getMemberships(hb.id)).some((m) => m.owner_id === vOwnerId)).toBe(false);
  expect((await getMemberships(ha.id)).some((m) => m.owner_id === vOwnerId)).toBe(true);

  // Toujours connecté : la page suivante ne renvoie PAS vers la landing.
  await v.page.goto("/home");
  await expect(v.page).toHaveURL(/\/home/);
  // Les recettes de B ont disparu de la biblio (plus membre).
  await v.page.goto("/library");
  await expect(v.page.getByText(titleB)).toHaveCount(0);

  await vb.context.close();
  await v.context.close();
});

test("dernier membre qui quitte = suppression du foyer (UI : pas de « Quitter »)", async ({
  browser,
}) => {
  const v = await newVisitor(browser);
  await createHouseholdViaUI(v.page, uniqueName("Solo A")); // v membre de A
  const bId = await createFromHub(v.page, uniqueName("Solo B")); // v seul membre de B
  const titleB = uniqueName("Recette B solo");
  await insertRecipe({ householdId: bId, title: titleB });

  // UI : v est le DERNIER membre de B → « Supprimer » proposé, « Quitter » masqué
  // (partir supprimerait le foyer ; la copie « tu pourras rejoindre » serait fausse).
  await v.page.goto(`/household/${bId}`);
  await expect(v.page.getByRole("button", { name: "Supprimer le foyer" })).toBeVisible();
  await expect(v.page.getByRole("button", { name: "Quitter ce foyer" })).toHaveCount(0);

  // API : quitter B en tant que dernier membre SUPPRIME le foyer (cascade).
  const leave = await v.page.request.delete(`/api/households/${bId}?action=leave`);
  expect(leave.status()).toBe(200);
  const bRow = await db().from("households").select("id").eq("id", bId).maybeSingle();
  expect(bRow.data, "le foyer doit être supprimé, pas orphelin").toBeNull();
  expect(await getRecipeByTitle(bId, titleB)).toBeNull();

  // v reste membre de A et connecté.
  await v.page.goto("/home");
  await expect(v.page).toHaveURL(/\/home/);

  await v.context.close();
});

test("démo : « Créer un foyer » = conversion (owner neuf), le hub ne liste pas la démo", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);
  await page.goto("/");
  await page.getByRole("button", { name: "Essayer l'app" }).click();
  await page.waitForURL(/\/home/);

  // Créer un foyer depuis la démo = CONVERSION : chemin « owner neuf » (redirect
  // /home), jamais un ajout de membership sur l'owner démo (garde serveur). Le
  // chemin « owner neuf » ne renvoie PAS `added:true` (réservé au chemin additif).
  const create = await context.request.post("/api/households", {
    data: { name: uniqueName("Converti") },
  });
  expect(create.status()).toBe(200);
  const body = await create.json();
  expect(body.redirect as string).toBe("/home");
  expect(body.added).toBeUndefined();

  // Le hub du converti ne liste PAS la démo.
  await page.goto("/household");
  await expect(page.getByText("Démo", { exact: true })).toHaveCount(0);

  await context.close();
});
