import { loadTestEnv } from "./helpers/env";

const SETUP_HINT = "Lance d'abord : npm run test:e2e:setup";

// Commande Redis au format @upstash/redis (POST JSON sur la racine du proxy)
async function redisCommand(
  env: Record<string, string>,
  command: string[],
): Promise<Response> {
  return fetch(env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(3000),
  });
}

export default async function globalSetup() {
  const env = loadTestEnv();

  // 1. Supabase local joignable
  try {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(3000),
    });
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(`Supabase local injoignable (${env.NEXT_PUBLIC_SUPABASE_URL}). ${SETUP_HINT}\n${err}`);
  }

  // 2. Proxy Redis joignable + flush : les rate-limits par IP (join 5/h,
  // création de foyer 5/h) rendraient sinon les runs consécutifs non
  // reproductibles (429 au 2e ou 3e run).
  try {
    const ping = await redisCommand(env, ["PING"]);
    if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
    await redisCommand(env, ["FLUSHALL"]);
  } catch (err) {
    throw new Error(`Proxy Redis injoignable (${env.UPSTASH_REDIS_REST_URL}). ${SETUP_HINT}\n${err}`);
  }

  // 3. Seed appliqué (foyer démo présent)
  const seedCheck = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/households?id=eq.${env.DEMO_HOUSEHOLD_ID}&select=id`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(3000),
    },
  );
  const rows = (await seedCheck.json()) as unknown[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Foyer démo absent de la base locale. ${SETUP_HINT}`);
  }
}
