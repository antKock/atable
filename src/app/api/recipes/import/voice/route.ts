import { NextResponse } from "next/server";
import { MAX_VOICE_FILE_SIZE, VALID_VOICE_MIME_TYPES } from "@/lib/schemas/import";
import { extractRecipeFromVoice, ImportError } from "@/lib/import";
import { enforceImportQuota } from "@/lib/import-quota";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { memberHouseholdIds } from "@/lib/auth/owner-context";

export const POST = withOwnerAuth(async (request: Request, _ctx, owner) => {
  // Quota/coût IA rattachés au premier foyer membre (l'import précède le choix
  // du foyer). Invité (lecture seule) refusé.
  const memberIds = memberHouseholdIds(owner);
  if (memberIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const householdId = memberIds[0];

  const quotaResponse = await enforceImportQuota(householdId);
  if (quotaResponse) return quotaResponse;

  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!audio || !(audio instanceof File)) {
      return NextResponse.json(
        { error: "Fichier audio requis" },
        { status: 400 },
      );
    }

    if (audio.size > MAX_VOICE_FILE_SIZE) {
      return NextResponse.json(
        { error: "Fichier audio trop volumineux (max 10 Mo)" },
        { status: 400 },
      );
    }

    const mimeBase = audio.type.split(";")[0];
    if (!VALID_VOICE_MIME_TYPES.includes(mimeBase as typeof VALID_VOICE_MIME_TYPES[number])) {
      return NextResponse.json(
        { error: "Format audio non supporté" },
        { status: 400 },
      );
    }

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
});
