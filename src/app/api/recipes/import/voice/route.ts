import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { MAX_VOICE_FILE_SIZE, VALID_VOICE_MIME_TYPES } from "@/lib/schemas/import";
import { extractRecipeFromVoice, ImportError } from "@/lib/import";

export async function POST(request: Request) {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const result = await extractRecipeFromVoice(audio);
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
}
