import { NextRequest, NextResponse } from "next/server";
import { buildImportUrlSchema } from "@/lib/schemas/import";
import {
  extractRecipeFromUrl,
  ImportError,
  URL_IMPORT_BUDGET_MS,
  type InstagramReadReport,
} from "@/lib/import";
import { isInstagramUrl } from "@/lib/instagram";
import { enforceImportQuota } from "@/lib/import-quota";
import { withOwnerAuth } from "@/lib/api/with-owner-auth";
import { resolveImportHousehold } from "@/lib/api/import-household";
import { withApiEventExtra, type ApiEventExtra } from "@/lib/events/api-call";
import { getT } from "@/lib/i18n/server";

/** Hôte du site importé, sans `www.` — pour le journal (#28) : savoir OÙ l'import échoue. */
function siteOf(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function igExtra(r: InstagramReadReport): ApiEventExtra {
  return {
    ig_path: r.path,
    ...(r.fallback ? { ig_fallback: r.fallback } : {}),
    ig_read_ms: r.readMs,
  };
}

export const POST = withOwnerAuth(
  async (request: NextRequest, _ctx, owner) => {
    const t = await getT();
    const target = resolveImportHousehold(owner, t);
    if (target instanceof NextResponse) return target;
    const { householdId } = target;

    // Valider AVANT de consommer le quota : une URL invalide ne coûte rien.
    const body = await request.json().catch(() => null);
    const site = siteOf((body as { url?: unknown } | null)?.url);
    // `api.called` porte le site quelle que soit l'issue (succès, 4xx, 5xx), et
    // pour Instagram la voie de lecture de la légende (catégories, jamais l'URL).
    let ig: InstagramReadReport | undefined;
    const response = await handle(body, t, householdId, (r) => (ig = r));
    // Budget d'import dépassé pendant la lecture (Apify lent) : la voie n'a pas
    // eu le temps de se rapporter, l'échec compte quand même.
    if (!ig && response.status === 504 && site && isInstagramUrl(`https://${site}`)) {
      ig = { path: "failed", fallback: "deadline", readMs: URL_IMPORT_BUDGET_MS };
    }
    const extra: ApiEventExtra = {
      ...(site ? { site } : {}),
      ...(ig ? igExtra(ig) : {}),
    };
    return Object.keys(extra).length ? withApiEventExtra(response, extra) : response;
  },
  {
    // Opt-out garde démo : extraction IA sans écriture (le visiteur démo importe
    // comme n'importe quel membre, sous le quota du foyer démo).
    allowDemoMutation: true,
  },
);

async function handle(
  body: unknown,
  t: Awaited<ReturnType<typeof getT>>,
  householdId: string,
  onInstagramRead: (report: InstagramReadReport) => void,
): Promise<NextResponse> {
  try {
    const parsed = buildImportUrlSchema(t).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? t.validation.urlInvalid,
          code: "INVALID_DATA",
        },
        { status: 400 },
      );
    }

    const quotaResponse = await enforceImportQuota(householdId);
    if (quotaResponse) return quotaResponse;

    const formData = await extractRecipeFromUrl(parsed.data.url, {
      householdId,
      onInstagramRead,
    });
    return NextResponse.json(formData);
  } catch (error) {
    console.error("[import/url] Error:", error);

    if (error instanceof ImportError) {
      const status = error.code === "SITE_BLOCKED" ? 422 : error.code === "TIMEOUT" ? 504 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    // OpenAI SDK attaches status on rate-limit errors
    const apiStatus = (error as { status?: number }).status;
    if (apiStatus === 429) {
      return NextResponse.json({ error: "rate_limit", code: "RATE_LIMIT" }, { status: 429 });
    }

    return NextResponse.json(
      { error: "extraction_failed", code: "EXTRACTION_FAILED" },
      { status: 422 },
    );
  }
}
