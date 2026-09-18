// Rejoue un envoi d'import gardé avec le code ACTUEL et le compare au résultat
// d'origine — pour reproduire une erreur, puis vérifier un correctif.
// docs/specs/ocr-appareil/01-conservation-imports.md
//
// Prérequis : l'échantillon est téléchargé (node scripts/import-samples/pull.mjs <env> --id=…).
// Usage :     npx tsx --tsconfig tsconfig.json scripts/import-samples/replay.mts <env> <sampleId> [--live]
//   photo  → extractRecipeFromImages sur les images telles que reçues ;
//   dictée → extractRecipeFromVoice sur l'enregistrement (transcription refaite) ;
//   lien   → structuration du texte GARDÉ (page.txt) ; `--live` relit la page en ligne.
// Appelle OpenAI avec la clé de .env.local (quelques dixièmes de centime) ;
// n'écrit rien nulle part (pas de `meta` : aucun coût enregistré en base).
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

async function main() {
  const [envName, sampleId] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const live = process.argv.includes("--live");
  if (!envName || !sampleId) {
    throw new Error("usage : replay.mts <prod|staging|local> <sampleId> [--live]");
  }
  const { loadEnvLocal } = await import("../lib/env.mjs");
  loadEnvLocal(".env.local"); // clé OpenAI
  const dir = path.join("scripts/bench/fixtures/import-samples", envName, sampleId);
  const sample = JSON.parse(await readFile(path.join(dir, "sample.json"), "utf8"));
  const files = await readdir(dir);
  const importLib = await import("@/lib/import");

  let replayed: unknown;
  const started = Date.now();
  try {
    if (sample.method === "photo") {
      const images = await Promise.all(
        files
          .filter((f) => /\.(jpe?g|png|webp)$/.test(f))
          .sort()
          .map(async (f) => {
            const type = f.endsWith(".png")
              ? "image/png"
              : f.endsWith(".webp")
                ? "image/webp"
                : "image/jpeg";
            return `data:${type};base64,${(await readFile(path.join(dir, f))).toString("base64")}`;
          }),
      );
      replayed = await importLib.extractRecipeFromImages(images);
    } else if (sample.method === "voice") {
      const audio = files.find((f) => f.startsWith("audio."))!;
      const type = audio.endsWith(".m4a")
        ? "audio/mp4"
        : audio.endsWith(".ogg")
          ? "audio/ogg"
          : audio.endsWith(".mp3")
            ? "audio/mpeg"
            : "audio/webm";
      const file = new File([await readFile(path.join(dir, audio))], audio, { type });
      const trace = {};
      replayed = {
        recipe: await importLib.extractRecipeFromVoice(file, { householdId: "", trace } as never),
        trace,
      };
    } else if (live || !files.includes("page.txt")) {
      replayed = await importLib.extractRecipeFromUrl(sample.url);
    } else {
      const text = await readFile(path.join(dir, "page.txt"), "utf8");
      replayed = await importLib.structureRecipeFromText(text, {
        callType: sample.path ?? "import_url",
      });
    }
  } catch (err) {
    replayed = { error: (err as Error).message, code: (err as { code?: string }).code };
  }

  const pick = (r: Record<string, unknown> | null | undefined) =>
    r
      ? {
          title: r.title,
          ingredients: r.ingredients,
          steps: r.steps,
          notes: r.notes,
          servings: r.servings,
        }
      : null;
  console.log(
    `\n=== ${sample.method} ${sampleId} — origine : ${sample.status}${sample.error_code ? ` ${sample.error_code}` : ""} (${sample.model ?? "?"})`,
  );
  console.log("--- extraction d'origine");
  console.log(JSON.stringify(pick(sample.extracted), null, 1));
  if (sample.saved) {
    console.log("--- recette enregistrée (vérité terrain)");
    console.log(JSON.stringify(pick(sample.saved), null, 1));
  }
  console.log(`--- rejoué avec le code actuel (${Date.now() - started} ms)`);
  console.log(JSON.stringify(replayed, null, 1));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
