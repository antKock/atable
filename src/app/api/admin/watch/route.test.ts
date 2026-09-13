import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const upsert = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({ from: vi.fn(() => ({ upsert })) })),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));

import { POST } from "./route";

function post(body: unknown, auth?: string) {
  return new NextRequest("http://localhost/api/admin/watch", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/watch (#27)", () => {
  beforeEach(() => {
    upsert.mockReset().mockResolvedValue({ error: null });
    process.env.ADMIN_API_SECRET = "s3cret";
  });

  it("401 sans le Bearer ADMIN_API_SECRET, même si le proxy laissait passer", async () => {
    expect((await POST(post({ day: "2026-09-13", traefik5xx: 1 }))).status).toBe(401);
    expect((await POST(post({ day: "2026-09-13", traefik5xx: 1 }, "Bearer nope"))).status).toBe(
      401,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it("422 sur un corps invalide (jour mal formé, compte négatif)", async () => {
    expect((await POST(post({ day: "13/09/2026", traefik5xx: 1 }, "Bearer s3cret"))).status).toBe(
      422,
    );
    expect((await POST(post({ day: "2026-09-13", traefik5xx: -1 }, "Bearer s3cret"))).status).toBe(
      422,
    );
  });

  it("upsert idempotent de stats_daily.traefik_5xx pour le jour", async () => {
    const res = await POST(post({ day: "2026-09-13", traefik5xx: 4 }, "Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, day: "2026-09-13", traefik5xx: 4 });
    expect(upsert).toHaveBeenCalledWith(
      { day: "2026-09-13", traefik_5xx: 4 },
      { onConflict: "day" },
    );
  });
});
