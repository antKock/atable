import { PostgrestClient } from "@supabase/postgrest-js";

// Client base de données côté serveur (jamais dans le navigateur).
//
// Parle PostgREST directement : `from()` / `rpc()` sont ceux de postgrest-js,
// exactement ce que supabase-js déléguait — les appelants ne voient aucune
// différence. Deux cibles possibles (docs/infra/migration-supabase-vps.md) :
//   - PostgREST auto-hébergé sur le VPS : `DATABASE_REST_URL` (réseau Docker
//     interne, ex. http://mijote-staging-postgrest-xxxx:3000) + `DATABASE_REST_KEY`
//     (JWT `role: service_role` signé avec le PGRST_JWT_SECRET du service) ;
//   - Supabase (repli tant que les variables ci-dessus sont absentes) :
//     `NEXT_PUBLIC_SUPABASE_URL` + `/rest/v1`, clé service role. L'en-tête
//     `apikey` est exigé par la passerelle Supabase et ignoré par PostgREST.
//
// Le nom du module (`supabase/server`) est conservé : 60 importeurs, et le
// contrat (`createServerClient()`, chaînes `.from()`) n'a pas changé.

// Forme minimale de process.env (index signature) : testable avec un objet nu.
type Env = { [key: string]: string | undefined };

export type DbClient = PostgrestClient;

export function databaseRestConfig(env: Env = process.env): {
  url: string;
  key: string;
} {
  if (env.DATABASE_REST_URL && env.DATABASE_REST_KEY) {
    return { url: env.DATABASE_REST_URL.replace(/\/$/, ""), key: env.DATABASE_REST_KEY };
  }
  return {
    url: `${env.NEXT_PUBLIC_SUPABASE_URL!}/rest/v1`,
    key: env.SUPABASE_SERVICE_ROLE_KEY!,
  };
}

export function createServerClient(): DbClient {
  const { url, key } = databaseRestConfig();
  return new PostgrestClient(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}
