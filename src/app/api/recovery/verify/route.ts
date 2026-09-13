import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/request-ip";
import { RecoveryEmailSchema } from "@/lib/schemas/household";
import { recoveryVerifyRateLimit } from "@/lib/redis";
import { findOwnerByEmail, verifyLoginCode, createOwnerSession } from "@/lib/queries/recovery";
import { getDeviceName } from "@/lib/auth/device-name";
import { signSession, setSessionCookie } from "@/lib/auth/session";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { parseJsonBody } from "@/lib/api/body";
import { z } from "zod";

const CODE_REGEX = /^\d{6}$/;
const VerifyBodySchema = z.object({
  email: RecoveryEmailSchema,
  code: z.string().regex(CODE_REGEX),
});

// Repli code 6 chiffres de la récup (#14, §4) — route PUBLIQUE. Le repli
// existe parce qu'un magic-link ouvert hors du WebView ne pose pas le cookie
// au bon endroit (jar WKWebView ≠ Safari) — ne pas « l'optimiser ».
//
// Message générique unique pour TOUT échec (email inconnu, code faux, token
// expiré/brûlé) : cette route ne doit pas servir d'oracle d'existence.
// Pas de fusion ici : simple reconnexion à l'owner (décision n°6).
export const POST = withPublicRoute(async (request: NextRequest, _ctx, t) => {
  const parsed = await parseJsonBody(request, {
    t,
    schema: VerifyBodySchema,
    unreadableMessage: (t) => t.recovery.codeInvalid,
    invalidMessage: (t) => t.recovery.codeInvalid,
  });
  if (parsed instanceof NextResponse) return parsed;
  const { email: parsedEmail, code } = parsed.data;

  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  const { success } = await recoveryVerifyRateLimit.limit(ip);
  if (!success) {
    return NextResponse.json({ error: t.recovery.rateLimited }, { status: 429 });
  }

  const owner = await findOwnerByEmail(parsedEmail);
  if (!owner) {
    return NextResponse.json({ error: t.recovery.codeInvalid }, { status: 400 });
  }

  const valid = await verifyLoginCode(owner.id, "recovery", code);
  if (!valid) {
    return NextResponse.json({ error: t.recovery.codeInvalid }, { status: 400 });
  }

  const session = await createOwnerSession(owner.id, getDeviceName(hdrs.get("user-agent") ?? ""));
  if (!session) {
    // Owner sans plus aucun foyer : rien à récupérer — même message générique.
    return NextResponse.json({ error: t.recovery.codeInvalid }, { status: 400 });
  }

  const token = await signSession({ sid: session.sessionId });
  // Cookie sur un 200 JSON (pas un 303) — fiable en WKWebView, comme join.
  const response = NextResponse.json({ ok: true, redirect: "/home" });
  setSessionCookie(response, token);
  return response;
});
