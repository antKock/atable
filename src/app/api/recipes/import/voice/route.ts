import { NextRequest, NextResponse } from "next/server";
import { MAX_VOICE_FILE_SIZE, buildImportVoiceSchema } from "@/lib/schemas/import";
import { extractRecipeFromVoice, ImportError, type ImportTrace } from "@/lib/import";
import { enforceImportQuota } from "@/lib/import-quota";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { resolveImportHousehold } from "@/lib/api/import-household";
import { getT } from "@/lib/i18n/server";
import { keepImportSample } from "@/lib/import-pool/samples";

// Marge pour l'enveloppe multipart autour du fichier audio (MAX_VOICE_FILE_SIZE).
// Corps refusé AVANT lecture (Traefik ne plafonne pas le corps en amont).
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const POST = withOwnerAuth(
  async (request: NextRequest, _ctx, owner) => {
    const t = await getT();
    const target = resolveImportHousehold(owner, t);
    if (target instanceof NextResponse) return target;
    const { householdId } = target;

    const trace: ImportTrace = {};
    const { response, audio } = await handle(request, t, householdId, trace);
    if (!audio) return response;
    // Envoi gardé 30 jours (sauf refus) — docs/specs/ocr-appareil/01-conservation-imports.md.
    return keepImportSample({
      owner,
      householdId,
      method: "voice",
      response,
      trace,
      files: async () => [
        {
          name: `audio.${audioExtension(audio.type)}`,
          body: new Uint8Array(await audio.arrayBuffer()),
          contentType: audio.type || "application/octet-stream",
        },
      ],
    });
  },
  {
    maxBodyBytes: MAX_VOICE_FILE_SIZE + MULTIPART_OVERHEAD_BYTES,
    // Opt-out garde démo : extraction IA sans écriture (le visiteur démo importe
    // comme n'importe quel membre, sous le quota du foyer démo).
    allowDemoMutation: true,
  },
);

async function handle(
  request: NextRequest,
  t: Awaited<ReturnType<typeof getT>>,
  householdId: string,
  trace: ImportTrace,
): Promise<{ response: NextResponse; audio?: File }> {
  let audio: File | undefined;
  try {
    // Valider AVANT de consommer le quota : un fichier invalide ne coûte rien.
    // Même schéma zod que le reste des imports (schemas/import.ts).
    const formData = await request.formData().catch(() => null);
    const parsed = buildImportVoiceSchema(t).safeParse(formData?.get("audio"));
    if (!parsed.success) {
      return {
        response: NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? t.api.audioRequired, code: "INVALID_DATA" },
          { status: 400 },
        ),
      };
    }

    const quotaResponse = await enforceImportQuota(householdId);
    if (quotaResponse) return { response: quotaResponse };

    audio = parsed.data;
    const result = await extractRecipeFromVoice(audio, { householdId, trace });
    return { response: NextResponse.json(result), audio };
  } catch (error) {
    console.error("[import/voice] Error:", error);

    if (error instanceof ImportError) {
      return {
        response: NextResponse.json({ error: error.message, code: error.code }, { status: 422 }),
        audio,
      };
    }

    const apiStatus = (error as { status?: number }).status;
    if (apiStatus === 429) {
      return {
        response: NextResponse.json({ error: "rate_limit", code: "RATE_LIMIT" }, { status: 429 }),
        audio,
      };
    }

    return {
      response: NextResponse.json(
        { error: "extraction_failed", code: "EXTRACTION_FAILED" },
        { status: 422 },
      ),
      audio,
    };
  }
}

/** Extension du fichier gardé, d'après le type MIME reçu (`;codecs=…` ignoré). */
function audioExtension(type: string): string {
  const base = type.split(";")[0];
  return base === "audio/mp4"
    ? "m4a"
    : base === "audio/ogg"
      ? "ogg"
      : base === "audio/mpeg"
        ? "mp3"
        : "webm";
}
