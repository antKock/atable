import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { enrichRecipe } from "@/lib/enrichment";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/enrichment", () => ({ enrichRecipe: vi.fn() }));

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  vi.mocked(enrichRecipe).mockReset();
  vi.stubEnv("BATCH_ENRICH_SECRET", "test-batch-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(auth?: string, query = ""): NextRequest {
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;
  return new NextRequest(`https://test.local/api/admin/batch-enrich${query}`, {
    method: "POST",
    headers,
  });
}

describe("POST /api/admin/batch-enrich — auth", () => {
  it("returns 401 with no authorization header", async () => {
    const res = await POST(request());
    expect(res.status).toBe(401);
  });

  it("returns 401 with a wrong bearer token", async () => {
    const res = await POST(request("Bearer wrong-token"));
    expect(res.status).toBe(401);
  });

  it("rejects the CRON_SECRET — the endpoint requires its own secret", async () => {
    const res = await POST(request(`Bearer ${process.env.CRON_SECRET}`));
    expect(res.status).toBe(401);
  });

  it("fails closed when BATCH_ENRICH_SECRET is not set (no 'Bearer undefined' bypass)", async () => {
    vi.stubEnv("BATCH_ENRICH_SECRET", "");
    const res = await POST(request("Bearer undefined"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/batch-enrich — reset mode", () => {
  it("returns 403 when ALLOW_BATCH_RESET is not set, without touching the DB", async () => {
    const res = await POST(request("Bearer test-batch-secret", "?reset=true"));
    expect(res.status).toBe(403);
    expect(supa.calls).toHaveLength(0);
  });

  it("runs the reset when ALLOW_BATCH_RESET=true", async () => {
    vi.stubEnv("ALLOW_BATCH_RESET", "true");
    supa.queueResults([
      { data: [], error: null }, // select all recipes (photos)
      { error: null }, // reset recipe fields
      { error: null }, // clear recipe_tags
      { count: 0, error: null }, // count remaining
    ]);
    const res = await POST(request("Bearer test-batch-secret", "?reset=true"));
    expect(res.status).toBe(200);
    expect((await res.json()).action).toBe("reset");
  });
});

describe("POST /api/admin/batch-enrich — enrich mode", () => {
  it("enriches the recipes still pending", async () => {
    supa.queueResults([
      { data: [{ id: "r-1", title: "Tarte" }], error: null }, // recipes to enrich
      { count: 1, error: null }, // total remaining
    ]);
    const res = await POST(request("Bearer test-batch-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("enrich");
    expect(body.processed).toBe(1);
    expect(enrichRecipe).toHaveBeenCalledWith("r-1");
  });
});
