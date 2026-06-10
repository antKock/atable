import { NextResponse } from "next/server";
import { importRateLimit } from "@/lib/redis";
import { t } from "@/lib/i18n/fr";

/**
 * Daily AI-import quota, keyed by household. Returns a 429 response when the
 * quota is exhausted, null when the request may proceed. Fails open if Redis
 * is unreachable (losing protection during an outage beats breaking imports).
 */
export async function enforceImportQuota(
  householdId: string,
): Promise<NextResponse | null> {
  try {
    const { success } = await importRateLimit.limit(householdId);
    if (!success) {
      return NextResponse.json(
        { error: t.import.errorImportQuota, code: "IMPORT_QUOTA" },
        { status: 429 },
      );
    }
  } catch (err) {
    console.error("[import] quota check failed (Redis down?), failing open:", err);
  }
  return null;
}
