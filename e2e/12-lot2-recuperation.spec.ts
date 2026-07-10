import { test, expect } from "@playwright/test";
import {
  newVisitor,
  createHouseholdViaUI,
  setRecoveryEmail,
  requestRecovery,
  uniqueName,
} from "./helpers/onboarding";
import {
  getHouseholdByJoinCode,
  getOwnerByEmail,
  countLoginTokens,
  overrideLatestLoginToken,
  insertRecipe,
} from "./helpers/db";

// Lot 2 foyer (#14) : email de secours, récupération magic-link + code,
// fusion d'owners, hints home, fork onboarding.
//
// Transport email no-op (RESEND_API_KEY absent de .env.test.local) : les
// secrets sont hashés en DB, les tests les REMPLACENT par des valeurs connues
// (overrideLatestLoginToken) pour jouer les flows à travers la vraie logique.

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}@e2e.mijote.fr`;
}

/**
 * Token magique unique par run (alphabet share-token, 16 chars) : token_hash
 * est UNIQUE en DB et les tokens consommés des runs précédents y restent —
 * une valeur fixe casserait le 2ᵉ run.
 */
function uniqueMagicToken(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  return Array.from(
    { length: 16 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

test("1. poser un email au profil : rien d'envoyé, hub « Accès sauvegardé »", async ({
  browser,
}) => {
  const a = await newVisitor(browser);
  await createHouseholdViaUI(a.page, uniqueName("Foyer Email"));

  // Avant : la ligne « Toi » invite à sauvegarder l'accès
  await a.page.goto("/household");
  await expect(a.page.getByText("Sauvegarder mon accès")).toBeVisible();

  const email = uniqueEmail("profil");
  await setRecoveryEmail(a.page, email);

  // Aucun token créé (= aucun email parti) : la saisie n'envoie RIEN
  const owner = await getOwnerByEmail(email);
  expect(owner, "l'email doit être stocké sur l'owner").toBeTruthy();
  expect(await countLoginTokens(owner!.id)).toBe(0);

  await a.page.goto("/household");
  await expect(a.page.getByText("Accès sauvegardé")).toBeVisible();

  await a.context.close();
});

test("2. récup par code sur un nouvel appareil : B retrouve le foyer, A marche toujours", async ({
  browser,
}) => {
  const a = await newVisitor(browser);
  const name = uniqueName("Foyer Récup");
  await createHouseholdViaUI(a.page, name);
  const email = uniqueEmail("recup");
  await setRecoveryEmail(a.page, email);
  const owner = await getOwnerByEmail(email);

  // « Nouvel appareil » = contexte B (cookies vierges)
  const b = await newVisitor(browser);
  await requestRecovery(b.page, email);
  await overrideLatestLoginToken(owner!.id, "recovery", { code: "123456" });

  await b.page.getByLabel("Code à 6 chiffres").fill("123456");
  await b.page.waitForURL(/\/home/);
  await b.page.goto("/household");
  await expect(b.page.getByRole("link", { name })).toBeVisible();
  await expect(b.page.getByText("Accès sauvegardé")).toBeVisible();

  // L'ancien appareil coexiste (aucune invalidation des autres sessions)
  await a.page.goto("/household");
  await expect(a.page.getByRole("link", { name })).toBeVisible();

  await a.context.close();
  await b.context.close();
});

test("3. récup par magic-link : naviguer l'URL connecte le nouvel appareil", async ({
  browser,
}) => {
  const a = await newVisitor(browser);
  const name = uniqueName("Foyer Lien");
  await createHouseholdViaUI(a.page, name);
  const email = uniqueEmail("lien");
  await setRecoveryEmail(a.page, email);
  const owner = await getOwnerByEmail(email);

  const b = await newVisitor(browser);
  await requestRecovery(b.page, email);
  const magicToken = uniqueMagicToken();
  await overrideLatestLoginToken(owner!.id, "recovery", { token: magicToken });

  await b.page.goto(`/recover/${magicToken}`);
  await b.page.waitForURL(/\/home/);
  await b.page.goto("/household");
  await expect(b.page.getByRole("link", { name })).toBeVisible();

  // Le lien est single-use : une seconde visite tombe sur l'erreur générique
  const c = await newVisitor(browser);
  await c.page.goto(`/recover/${magicToken}`);
  await expect(c.page.getByText("Ce lien n'est plus valide")).toBeVisible();

  await a.context.close();
  await b.context.close();
  await c.context.close();
});

test("4. email inconnu : écran identique, aucune ligne login_tokens", async ({
  browser,
}) => {
  const before = await countLoginTokens();

  const b = await newVisitor(browser);
  // requestRecovery asserte déjà l'écran « Vérifie tes mails » (identique au
  // cas email connu — anti-énumération) ; l'encart code y est aussi
  await requestRecovery(b.page, uniqueEmail("inconnu"));
  await expect(b.page.getByText("Tu lis tes mails sur un autre appareil ?")).toBeVisible();

  expect(await countLoginTokens()).toBe(before);

  await b.context.close();
});

test("5. code faux ×5 : token brûlé, message générique — même le bon code échoue", async ({
  browser,
}) => {
  const a = await newVisitor(browser);
  await createHouseholdViaUI(a.page, uniqueName("Foyer Brûlé"));
  const email = uniqueEmail("brule");
  await setRecoveryEmail(a.page, email);
  const owner = await getOwnerByEmail(email);

  const b = await newVisitor(browser);
  await requestRecovery(b.page, email);
  await overrideLatestLoginToken(owner!.id, "recovery", { code: "123456" });

  const codeInput = b.page.getByLabel("Code à 6 chiffres");
  for (let i = 0; i < 5; i++) {
    await codeInput.fill("000000");
    await expect(b.page.getByText("Code invalide ou expiré.")).toBeVisible();
    // Le composant vide le champ après l'erreur — attendre avant le retry
    await expect(codeInput).toHaveValue("");
  }

  // Token brûlé : le BON code renvoie le même message générique
  await codeInput.fill("123456");
  await expect(b.page.getByText("Code invalide ou expiré.")).toBeVisible();
  expect(b.page.url()).not.toMatch(/\/home/);

  await a.context.close();
  await b.context.close();
});

test("6. fusion : B pose l'email de A → vérif → la session de B rejoint l'union des foyers", async ({
  browser,
}) => {
  // A : foyer + email posé (A = owner CIBLE, il porte l'email)
  const a = await newVisitor(browser);
  const nameA = uniqueName("Foyer Cible");
  await createHouseholdViaUI(a.page, nameA);
  const email = uniqueEmail("fusion");
  await setRecoveryEmail(a.page, email);
  const target = await getOwnerByEmail(email);

  // B : son propre foyer, puis pose LE MÊME email depuis le profil
  const b = await newVisitor(browser);
  const nameB = uniqueName("Foyer Source");
  await createHouseholdViaUI(b.page, nameB);
  await b.page.goto("/household/profile");
  await b.page.getByLabel("Email de secours").fill(email);
  await b.page.getByRole("button", { name: "Enregistrer" }).click();

  // Collision → écran fusion (token purpose='merge' créé vers la cible)
  await expect(b.page.getByRole("heading", { name: "On réunit tes foyers" })).toBeVisible();
  await overrideLatestLoginToken(target!.id, "merge", { code: "654321" });

  await b.page.getByLabel("Code reçu par email").fill("654321");
  await b.page.waitForURL(/\/household/);

  // Le hub de B liste l'UNION (la session de B est repointée sur la cible A)
  await expect(b.page.getByRole("link", { name: nameA })).toBeVisible();
  await expect(b.page.getByRole("link", { name: nameB })).toBeVisible();
  await expect(b.page.getByText("Accès sauvegardé")).toBeVisible();

  // A (autre session de la cible) voit aussi l'union
  await a.page.goto("/household");
  await expect(a.page.getByRole("link", { name: nameB })).toBeVisible();

  await a.context.close();
  await b.context.close();
});

test("7. hints : partage < 3 recettes, puis email ; dismiss persistant ; rien en démo", async ({
  browser,
}) => {
  const a = await newVisitor(browser);
  const code = await createHouseholdViaUI(a.page, uniqueName("Foyer Hints"));
  const household = await getHouseholdByJoinCode(code);

  // < 3 recettes → hint partage
  await a.page.goto("/home");
  await expect(a.page.getByText("Cuisinez à plusieurs")).toBeVisible();
  await expect(a.page.getByText("Sauvegarde ton accès")).toHaveCount(0);

  // ≥ 3 recettes, pas d'email → hint email
  for (let i = 0; i < 3; i++) {
    await insertRecipe({ householdId: household!.id, title: uniqueName(`Recette ${i}`) });
  }
  await a.page.reload();
  await expect(a.page.getByText("Sauvegarde ton accès")).toBeVisible();
  await expect(a.page.getByText("Cuisinez à plusieurs")).toHaveCount(0);

  // Dismiss → toast profil + ne revient plus (cookie 180 j)
  await a.page.getByRole("button", { name: "Fermer" }).click();
  await expect(a.page.getByText("Tu retrouveras ça dans ton profil")).toBeVisible();
  await a.page.reload();
  await expect(a.page.getByText("Sauvegarde ton accès")).toHaveCount(0);

  await a.context.close();

  // Démo : aucun hint — seule la bannière démo (conversion) est là
  const d = await newVisitor(browser);
  await d.page.goto("/");
  await d.page.getByRole("button", { name: "Essayer l'app" }).click();
  await d.page.waitForURL(/\/home/);
  await expect(
    d.page.getByText("Mode démo — tes recettes ne seront pas conservées"),
  ).toBeVisible();
  await expect(d.page.getByText("Cuisinez à plusieurs")).toHaveCount(0);
  await expect(d.page.getByText("Sauvegarde ton accès")).toHaveCount(0);
  await d.context.close();
});

test("8. fork onboarding « Rejoindre un foyer » : les deux chemins", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser);
  await page.goto("/");
  await page.getByRole("button", { name: "Rejoindre un foyer" }).click();

  // Chemin 1 : code d'invitation → formulaire existant
  await page.getByRole("button", { name: "J'ai un code d'invitation" }).click();
  await expect(page.getByPlaceholder("OLIVE-4821")).toBeVisible();

  // Retour au fork, chemin 2 : récupération par email
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("button", { name: "Récupérer avec mon email" })).toBeVisible();
  await page.getByRole("button", { name: "Récupérer avec mon email" }).click();
  await expect(page.getByRole("heading", { name: "Récupérer mon accès" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Envoyer le lien" })).toBeVisible();

  await context.close();
});
