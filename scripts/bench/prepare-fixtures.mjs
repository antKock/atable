#!/usr/bin/env node
// Prépare les fixtures du banc d'essai modèles (scripts/bench/bench-models.mjs) :
//  - text/    : pages recettes nettoyées (mêmes regex que fetchAndCleanHtml de
//               src/lib/import.ts), caption Insta simulée, transcriptions scriptées
//  - images/  : captures d'écran Playwright des mêmes pages (viewport mobile)
//  - audio/   : dictées synthétisées via `say` macOS + afconvert → m4a
// Usage : node scripts/bench/prepare-fixtures.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(ROOT, "fixtures");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// NB : les URLs cuisineaz/750g redirigent vers d'autres recettes que leur slug
// d'origine — les slugs ci-dessous reflètent le contenu réellement servi.
const PAGES = [
  { slug: "marmiton-ratatouille", url: "https://www.marmiton.org/recettes/recette_ratatouille_23223.aspx" },
  { slug: "cuisineaz-sauce-pommes", url: "https://www.cuisineaz.com/recettes/quiche-lorraine-4041.aspx" },
  { slug: "750g-tarte-pommes", url: "https://www.750g.com/quiche-lorraine-r4028.htm" },
];

// Copie exacte du nettoyage HTML de src/lib/import.ts (fetchAndCleanHtml).
function cleanHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<\/(?:p|div|li|tr|h[1-6])>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, 50000);
}

// Caption Instagram réaliste (émojis, hashtags, pas de structure nette).
const INSTA_CAPTION = `PÂTES À LA CRÈME DE COURGETTES 🔥 la recette parfaite pour la semaine, prête en 20 min chrono ⏱️

Pour 4 personnes il te faut :
✅ 400g de penne
✅ 2 courgettes moyennes
✅ 1 oignon
✅ 2 gousses d'ail
✅ 20cl de crème fraîche légère
✅ 60g de parmesan + un peu pour servir
✅ huile d'olive, sel, poivre, basilic frais

On fait revenir l'oignon et l'ail émincés dans un filet d'huile d'olive, on ajoute les courgettes coupées en petits dés, on laisse cuire 10 min à feu moyen. Pendant ce temps on cuit les pâtes al dente (garde une louche d'eau de cuisson 😉). On mixe la moitié des courgettes avec la crème et le parmesan, on remet tout dans la poêle avec les pâtes, on détend avec l'eau de cuisson et hop c'est prêt 🤌

Astuce : ajoute des pignons torréfiés pour le croquant, ça change tout !!

Tu testes ? Dis-le moi en commentaire 👇👇
#pasta #recettefacile #courgettes #batchcooking #mangersain #recettesemaine #foodlover #cuisinemaison`;

// Dictées : lues telles quelles par `say`, et vérité terrain pour le WER.
const DICTATIONS = [
  {
    slug: "voice-fr-hesitations",
    voice: "Jacques",
    text: `Alors, la recette du clafoutis aux cerises de ma grand-mère. Il faut 500 grammes de cerises, euh, 4 œufs, 100 grammes de farine, ah non attends, 120 grammes de farine plutôt. Ensuite 80 grammes de sucre, un demi-litre de lait, non pardon, 30 centilitres de lait, et une pincée de sel. Donc on préchauffe le four à 180 degrés. On mélange les œufs avec le sucre, on ajoute la farine petit à petit, puis le lait. On beurre un plat, on dispose les cerises, on verse la pâte par-dessus et on enfourne pour 35 minutes. C'est pour 6 personnes à peu près. Ah et j'oubliais, on peut saupoudrer de sucre glace à la sortie du four, c'est meilleur.`,
  },
  {
    slug: "voice-fr-simple",
    voice: "Amélie",
    text: `Salade de lentilles au chèvre chaud. Les ingrédients : 250 grammes de lentilles vertes, un oignon rouge, deux carottes, un crottin de chèvre, quatre tranches de pain de campagne, de la moutarde, du vinaigre de cidre, de l'huile d'olive et du persil. Faites cuire les lentilles 25 minutes dans l'eau bouillante avec une carotte coupée en rondelles. Pendant ce temps, préparez la vinaigrette avec la moutarde, le vinaigre et l'huile. Égouttez les lentilles, mélangez avec l'oignon émincé et la vinaigrette. Passez les tranches de pain avec le chèvre sous le gril deux minutes. Servez tiède avec le persil ciselé. Pour deux personnes en plat principal.`,
  },
  {
    slug: "voice-pt-caldo",
    voice: "Joana",
    text: `Caldo verde tradicional. Ingredientes: um quilo de batatas, 300 gramas de couve galega cortada em juliana fina, um chouriço de carne, uma cebola, dois dentes de alho e azeite. Coza as batatas com a cebola e o alho em água temperada com sal. Triture tudo até obter um creme aveludado. Junte a couve e deixe cozer cinco minutos. Adicione o chouriço às rodelas e um fio de azeite antes de servir. Para quatro pessoas.`,
  },
];

