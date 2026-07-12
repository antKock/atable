import { test, expect } from "@playwright/test";
import {
  newVisitor,
  createHouseholdViaUI,
  joinViaCode,
  openHouseholdDetail,
  uniqueName,
} from "./helpers/onboarding";
import {
  getHouseholdByJoinCode,
  getMemberships,
  insertRecipe,
} from "./helpers/db";

// Lot 3 (#15a) — rôle invité : deux liens par rôle, lecture seule enforced
// 100 % côté serveur (RLS sans policy). LE test qui compte = la matrice 403.

/** Routes de MUTATION household-scopées qu'un invité ne doit jamais atteindre. */
function mutationMatrix(hid: string, recipeId: string, targetOwnerId: string) {
  return [
    { label: "POST /api/recipes", method: "post" as const, url: "/api/recipes", data: { title: "Intrus" } },
    { label: "PUT /api/recipes/[id]", method: "put" as const, url: `/api/recipes/${recipeId}`, data: { title: "Intrus", ingredients: "x", steps: "y" } },
    { label: "DELETE /api/recipes/[id]", method: "delete" as const, url: `/api/recipes/${recipeId}` },
    // NB : POST /api/recipes/[id]/share n'est PAS ici — partager est autorisé à
    // un invité (décision produit ; testé positivement plus bas).
    { label: "POST /api/tags", method: "post" as const, url: "/api/tags", data: { name: uniqueName("tag") } },
    { label: "POST /api/recipes/import/url", method: "post" as const, url: "/api/recipes/import/url", data: { url: "https://example.com/recette" } },
    { label: "PUT /api/households/[id] (rename)", method: "put" as const, url: `/api/households/${hid}`, data: { name: "Renommé par un invité" } },
    { label: "PATCH members/[ownerId] (rôle)", method: "patch" as const, url: `/api/households/${hid}/members/${targetOwnerId}`, data: { role: "guest" } },
    { label: "DELETE members/[ownerId] (retrait)", method: "delete" as const, url: `/api/households/${hid}/members/${targetOwnerId}` },
    // Supprimer le foyer = destruction cascade : réservé aux membres, jamais un
    // invité (masquage UI insuffisant, la garde est serveur).
    { label: "DELETE households/[id]?action=delete", method: "delete" as const, url: `/api/households/${hid}?action=delete` },
  ];
}

test("invité : lien invité → rôle guest, lecture live, matrice 403 sur toute mutation", async ({ browser }) => {
  const a = await newVisitor(browser);
  const memberCode = await createHouseholdViaUI(a.page, uniqueName("Foyer Invité A"));
  const household = await getHouseholdByJoinCode(memberCode);
  expect(household?.guest_join_code).toMatch(/^[A-Z]+-\d{4}$/);
  const hid = household!.id;
  const aOwnerId = (await getMemberships(hid))[0].owner_id;

  // Une recette déjà présente dans le foyer de A.
  const title1 = uniqueName("Recette A");
  const recipeId = await insertRecipe({ householdId: hid, title: title1 });

  // B rejoint via le LIEN INVITÉ → membership guest.
  const b = await newVisitor(browser);
  await joinViaCode(b.page, household!.guest_join_code as string);

  const memberships = await getMemberships(hid);
  const bMembership = memberships.find((m) => m.owner_id !== aOwnerId);
  expect(bMembership?.role, "B doit être invité").toBe("guest");

  // B voit les recettes de A, en direct (A crée → B recharge et la voit).
  await b.page.goto("/library");
  await expect(b.page.getByText(title1)).toBeVisible();
  const title2 = uniqueName("Recette A live");
  await insertRecipe({ householdId: hid, title: title2 });
  await b.page.reload();
  await expect(b.page.getByText(title2)).toBeVisible();

  // UI en lecture seule : pas de FAB « + » ni de crayon sur la fiche.
  await b.page.goto("/home");
  await expect(b.page.getByRole("link", { name: "Ajouter", exact: true })).toHaveCount(0);
  await b.page.goto(`/recipes/${recipeId}`);
  await expect(b.page.getByRole("heading", { name: title1 })).toBeVisible();
  await expect(b.page.getByRole("link", { name: "Modifier" })).toHaveCount(0);
  // …mais « Partager » RESTE disponible pour un invité (décision produit).
  await expect(b.page.getByRole("button", { name: "Partager" })).toBeVisible();

  // Matrice API : toutes les mutations household-scopées → 403.
  for (const route of mutationMatrix(hid, recipeId, aOwnerId)) {
    const res = await b.page.request[route.method](route.url, route.data ? { data: route.data } : undefined);
    expect(res.status(), `${route.label} doit répondre 403 pour un invité`).toBe(403);
  }

  // Partage : un invité PEUT créer le lien public (200 + url) — seul geste
  // « sortant » permis en lecture seule.
  const share = await b.page.request.post(`/api/recipes/${recipeId}/share`);
  expect(share.status(), "un invité doit pouvoir partager").toBe(200);
  expect((await share.json()).url as string).toContain("/r/");

  await a.context.close();
  await b.context.close();
});

