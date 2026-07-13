// Envoi des emails de récupération d'accès (#14, Lot 2).
//
// Deux transports :
//   - RESEND_API_KEY absent (E2E, dev sans clé) → no-op loggé. C'est LE mode
//     des tests : ils lisent/écrivent les codes en DB, jamais d'email réel
//     (la clé est pinnée à vide dans e2e/helpers/env.ts).
//   - RESEND_API_KEY présent → Resend en fetch direct (pas de SDK — décision
//     n°1, minimiser la dépendance), domaine mijote.anthonykocken.fr vérifié,
//     expéditeur EMAIL_FROM.
//
// Template : proposition A « Carte Mijote » retenue par Anthony (2026-07-10),
// copy ajustée — référence visuelle dans docs/specs/foyer/emails/. Markup
// tables + styles inline ; le dégradé du bouton retombe sur l'olive plein là
// où linear-gradient n'est pas supporté (Outlook) ; aucune webfont embarquée.

export type RecoveryEmailKind = "recovery" | "merge";

export type RecoveryEmailPayload = {
  magicLink: string;
  code: string;
  kind: RecoveryEmailKind;
};

const COPY: Record<
  RecoveryEmailKind,
  { subject: string; title: string; body: string; cta: string }
> = {
  recovery: {
    subject: "Retrouve ton carnet sur Mijote",
    title: "Retrouve ton carnet",
    body: "Pour retrouver ton carnet Mijote sur un nouvel appareil, appuie sur le bouton, et c'est tout.",
    cta: "Ouvrir Mijote",
  },
  merge: {
    subject: "On réunit tes carnets",
    title: "On réunit tes carnets",
    body: "Tu as saisi cet email depuis ton profil. Confirme pour réunir tes deux accès en une seule identité.",
    cta: "Réunir mes carnets",
  },
};

export function renderRecoveryEmail(payload: RecoveryEmailPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const { magicLink, code, kind } = payload;
  const copy = COPY[kind];

  const text = [
    copy.title,
    "",
    `${copy.body} Ouvre ce lien : ${magicLink}`,
    "",
    `Tu lis ce mail sur un autre appareil ? Saisis plutôt ce code dans Mijote : ${code}`,
    "",
    "Ce lien et ce code expirent dans 15 minutes.",
    "Tu n'as rien demandé ? Ignore ce mail — ton carnet reste bien au chaud.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F1E8;">
  <tr>
    <td align="center" style="padding:36px 16px 48px;">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:480px; max-width:100%;">
        <tr>
          <td align="center" style="padding:0 0 20px;">
            <span style="font-family:Fraunces, Georgia, 'Times New Roman', serif; font-size:30px; font-weight:700; font-style:italic; letter-spacing:-0.02em; color:#6E7A38;">Mijote</span>
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF; border:1px solid #E5DED6; border-radius:14px; padding:36px 32px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="font-family:Fraunces, Georgia, 'Times New Roman', serif; font-size:26px; font-weight:600; letter-spacing:-0.02em; color:#1A1A18; padding:0 0 14px;">
                  ${copy.title}
                </td>
              </tr>
              <tr>
                <td align="center" style="font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; line-height:1.6; color:#6B6E68; padding:0 8px 26px;">
                  ${copy.body}
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 0 28px;">
                  <a href="${magicLink}"
                     style="display:inline-block; background:linear-gradient(155deg,#7d8c40,#5d6a2e); background-color:#6E7A38; color:#FFFFFF; font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:17px; font-weight:600; text-decoration:none; padding:16px 40px; border-radius:27px;">
                    ${copy.cta}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="background-color:#EEF2E4; border-radius:14px; padding:18px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:13px; line-height:1.5; color:#1A1A18; padding:0 0 10px;">
                        <strong>Tu lis ce mail sur un autre appareil&nbsp;?</strong><br>
                        <span style="color:#6B6E68;">Saisis plutôt ce code dans Mijote&nbsp;:</span>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="font-family:'DM Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size:30px; font-weight:500; letter-spacing:0.35em; color:#1A1A18; padding:0 0 2px 0.35em;">
                        ${code}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12.5px; color:#6B6E68; padding:18px 0 0;">
                  Ce lien et ce code expirent dans 15&nbsp;minutes.
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.6; color:#6B6E68; padding:22px 24px 0;">
            Tu n'as rien demandé&nbsp;? Ignore ce mail — ton carnet reste bien au chaud.<br>
            <a href="https://mijote.anthonykocken.fr" style="color:#6E7A38; text-decoration:none;">mijote.anthonykocken.fr</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: copy.subject, html, text };
}

export async function sendRecoveryEmail(
  to: string,
  payload: RecoveryEmailPayload,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[email] transport no-op (RESEND_API_KEY absent) — ${payload.kind} pour ${to} : ${payload.magicLink} · code ${payload.code}`,
    );
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("email: EMAIL_FROM manquant alors que RESEND_API_KEY est défini");
  }

  const { subject, html, text } = renderRecoveryEmail(payload);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) {
    // Le corps d'erreur Resend est utile (domaine, quota…) et ne contient pas
    // les secrets ; l'appelant décide quoi en faire (la route /request le
    // capture SANS changer sa réponse 200 — anti-énumération).
    const detail = await res.text().catch(() => "");
    throw new Error(`email: envoi Resend échoué (HTTP ${res.status}) ${detail}`.trim());
  }
}
