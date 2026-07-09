import { NextResponse } from "next/server";
import {
  importRateLimit,
  recipeCreateRateLimit,
  householdCreateRateLimit,
} from "@/lib/redis";
import { t } from "@/lib/i18n/fr";
import type { Ratelimit } from "@upstash/ratelimit";

/**
 * Shared quota check: returns a 429 response when the limit is exhausted,
 * null when the request may proceed. Fails open if Redis is unreachable
 * (losing protection during an outage beats breaking the app).
 */
async function enforceQuota(
  limiter: Ratelimit,
  key: string,
  message: string,
  code: string,
): Promise<NextResponse | null> {
  try {
    const { success } = await limiter.limit(key);
    if (!success) {
      return NextResponse.json({ error: message, code }, { status: 429 });
    }
  } catch (err) {
    console.error(`[quota:${code}] check failed (Redis down?), failing open:`, err);
  }
  return null;
}

/** Daily AI-import quota (url/screenshot/voice), keyed by household. */
export function enforceImportQuota(householdId: string): Promise<NextResponse | null> {
  return enforceQuota(importRateLimit, householdId, t.import.errorImportQuota, "IMPORT_QUOTA");
}

/** Recipe creation quota (each create triggers AI enrichment), keyed by household. */
export function enforceRecipeCreateQuota(householdId: string): Promise<NextResponse | null> {
  return enforceQuota(recipeCreateRateLimit, householdId, t.join.rateLimited, "RECIPE_QUOTA");
}

/** Household creation quota, keyed by IP (the route is unauthenticated). */
export function enforceHouseholdCreateQuota(ip: string): Promise<NextResponse | null> {
  return enforceQuota(householdCreateRateLimit, ip, t.join.rateLimited, "HOUSEHOLD_QUOTA");
}
