import { NextRequest, NextResponse } from "next/server";
import { isBearerAuthorized } from "@/lib/cron-auth";

// Routes /api/admin/* du veilleur (#27) : le proxy exige déjà le Bearer
// ADMIN_API_SECRET (repli BATCH_ENRICH_SECRET) ; on le revérifie dans la route
// pour ne pas dépendre du proxy (défense en profondeur, comme batch-enrich).
export function rejectUnlessAdmin(request: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_API_SECRET || process.env.BATCH_ENRICH_SECRET;
  if (!isBearerAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
