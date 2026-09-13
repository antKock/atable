import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withPublicRoute } from "./with-public-route";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const req = (headers: Record<string, string> = {}) =>
  new NextRequest("https://test.local/api/public", { method: "POST", headers });

describe("withPublicRoute", () => {
  it("passe le dictionnaire au handler et renvoie sa réponse", async () => {
    const route = withPublicRoute(async (_r, _c, t) =>
      NextResponse.json({ msg: t.api.serverError }),
    );
    const res = await route(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ msg: "Erreur serveur" });
  });

  it("413 avant le handler quand le corps annoncé dépasse le plafond", async () => {
    const handler = vi.fn(async () => NextResponse.json({}));
    const route = withPublicRoute(handler, { maxBodyBytes: 100 });
    const res = await route(req({ "content-length": "101" }));
    expect(res.status).toBe(413);
    expect(handler).not.toHaveBeenCalled();
  });

  it("500 générique localisé + Sentry sur une erreur non attrapée (jamais le message brut)", async () => {
    const route = withPublicRoute(async () => {
      throw new Error('duplicate key value violates unique constraint "owners_pkey"');
    });
    const res = await route(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erreur serveur" });
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
