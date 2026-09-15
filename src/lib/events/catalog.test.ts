import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { apiRoutePattern, isEventName, isKnownDataTrack, isUuid } from "./catalog";

describe("catalog — helpers purs", () => {
  it("isEventName : allow-list stricte", () => {
    expect(isEventName("screen.viewed")).toBe(true);
    expect(isEventName("api.called")).toBe(true);
    expect(isEventName("recipe.viewed")).toBe(false); // un MOMENT (vue SQL), pas un fait
    expect(isEventName(42)).toBe(false);
  });

  it("isKnownDataTrack : identifiants fixes et préfixes dynamiques", () => {
    expect(isKnownDataTrack("import.url")).toBe(true);
    expect(isKnownDataTrack("home.carousel.season")).toBe(true);
    expect(isKnownDataTrack("hint.share.act")).toBe(true);
    expect(isKnownDataTrack("hint.share")).toBe(true);
    expect(isKnownDataTrack("library.filter.tag")).toBe(true);
    expect(isKnownDataTrack("import.magic")).toBe(false);
    expect(isKnownDataTrack("home.carousel.")).toBe(false);
  });

  it("apiRoutePattern : les segments uuid deviennent [id]", () => {
    expect(apiRoutePattern("/api/recipes/1b4e28ba-2fa1-11d2-883f-0016d3cca427/share")).toBe(
      "/api/recipes/[id]/share",
    );
    expect(
      apiRoutePattern(
        "/api/households/1b4e28ba-2fa1-11d2-883f-0016d3cca427/members/2b4e28ba-2fa1-11d2-883f-0016d3cca427",
      ),
    ).toBe("/api/households/[id]/members/[id]");
    expect(apiRoutePattern("/api/recipes/import/url")).toBe("/api/recipes/import/url");
  });

  it("isUuid", () => {
    expect(isUuid("1b4e28ba-2fa1-11d2-883f-0016d3cca427")).toBe(true);
    expect(isUuid("nope")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Garde-fou anti-dérive (spec §8.1) : les identifiants `data-track` posés dans
// le code sont tous au catalogue, et ceux que les vues SQL / requêtes
// référencent sont encore posés. Une vue orpheline = rouge.
// ---------------------------------------------------------------------------

const ROOT = join(__dirname, "../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|sql)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * `data-track="…"` littéraux du code, et les props `track="…"` des composants
 * qui les relaient (BackButton, RecipeCarousel, ConfirmDeleteDialog, MiniStrip).
 * Les valeurs calculées portent un préfixe `*` au catalogue.
 */
function dataTrackLiteralsInSrc(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of walk(join(ROOT, "src"))) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?:data-track|\btrack)=["']([a-z0-9_.*-]+)["']/g)) {
      const list = found.get(m[1]) ?? [];
      list.push(file.replace(ROOT + "/", ""));
      found.set(m[1], list);
    }
  }
  return found;
}

/** Préfixes dynamiques posés dans le code : `data-track={`hint.${…}`}`, `track={`home.carousel.${…}`}`. */
function dataTrackPrefixesInSrc(): Set<string> {
  const out = new Set<string>();
  for (const file of walk(join(ROOT, "src"))) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?:data-track|\btrack)=\{`([a-z0-9_.-]+)\$\{/g)) out.add(m[1]);
  }
  return out;
}

/** Cibles `target = '…'` / `target IN ('…')` référencées par les vues et requêtes. */
function targetsReferencedInSql(): Map<string, string> {
  const files: string[] = [];
  const views = join(ROOT, "supabase/migrations/052_events_views.sql");
  try {
    statSync(views);
    files.push(views);
  } catch {
    // Pas encore de vues (lot 2 non livré).
  }
  try {
    files.push(...walk(join(ROOT, "scripts/events")));
  } catch {
    // Pas encore de requêtes.
  }
  const out = new Map<string, string>();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(
      /props->>'target'\s*(?:=|IN)\s*\(?\s*((?:'[a-z0-9_.-]+'\s*,?\s*)+)\)?/g,
    )) {
      for (const t of m[1].matchAll(/'([a-z0-9_.-]+)'/g))
        out.set(t[1], file.replace(ROOT + "/", ""));
    }
    for (const m of text.matchAll(/props->>'target'\s+LIKE\s+'([a-z0-9_.-]+)%'/g)) {
      out.set(m[1] + "*", file.replace(ROOT + "/", ""));
    }
  }
  return out;
}

describe("catalog — anti-dérive (data-track ↔ code ↔ vues SQL)", () => {
  it("tout data-track posé dans le code est au catalogue", () => {
    const unknown: string[] = [];
    for (const [id, files] of dataTrackLiteralsInSrc()) {
      if (id === "none") continue;
      if (!isKnownDataTrack(id)) unknown.push(`${id} (${files.join(", ")})`);
    }
    for (const prefix of dataTrackPrefixesInSrc()) {
      if (!isKnownDataTrack(prefix + "x")) unknown.push(`${prefix}* (préfixe dynamique)`);
    }
    expect(unknown, "identifiants hors catalogue").toEqual([]);
  });

  it("toute cible référencée par une vue ou une requête est encore posée dans le code", () => {
    const posed = new Set(dataTrackLiteralsInSrc().keys());
    const prefixes = dataTrackPrefixesInSrc();
    const orphans: string[] = [];
    for (const [target, file] of targetsReferencedInSql()) {
      if (target.endsWith("*")) {
        const prefix = target.slice(0, -1);
        const ok =
          [...prefixes].some((p) => p.startsWith(prefix) || prefix.startsWith(p)) ||
          [...posed].some((p) => p.startsWith(prefix));
        if (!ok) orphans.push(`${target} (${file})`);
      } else if (!posed.has(target)) {
        orphans.push(`${target} (${file})`);
      }
    }
    expect(orphans, "cibles orphelines").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// La règle (décision du 2026-09-15 après les premières lectures prod) : tout
// élément cliquable porte un `data-track` (ou une prop `track`), sauf s'il
// hérite d'un conteneur nommé — auquel cas son fichier est déclaré ci-dessous
// avec le conteneur dont il hérite. Un nouveau bouton sans nom fait échouer la
// CI : la trace de secours `?button` est pour l'imprévu réel, pas pour l'oubli.
// ---------------------------------------------------------------------------

/** Fichiers dont les cliquables sans nom héritent d'un conteneur `data-track`. */
const INHERITS: Record<string, string> = {
  "src/components/recipes/FilterBar.tsx": "library.filter.* (options du panneau)",
  "src/components/recipes/form/PhotoManager.tsx": "recipe.add_photo (bouton d'ajout)",
  "src/components/recipes/import/ImportCard.tsx":
    "import.url / import.photo / import.voice (tuile)",
  "src/components/recipes/import/ImportSelector.tsx":
    "import.* (puces « ou plutôt », data-track calculé)",
  "src/components/recipes/import/UrlImporter.tsx": "import.url",
  "src/components/recipes/import/ScreenshotImporter.tsx": "import.photo",
  "src/components/recipes/import/VoiceImporter.tsx": "import.voice",
  "src/app/(landing)/support/content-fr.tsx": "support.links",
  "src/app/(landing)/support/content-en.tsx": "support.links",
  "src/app/(landing)/legal/confidentialite/content-fr.tsx": "legal.links",
  "src/app/(landing)/legal/confidentialite/content-en.tsx": "legal.links",
};

/** Hors périmètre du journal : admin (provider désactivé). */
const OUT_OF_SCOPE = ["src/app/admin/", "src/components/admin/"];

/**
 * Balises ouvrantes cliquables (`button`, `Button`, `Link`, `a href`) avec leurs
 * attributs, en respectant les accolades (`onClick={() => …}` contient un `>`).
 */
function clickableTags(text: string): { tag: string; attrs: string; line: number }[] {
  const out: { tag: string; attrs: string; line: number }[] = [];
  // Tout élément : les non-cliquables sont filtrés après lecture des attributs
  // (`role="button"` les rend cliquables ; un `onClick` dessus est une erreur).
  const re = /<([A-Za-z][A-Za-z0-9.]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let i = m.index + m[0].length;
    let depth = 0;
    while (i < text.length) {
      const c = text[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && text[i - 1] !== "=") break;
      i++;
    }
    const attrs = text.slice(m.index + m[0].length, i);
    // `<Link>` cité dans un commentaire (`// … rend un <Link>`) : pas du JSX.
    if (/^\s*\/\//m.test(text.slice(text.lastIndexOf("\n", m.index) + 1, m.index))) continue;
    const tag = m[1];
    const line = text.slice(0, m.index).split("\n").length;
    const clickable =
      tag === "button" ||
      tag === "Button" ||
      tag === "Link" ||
      (tag === "a" && /\bhref=/.test(attrs)) ||
      /\brole=["']button["']/.test(attrs);
    if (clickable) {
      out.push({ tag, attrs, line });
    } else if (/\bonClick=/.test(attrs) && /^(div|span|li|p|img|section|h[1-6]|td|tr)$/.test(tag)) {
      // Cliquable de fait, invisible au journal (le listener ne voit que
      // button / a / role=button) et inaccessible : refusé.
      out.push({ tag: `${tag} onClick (utiliser <button> ou role="button")`, attrs: "", line });
    }
  }
  return out;
}

describe("catalog — règle : tout cliquable est nommé", () => {
  it("le scanner voit role=button, ignore les commentaires, refuse onClick sur un div", () => {
    const sample = [
      "// rend un <Link> ou un <button>",
      '<button data-track="x.y">ok</button>',
      '<div role="button" onClick={() => go()}>sans nom</div>',
      "<span onClick={() => go()}>interdit</span>",
      '<Link href="/x">sans nom</Link>',
      "<a>pas un lien</a>",
    ].join("\n");
    const found = clickableTags(sample).map((t) => `${t.line}:${t.tag}`);
    expect(found).toEqual([
      "2:button",
      "3:div",
      '4:span onClick (utiliser <button> ou role="button")',
      "5:Link",
    ]);
  });

  it("aucun bouton ni lien sans data-track hors héritage déclaré", () => {
    const missing: string[] = [];
    for (const file of walk(join(ROOT, "src"))) {
      if (!file.endsWith(".tsx")) continue;
      const rel = file.replace(ROOT + "/", "");
      if (OUT_OF_SCOPE.some((p) => rel.startsWith(p)) || rel in INHERITS) continue;
      const text = readFileSync(file, "utf8");
      for (const t of clickableTags(text)) {
        if (/data-track=|\btrack=/.test(t.attrs)) continue;
        missing.push(`${rel}:${t.line} <${t.tag}>`);
      }
    }
    expect(
      missing,
      'cliquables sans nom — poser data-track="domaine.cible" (au catalogue), data-track="none", ou déclarer l\'héritage dans INHERITS',
    ).toEqual([]);
  });

  it("les fichiers déclarés en héritage existent encore", () => {
    const gone = Object.keys(INHERITS).filter((rel) => {
      try {
        statSync(join(ROOT, rel));
        return false;
      } catch {
        return true;
      }
    });
    expect(gone).toEqual([]);
  });
});
