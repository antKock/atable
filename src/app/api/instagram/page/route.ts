import { NextRequest, NextResponse } from "next/server";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { withApiEventExtra } from "@/lib/events/api-call";
import { enforceInstagramPageQuota } from "@/lib/import-quota";
import {
  DEVICE_PAGE_MAX_BYTES,
  decodeDeviceBody,
  isDeviceRef,
  storeDevicePage,
} from "@/lib/instagram-device";
import { isInstagramUrl } from "@/lib/instagram";

// Dépôt d'une page Instagram publique lue par l'extension de partage iOS
// (chantier « Instagram sans Apify », étape 2 — docs/specs/instagram/00-socle.md).
//   POST /api/instagram/page?ref={uuid}&url={URL finale lue par le téléphone}
//   corps = HTML brut, ou deflate brut si `x-mijote-body-encoding: deflate-raw`
// Réponse sans contenu pour l'extension (elle n'attend rien) : l'import de la
// page web récupère la légende par `igref`. Jamais de HTML dans les logs ni le
// journal — seulement l'issue (`ig_device` : ok | unparsable | duplicate).
export const POST = withOwnerAuth(
  async (request: NextRequest, _ctx, owner) => {
    const ref = request.nextUrl.searchParams.get("ref");
    if (!isDeviceRef(ref)) {
      return NextResponse.json({ error: "invalid_ref", code: "INVALID_DATA" }, { status: 400 });
    }
    const rawUrl = request.nextUrl.searchParams.get("url");
    const pageUrl = rawUrl && isInstagramUrl(rawUrl) ? rawUrl : null;

    const quota = await enforceInstagramPageQuota(owner.ownerId);
    if (quota) return quota;

    const body = Buffer.from(await request.arrayBuffer());
    if (body.byteLength > DEVICE_PAGE_MAX_BYTES) {
      return NextResponse.json({ error: "too_large", code: "BODY_TOO_LARGE" }, { status: 413 });
    }
    const html = decodeDeviceBody(body, request.headers.get("x-mijote-body-encoding"));
    if (!html) {
      return NextResponse.json({ error: "unreadable", code: "INVALID_DATA" }, { status: 400 });
    }

    try {
      const status = await storeDevicePage({ ref, ownerId: owner.ownerId, html, pageUrl });
      return withApiEventExtra(NextResponse.json({ status }), { ig_device: status });
    } catch (err) {
      console.error("[instagram/page] store failed:", err);
      return NextResponse.json({ error: "store_failed", code: "STORE_FAILED" }, { status: 503 });
    }
  },
  {
    maxBodyBytes: DEVICE_PAGE_MAX_BYTES,
    // Opt-out garde démo : rien n'est écrit en base (Redis, 5 min, lié à
    // l'owner) — le visiteur démo importe par partage comme tout le monde.
    allowDemoMutation: true,
  },
);
