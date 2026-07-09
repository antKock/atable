import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { loadTestEnv } from "./helpers/env";
import { newVisitor } from "./helpers/onboarding";

// Lot 0 foyer : la résolution d'identité passe par la DB (sid → owner →
// memberships). Un cookie signé valide mais dont le sid n'existe pas en DB
// (cookie forgé, session supprimée) doit être traité comme « déconnecté » —
// purge du cookie + retour landing — jamais un 500 ni une boucle de redirects.

async function forgedToken(): Promise<string> {
  const env = loadTestEnv();
  const secret = new TextEncoder().encode(env.SESSION_SIGNING_SECRET);
  return new SignJWT({ hid: randomUUID(), sid: randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("180d")
    .sign(secret);
}

test("lot 0 : cookie forgé (sid inexistant) → API protégée en 401", async ({ browser, baseURL }) => {
  const { context } = await newVisitor(browser);
  await context.addCookies([
    { name: "atable_session", value: await forgedToken(), url: baseURL! },
  ]);
  const res = await context.request.get("/api/carousels");
  expect(res.status()).toBe(401);
  await context.close();
});

test("lot 0 : cookie forgé (sid inexistant) → déconnecté vers la landing, sans 500", async ({ browser, baseURL }) => {
  const { context, page } = await newVisitor(browser);
  await context.addCookies([
    { name: "atable_session", value: await forgedToken(), url: baseURL! },
  ]);

  const serverErrors: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 500) serverErrors.push(`${r.status()} ${r.url()}`);
  });

  await page.goto("/home");
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "Essayer l'app" })).toBeVisible();
  expect(serverErrors).toEqual([]);

  // Le cookie a été purgé au passage (route /api/auth/session/clear) : pas de
  // boucle landing ↔ /home au prochain chargement.
  const session = (await context.cookies()).find((c) => c.name === "atable_session");
  expect(session?.value ?? "").toBe("");
  await context.close();
});
