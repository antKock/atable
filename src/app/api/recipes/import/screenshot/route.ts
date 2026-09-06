import { NextResponse } from "next/server";
import { buildImportScreenshotSchema } from "@/lib/schemas/import";
import { extractRecipeFromImages } from "@/lib/import";
import { getT } from "@/lib/i18n/server";
import { enforceImportQuota } from "@/lib/import-quota";
import { withOwnerAuth, forbiddenResponse } from "@/lib/api/with-owner-auth";
import { memberHouseholdIds } from "@/lib/auth/owner-context";

// Plafond du corps JSON, cohérent avec MAX_BASE64_LENGTH (schemas/import.ts :
// 15 M caractères ≈ une image de 10 Mo) + enveloppe JSON. Le client
// redimensionne à 1280 px (~500 Ko base64 par image, 5 max) : en pratique on
// est très en dessous ; la limite sert de garde-fou contre un corps hostile,
// refusé AVANT lecture (Vercel plafonnait à 4,5 Mo, Traefik ne plafonne rien).
const MAX_SCREENSHOT_BODY_BYTES = 15_000_000 + 64 * 1024;

export const POST = withOwnerAuth(async (request: Request, _ctx, owner) => {
  const t = await getT();
  // Quota/coût IA rattachés au premier foyer membre (l'import précède le choix
  // du foyer). Invité (lecture seule) refusé.
  const memberIds = memberHouseholdIds(owner);
  if (memberIds.length === 0) {
    return forbiddenResponse(t);
  }
  const householdId = memberIds[0];

  const quotaResponse = await enforceImportQuota(householdId);
  if (quotaResponse) return quotaResponse;

  try {
    const body = await request.json();
    const parsed = buildImportScreenshotSchema(t).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? t.api.invalidData },
        { status: 400 },
      );
    }

    const formData = await extractRecipeFromImages(parsed.data.images, { householdId });
    return NextResponse.json(formData);
  } catch (error) {
    console.error("[import/screenshot] Error:", error);
    const status = (error as { status?: number }).status;
    if (status === 429) {
      return NextResponse.json(
        { error: t.import.errorRateLimit },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: t.api.screenshotExtractFailed },
      { status: 422 },
    );
  }
}, {
  maxBodyBytes: MAX_SCREENSHOT_BODY_BYTES,
  // Opt-out garde démo : extraction IA sans écriture (le visiteur démo importe
  // comme n'importe quel membre, sous le quota du foyer démo).
  allowDemoMutation: true,
});
