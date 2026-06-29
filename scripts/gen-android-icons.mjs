// One-off: derive the three @capacitor/assets source images from the master
// SVG (docs/icons/mijote-icon-1024.svg) so Android gets a proper adaptive icon
// (pot kept inside the safe zone, sage gradient as its own background layer).
//   assets/icon-only.png       — full design (iOS + Android legacy square)
//   assets/icon-background.png — sage gradient only
//   assets/icon-foreground.png — pot/lid/steam, scaled to ~66% on transparent
import sharp from "sharp";
import { readFileSync, mkdirSync, copyFileSync } from "node:fs";

const SRC = "docs/icons/mijote-icon-1024.svg";
const OUT = "assets";
mkdirSync(OUT, { recursive: true });

const svg = readFileSync(SRC, "utf8");
const open = svg.match(/<svg[^>]*>/)[0];
const defs = svg.slice(svg.indexOf("<defs>"), svg.indexOf("</defs>") + "</defs>".length);

// The two full-bleed <rect> are the sage background; everything in the
// translate(0 60) group is the pot/lid/steam.
const bgRects = svg.match(/<rect width="1024" height="1024"[^>]*><\/rect>/g).join("\n");
const potStart = svg.indexOf('<g transform="translate(0 60)">');
const potGroup = svg.slice(potStart, svg.lastIndexOf("</g>") + "</g>".length);

const backgroundSvg = `${open}${defs}${bgRects}</svg>`;
// Scale the pot about the canvas centre to ~66% so the handles stay clear of
// the adaptive icon's circular mask (safe zone = centre 66dp of 108dp).
const foregroundSvg = `${open}${defs}<g transform="translate(512 512) scale(0.66) translate(-512 -512)">${potGroup}</g></svg>`;

const render = (svgStr, file) =>
  sharp(Buffer.from(svgStr)).resize(1024, 1024).png().toFile(`${OUT}/${file}`);

await Promise.all([
  copyFileSync("docs/icons/mijote-icon-1024.png", `${OUT}/icon-only.png`),
  render(backgroundSvg, "icon-background.png"),
  render(foregroundSvg, "icon-foreground.png"),
]);
console.log("✓ wrote assets/icon-only.png, icon-background.png, icon-foreground.png");
