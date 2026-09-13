import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { db, getHouseholdByName } from "./db";

/**
 * Chaque « visiteur » E2E = un contexte navigateur isolé (cookies propres)
 * avec une IP simulée unique via x-forwarded-for : les rate-limits par IP
 * (join 5/h, création de foyer 5/h) sont lus depuis ce header par les routes,
 * et une IP partagée ferait dérailler la suite en 429.
 */
export async function newVisitor(
  browser: Browser,
  options: { arm?: AbArm; probe?: boolean } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const ip = `10.${rand(254)}.${rand(254)}.${1 + rand(253)}`;
  // Sonde (#26) par défaut : le harnais est un agent, ses requêtes portent
  // `x-mijote-probe` comme en prod. `probe: false` = un vrai visiteur.
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-forwarded-for": ip,
      ...(options.probe === false ? {} : { "x-mijote-probe": "1" }),
    },
  });
  await pinAbArm(context, options.arm ?? "a");
  const page = await context.newPage();
  return { context, page };
}

/**
 * A/B onboarding (#25) : le flag est actif dans le harnais, donc un visiteur
 * sans cookie tire un bras au hasard. Les specs existantes décrivent la landing
 * A : on pose le cookie avant la première visite (le proxy le respecte).
 * `"none"` = laisser le proxy tirer (spec dédiée au split).
 */
export type AbArm = "a" | "b" | "none";

export async function pinAbArm(context: BrowserContext, arm: AbArm): Promise<void> {
  if (arm === "none") return;
  await context.addCookies([
    {
      name: "mijote_ab_onboarding",
      value: arm,
      url: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3100}`,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

function rand(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}

/** Nom unique par run pour éviter les collisions entre runs successifs. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${rand(999)}`;
}

/**
 * Onboarding « Créer un foyer » via l'UI. Depuis la spec #23 la landing crée
 * EN UN TAP (nom par défaut « Mon carnet ») ; pour garder le contrat des specs
 * (un foyer portant `name`, relu en DB par ce nom), on renomme ensuite via
 * l'API avec la session du navigateur. Retourne le join code.
 */
export async function createHouseholdViaUI(page: Page, name: string): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "Créer un carnet" }).click();
  await page.waitForURL(/\/home/);
  const householdId = await currentHouseholdId(page);
  const rename = await page.request.put(`/api/households/${householdId}`, { data: { name } });
  expect(rename.status(), "renommage post-création (helper E2E)").toBe(200);
  const household = await getHouseholdByName(name);
  expect(household?.join_code, "le foyer créé doit avoir un join_code").toMatch(/^[A-Z]+-\d{4}$/);
  return household!.join_code as string;
}

/**
 * Foyer de la session courante du navigateur : cookie `atable_session` (JWT
 * signé, payload `{ sid }`) → device_sessions.household_id en DB locale.
 */
export async function currentHouseholdId(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find((c) => c.name === "atable_session");
  expect(cookie, "cookie de session attendu après la création").toBeTruthy();
  const payload = JSON.parse(
    Buffer.from(cookie!.value.split(".")[1], "base64url").toString("utf8"),
  ) as {
    sid: string;
  };
  const { data, error } = await db()
    .from("device_sessions")
    .select("household_id")
    .eq("id", payload.sid)
    .single();
  if (error) throw error;
  return data.household_id as string;
}

/**
 * Depuis le hub « Foyer & profil », ouvre le détail du (premier) foyer.
 * Exclut les lignes « Toi » (/profile) et « Créer ou rejoindre » (/switch).
 */
export async function openHouseholdDetail(page: Page): Promise<void> {
  await page.goto("/household");
  await page
    .locator('a[href^="/household/"]:not([href$="/profile"]):not([href$="/switch"])')
    .first()
    .click();
  await page.waitForURL(/\/household\/[0-9a-f-]{36}/);
}

/**
 * Onboarding « Rejoindre un foyer » via le code d'invitation — passe par le
 * fork du Lot 2 (code OU récupération email).
 */
export async function joinViaCode(page: Page, code: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir un carnet" }).click();
  await page.getByRole("button", { name: "J'ai un code d'invitation" }).click();
  await page.getByPlaceholder("OLIVE-4821").fill(code);
  await page.getByRole("button", { name: "Ouvrir", exact: true }).click();
  await page.waitForURL(/\/home/);
}

/**
 * Rejoindre ADDITIVEMENT depuis le hub (Lot 4) : l'owner courant ajoute un
 * foyer, la session est conservée, le hub liste tous ses foyers. Passe par
 * /household/switch (« Créer ou rejoindre »).
 */
export async function joinFromHub(page: Page, code: string): Promise<void> {
  await openSwitchScreen(page);
  await page.getByRole("button", { name: "Ouvrir un carnet" }).click();
  await page.getByPlaceholder("OLIVE-4821").fill(code);
  await page.getByRole("button", { name: "Ouvrir", exact: true }).click();
  // Additif → retour au hub (pas de nouvelle session). Attendre que le hub soit
  // RÉELLEMENT chargé (pas seulement l'URL) : la redirection additive passe par
  // window.location, et un goto suivant qui court-circuite ce chargement en vol
  // avorte (net::ERR_ABORTED).
  await page.waitForURL(/\/household(\?|$|\/)/);
  await expect(page.getByRole("heading", { name: "Carnet & profil" })).toBeVisible();
}

/** Ouvre « Créer ou rejoindre un foyer » depuis le hub (nav SPA fiable). */
async function openSwitchScreen(page: Page): Promise<void> {
  await page.goto("/household");
  await page.getByRole("link", { name: "Créer ou ouvrir un carnet" }).click();
  await page.waitForURL(/\/household\/switch/);
}

/**
 * Créer ADDITIVEMENT un foyer depuis le hub (Lot 4) : ajoute un foyer à l'owner
 * courant, redirige vers la Home (créer depuis le profil ramène à l'accueil).
 * Retourne l'id du nouveau foyer (relu en DB par le nom).
 */
export async function createFromHub(page: Page, name: string): Promise<string> {
  await openSwitchScreen(page);
  await page.getByRole("button", { name: "Créer un carnet" }).click();
  await page.getByPlaceholder("Ex : Recettes de famille, Chez nous…").fill(name);
  await page.getByRole("button", { name: "Créer le carnet" }).click();
  await page.waitForURL(/\/home/);
  const household = await getHouseholdByName(name);
  expect(household?.id, "le foyer créé depuis le hub doit exister en DB").toBeTruthy();
  return household!.id as string;
}

/** Pose l'email de secours depuis le profil (aucun envoi attendu). */
export async function setRecoveryEmail(page: Page, email: string): Promise<void> {
  await page.goto("/household/profile");
  await page.getByLabel("Email de secours").fill(email);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Profil mis à jour")).toBeVisible();
}

/**
 * Ouvre l'écran de récupération par email depuis la landing et envoie la
 * demande — laisse la page sur « Vérifie tes mails ».
 */
export async function requestRecovery(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir un carnet" }).click();
  await page.getByRole("button", { name: "Récupérer avec mon email" }).click();
  await page.getByLabel("Email de secours").fill(email);
  await page.getByRole("button", { name: "Envoyer le lien" }).click();
  await expect(page.getByRole("heading", { name: "Vérifie tes mails" })).toBeVisible();
}
