import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    // Les specs Playwright (e2e/) ne sont pas des tests vitest
    exclude: [...configDefaults.exclude, "e2e/**"],
    // Dummy values so modules that read env at import time (redis.ts,
    // openai.ts, supabase) don't throw. Real calls are always vi.mock'd.
    env: {
      OPENAI_SERVICE_KEY: "test-openai-key",
      SESSION_SIGNING_SECRET: "test-secret-that-is-at-least-32-chars-long!!",
      CRON_SECRET: "test-cron-secret",
      DEMO_HOUSEHOLD_ID: "00000000-0000-0000-0000-000000000000",
      UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-upstash-token",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
