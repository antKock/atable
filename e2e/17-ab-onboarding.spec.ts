import { test, expect } from "@playwright/test";
import { newVisitor, uniqueName } from "./helpers/onboarding";
import { db } from "./helpers/db";

// A/B onboarding (backlog #25). Flag actif dans le harnais (e2e/helpers/env.ts).
// Les autres specs épinglent le bras A via newVisitor ; ici on couvre le tirage
// par le proxy, le bras B de bout en bout, et la persistance du bras sur l'owner.

async function currentOwnerVariant(page: import("@playwright/test").Page): Promise<string | null> {
  const cookie = (await page.context().cookies()).find((c) => c.name === "atable_session");
  expect(cookie, "cookie de session attendu").toBeTruthy();
  const { sid } = JSON.parse(
    Buffer.from(cookie!.value.split(".")[1], "base64url").toString("utf8"),
  ) as { sid: string };
  const { data, error } = await db()
    .from("device_sessions")
    .select("owner_id")
    .eq("id", sid)
    .single();
  if (error) throw error;
  const { data: owner, error: ownerError } = await db()
    .from("owners")
    .select("onboarding_variant")
    .eq("id", data.owner_id as string)
    .single();
  if (ownerError) throw ownerError;
  return owner.onboarding_variant as string | null;
}

async function assignedToday(): Promise<number> {
  const { data } = await db()
    .from("stats_daily")
    .select("ab_onboarding_a, ab_onboarding_b")
    .eq("day", new Date().toISOString().slice(0, 10))
    .maybeSingle();
  return ((data?.ab_onboarding_a as number) ?? 0) + ((data?.ab_onboarding_b as number) ?? 0);
}

test("A/B : premier rendu sans cookie → bras tiré, cookie 1 an, affectation comptée", async ({
  browser,
}) => {
  const before = await assignedToday();
  const { context, page } = await newVisitor(browser, { arm: "none" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mijote" })).toBeVisible();

  const cookie = (await context.cookies()).find((c) => c.name === "mijote_ab_onboarding");
  expect(cookie, "cookie d'affectation posé par le proxy").toBeTruthy();
  expect(["a", "b"]).toContain(cookie!.value);
  // ~1 an (Playwright donne l'expiration en secondes epoch)
  expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(360 * 24 * 3600);

  // La landing rendue correspond au bras du cookie
  const primary = cookie!.value === "b" ? "Commencer" : "Essayer l'app";
  await expect(page.getByRole("button", { name: primary })).toBeVisible();

  // Compteur d'affectation (after() → best-effort, on attend)
  await expect.poll(assignedToday, { timeout: 10_000 }).toBe(before + 1);

  // Second rendu : même bras, pas de nouvelle affectation
  await page.reload();
  await expect(page.getByRole("button", { name: primary })).toBeVisible();
  await page.waitForTimeout(500);
  expect(await assignedToday()).toBe(before + 1);
  await context.close();
});

test("A/B bras B : « Commencer » → carnet en un tap → « Ta première recette » → recette créée", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser, { arm: "b" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Commencer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "J'ai déjà un carnet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Voir un exemple" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Essayer l'app" })).toHaveCount(0);

  await page.getByRole("button", { name: "Commencer" }).click();
  await page.waitForURL(/\/recipes\/new\?first=1$/);
  await expect(page.getByRole("heading", { name: "Ta première recette" })).toBeVisible();
  await expect(page.getByText("Mijote la met au propre")).toBeVisible();
  // Pas de retour sur le choix de méthode (rien derrière)
  await expect(page.getByRole("button", { name: "Retour" })).toHaveCount(0);
  await expect(page.getByText("Écrire moi-même")).toBeVisible();

  // Le bras est persisté sur l'owner réel
  expect(await currentOwnerVariant(page)).toBe("b");

  // Manuel → formulaire (first=1 conservé, view=form ajouté) → retour possible
  await page.getByText("Écrire moi-même").click();
  await page.waitForURL(/\/recipes\/new\?first=1&view=form$/);
  await expect(page.getByRole("button", { name: "Retour" })).toBeVisible();
  const title = uniqueName("Première recette");
  await page.locator("#title").fill(title);
  await page.locator("#ingredients").fill("2 œufs\n100 g de farine");
  await page.locator("#steps").fill("Mélanger.\nCuire.");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // Flux inchangé après enregistrement : la recette créée
  await page.waitForURL(/\/recipes\/[0-9a-f-]+$/);
  await expect(page.getByText(title).first()).toBeVisible();
  await context.close();
});

test("A/B bras B : « J'ai déjà un carnet » ouvre le fork rejoindre, « Voir un exemple » ouvre la démo (bras persisté)", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser, { arm: "b" });
  await page.goto("/");
  await page.getByRole("button", { name: "J'ai déjà un carnet" }).click();
  await expect(page.getByRole("button", { name: "J'ai un code d'invitation" })).toBeVisible();
  await page.getByRole("button", { name: "Retour" }).click();

  await page.getByRole("button", { name: "Voir un exemple" }).click();
  await page.waitForURL(/\/home/);
  await expect(page.getByText("Tu explores un compte démo")).toBeVisible();
  expect(await currentOwnerVariant(page)).toBe("b");
  await context.close();
});

test("A/B bras A : landing inchangée, bras persisté sur l'owner créé", async ({ browser }) => {
  const { context, page } = await newVisitor(browser, { arm: "a" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Essayer l'app" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Commencer" })).toHaveCount(0);
  await page.getByRole("button", { name: "Créer un carnet" }).click();
  await page.waitForURL(/\/home/);
  expect(await currentOwnerVariant(page)).toBe("a");
  await context.close();
});
