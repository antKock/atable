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
    for (const m of text.matchAll(/props->>'target'\s*(?:=|IN)\s*\(?\s*((?:'[a-z0-9_.-]+'\s*,?\s*)+)\)?/g)) {
      for (const t of m[1].matchAll(/'([a-z0-9_.-]+)'/g)) out.set(t[1], file.replace(ROOT + "/", ""));
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
