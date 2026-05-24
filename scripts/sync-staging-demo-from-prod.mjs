#!/usr/bin/env node
// Sync the demo household's recipes (and recipe_tags) from prod into staging,
// so the staging demo renders the same AI-enriched content (generated images,
// prep_time/cook_time/cost/complexity/seasons, tags) as prod.
//
// Match strategy: by recipe title within the demo household. Idempotent.
// Image URLs are cross-referenced from the prod public Storage bucket
// (recipe-photos) — no file copy needed.
//
// Requires:
//   .env.local      → prod credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_HOUSEHOLD_ID)
//   .env.staging.local → staging credentials (same vars, pulled via `vercel env pull --environment=preview .env.staging.local`)

import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv(file) {
  const path = resolve(process.cwd(), file);
  return Object.fromEntries(
    readFileSync(path, "utf-8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      })
  );
}

const prodEnv = loadEnv(".env.local");
const stagingEnv = loadEnv(".env.staging.local");

const PROD = {
  url: prodEnv["NEXT_PUBLIC_SUPABASE_URL"],
  key: prodEnv["SUPABASE_SERVICE_ROLE_KEY"],
  demo: prodEnv["DEMO_HOUSEHOLD_ID"] || "00000000-0000-0000-0000-000000000000",
};
const STAGING = {
  url: stagingEnv["NEXT_PUBLIC_SUPABASE_URL"],
  key: stagingEnv["SUPABASE_SERVICE_ROLE_KEY"],
  demo: stagingEnv["DEMO_HOUSEHOLD_ID"] || "00000000-0000-0000-0000-000000000000",
};

for (const [label, env] of [["prod", PROD], ["staging", STAGING]]) {
  if (!env.url || !env.key) {
    console.error(`Missing Supabase URL or service key for ${label}`);
    process.exit(1);
  }
}
if (PROD.url === STAGING.url) {
  console.error("Prod and staging Supabase URLs are identical — refusing to run.");
  process.exit(1);
}

console.log(`Prod    : ${PROD.url}`);
console.log(`Staging : ${STAGING.url}`);
console.log(`Demo HH : ${PROD.demo}\n`);

async function rest(env, path, init = {}) {
  const res = await fetch(env.url + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: env.key,
      Authorization: "Bearer " + env.key,
      "Content-Type": "application/json",
      Prefer: init.method && init.method !== "GET" ? "return=representation" : "",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method || "GET"} ${path} → ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// ─── 1. Pull prod state ────────────────────────────────────────────────────
const prodRecipes = await rest(
  PROD,
  `recipes?household_id=eq.${PROD.demo}&select=id,title,prep_time,cook_time,cost,complexity,seasons,image_prompt,generated_image_url,enrichment_status,image_status&order=created_at.asc`
);
console.log(`Pulled ${prodRecipes.length} prod demo recipes.`);

const prodIds = prodRecipes.map((r) => r.id);
const inList = (ids) => "(" + ids.map((i) => `"${i}"`).join(",") + ")";

const prodRecipeTags = await rest(
  PROD,
  `recipe_tags?recipe_id=in.${inList(prodIds)}&select=recipe_id,tag_id`
);
const prodTagIds = [...new Set(prodRecipeTags.map((rt) => rt.tag_id))];
const prodTags = await rest(
  PROD,
  `tags?id=in.${inList(prodTagIds)}&select=id,name`
);
const prodTagNameById = Object.fromEntries(prodTags.map((t) => [t.id, t.name]));

// ─── 2. Pull staging state ─────────────────────────────────────────────────
const stagingRecipes = await rest(
  STAGING,
  `recipes?household_id=eq.${STAGING.demo}&select=id,title`
);
const stagingIdByTitle = Object.fromEntries(stagingRecipes.map((r) => [r.title, r.id]));

const stagingTags = await rest(
  STAGING,
  `tags?is_predefined=eq.true&select=id,name`
);
const stagingTagIdByName = Object.fromEntries(stagingTags.map((t) => [t.name, t.id]));

// ─── 3. Apply ──────────────────────────────────────────────────────────────
let updated = 0;
let skipped = 0;
let tagLinks = 0;
const missingTags = new Set();

for (const r of prodRecipes) {
  const stagingId = stagingIdByTitle[r.title];
  if (!stagingId) {
    console.warn(`  ⊘ no staging recipe for "${r.title}" — skipped`);
    skipped++;
    continue;
  }

  const patch = {
    photo_url: null,
    generated_image_url: r.generated_image_url,
    image_prompt: r.image_prompt,
    prep_time: r.prep_time,
    cook_time: r.cook_time,
    cost: r.cost,
    complexity: r.complexity,
    seasons: r.seasons ?? [],
    enrichment_status: r.enrichment_status,
    image_status: r.image_status,
  };

  await rest(STAGING, `recipes?id=eq.${stagingId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  updated++;

  // Recipe tags: reset and re-insert
  await rest(STAGING, `recipe_tags?recipe_id=eq.${stagingId}`, { method: "DELETE" });

  const prodTagNames = prodRecipeTags
    .filter((rt) => rt.recipe_id === r.id)
    .map((rt) => prodTagNameById[rt.tag_id])
    .filter(Boolean);

  const rows = [];
  for (const name of prodTagNames) {
    const stagingTagId = stagingTagIdByName[name];
    if (!stagingTagId) {
      missingTags.add(name);
      continue;
    }
    rows.push({ recipe_id: stagingId, tag_id: stagingTagId });
  }
  if (rows.length) {
    await rest(STAGING, `recipe_tags`, { method: "POST", body: JSON.stringify(rows) });
    tagLinks += rows.length;
  }

  console.log(`  ✓ ${r.title} (${prodTagNames.length} tags)`);
}

console.log(
  `\nDone — ${updated} updated, ${skipped} skipped, ${tagLinks} tag links recreated.`
);
if (missingTags.size) {
  console.warn(
    `Warning: ${missingTags.size} predefined tag(s) missing in staging: ${[...missingTags].join(", ")}`
  );
}