test("détail foyer côté invité : bandeau lecture seule, pas d'« Inviter », seul « Quitter »", async ({ browser }) => {
  const a = await newVisitor(browser);
  const memberCode = await createHouseholdViaUI(a.page, uniqueName("Foyer Invité UI"));
  const household = await getHouseholdByJoinCode(memberCode);

  const b = await newVisitor(browser);
  await joinViaCode(b.page, household!.guest_join_code as string);

  await openHouseholdDetail(b.page);
  await expect(b.page.getByText("Tu peux consulter les recettes en direct, mais pas les modifier.")).toBeVisible();
  // Sous-titre « Invité · N personnes » (le « · » le distingue de la pill de rôle).
  await expect(b.page.getByText(/Invité ·/)).toBeVisible();
  await expect(b.page.getByRole("link", { name: "Inviter quelqu'un" })).toHaveCount(0);
  await expect(b.page.getByRole("button", { name: "Supprimer le foyer" })).toHaveCount(0);
  await expect(b.page.getByRole("button", { name: "Quitter ce foyer" })).toBeVisible();

  // Le code d'invitation MEMBRE ne doit JAMAIS être livré à un invité (même
  // non affiché : prop sérialisée dans le payload RSC → escalade invité→membre
  // via le re-join additif). La page ne doit pas contenir le code membre.
  expect(await b.page.content()).not.toContain(memberCode);

  await a.context.close();
  await b.context.close();
});

test("A passe B membre → B peut créer ; A repasse B invité → re-403", async ({ browser }) => {
  const a = await newVisitor(browser);
  const memberCode = await createHouseholdViaUI(a.page, uniqueName("Foyer Rôle"));
  const household = await getHouseholdByJoinCode(memberCode);
  const hid = household!.id;
  const aOwnerId = (await getMemberships(hid))[0].owner_id;

  const b = await newVisitor(browser);
  await joinViaCode(b.page, household!.guest_join_code as string);
  const bOwnerId = (await getMemberships(hid)).find((m) => m.owner_id !== aOwnerId)!.owner_id;

  // Invité : création refusée.
  let create = await b.page.request.post("/api/recipes", { data: { title: uniqueName("essai") } });
  expect(create.status()).toBe(403);

  // A promeut B en membre.
  const promote = await a.page.request.patch(`/api/households/${hid}/members/${bOwnerId}`, { data: { role: "member" } });
  expect(promote.status()).toBe(200);

  // B peut désormais créer.
  create = await b.page.request.post("/api/recipes", { data: { title: uniqueName("par B membre") } });
  expect(create.status()).toBe(201);

  // A repasse B en invité → re-403.
  const demote = await a.page.request.patch(`/api/households/${hid}/members/${bOwnerId}`, { data: { role: "guest" } });
  expect(demote.status()).toBe(200);
  create = await b.page.request.post("/api/recipes", { data: { title: uniqueName("re-refus") } });
  expect(create.status()).toBe(403);

  await a.context.close();
  await b.context.close();
});

test("A retire B → accès coupé immédiatement (page suivante → landing)", async ({ browser }) => {
  const a = await newVisitor(browser);
  const memberCode = await createHouseholdViaUI(a.page, uniqueName("Foyer Retrait"));
  const household = await getHouseholdByJoinCode(memberCode);
  const hid = household!.id;
  const aOwnerId = (await getMemberships(hid))[0].owner_id;

  const b = await newVisitor(browser);
  await joinViaCode(b.page, household!.guest_join_code as string);
  const bOwnerId = (await getMemberships(hid)).find((m) => m.owner_id !== aOwnerId)!.owner_id;

  // B a accès avant retrait.
  await b.page.goto("/home");
  await expect(b.page).toHaveURL(/\/home/);

  // A retire B.
  const remove = await a.page.request.delete(`/api/households/${hid}/members/${bOwnerId}`);
  expect(remove.status()).toBe(200);
  expect((await getMemberships(hid)).some((m) => m.owner_id === bOwnerId)).toBe(false);

  // Page suivante de B → déconnexion propre vers la landing.
  await b.page.goto("/home");
  await b.page.waitForURL((url) => url.pathname === "/");
  await expect(b.page.getByRole("button", { name: "Créer un foyer" })).toBeVisible();

  await a.context.close();
  await b.context.close();
});

test("dernier membre : A ne peut ni se rétrograder ni se retirer (409)", async ({ browser }) => {
  const a = await newVisitor(browser);
  const memberCode = await createHouseholdViaUI(a.page, uniqueName("Foyer Dernier"));
  const household = await getHouseholdByJoinCode(memberCode);
  const hid = household!.id;
  const aOwnerId = (await getMemberships(hid))[0].owner_id;

  const demoteSelf = await a.page.request.patch(`/api/households/${hid}/members/${aOwnerId}`, { data: { role: "guest" } });
  expect(demoteSelf.status()).toBe(409);

  const removeSelf = await a.page.request.delete(`/api/households/${hid}/members/${aOwnerId}`);
  expect(removeSelf.status()).toBe(409);

  // A reste bien membre.
  expect((await getMemberships(hid))[0].role).toBe("member");

  await a.context.close();
});

test("lien membre → rôle membre (non-régression) ; codes invités exclus de la démo", async ({ browser }) => {
  const a = await newVisitor(browser);
  const memberCode = await createHouseholdViaUI(a.page, uniqueName("Foyer Membre"));
  const household = await getHouseholdByJoinCode(memberCode);
  const hid = household!.id;
  const aOwnerId = (await getMemberships(hid))[0].owner_id;

  // Rejoindre avec le lien MEMBRE → rôle member.
  const b = await newVisitor(browser);
  await joinViaCode(b.page, memberCode);
  const bMembership = (await getMemberships(hid)).find((m) => m.owner_id !== aOwnerId);
  expect(bMembership?.role).toBe("member");

  // Un membre peut créer (non-régression).
  const create = await b.page.request.post("/api/recipes", { data: { title: uniqueName("par membre") } });
  expect(create.status()).toBe(201);

  // Le guest_join_code de la démo ne rejoint aucun foyer (lookup exclut is_demo).
  const lookup = await b.page.request.get("/api/households/lookup?code=DEMOGUEST-0000");
  expect(lookup.status()).toBe(404);

  await a.context.close();
  await b.context.close();
});
