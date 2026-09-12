import { describe, it, expect } from "vitest";
import { databaseRestConfig } from "./server";

describe("databaseRestConfig", () => {
  it("préfère PostgREST auto-hébergé quand DATABASE_REST_URL et DATABASE_REST_KEY sont posées", () => {
    expect(
      databaseRestConfig({
        DATABASE_REST_URL: "http://postgrest:3000/",
        DATABASE_REST_KEY: "jwt",
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srk",
      }),
    ).toEqual({ url: "http://postgrest:3000", key: "jwt" });
  });

  it("retombe sur Supabase (/rest/v1) sinon", () => {
    expect(
      databaseRestConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "srk",
      }),
    ).toEqual({ url: "https://x.supabase.co/rest/v1", key: "srk" });
  });
});
