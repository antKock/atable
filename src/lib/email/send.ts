// Envoi des emails de récupération d'accès (#14, Lot 2).
//
// Deux transports :
//   - RESEND_API_KEY absent (E2E, dev sans clé) → no-op loggé. C'est LE mode
//     des tests : ils lisent/écrivent les codes en DB, jamais d'email réel.
//   - RESEND_API_KEY présent → Resend (domaine mijote.anthonykocken.fr vérifié,
//     expéditeur EMAIL_FROM). ⚠️ PAS ENCORE BRANCHÉ : le template HTML attend
//     l'arbitrage d'Anthony entre les deux propositions de
//     docs/specs/foyer/emails/ — le transport réel arrive avec le template
//     retenu, dans ce fichier, sans changer l'interface.

export type RecoveryEmailKind = "recovery" | "merge";

export type RecoveryEmailPayload = {
  magicLink: string;
  code: string;
  kind: RecoveryEmailKind;
};

export async function sendRecoveryEmail(
  to: string,
  payload: RecoveryEmailPayload,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(
      `[email] transport no-op (RESEND_API_KEY absent) — ${payload.kind} pour ${to} : ${payload.magicLink} · code ${payload.code}`,
    );
    return;
  }

  // TODO(arbitrage template) : brancher Resend avec le template retenu.
  console.error(
    "[email] transport Resend non branché — template en attente d'arbitrage (docs/specs/foyer/emails/), email NON envoyé",
  );
}
