import { NextRequest, NextResponse } from "next/server";
import { buildImportScreenshotSchema } from "@/lib/schemas/import";
import { extractRecipeFromImages } from "@/lib/import";
import { getT } from "@/lib/i18n/server";
import { enforceImportQuota } from "@/lib/import-quota";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { resolveImportHousehold } from "@/lib/api/import-household";

// Plafond du corps JSON, cohérent avec MAX_BASE64_LENGTH (schemas/import.ts :
// 15 M caractères ≈ une image de 10 Mo) + enveloppe JSON. Le client
// redimensionne à 1280 px (~500 Ko base64 par image, 5 max) : en pratique on
// est très en dessous ; la limite sert de garde-fou contre un corps hostile,
// refusé AVANT lecture (Traefik ne plafonne pas le corps en amont).
const MAX_SCREENSHOT_BODY_BYTES = 15_000_000 + 64 * 1024;

export const POST = withOwnerAuth(
  async (request: NextRequest, _ctx, owner) => {
    const t = await getT();
    const target = resolveImportHousehold(owner, t);
    if (target instanceof NextResponse) return target;
    const { householdId } = target;

    try {
      // Valider AVANT de consommer le quota : un corps invalide ne coûte rien.
      const body = await request.json().catch(() => null);
      const parsed = buildImportScreenshotSchema(t).safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? t.api.invalidData, code: "INVALID_DATA" },
          { status: 400 },
        );
      }

      const quotaResponse = await enforceImportQuota(householdId);
      if (quotaResponse) return quotaResponse;

      const formData = await extractRecipeFromImages(parsed.data.images, { householdId });
      return NextResponse.json(formData);
    } catch (error) {
      console.error("[import/screenshot] Error:", error);
      // Contrat d'erreur commun aux trois voies d'import : `{ error, code }`, le
      // client (ImportSelector) ne mappe que par `code`.
      const status = (error as { status?: number }).status;
      if (status === 429) {
        return NextResponse.json(
          { error: t.import.errorRateLimit, code: "RATE_LIMIT" },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: t.api.screenshotExtractFailed, code: "EXTRACTION_FAILED" },
        { status: 422 },
      );
    }
  },
  {
    maxBodyBytes: MAX_SCREENSHOT_BODY_BYTES,
    // Opt-out garde démo : extraction IA sans écriture (le visiteur démo importe
    // comme n'importe quel membre, sous le quota du foyer démo).
    allowDemoMutation: true,
  },
);
