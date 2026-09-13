import { NextRequest, NextResponse } from "next/server";
import { MAX_VOICE_FILE_SIZE, buildImportVoiceSchema } from "@/lib/schemas/import";
import { extractRecipeFromVoice, ImportError } from "@/lib/import";
import { enforceImportQuota } from "@/lib/import-quota";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { resolveImportHousehold } from "@/lib/api/import-household";
import { getT } from "@/lib/i18n/server";

// Marge pour l'enveloppe multipart autour du fichier audio (MAX_VOICE_FILE_SIZE).
// Corps refusé AVANT lecture (Traefik ne plafonne pas le corps en amont).
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const POST = withOwnerAuth(async (request: NextRequest, _ctx, owner) => {
  const t = await getT();
  const target = resolveImportHousehold(owner, t);
  if (target instanceof NextResponse) return target;
  const { householdId } = target;

  try {
    // Valider AVANT de consommer le quota : un fichier invalide ne coûte rien.
    // Même schéma zod que le reste des imports (schemas/import.ts).
    const formData = await request.formData().catch(() => null);
    const parsed = buildImportVoiceSchema(t).safeParse(formData?.get("audio"));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? t.api.audioRequired, code: "INVALID_DATA" },
        { status: 400 },
      );
    }
    const audio = parsed.data;

    const quotaResponse = await enforceImportQuota(householdId);
    if (quotaResponse) return quotaResponse;

    const result = await extractRecipeFromVoice(audio, { householdId });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[import/voice] Error:", error);

    if (error instanceof ImportError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 },
      );
    }

    const apiStatus = (error as { status?: number }).status;
    if (apiStatus === 429) {
      return NextResponse.json(
        { error: "rate_limit", code: "RATE_LIMIT" },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "extraction_failed", code: "EXTRACTION_FAILED" },
      { status: 422 },
    );
  }
}, {
  maxBodyBytes: MAX_VOICE_FILE_SIZE + MULTIPART_OVERHEAD_BYTES,
  // Opt-out garde démo : extraction IA sans écriture (le visiteur démo importe
  // comme n'importe quel membre, sous le quota du foyer démo).
  allowDemoMutation: true,
});
