import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { POST } from "./route";
import { createServerClient } from "@/lib/supabase/server";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

vi.mock("@/lib/supabase/server");
vi.mock("next/headers", () => ({ headers: vi.fn() }));
// L'auth reste pilotée par les headers mockés (cf. owner-context-mock.ts)
vi.mock("@/lib/auth/owner-context", async () => {
  const { ownerContextFromTestHeaders } = await import("@/test/owner-context-mock");
  return { getOwnerContext: vi.fn(ownerContextFromTestHeaders) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockHeaders = headers as unknown as Mock;

let supa: SupabaseMock;

beforeEach(() => {
  supa = createSupabaseMock();
  vi.mocked(createServerClient).mockReturnValue(supa.client);
  mockHeaders.mockResolvedValue(new Headers({ "x-household-id": "household-1" }));
});

const ctx = (id = "recipe-1") => ({ params: Promise.resolve({ id }) });

function photoRequest(file: File): NextRequest {
  const fd = new FormData();
  fd.append("photo", file);
  return new NextRequest("https://test.local/api/recipes/recipe-1/photo", {
    method: "POST",
    body: fd,
  });
}

const webp = () => new File([new Uint8Array([1, 2, 3])], "p.webp", { type: "image/webp" });

/** The payload of the recipes `.update()` call. */
function recipeUpdate(): Record<string, unknown> | undefined {
  return supa.calls
    .filter((c) => c.table === "recipes")
    .flatMap((c) => c.ops)
    .find((op) => op.method === "update")?.args[0] as Record<string, unknown> | undefined;
}

describe("POST /api/recipes/[id]/photo", () => {
  it("persists photo_url and settles image_status to 'none' on success", async () => {
    supa.queueResults([
      { data: { id: "recipe-1" } }, // ownership check
      { error: null }, // recipes update
    ]);

    const res = await POST(photoRequest(webp()), ctx());

    expect(res.status).toBe(200);
    expect(supa.uploadMock).toHaveBeenCalledTimes(1);
    const update = recipeUpdate();
    expect(update?.image_status).toBe("none");
    expect(typeof update?.photo_url).toBe("string");
  });

  it("returns 404 (and uploads nothing) when the recipe isn't in the household", async () => {
    supa.queueResults([{ data: null }]); // ownership check fails

    const res = await POST(photoRequest(webp()), ctx("missing"));

    expect(res.status).toBe(404);
    expect(supa.uploadMock).not.toHaveBeenCalled();
    expect(recipeUpdate()).toBeUndefined();
  });

  it("rejects an unsupported mime type with 400", async () => {
    const gif = new File([new Uint8Array([1])], "p.gif", { type: "image/gif" });
    const res = await POST(photoRequest(gif), ctx());
    expect(res.status).toBe(400);
    expect(supa.uploadMock).not.toHaveBeenCalled();
  });

  it("returns 401 without a household header", async () => {
    mockHeaders.mockResolvedValue(new Headers());
    const res = await POST(photoRequest(webp()), ctx());
    expect(res.status).toBe(401);
  });
});
