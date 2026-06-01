/**
 * One-off backfill: re-encode existing recipe images to WebP in Supabase
 * Storage, in place (same object path, content-type image/webp) so DB URLs stay
 * valid — no DB writes. Idempotent: objects already WebP are skipped.
 *
 * Env (source the right file BEFORE running):
 *   staging:  set -a; . ./.env.staging.local; set +a
 *   prod:     set -a; . ./.env.local;         set +a
 * Then:  node scripts/backfill-webp.mjs [--dry]
 *   --dry  → report only, no uploads.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key);
const BUCKET = "recipe-photos";
const DRY = process.argv.includes("--dry");
const FORCE = process.argv.includes("--force"); // re-process even already-WebP (e.g. to reset cache-control)
const ref = url.match(/https:\/\/([^.]+)/)?.[1];

function pathFromUrl(u) {
  if (!u) return null;
  const m = u.match(/recipe-photos\/(.+)$/);
  return m ? decodeURIComponent(m[1].split("?")[0]) : null;
}

console.log(`Project ${ref} — ${DRY ? "DRY RUN" : "LIVE"}`);

const { data: recipes, error } = await supabase
  .from("recipes")
  .select("id, photo_url, generated_image_url");
if (error) {
  console.error(error.message);
  process.exit(1);
}

const paths = new Set();
for (const r of recipes) {
  for (const u of [r.photo_url, r.generated_image_url]) {
    const p = pathFromUrl(u);
    if (p) paths.add(p);
  }
}
console.log(`${recipes.length} recipes → ${paths.size} image objects to inspect`);

let converted = 0, skipped = 0, failed = 0, savedBytes = 0;
for (const path of paths) {
  try {
    const { data: blob, error: dErr } = await supabase.storage
      .from(BUCKET)
      .download(path);
    if (dErr || !blob) {
      console.log("  download FAIL", path, dErr?.message ?? "");
      failed++;
      continue;
    }
    const input = Buffer.from(await blob.arrayBuffer());
    const meta = await sharp(input).metadata();
    if (meta.format === "webp" && !FORCE) {
      skipped++;
      continue;
    }
    const out = await sharp(input)
      .rotate() // bake EXIF orientation
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    console.log(
      `  ${path}: ${Math.round(input.length / 1024)}KB ${meta.format} → ${Math.round(out.length / 1024)}KB webp`,
    );
    savedBytes += input.length - out.length;
    if (!DRY) {
      const { error: uErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, out, {
          contentType: "image/webp",
          upsert: true,
          cacheControl: "2592000", // 30 days
        });
      if (uErr) {
        console.log("  upload FAIL", path, uErr.message);
        failed++;
        continue;
      }
    }
    converted++;
  } catch (e) {
    console.log("  ERROR", path, e.message);
    failed++;
  }
}
console.log(
  `\n${DRY ? "[dry] would convert" : "converted"} ${converted}, skipped(webp) ${skipped}, failed ${failed}, saved ~${(savedBytes / 1024 / 1024).toFixed(1)}MB`,
);
