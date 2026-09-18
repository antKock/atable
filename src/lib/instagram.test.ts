import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseInstagramUrl,
  extractEmbedCaption,
  extractOgCaption,
  readInstagramDirect,
  resolveShareLink,
  decodeEntities,
  directFailureLabel,
} from "./instagram";

// Fixtures : extraits des pages publiques de trois reels publics (@marmiton_org
// DCJe4hFIGzC et Cn6qcPXrOiz, @iletaitunefoislapatisserie C2VRw5ltJ37), lus
// sans connexion le 2026-09-18 — aucune donnée d'utilisateur.
const fixture = (name: string) => readFileSync(join(__dirname, "../test/instagram", name), "utf8");

describe("parseInstagramUrl", () => {
  it.each([
    ["https://www.instagram.com/p/DCJe4hFIGzC/", "DCJe4hFIGzC"],
    ["https://www.instagram.com/reel/DCJe4hFIGzC/?igsh=MWZ5bHh1", "DCJe4hFIGzC"],
    ["https://www.instagram.com/reels/DCJe4hFIGzC/", "DCJe4hFIGzC"],
    ["https://www.instagram.com/marmiton_org/reel/DCJe4hFIGzC/", "DCJe4hFIGzC"],
    ["https://www.instagram.com/marmiton_org/p/DCJe4hFIGzC", "DCJe4hFIGzC"],
    ["https://instagram.com/tv/Cn6qcPXrOiz/?utm_source=ig_web_copy_link", "Cn6qcPXrOiz"],
    ["https://m.instagram.com/reel/C2VRw5ltJ37", "C2VRw5ltJ37"],
    ["https://instagr.am/p/C2VRw5ltJ37/", "C2VRw5ltJ37"],
  ])("%s → %s", (url, code) => {
    expect(parseInstagramUrl(url)).toEqual({ kind: "post", code });
  });

  it("lien de partage court : à résoudre par redirection", () => {
    expect(parseInstagramUrl("https://www.instagram.com/share/reel/BAabc123/")).toEqual({
      kind: "share",
      path: "/share/reel/BAabc123/",
    });
  });

  it.each([
    "https://www.instagram.com/marmiton_org/",
    "https://www.instagram.com/stories/marmiton_org/123/",
    "https://www.instagram.com/explore/tags/recette/",
    "https://www.instagram.com/reel/",
    "https://example.com/reel/DCJe4hFIGzC/",
    "pas une url",
  ])("%s → null (pas une publication)", (url) => {
    expect(parseInstagramUrl(url)).toBeNull();
  });
});

describe("extraction", () => {
  it("entités HTML : hexadécimales, décimales, nommées, emoji", () => {
    expect(decodeEntities("c&#xe0;s &#064;x &amp; &quot;y&quot; &#x1f34b;")).toBe(
      'càs @x & "y" 🍋',
    );
  });

  it("embed : légende complète, retours à la ligne conservés, sans le nom du compte", () => {
    const caption = extractEmbedCaption(fixture("embed-DCJe4hFIGzC.html"));
    expect(caption).toMatch(/^Si tu cherches une idée de recette/);
    expect(caption).toContain(
      "Les ingrédients :\n- 6 petites pommes de terre\n- 15g de beurre fondu",
    );
    expect(caption).toContain("- 30g d’emmental râpé");
    expect(caption).toContain("Inspiration de @charlie.ma.vie");
    expect(caption).toMatch(/#yummyfood$/);
    expect(caption).not.toContain("marmiton_org\n");
    expect(caption).not.toMatch(/Voir les|commentaires/);
  });

  it("embed : légende longue, sections conservées", () => {
    const caption = extractEmbedCaption(fixture("embed-C2VRw5ltJ37.html"))!;
    expect(caption).toContain("Pâte sablée :\n170 g de beurre");
    expect(caption).toContain("Garniture :\n4 œufs");
  });

  it("og:description : préfixe « likes, comments » retiré, texte identique à l'embed", () => {
    for (const id of ["DCJe4hFIGzC", "Cn6qcPXrOiz", "C2VRw5ltJ37"]) {
      const og = extractOgCaption(fixture(`reel-${id}.html`));
      const embed = extractEmbedCaption(fixture(`embed-${id}.html`));
      expect(og).not.toMatch(/likes|comments/);
      expect(og).toBe(embed);
    }
  });

  it("page sans légende (publication introuvable, mur de connexion) → null", () => {
    expect(extractEmbedCaption("<html><body><div class='Embed'></div></body></html>")).toBeNull();
    expect(
      extractOgCaption(
        '<meta property="og:description" content="Create an account or log in to Instagram" />',
      ),
    ).toBeNull();
    expect(extractOgCaption("<html></html>")).toBeNull();
  });
});

describe("readInstagramDirect", () => {
  const html = (body: string, status = 200) => new Response(body, { status });
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("page embed OK : une seule lecture, voie embed", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(html(fixture("embed-DCJe4hFIGzC.html")));
    const r = await readInstagramDirect("DCJe4hFIGzC");
    expect(r).toMatchObject({ ok: true, page: "embed", reasons: {} });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://www.instagram.com/p/DCJe4hFIGzC/embed/captioned/");
    expect((init as RequestInit).redirect).toBe("manual");
  });

  it("embed sans légende → page du reel (og), la raison de l'embed est gardée", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(html("<html></html>"))
      .mockResolvedValueOnce(html(fixture("reel-C2VRw5ltJ37.html")));
    const r = await readInstagramDirect("C2VRw5ltJ37");
    expect(r).toMatchObject({ ok: true, page: "og", reasons: { embed: "no_caption" } });
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe("https://www.instagram.com/reel/C2VRw5ltJ37/");
  });

  it("429 puis redirection vers la connexion → échec, raisons par page", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(html("", 429))
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "/accounts/login/" } }),
      );
    const r = await readInstagramDirect("DCJe4hFIGzC");
    expect(r).toEqual({ ok: false, reasons: { embed: "http_429", og: "login_wall" } });
    expect(directFailureLabel(r.reasons)).toBe("http_429/login_wall");
  });

  it("délai dépassé et erreur réseau : ne lève jamais", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(Object.assign(new Error("t"), { name: "TimeoutError" }))
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    const r = await readInstagramDirect("DCJe4hFIGzC");
    expect(r).toEqual({ ok: false, reasons: { embed: "timeout", og: "network" } });
  });

  it("légende trop courte : voie suivante, texte gardé en dernier recours", async () => {
    const short =
      '<div class="Caption"><a class="CaptionUsername" href="#">x</a><br />Miam 😋</div>';
    vi.mocked(fetch).mockResolvedValueOnce(html(short)).mockResolvedValueOnce(html("", 500));
    const r = await readInstagramDirect("DCJe4hFIGzC");
    expect(r).toEqual({
      ok: false,
      reasons: { embed: "too_short", og: "http_500" },
      short: { caption: "Miam 😋", page: "embed" },
    });
  });
});

describe("resolveShareLink", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("lit la redirection vers la publication sans la suivre", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://www.instagram.com/reel/DCJe4hFIGzC/?igsh=abc" },
      }),
    );
    expect(await resolveShareLink("/share/reel/BAabc/")).toBe("DCJe4hFIGzC");
  });

  it("redirection vers la connexion ou erreur → null", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "/accounts/login/?next=x" } }),
      )
      .mockRejectedValueOnce(new Error("boom"));
    expect(await resolveShareLink("/share/reel/BAabc/")).toBeNull();
    expect(await resolveShareLink("/share/reel/BAabc/")).toBeNull();
  });
});
