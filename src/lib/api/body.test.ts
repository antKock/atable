import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "./body";

const req = (body: string) =>
  new NextRequest("https://test.local/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

const schema = z.object({ name: z.string().min(1, "nom requis") });

describe("parseJsonBody", () => {
  it("renvoie { data } validé", async () => {
    const r = await parseJsonBody(req('{"name":"a"}'), { schema });
    expect(r).toEqual({ data: { name: "a" } });
  });

  it("400 INVALID_JSON sur un corps illisible (message localisé par défaut)", async () => {
    const r = await parseJsonBody(req("{oops"), { schema });
    expect(r).toBeInstanceOf(NextResponse);
    const res = r as NextResponse;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Données invalides", code: "INVALID_JSON" });
  });

  it("422 INVALID_DATA avec le premier message zod ; statut surchargeable", async () => {
    const r = (await parseJsonBody(req('{"name":""}'), { schema })) as NextResponse;
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ error: "nom requis", code: "INVALID_DATA" });
    const r2 = (await parseJsonBody(req('{"name":""}'), { schema, invalidStatus: 400 })) as NextResponse;
    expect(r2.status).toBe(400);
  });

  it("`pick` extrait le champ, `invalidMessage` / `unreadableMessage` remplacent les messages", async () => {
    const r = await parseJsonBody(req('{"code":"abc"}'), {
      schema: z.string().regex(/^\d+$/),
      pick: (b) => (b as { code?: unknown }).code,
      invalidMessage: () => "format",
      unreadableMessage: () => "illisible",
    });
    expect(await (r as NextResponse).json()).toMatchObject({ error: "format" });
    const r2 = await parseJsonBody(req("nope"), { schema: z.string(), unreadableMessage: () => "illisible" });
    expect(await (r2 as NextResponse).json()).toMatchObject({ error: "illisible" });
  });

  it("un corps JSON `null` est lisible mais invalide (422), pas un 400", async () => {
    const r = (await parseJsonBody(req("null"), { schema })) as NextResponse;
    expect(r.status).toBe(422);
  });
});
