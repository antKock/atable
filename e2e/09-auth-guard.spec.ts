import { test, expect } from "@playwright/test";
import { newVisitor } from "./helpers/onboarding";

// Caractérisation du garde d'auth. Note : c'est le middleware qui intercepte
// (redirect vers la landing), pages ET API — le 401 de withHouseholdAuth
// n'est pas observable via HTTP puisque le middleware court-circuite avant.
test("auth : /home sans cookie → redirigé vers la landing", async ({ browser }) => {
  const { context, page } = await newVisitor(browser);
  await page.goto("/home");
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "Essayer l'app" })).toBeVisible();
  await context.close();
});

test("auth : API protégée sans cookie → redirect middleware vers /", async ({ browser }) => {
  const { context } = await newVisitor(browser);
  const res = await context.request.get("/api/carousels", { maxRedirects: 0 });
  expect([301, 302, 303, 307, 308]).toContain(res.status());
  // location peut être relatif (dev) ou absolu (prod) — comparer le pathname
  expect(new URL(res.headers()["location"], res.url()).pathname).toBe("/");
  await context.close();
});
