import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@/lib/supabase/server";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { getT } from "@/lib/i18n/server";
import { parseJsonBody } from "@/lib/api/body";
import { deleteOwnerImportSamples } from "@/lib/import-pool/samples";

const ImportPoolChoiceSchema = z.object({ optOut: z.boolean() });

/**
 * Refus (ou retour) de la conservation des envois d'import
 * (docs/specs/ocr-appareil/01-conservation-imports.md). Refuser supprime aussi,
 * immédiatement, ce qui a déjà été gardé pour cette personne. Démo : garde par
 * défaut de withOwnerAuth (rien n'est gardé pour elle, rien à refuser).
 */
export const PUT = withOwnerAuth(async (request: NextRequest, _context: unknown, owner) => {
  const t = await getT();
  const parsed = await parseJsonBody(request, { t, schema: ImportPoolChoiceSchema });
  if (parsed instanceof NextResponse) return parsed;
  const { optOut } = parsed.data;

  const { error } = await createServerClient()
    .from("owners")
    .update({ import_pool_opt_out: optOut })
    .eq("id", owner.ownerId);
  if (error) {
    return NextResponse.json({ error: t.import.pool.error }, { status: 500 });
  }

  if (optOut) {
    try {
      await deleteOwnerImportSamples(owner.ownerId);
    } catch (err) {
      // Le refus est enregistré (plus rien ne sera gardé) ; ce qui reste sera
      // retenté à la purge nocturne — on le signale sans faire échouer.
      Sentry.captureException(err, { tags: { feature: "import-pool" } });
    }
  }
  return NextResponse.json({ optOut });
});
