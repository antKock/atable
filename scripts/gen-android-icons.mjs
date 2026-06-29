// Regenerate ALL Android launcher icons directly into the mipmap folders,
// at correct resolutions, from the master SVG (docs/icons/mijote-icon-1024.svg).
//
// Why hand-rolled instead of @capacitor/assets: the tool emitted the adaptive
// foreground/background at *legacy* 48dp sizes and inset the background, which
// made the pot tiny + blurry (a thick sage "border"). Here:
//   - legacy ic_launcher / ic_launcher_round  → full design at 48dp sizes
//   - adaptive ic_launcher_foreground         → pot @ ~92% on transparent, 108dp sizes
//   - adaptive ic_launcher_background         → full sage gradient, 108dp sizes
// The adaptive XML (mipmap-anydpi-v26/*.xml) references these with NO <inset>.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const RES = "android/app/src/main/res";
const SVG = "docs/icons/mijote-icon-1024.svg";
const FULL_PNG = "docs/icons/mijote-icon-1024.png";
// Pot size inside the 108dp adaptive foreground. The launcher only shows the
// central ~66dp safe zone (outer ~18dp is cropped by the mask), so the pot's
// widest points (the handles, ±40% from centre in the source) must land inside
// that safe radius (~33% of the layer). 0.78 keeps them just inside → prominent
// pot, no clipped handles. Higher (e.g. 0.92) clips the handles & lid.
const FG_SCALE = 0.78;

// density → [legacy 48dp px, adaptive 108dp px]
const D = {
  ldpi: [36, 81], mdpi: [48, 108], hdpi: [72, 162],
  xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432],
};

const svg = readFileSync(SVG, "utf8");
const open = svg.match(/<svg[^>]*>/)[0];
const defs = svg.slice(svg.indexOf("<defs>"), svg.indexOf("</defs>") + 7);
const bgRects = svg.match(/<rect width="1024" height="1024"[^>]*><\/rect>/g).join("");
const pot = svg.slice(svg.indexOf('<g transform="translate(0 60)">'), svg.lastIndexOf("</g>") + 5);

const bgSvg = `${open}${defs}${bgRects}</svg>`;
const fgSvg = `${open}${defs}<g transform="translate(512 512) scale(${FG_SCALE}) translate(-512 -512)">${pot}</g></svg>`;

const circle = (s) => Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="#fff"/></svg>`);

for (const [d, [legacy, adaptive]] of Object.entries(D)) {
  const dir = `${RES}/mipmap-${d}`;
  // Legacy square (full design) + round (full design circle-masked)
  await sharp(FULL_PNG).resize(legacy, legacy).png().toFile(`${dir}/ic_launcher.png`);
  await sharp(FULL_PNG).resize(legacy, legacy)
    .composite([{ input: circle(legacy), blend: "dest-in" }]).png().toFile(`${dir}/ic_launcher_round.png`);
  // Adaptive layers at 108dp
  await sharp(Buffer.from(bgSvg)).resize(adaptive, adaptive).png().toFile(`${dir}/ic_launcher_background.png`);
  await sharp(Buffer.from(fgSvg)).resize(adaptive, adaptive).png().toFile(`${dir}/ic_launcher_foreground.png`);
}
console.log(`✓ regenerated launcher icons (foreground pot @ ${FG_SCALE}, adaptive layers @ 108dp)`);
