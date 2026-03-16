import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { ImportUrlSchema } from "@/lib/schemas/import";
import { extractRecipeFromUrl, ImportError } from "@/lib/import";

export async function POST(request: Request) {
  try {
    const hdrs = await headers();
    const householdId = hdrs.get("x-household-id");
    if (!householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = ImportUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "URL invalide" },
        { status: 400 },
      );
    }

    const formData = await extractRecipeFromUrl(parsed.data.url);
    return NextResponse.json(formData);
  } catch (error) {
    console.error("[import/url] Error:", error);

    if (error instanceof ImportError) {
      const status = error.code === "SITE_BLOCKED" ? 422 : 502;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }

    // OpenAI SDK attaches status on rate-limit errors
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
