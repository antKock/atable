/**
 * Protocole de test spec #9 — impact avant/après sur des foyers de prod.
 * LECTURE SEULE. Usage : npx tsx scripts/spec9-compare-carousels.ts [path/vers/.env]
 *
 * « Avant » = simulation en mémoire de l'ancienne logique (13 requêtes,
 * reproduites fidèlement, y compris le bug « Libanaise/Orientale » sans
 * espaces et « Redécouvrir » trié par view_count asc).
 * « Après » = le VRAI code de src/lib/carousels/ (bucketing, sélection,
 * ordre client + dédup en cascade), sur les mêmes données.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { CAROUSEL_CATALOG } from "../src/lib/carousels/catalog";
import { bucket } from "../src/lib/carousels/bucketing";
import { selectSections } from "../src/lib/carousels/selection";
import { prepareForDisplay } from "../src/lib/carousels/display";
import type { CarouselRecipeItem, CarouselSection } from "../src/lib/carousels/types";

const envPath = process.argv[2] ?? new URL("../../../../atable/.env.local", import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const DEMO_ID = env.DEMO_HOUSEHOLD_ID;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): CarouselRecipeItem {
  return {
    id: row.id,
    title: row.title,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tags: (row.recipe_tags ?? []).map((rt: any) => rt?.tags).filter(Boolean),
    photoUrl: row.photo_url ?? null,
    createdAt: row.created_at,
    generatedImageUrl: row.generated_image_url ?? null,
    enrichmentStatus: row.enrichment_status ?? "none",
    imageStatus: row.image_status ?? "none",
    prepTime: row.prep_time ?? null,
    cookTime: row.cook_time ?? null,
    cost: row.cost ?? null,
    // prod n'a pas encore la migration 024 : on simule son backfill
    lastActivityAt: row.last_viewed_at ?? row.created_at,
    viewCount: row.view_count ?? 0,
  };
}

type OldSection = { key: string; recipes: CarouselRecipeItem[] };

// Ancienne logique, à l'identique (voir git 2a2a2f8:src/lib/queries/carousels.ts)
function oldSections(recipes: CarouselRecipeItem[]): OldSection[] {
  const byCreated = [...recipes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const byTag = (name: string) => byCreated.filter((r) => r.tags.some((t) => t.name === name));
  const byTags = (names: string[]) => byCreated.filter((r) => r.tags.some((t) => names.includes(t.name)));
  const viewed = recipes.filter((r) => r.viewCount > 0);
  const all: OldSection[] = [
    { key: "nouvelles", recipes: byCreated },
    // l'ancien last_viewed_at (non null ⟺ ouverte) ≡ view_count>0 + last_activity_at
    { key: "recentes", recipes: [...viewed].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)) },
    { key: "redecouvrir", recipes: [...viewed].sort((a, b) => a.viewCount - b.viewCount) },
    { key: "rapide", recipes: byTag("Rapide") },
    { key: "vegetarien", recipes: byTag("Végétarien") },
    { key: "comfortFood", recipes: byTag("Comfort food") },
    { key: "pasCher", recipes: byCreated.filter((r) => r.cost === "€") },
    { key: "apero", recipes: byTag("Apéro") },
    { key: "desserts", recipes: byTag("Dessert") },
    { key: "cuisineItalienne", recipes: byTag("Italienne") },
    // bug historique reproduit : « Libanaise/Orientale » (sans espaces) ne matche rien
    { key: "cuisineDuMonde", recipes: byTags(["Indienne", "Libanaise/Orientale", "Mexicaine", "Asiatique", "Africaine", "Américaine"]) },
    { key: "petitDejeuner", recipes: byTag("Petit-déjeuner") },
    { key: "boissons", recipes: byTag("Boisson") },
  ];
  return all.map((s) => ({ ...s, recipes: s.recipes.slice(0, 10) })).filter((s) => s.recipes.length > 0);
}

// Recouvrement des têtes : le mobile ne montre que ~1,5 carte par carrousel.
// % de cartes de tête (2 premières) déjà vues en tête d'un carrousel plus haut.
function headDupRate(sections: { key: string; recipes: { id: string }[] }[]): { rate: number; dups: number; total: number } {
  const seen = new Set<string>();
  let dups = 0;
  let total = 0;
  for (const s of sections) {
    for (const r of s.recipes.slice(0, 2)) {
      total += 1;
      if (seen.has(r.id)) dups += 1;
      seen.add(r.id);
    }
  }
  return { rate: total ? dups / total : 0, dups, total };
}

function fmt(sections: { key: string; recipes: unknown[] }[]): string {
  return sections.map((s) => `${s.key}(${s.recipes.length})`).join(" ");
}

async function analyzeHousehold(id: string, name: string, count: number) {
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, title, photo_url, created_at, generated_image_url, enrichment_status, image_status, prep_time, cook_time, cost, last_viewed_at, view_count, recipe_tags(tag_id, tags(id, name, category))",
    )
    .eq("household_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const recipes = (data ?? []).map(mapRow);

  console.log(`\n━━━ Foyer « ${name} » — ${count} recettes ━━━`);

  // AVANT : ordre client historique = nouvelles épinglé + reste random.
  // Le random ne change pas le taux de dup moyen — on mesure sur 5 ordres.
  const before = oldSections(recipes);
  const beforeRates: number[] = [];
  for (let s = 0; s < 5; s++) {
    const rest = before.filter((x) => x.key !== "nouvelles");
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const shuffled = [before.find((x) => x.key === "nouvelles")!, ...rest].filter(Boolean);
    beforeRates.push(headDupRate(shuffled).rate);
  }
  console.log(`AVANT  ${before.length} carrousels : ${fmt(before)}`);
  console.log(`       dup têtes (moy. 5 ordres) : ${(100 * beforeRates.reduce((a, b) => a + b, 0) / beforeRates.length).toFixed(0)}%`);

  // APRÈS : vrai pipeline serveur + client, 5 seeds de visite.
  const server = selectSections(bucket(recipes, CAROUSEL_CATALOG));
  const catCount = server.filter((s) => s.reorderable).length;
  console.log(`APRÈS  serveur : ${server.length} carrousels (${catCount} catégories) : ${fmt(server)}`);
  const afterRates: number[] = [];
  let sample: CarouselSection[] | null = null;
  for (const seed of [11, 222, 3333, 44444, 555555]) {
    const displayed = prepareForDisplay(server, seed);
    afterRates.push(headDupRate(displayed).rate);
    if (!sample) sample = displayed;
    const empty = displayed.filter((s) => s.recipes.length === 0);
    if (empty.length) console.log(`       ⚠️ carrousel vide affiché (seed ${seed}) : ${empty.map((s) => s.key)}`);
  }
  console.log(`       affiché (seed 11) : ${fmt(sample!)}`);
  console.log(`       dup têtes après dédup (moy. 5 visites) : ${(100 * afterRates.reduce((a, b) => a + b, 0) / afterRates.length).toFixed(0)}%`);
}

async function main() {
  const { data: households, error } = await supabase
    .from("households")
    .select("id, name, recipes(count)")
    .neq("id", DEMO_ID);
  if (error) throw error;
  const withCounts = (households ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((h: any) => ({ id: h.id, name: h.name, count: h.recipes?.[0]?.count ?? 0 }))
    .filter((h) => h.count > 0)
    .sort((a, b) => a.count - b.count);
  if (!withCounts.length) throw new Error("aucun foyer avec recettes");

  console.log(`${withCounts.length} foyers réels avec recettes (hors démo). Tailles : ${withCounts.map((h) => h.count).join(", ")}`);
  const picks = [
    withCounts[0],
    withCounts[Math.floor(withCounts.length / 2)],
    withCounts[withCounts.length - 1],
  ].filter((h, i, arr) => arr.findIndex((x) => x.id === h.id) === i);

  for (const h of picks) await analyzeHousehold(h.id, h.name, h.count);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
