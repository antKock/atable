import { NextResponse } from "next/server";
import { BUILD_ID } from "@/lib/version";

// Always answered by the live deployment, never cached — so a stale client
// always sees the current build id (and the WKWebView's NSURLCache can't hand
// back an old value).
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { buildId: BUILD_ID },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
