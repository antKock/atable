import { NextRequest, NextResponse, after } from "next/server";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { getClientIp } from "@/lib/request-ip";
import { RecoveryEmailSchema } from "@/lib/schemas/household";
import { recoveryIpRateLimit, recoveryEmailRateLimit } from "@/lib/redis";
import { findOwnerByEmail, createLoginToken } from "@/lib/queries/recovery";
import { sendRecoveryEmail } from "@/lib/email/send";
import { withPublicRoute } from "@/lib/api/with-public-route";
import { parseJsonBody } from "@/lib/api/body";
import { getRequestOrigin } from "@/lib/request-origin";

// Demande de récupération (#14, §4) — route PUBLIQUE (proxy).
//
// ANTI-ÉNUMÉRATION STRICTE : la réponse est un 200 identique que l'email
// existe ou non (timing best effort). Même un échec du chemin « email
// connu » (DB, envoi) répond 200 : un 500 réservé aux adresses existantes
// serait un oracle. Les erreurs partent dans Sentry, pas dans la réponse.
export const POST = withPublicRoute(async (request: NextRequest, _ctx, t) => {
  // Erreur de FORMAT : indépendante de l'existence, sûre à révéler.
  const parsed = await parseJsonBody(request, {
    t,
    schema: RecoveryEmailSchema,
    pick: (b) => (b as { email?: unknown } | null)?.email,
    unreadableMessage: (t) => t.profile.emailInvalid,
    invalidMessage: (t) => t.profile.emailInvalid,
  });
  if (parsed instanceof NextResponse) return parsed;
  const email = parsed.data;

  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  const { success: ipAllowed } = await recoveryIpRateLimit.limit(ip);
  if (!ipAllowed) {
    return NextResponse.json({ error: t.recovery.rateLimited }, { status: 429 });
  }
  // Par adresse, que l'email existe OU NON : un 429 sélectif serait un oracle.
  const { success: emailAllowed } = await recoveryEmailRateLimit.limit(email);
  if (!emailAllowed) {
    return NextResponse.json({ error: t.recovery.rateLimited }, { status: 429 });
  }

  try {
    const owner = await findOwnerByEmail(email);
    if (owner) {
      const { token, code } = await createLoginToken(owner.id, "recovery");
      const magicLink = `${getRequestOrigin(request)}/recover/${token}`;
      // L'appel HTTP Resend part APRÈS la réponse (after) : c'est le plus
      // gros différentiel de timing entre email connu et inconnu — le
      // sortir du chemin de réponse resserre l'anti-énumération. Le token,
      // lui, reste créé en synchrone (les E2E le lisent dès le 200).
      after(async () => {
        try {
          await sendRecoveryEmail(email, { magicLink, code, kind: "recovery" });
        } catch (err) {
          Sentry.captureException(err);
          console.error("[recovery/request] envoi email échoué (post-réponse) :", err);
        }
      });
    }
  } catch (err) {
    Sentry.captureException(err);
    console.error("[recovery/request] échec du chemin email connu (réponse 200 conservée) :", err);
  }

  return NextResponse.json({ ok: true });
});
