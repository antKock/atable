/**
 * Generate the iOS splash image: Mijote cocotte (no green disc) centered on a
 * cream `#F5F1E8` 2732×2732 canvas. Used by both the LaunchScreen storyboard
 * and the @capacitor/splash-screen plugin.
 *
 * Run with: `node scripts/build-splash.mjs`
 *
 * Outputs to `ios/App/App/Assets.xcassets/Splash.imageset/*.png`. Re-run
 * whenever the icon source SVG or the brand background colour changes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SVG_SOURCE = path.join(ROOT, "docs/icons/mijote-icon-1024.svg");
const TARGET_DIR = path.join(
  ROOT,
  "ios/App/App/Assets.xcassets/Splash.imageset",
);
const TARGET_FILES = [
  "splash-2732x2732.png",
  "splash-2732x2732-1.png",
  "splash-2732x2732-2.png",
];

const SPLASH_SIZE = 2732;
// Cocotte width relative to the canvas. The icon SVG has empty top/bottom
// margins inside its 1024 viewBox so the visible cocotte ends up ~75% of
// LOGO_SIZE. At 700, the cocotte reads as a discreet centred logo
// (~19% of the canvas, ≈ Instagram / minimal-splash proportions).
const LOGO_SIZE = 700;
// `#F5F1E8` — the app cream background (cf. globals.css `--background`).
const CREAM = { r: 0xf5, g: 0xf1, b: 0xe8, alpha: 1 };

async function main() {
  let svg = fs.readFileSync(SVG_SOURCE, "utf8");

  // Strip the two background rects (green radial disc + multiply darken
  // overlay). The cocotte itself and its shadow remain untouched and render
  // against the new cream canvas.
  svg = svg.replace(
    /\s*<rect width="1024" height="1024" fill="url\(#bg\)"><\/rect>/,
    "",
  );
  svg = svg.replace(
    /\s*<rect width="1024" height="1024" fill="#000000" opacity="0\.05" style="mix-blend-mode: multiply"><\/rect>/,
    "",
  );

  const logoBuffer = await sharp(Buffer.from(svg), { density: 300 })
    .resize(LOGO_SIZE, LOGO_SIZE)
    .png()
    .toBuffer();

  const splashBuffer = await sharp({
    create: {
      width: SPLASH_SIZE,
      height: SPLASH_SIZE,
      channels: 4,
      background: CREAM,
    },
  })
    .composite([{ input: logoBuffer, gravity: "centre" }])
    .png()
    .toBuffer();

  for (const filename of TARGET_FILES) {
    fs.writeFileSync(path.join(TARGET_DIR, filename), splashBuffer);
  }
  console.log(
    `Wrote ${SPLASH_SIZE}×${SPLASH_SIZE} cream splash with ${LOGO_SIZE}px cocotte to ${TARGET_FILES.length} files.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
