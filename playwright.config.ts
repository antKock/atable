import { defineConfig, devices } from "@playwright/test";
import { loadTestEnv } from "./e2e/helpers/env";

// L'environnement vient de .env.test.local (Supabase local + Redis local) —
// jamais de .env.local. Voir e2e/README.md pour la mise en route.
const testEnv = loadTestEnv();

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // Un seul worker : les tests partagent une base et des rate-limits par IP ;
  // la stabilité (filet de non-régression) prime sur la durée de la suite.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `${BASE_URL}/api/version`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { ...process.env, ...testEnv, NEXT_DIST_DIR: ".next-e2e" },
  },
});
