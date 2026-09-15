import { test, expect } from "@playwright/test";
import { newVisitor, createHouseholdViaUI, uniqueName } from "./helpers/onboarding";
import { db } from "./helpers/db";

// Journal des événements produit (#28) : un VRAI visiteur (sans sonde) laisse
// une trace lisible de bout en bout — cookie appareil, écrans, clics avec
// identifiant, appels API rattachés à l'owner ; un visiteur sonde n'en laisse
// aucune. Le sens (vues SQL) est testé à part (052 + catalog.test.ts).

async function eventsFor(anonId: string) {
  const { data, error } = await db()
    .from("events")
    .select("name, props, owner_id, source, platform, variant, is_demo")
    .eq("anon_id", anonId)
    .order("at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function anonIdOf(context: {
  cookies: () => Promise<{ name: string; value: string; httpOnly: boolean }[]>;
}) {
  const cookie = (await context.cookies()).find((c) => c.name === "mijote_aid");
  expect(cookie, "cookie appareil mijote_aid attendu dès la landing").toBeTruthy();
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.value).toMatch(/^[0-9a-f-]{36}$/);
  return cookie!.value;
}

test("un vrai visiteur : landing → carnet → recette, écrans / clics / API journalisés et rattachés", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser, { probe: false, arm: "a" });
  await page.goto("/");
  const anonId = await anonIdOf(context);

  await createHouseholdViaUI(page, uniqueName("Foyer Journal"));
  await page.goto("/home");
  await page.getByRole("link", { name: "Ajouter", exact: true }).click();
  await page.waitForURL(/\/recipes\/new/);
  await page.getByText("Écrire moi-même").click();
  await page.locator("#title").fill("Recette journal");
  await page.locator("#ingredients").fill("1 kg de pommes de terre");
  await page.locator("#steps").fill("Éplucher.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/);
  // Laisser le lot client partir (5 s max) puis changer d'écran (vidage à la sortie).
  await page.goto("/home");
  await page.waitForTimeout(1500);

  await expect
    .poll(async () => (await eventsFor(anonId)).length, { timeout: 15_000 })
    .toBeGreaterThan(8);
  const events = await eventsFor(anonId);
  const names = events.map((e) => e.name);

  // Flux A — écrans, avec le MOTIF de route (jamais l'id dans route).
  const screens = events
    .filter((e) => e.name === "screen.viewed")
    .map((e) => (e.props as { route: string }).route);
  expect(screens).toContain("/");
  expect(screens).toContain("/recipes/new");
  expect(screens).toContain("/recipes/[id]");
  expect(screens.some((r) => /[0-9a-f]{8}-/.test(r))).toBe(false);

  // Flux B — clics avec identifiant contractuel.
  const clicks = events
    .filter((e) => e.name === "ui.clicked")
    .map((e) => (e.props as { target: string }).target);
  expect(clicks).toContain("landing.start");
  expect(clicks).toContain("nav.new");
  expect(clicks).toContain("import.manual");
  expect(clicks).toContain("recipe.save");
  // Règle « tout cliquable est nommé » : aucune trace de secours sur ce parcours.
  expect(clicks.filter((c) => c.startsWith("?"))).toEqual([]);

  // Flux C — appels API : création du carnet (anonyme, avant la session) puis
  // création de la recette (rattachée à l'owner, avec source et recipe_id).
  const created = events.find(
    (e) => e.name === "api.called" && (e.props as { route: string }).route === "/api/households",
  );
  expect(created, "POST /api/households journalisé").toBeTruthy();
  const saved = events.find(
    (e) =>
      e.name === "api.called" &&
      (e.props as { route: string; method: string }).route === "/api/recipes" &&
      (e.props as { method: string }).method === "POST",
  );
  expect(saved, "POST /api/recipes journalisé").toBeTruthy();
  expect(saved!.owner_id, "rattaché à l'owner").toBeTruthy();
  expect(saved!.props).toMatchObject({ status: 201, method_kind: "manual" });
  expect((saved!.props as { recipe_id?: string }).recipe_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(saved!.source).toBe("server");

  // Contexte photographié : bras A, web, pas démo. Jamais de contenu.
  expect(saved!.variant).toBe("a");
  expect(saved!.platform).toBe("web");
  expect(saved!.is_demo).toBe(false);
  expect(JSON.stringify(events)).not.toContain("Recette journal");

  // Ouverture de l'app et sortie d'écran avec durée.
  expect(names).toContain("app.opened");
  const left = events.find((e) => e.name === "screen.left");
  expect(left).toBeTruthy();
  expect((left!.props as { duration_ms: number }).duration_ms).toBeGreaterThanOrEqual(0);

  await context.close();
});

test("un visiteur sonde ne laisse aucune ligne", async ({ browser }) => {
  const { context, page } = await newVisitor(browser); // sonde par défaut
  await page.goto("/");
  const anonId = await anonIdOf(context);
  await createHouseholdViaUI(page, uniqueName("Foyer Sonde"));
  await page.goto("/recipes/new");
  await page.waitForTimeout(1500);
  await page.goto("/home");
  await page.waitForTimeout(1500);
  expect(await eventsFor(anonId)).toHaveLength(0);
  await context.close();
});

test("POST /api/events : lot invalide ignoré, allow-list respectée, jamais d'erreur", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser, { probe: false });
  await page.goto("/");
  const anonId = await anonIdOf(context);
  const res = await page.request.post("/api/events", {
    data: {
      platform: "web",
      events: [
        { name: "recipe.viewed", props: {}, at: Date.now() }, // un moment, pas un fait
        { name: "ui.clicked", props: { target: "x".repeat(300), route: "/" }, at: Date.now() },
        { name: "ui.seen", props: { target: "hint.share", route: "/home" }, at: Date.now() },
      ],
    },
  });
  expect(res.status()).toBe(204);
  await expect
    .poll(async () => (await eventsFor(anonId)).filter((e) => e.name === "ui.seen").length)
    .toBe(1);
  const all = await eventsFor(anonId);
  expect(all.some((e) => e.name === "recipe.viewed")).toBe(false);
  expect(
    all.filter(
      (e) => e.name === "ui.clicked" && (e.props as { target: string }).target.length > 200,
    ),
  ).toHaveLength(0);
  await context.close();
});

test("origine d'entrée : UTM, referrer et navigateur intégré sur la première vue d'écran", async ({
  browser,
}) => {
  const { context, page } = await newVisitor(browser, {
    probe: false,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Instagram 300.0.0.0",
  });
  await page.goto("/?utm_source=Instagram&utm_medium=bio&fbclid=AbC-123", {
    referer: "https://l.instagram.com/?u=x",
  });
  const anonId = await anonIdOf(context);
  await expect
    .poll(async () => (await eventsFor(anonId)).filter((e) => e.name === "screen.viewed").length)
    .toBeGreaterThan(0);
  const first = (await eventsFor(anonId)).find((e) => e.name === "screen.viewed")!;
  expect(first.props).toMatchObject({
    route: "/",
    entry: {
      utm_source: "instagram",
      utm_medium: "bio",
      click_id: "fbclid",
      in_app: "instagram",
      referrer_host: "l.instagram.com",
    },
  });
  expect(JSON.stringify(first.props)).not.toContain("AbC-123");
  await context.close();
});
