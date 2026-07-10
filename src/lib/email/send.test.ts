import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderRecoveryEmail, sendRecoveryEmail } from "./send";

const PAYLOAD = {
  magicLink: "https://mijote.test/recover/VERtkn234ABCDe56",
  code: "482913",
} as const;

describe("renderRecoveryEmail", () => {
  it("récup : objet, lien, code et copy arbitrée (proposition A)", () => {
    const { subject, html, text } = renderRecoveryEmail({ ...PAYLOAD, kind: "recovery" });
    expect(subject).toBe("Retrouve ton foyer sur Mijote");
    expect(html).toContain(PAYLOAD.magicLink);
    expect(html).toContain("482913");
    expect(html).toContain("appuie sur le bouton, et c'est tout");
    expect(html).toContain("15&nbsp;minutes");
    // Repli texte : lien + code aussi
    expect(text).toContain(PAYLOAD.magicLink);
    expect(text).toContain("482913");
  });

  it("fusion : même gabarit, objet et copy dédiés", () => {
    const { subject, html } = renderRecoveryEmail({ ...PAYLOAD, kind: "merge" });
    expect(subject).toBe("On réunit tes foyers");
    expect(html).toContain("réunir tes deux accès en une seule identité");
    expect(html).toContain("Réunir mes foyers");
    expect(html).toContain(PAYLOAD.magicLink);
  });
});

describe("sendRecoveryEmail — sélection de transport", () => {
  const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("no-op sans RESEND_API_KEY (contrat E2E : jamais d'email réel)", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await sendRecoveryEmail("a@ex.fr", { ...PAYLOAD, kind: "recovery" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clé présente → POST Resend avec from/to/subject/html/text", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Mijote <acces@mijote.anthonykocken.fr>");
    await sendRecoveryEmail("a@ex.fr", { ...PAYLOAD, kind: "recovery" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe("Mijote <acces@mijote.anthonykocken.fr>");
    expect(body.to).toBe("a@ex.fr");
    expect(body.subject).toBe("Retrouve ton foyer sur Mijote");
    expect(body.html).toContain(PAYLOAD.magicLink);
    expect(body.text).toContain("482913");
  });

  it("clé présente sans EMAIL_FROM → erreur explicite, pas d'appel réseau", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "");
    await expect(
      sendRecoveryEmail("a@ex.fr", { ...PAYLOAD, kind: "recovery" }),
    ).rejects.toThrow(/EMAIL_FROM/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("HTTP non-2xx Resend → erreur propagée (l'appelant garde sa réponse uniforme)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "Mijote <acces@mijote.anthonykocken.fr>");
    fetchMock.mockResolvedValueOnce(new Response("quota", { status: 429 }));
    await expect(
      sendRecoveryEmail("a@ex.fr", { ...PAYLOAD, kind: "recovery" }),
    ).rejects.toThrow(/429/);
  });
});