async function prepareText() {
  const dir = path.join(FIX, "text");
  await mkdir(dir, { recursive: true });
  for (const { slug, url } of PAGES) {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    const cleaned = cleanHtml(await res.text());
    await writeFile(path.join(dir, `${slug}.txt`), cleaned);
    console.log(`text/${slug}.txt — ${cleaned.length} chars`);
  }
  await writeFile(path.join(dir, "insta-caption.txt"), INSTA_CAPTION);
  for (const d of DICTATIONS) {
    await writeFile(path.join(dir, `${d.slug}.txt`), d.text);
  }
  console.log("text/ ok");
}

// Bandeaux de consentement : best-effort. Certains CMP (Didomi, AppConsent…)
// rendent le bouton hors <button> ou dans une iframe — on cherche le texte
// d'acceptation dans la page et toutes ses frames.
const CONSENT_TEXTS = [
  "Tout accepter",
  "Accepter & Fermer",
  "Accepter et fermer",
  "J'accepte",
  "Accepter",
];

async function tryConsent(page) {
  const frames = [page.mainFrame(), ...page.frames()];
  for (const frame of frames) {
    // Sélecteur direct Didomi d'abord.
    for (const sel of ["#didomi-notice-agree-button", 'button[aria-label*="accepter" i]']) {
      try {
        const el = frame.locator(sel).first();
        if (await el.isVisible({ timeout: 300 })) {
          await el.click({ timeout: 1500 });
          return true;
        }
      } catch {
        /* frame morte ou sélecteur absent */
      }
    }
    for (const text of CONSENT_TEXTS) {
      try {
        const el = frame
          .locator(`button, a, div[role="button"], span, div`, { hasText: text })
          .locator(`text="${text}"`)
          .first();
        if (await el.isVisible({ timeout: 300 })) {
          await el.click({ timeout: 1500 });
          return true;
        }
      } catch {
        /* on tente la frame/texte suivant */
      }
    }
  }
  return false;
}

async function prepareScreenshots() {
  const dir = path.join(FIX, "images");
  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    locale: "fr-FR",
  });
  for (const { slug, url } of PAGES) {
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);
      // Les bandeaux (Didomi & co) apparaissent parfois avec retard : on boucle.
      let consentDone = false;
      for (let round = 0; round < 4 && !consentDone; round++) {
        consentDone = await tryConsent(page);
        await page.waitForTimeout(consentDone ? 1200 : 1500);
      }
      if (!consentDone) console.warn(`images/${slug} — bandeau cookies non fermé ?`);
      // Deux captures qui se chevauchent (titre+ingrédients puis étapes), comme
      // un vrai utilisateur qui envoie plusieurs screenshots du même article.
      const slices = [
        { n: 1, y: 0 },
        { n: 2, y: 2400 },
      ];
      for (const { n, y } of slices) {
        await page.screenshot({
          path: path.join(dir, `${slug}-${n}.png`),
          clip: { x: 0, y, width: 390, height: 2500 },
          fullPage: true,
        });
      }
      console.log(`images/${slug}-{1,2}.png ok`);
    } catch (err) {
      console.error(`images/${slug}.png ÉCHEC:`, err.message);
    } finally {
      await page.close();
    }
  }
  await browser.close();
}

function prepareAudio() {
  const dir = path.join(FIX, "audio");
  execFileSync("mkdir", ["-p", dir]);
  for (const d of DICTATIONS) {
    const aiff = path.join(dir, `${d.slug}.aiff`);
    const m4a = path.join(dir, `${d.slug}.m4a`);
    execFileSync("say", ["-v", d.voice, "-o", aiff, d.text]);
    execFileSync("afconvert", ["-f", "mp4f", "-d", "aac", aiff, m4a]);
    execFileSync("rm", [aiff]);
    console.log(`audio/${d.slug}.m4a ok`);
  }
}

await prepareText();
await prepareScreenshots();
prepareAudio();
console.log("Fixtures prêtes dans", FIX);
