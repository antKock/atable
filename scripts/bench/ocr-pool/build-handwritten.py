#!/usr/bin/env python3
"""
Pool de test OCR — volet « recettes manuscrites ».

Télécharge les scans publics listés dans SOURCES (Wikimedia Commons, IIIF de la
Wellcome Collection), puis fabrique pour chaque page :

  - handwritten/clean/<id>-<n>.jpg : le scan d'origine, redimensionné
    (côté long ≤ 2048 px) et réencodé en JPEG qualité 85 — le format que le
    client Mijote envoie ;
  - handwritten/<id>-<n>.jpg : une version « photographiée au téléphone »
    (légère perspective, fond de table, lumière chaude, ombre douce, bruit,
    compression JPEG), déterministe (graine dérivée de l'id). C'est le cas
    testé principal.

Écrit aussi le manifeste versionné scripts/bench/ocr-pool/manifest-handwritten.json
(métadonnées uniquement : provenance, licence, difficulté…).

Les vérités terrain (truth/<id>.json) sont transcrites à la main, en regardant
les images ; ce script ne les écrit pas et ne les écrase jamais.

Aucun appel à un modèle (OpenAI ou autre) : la vérité terrain doit rester
indépendante des modèles comparés.

Usage :
  python3 scripts/bench/ocr-pool/build-handwritten.py            # tout
  python3 scripts/bench/ocr-pool/build-handwritten.py --only hand-pz-foie-de-veau-malaga
  python3 scripts/bench/ocr-pool/build-handwritten.py --no-download   # réutilise le cache _src/

Dépendance : Pillow (pas de numpy).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import random
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[3]
POOL = ROOT / "scripts/bench/fixtures/ocr-pool"
OUT_DIR = POOL / "handwritten"
CLEAN_DIR = OUT_DIR / "clean"
SRC_DIR = OUT_DIR / "_src"  # cache des originaux téléchargés (ignoré par git, comme tout fixtures/)
MANIFEST = ROOT / "scripts/bench/ocr-pool/manifest-handwritten.json"

UA = "MijoteOcrBench/1.0 (banc OCR interne ; contact kocken.anthony@gmail.com)"
MAX_SIDE = 2048
JPEG_QUALITY = 85

# Licences récurrentes -------------------------------------------------------
CC0 = ("CC0 1.0 (Paris Musées)", "https://creativecommons.org/publicdomain/zero/1.0/")
CCBYSA4 = ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/")
PDM_WELLCOME = ("Public Domain Mark 1.0 (Wellcome Collection)", "https://creativecommons.org/publicdomain/mark/1.0/")
NOC_US = ("Domaine public aux États-Unis — NoC-US (No Copyright – United States)", "http://rightsstatements.org/vocab/NoC-US/1.0/")

PZ_SOURCE_TITLE = (
    "Étiquette de caisse contenant quatre Panzerfaust 60, recette de cuisine au revers "
    "(Musée de la Libération de Paris – musée du Général Leclerc – musée Jean Moulin, inv. {inv})"
)
PZ_PROVENANCE = (
    "Paris Musées (musée de la Libération de Paris – musée Jean Moulin), fonds 2007.24, don Hugues Dufossé 2006 ; "
    "recettes écrites au crayon à papier au revers d'étiquettes de caisses de munitions allemandes livrées en 1944 "
    "(carte ~6,5 × 10,5 cm). Numérisation Paris Musées publiée en CC0, reversée sur Wikimedia Commons."
)


def commons(title: str) -> dict:
    return {"kind": "commons", "title": title}


def iiif(service: str) -> dict:
    return {"kind": "iiif", "service": service}


def pz(inv: str) -> dict:
    return commons(f"File:Etiquette de caisse contenant quatre Panzerfaust 60, recette de cuisine au revers, {inv}.jpg")


# Chaque entrée : métadonnées du manifeste + pages sources (dans l'ordre de lecture).
SOURCES: list[dict] = [
    # --- Français, 1944 : fiches au crayon (Panzerfaust) -------------------
    {
        "id": "hand-pz-foie-de-veau-malaga", "subtype": "fiche", "lang": "fr", "era": "1940s",
        "pages": [pz("2007.24.287")], "inv": "2007.24.287", "license": CC0,
        "difficulty": "moyen",
        "notes": "Crayon à papier sur carton beige taché ; recette en prose sans liste d'ingrédients ni quantités précises ; « presque cuit » ajouté en interligne.",
    },
    {
        "id": "hand-pz-gateau-maggy", "subtype": "fiche", "lang": "fr", "era": "1940s",
        "pages": [pz("2007.24.120")], "inv": "2007.24.120", "license": CC0,
        "difficulty": "facile",
        "notes": "Écriture la plus appuyée et lisible du fonds ; quantités en grammes, prose continue.",
    },
    {
        "id": "hand-pz-gateau-savoie", "subtype": "fiche", "lang": "fr", "era": "1940s",
        "pages": [pz("2007.24.121")], "inv": "2007.24.121", "license": CC0,
        "difficulty": "moyen",
        "notes": "Ratures (« blancs », « lait » barrés), parenthèses, partie « Pour glacer » séparée par un trait.",
    },
    {
        "id": "hand-pz-moka", "subtype": "fiche", "lang": "fr", "era": "1940s",
        "pages": [pz("2007.24.139")], "inv": "2007.24.139", "license": CC0,
        "difficulty": "moyen",
        "notes": "Taches d'humidité sur le texte ; quantités en grammes ; crayon pâle.",
    },
    {
        "id": "hand-pz-flan-breton", "subtype": "fiche", "lang": "fr", "era": "1940s",
        "pages": [pz("2007.24.102")], "inv": "2007.24.102", "license": CC0,
        "difficulty": "moyen",
        "notes": "Deux recettes sur la fiche : la cible est la première (« Flan breton », titre souligné). La seconde, « Œufs aux champignons », occupe la moitié basse et ne doit PAS être fusionnée.",
    },
    {
        "id": "hand-pz-flan-chocolat", "subtype": "fiche", "lang": "fr", "era": "1940s",
        "pages": [pz("2007.24.1")], "inv": "2007.24.1", "license": CC0,
        "difficulty": "difficile",
        "notes": "Crayon très pâle, titre abrégé et peu lisible (« Flan … » souligné) ; abréviations (« 500 gr »), liste d'ingrédients fondue dans la prose.",
    },
    # --- Français, milieu XIXᵉ : carnet (Wellcome MS.7883) ------------------
    {
        "id": "hand-wellcome-creme-au-chocolat", "subtype": "carnet", "lang": "fr", "era": "1840s",
        "pages": [
            iiif("https://iiif.wellcomecollection.org/image/b19680995_MS_7883_0045.JP2"),
            iiif("https://iiif.wellcomecollection.org/image/b19680995_MS_7883_0046.JP2"),
        ],
        "source_url": "https://wellcomecollection.org/works/pkav7daz",
        "source_title": "Anglo-French Recipe Book, 19th century (Wellcome MS.7883, Emma S. Rickards, Bishopsteignton, 1849), p. 21-22",
        "provenance": "Wellcome Collection, Londres — MS.7883, carnet de recettes anglo-français d'une seule main (inscription « Emma S Rickards / Bishopsteignton / January 1849 »). Images IIIF b19680995, canvases 0045-0046.",
        "license": PDM_WELLCOME,
        "difficulty": "difficile",
        "notes": "Cursive anglaise du XIXᵉ à l'encre sépia, français ancien (quarteron, chopine, setier). Recette sur 2 pages : p. 21 commence par la fin de la recette précédente (hors d'œuvre au hachis) ; p. 22 contient la fin de la recette puis « Victoria Cake » et « To preserve Apples with Ginger » (autres recettes visibles, en anglais) ; bord de la page voisine visible.",
    },
    # --- Anglais, milieu XIXᵉ : feuille volante (Wellcome MS.7883) ---------
    {
        "id": "hand-wellcome-apples-frangipane", "subtype": "fiche", "lang": "en", "era": "1840s",
        "pages": [iiif("https://iiif.wellcomecollection.org/image/b19680995_MS_7883_0102.JP2")],
        "source_url": "https://wellcomecollection.org/works/pkav7daz",
        "source_title": "Anglo-French Recipe Book, 19th century (Wellcome MS.7883), feuillet volant 12/35 « Apples à la Frangipane »",
        "provenance": "Wellcome Collection — MS.7883, recette sur feuillet volant inséré dans le carnet (classé à part, cote 7883/2). Image IIIF b19680995, canvas 0102.",
        "license": PDM_WELLCOME,
        "difficulty": "moyen",
        "notes": "Grande écriture penchée à l'encre, feuille déchirée et réparée ; prose sans ponctuation régulière ; cote d'archive « with MS.7883 12/35 » au crayon en bas.",
    },
    # --- Anglais, XXᵉ siècle : fiches et feuilles familiales ---------------
    {
        "id": "hand-commons-apple-cake", "subtype": "fiche", "lang": "en", "era": "1950s",
        "pages": [commons("File:Apple cake recipe card - Michigan circa 1950.jpg")],
        "source_title": "Apple cake recipe card - Michigan circa 1950 (Wikimedia Commons)",
        "provenance": "Boîte à recettes d'une grand-tante (Michigan, vers 1950), scannée et publiée par l'utilisateur Commons SJW/Jengod qui en déclare la libre diffusion.",
        "license": CCBYSA4,
        "difficulty": "facile",
        "notes": "Fiche bristol lignée, recto et verso scannés l'un au-dessus de l'autre dans la même image ; accolades groupant les ingrédients (« sift together », « cream ») ; abréviations c, T, t, # (livre).",
    },
    {
        "id": "hand-commons-orange-cake", "subtype": "fiche", "lang": "en", "era": "1950s",
        "pages": [commons("File:Orange cake - Handwritten 2024-05-21 103943 page 1.jpg")],
        "source_title": "Orange cake - Handwritten (Wikimedia Commons)",
        "provenance": "Même boîte à recettes familiale (Michigan, milieu du XXᵉ siècle), publiée sur Commons par SJW/Jengod.",
        "license": CCBYSA4,
        "difficulty": "facile",
        "notes": "Fiche lignée, cursive à l'encre ; notes entre accolades (« wash well », « 400° for 40 min ») et ajout au crayon (« after sifting »).",
    },
    {
        "id": "hand-cml-key-lime-pie", "subtype": "fiche", "lang": "en", "era": "1990s",
        "pages": [
            commons("File:Esther Staat Recipe - DPLA - efe735d152436947171c1bf0a277dd94 (page 2).jpg"),
            commons("File:Esther Staat Recipe - DPLA - efe735d152436947171c1bf0a277dd94 (page 1).jpg"),
        ],
        "source_title": "Esther Staat Recipe (« Ann's Key Lime Pie »), Columbus Metropolitan Library, 1992",
        "provenance": "Columbus Metropolitan Library (Ohio), collection « Columbus Memory », via DPLA puis Wikimedia Commons ; recette manuscrite d'Esther Staat (1925-2021), carte pliée « Here's what's cookin' ».",
        "license": NOC_US,
        "difficulty": "facile",
        "notes": "Deux images : l'intérieur de la carte (la recette, « (over) » en bas) puis l'extérieur (note manuscrite sur l'origine de la recette + champs imprimés « Here's what's cookin' » / « Recipe from the kitchen of » remplis à la main, illustration). Texte imprimé mêlé au manuscrit.",
    },
    {
        "id": "hand-eisenhower-oatmeal-cookies", "subtype": "fiche", "lang": "en", "era": "1960s",
        "pages": [commons("File:John Eisenhower's Oatmeal Cookie Recipe - DPLA - c9d38b93a456e54e74c5957270b77dc6.jpg")],
        "source_title": "John Eisenhower's Oatmeal Cookie Recipe (1967), Eisenhower Presidential Library / NARA",
        "provenance": "National Archives (Dwight D. Eisenhower Presidential Library), papiers de Mamie Doud Eisenhower, via DPLA puis Wikimedia Commons.",
        "license": NOC_US,
        "difficulty": "moyen",
        "notes": "Grande écriture au crayon sur papier ligné jauni, liste d'ingrédients seule, sans instructions (la liste touche le bas de la feuille : suite non numérisée → truncated) ; une ligne barrée ; tampon d'archives.",
    },
    {
        "id": "hand-truman-marble-cake", "subtype": "fiche", "lang": "en", "era": "1940s",
        "pages": [commons("File:Recipe for Marble Cake - DPLA - 28b9f5998915b1d2f2931615f1dd46c9.jpg")],
        "source_title": "Recipe for Marble Cake, Bess Wallace Truman papers, Harry S. Truman Library / NARA",
        "provenance": "National Archives (Harry S. Truman Presidential Library), papiers de Bess W. Truman (catalogue NARA 139308704), via DPLA puis Wikimedia Commons. Écrit sur un papier à en-tête « United States Senate — Memorandum » (donc vers 1935-1945).",
        "license": NOC_US,
        "difficulty": "difficile",
        "notes": "Deux colonnes (« White part » / « Dark »), en-tête imprimé qui chevauche le titre manuscrit, ratures, fractions superposées ; scan noir et blanc.",
    },
    {
        "id": "hand-truman-gingerbread-brownies", "subtype": "fiche", "lang": "en", "era": "1940s",
        "pages": [commons("File:Recipe for Gingerbread Brownies - DPLA - 2ebca851297d8523c241ce7aef31923d.jpg")],
        "source_title": "Recipe for Gingerbread Brownies, Bess Wallace Truman papers, Harry S. Truman Library / NARA",
        "provenance": "National Archives (Harry S. Truman Presidential Library), papiers de Bess W. Truman (catalogue NARA 139308726), via DPLA puis Wikimedia Commons. Papier à en-tête « The White House, Washington » (donc 1945-1953).",
        "license": NOC_US,
        "difficulty": "difficile",
        "notes": "Crayon très pâle, liste d'ingrédients seule (aucune instruction), deux colonnes irrégulières, abréviations (c, t, tsp. B.K.P.).",
    },
    {
        "id": "hand-johnson-egg-cheese-casserole", "subtype": "fiche", "lang": "en", "era": "1940s",
        "pages": [commons("File:Egg, Cheese and Vegetable Casserole Recipe - DPLA - ce0f339c0e1bf6ceae4e77a5e631eef4.jpg")],
        "source_title": "Egg, Cheese and Vegetable Casserole Recipe (1945-1946), NARA",
        "provenance": "National Archives, recette manuscrite de Frances Smith Johnson (1945-1946), via DPLA puis Wikimedia Commons.",
        "license": NOC_US,
        "difficulty": "moyen",
        "notes": "Crayon pâle sur papier jauni et taché, écriture script arrondie ; en-tête « Wash. D.C. / Katy Sparks : 8/11/46 » ; liste d'ingrédients puis prose.",
    },
]


# Téléchargement ----------------------------------------------------------------

def http_get(url: str, retries: int = 4) -> bytes:
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 — on réessaie tout (429, coupures…)
            last = e
            time.sleep(4 * (attempt + 1))
    raise RuntimeError(f"échec du téléchargement {url}: {last}")


def commons_info(title: str) -> dict:
    q = urllib.parse.urlencode({
        "action": "query", "titles": title, "prop": "imageinfo",
        "iiprop": "url|size|extmetadata", "format": "json",
    })
    data = json.loads(http_get(f"https://commons.wikimedia.org/w/api.php?{q}"))
    page = next(iter(data["query"]["pages"].values()))
    if "imageinfo" not in page:
        raise RuntimeError(f"fichier Commons introuvable : {title}")
    return page["imageinfo"][0]


def fetch_page(spec: dict, dest: Path) -> dict:
    """Télécharge une page source (cache dans _src/). Renvoie des infos de provenance."""
    info: dict = {}
    if spec["kind"] == "commons":
        ii = commons_info(spec["title"])
        info = {
            "url": ii["descriptionurl"],
            "license": ii.get("extmetadata", {}).get("LicenseShortName", {}).get("value"),
        }
        if not dest.exists():
            # Original pleine résolution (le redimensionnement est fait ici, pas par Commons).
            dest.write_bytes(http_get(ii["url"]))
            time.sleep(1)
    elif spec["kind"] == "iiif":
        info = {"url": spec["service"]}
        if not dest.exists():
            dest.write_bytes(http_get(spec["service"] + "/full/2400,/0/default.jpg"))
            time.sleep(1)
    else:
        raise ValueError(spec)
    return info


# Traitement d'image -------------------------------------------------------------

def fit(img: Image.Image, max_side: int = MAX_SIDE) -> Image.Image:
    w, h = img.size
    s = min(1.0, max_side / max(w, h))
    if s < 1.0:
        img = img.resize((round(w * s), round(h * s)), Image.LANCZOS)
    return img


def save_jpeg(img: Image.Image, path: Path) -> None:
    img = fit(img.convert("RGB"))
    img.save(path, "JPEG", quality=JPEG_QUALITY, optimize=True)


def perspective_coeffs(src: list[tuple[float, float]], dst: list[tuple[float, float]]) -> list[float]:
    """Coefficients pour Image.transform(PERSPECTIVE) : dst (sortie) -> src (entrée).
    Résolution d'un système 8×8 par élimination de Gauss (pas de numpy)."""
    a, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    n = 8
    m = [row[:] + [bb] for row, bb in zip(a, b)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        for r in range(n):
            if r != c:
                f = m[r][c] / m[c][c]
                for k in range(c, n + 1):
                    m[r][k] -= f * m[c][k]
    return [m[i][n] / m[i][i] for i in range(n)]


def table_background(size: tuple[int, int], rng: random.Random) -> Image.Image:
    """Fond de table en bois clair/sombre : dégradé + fibres floues + grain."""
    fw, fh = size
    # On dessine plus grand puis on recadre au centre après rotation (pas de coins vides).
    w, h = int(fw * 1.3), int(fh * 1.3)
    palettes = [((120, 84, 52), (150, 108, 70)), ((92, 70, 50), (118, 92, 66)), ((170, 150, 120), (196, 178, 150))]
    c1, c2 = rng.choice(palettes)
    bg = Image.new("RGB", (w, h), c1)
    d = ImageDraw.Draw(bg)
    y = 0
    while y < h:
        t = rng.random()
        col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
        hh = rng.randint(3, 14)
        d.rectangle([0, y, w, y + hh], fill=col)
        y += hh
    bg = bg.filter(ImageFilter.GaussianBlur(2.5))
    # Rotation légère des fibres pour éviter des lignes parfaitement horizontales.
    bg = bg.rotate(rng.uniform(-8, 8), resample=Image.BICUBIC, expand=False, fillcolor=c1)
    left, top = (w - fw) // 2, (h - fh) // 2
    bg = bg.crop((left, top, left + fw, top + fh))
    w, h = fw, fh
    grain = Image.effect_noise((w, h), 18).convert("RGB")
    return ImageChops.overlay(bg, ImageEnhance.Brightness(grain).enhance(1.0)).filter(ImageFilter.GaussianBlur(0.6))


def phone_photo(scan: Image.Image, seed: int) -> Image.Image:
    """Simule une photo au téléphone d'un document posé sur une table."""
    rng = random.Random(seed)
    doc = fit(scan.convert("RGB"), 1800)
    dw, dh = doc.size
    # Cadre de la photo : marge autour du document, format 4:3 (ou 3:4).
    portrait = dh >= dw
    margin = 0.10 + rng.uniform(0.0, 0.06)
    W = int(dw * (1 + 2 * margin))
    H = int(dh * (1 + 2 * margin))
    if portrait:
        H = max(H, int(W * 4 / 3)); W = max(W, int(H * 3 / 4))
    else:
        W = max(W, int(H * 4 / 3)); H = max(H, int(W * 3 / 4))
    canvas = table_background((W, H), rng)

    # Coins du document dans la photo : centré puis coins perturbés (perspective légère).
    ox, oy = (W - dw) / 2, (H - dh) / 2
    j = 0.035
    def jit(v: float, span: float) -> float:
        return v + rng.uniform(-j, j) * span
    dst = [
        (jit(ox, dw), jit(oy, dh)),
        (jit(ox + dw, dw), jit(oy, dh)),
        (jit(ox + dw, dw), jit(oy + dh, dh)),
        (jit(ox, dw), jit(oy + dh, dh)),
    ]
    # Léger trapèze (téléphone tenu un peu penché vers le haut ou le bas).
    tilt = rng.uniform(-0.03, 0.03) * dw
    dst[0] = (dst[0][0] + tilt, dst[0][1]); dst[1] = (dst[1][0] - tilt, dst[1][1])
    src = [(0, 0), (dw, 0), (dw, dh), (0, dh)]
    coeffs = perspective_coeffs(src, dst)
    warped = doc.transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    mask = Image.new("L", (dw, dh), 255).transform((W, H), Image.PERSPECTIVE, coeffs, Image.BICUBIC)

    # Ombre portée du document sur la table.
    shadow = mask.filter(ImageFilter.GaussianBlur(18))
    shadow_off = Image.new("L", (W, H), 0)
    shadow_off.paste(shadow, (int(W * 0.008), int(H * 0.012)))
    canvas = Image.composite(Image.new("RGB", (W, H), (25, 18, 12)), canvas, shadow_off.point(lambda v: int(v * 0.55)))
    canvas.paste(warped, (0, 0), mask)

    # Éclairage : dégradé (lampe d'un côté) + vignettage.
    light = Image.new("L", (W, H))
    ld = ImageDraw.Draw(light)
    lx, ly = rng.uniform(0.2, 0.8) * W, rng.uniform(0.1, 0.5) * H
    rmax = math.hypot(W, H)
    for r in range(int(rmax), 0, -max(4, int(rmax / 120))):
        v = int(255 - 70 * (r / rmax) ** 1.4)
        ld.ellipse([lx - r, ly - r, lx + r, ly + r], fill=v)
    light = light.filter(ImageFilter.GaussianBlur(40))
    canvas = ImageChops.multiply(canvas, Image.merge("RGB", (light, light, light)))

    # Ombre douce d'une main ou du téléphone sur un coin du document.
    sh = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(sh)
    corner = rng.choice(["tl", "tr", "bl", "br", "b"])
    cx = {"tl": 0, "bl": 0, "tr": W, "br": W, "b": W / 2}[corner]
    cy = {"tl": 0, "tr": 0, "bl": H, "br": H, "b": H}[corner]
    rr = rng.uniform(0.28, 0.42) * max(W, H)
    sd.ellipse([cx - rr, cy - rr * 0.8, cx + rr, cy + rr * 0.8], fill=int(rng.uniform(55, 85)))
    sh = sh.filter(ImageFilter.GaussianBlur(max(W, H) * 0.06))
    canvas = ImageChops.subtract(canvas, Image.merge("RGB", (sh, sh, sh)))

    # Lumière chaude (lampe à incandescence / fin de journée).
    r_, g_, b_ = canvas.split()
    warm = rng.uniform(0.84, 0.92)
    r_ = r_.point(lambda v: min(255, int(v * 1.04 + 4)))
    b_ = b_.point(lambda v: int(v * warm))
    canvas = Image.merge("RGB", (r_, g_, b_))
    canvas = ImageEnhance.Contrast(canvas).enhance(rng.uniform(0.88, 0.96))

    # Mise au point imparfaite + bruit de capteur.
    canvas = canvas.filter(ImageFilter.GaussianBlur(rng.uniform(0.5, 0.9)))
    noise = Image.effect_noise((W, H), 22).convert("L")
    noise_rgb = Image.merge("RGB", (noise, noise, noise))
    canvas = Image.blend(canvas, ImageChops.overlay(canvas, noise_rgb), 0.18)

    # Compression intermédiaire (appareil photo) avant l'encodage final q85.
    buf = io.BytesIO()
    canvas.save(buf, "JPEG", quality=rng.randint(72, 80))
    buf.seek(0)
    return Image.open(buf).convert("RGB")


# Programme principal ------------------------------------------------------------

def seed_for(name: str) -> int:
    return int(hashlib.sha256(name.encode()).hexdigest()[:8], 16)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="ne traiter que cet id")
    ap.add_argument("--no-download", action="store_true", help="n'utiliser que le cache _src/")
    args = ap.parse_args()

    for d in (OUT_DIR, CLEAN_DIR, SRC_DIR):
        d.mkdir(parents=True, exist_ok=True)

    manifest = []
    for s in SOURCES:
        sid = s["id"]
        images, clean_images, page_urls = [], [], []
        for n, spec in enumerate(s["pages"], start=1):
            raw = SRC_DIR / f"{sid}-{n}.orig"
            if args.only and args.only != sid:
                pass
            elif args.no_download and not raw.exists():
                print(f"  ! {sid}-{n}: absent du cache", file=sys.stderr)
            else:
                info = fetch_page(spec, raw) if not args.no_download else {}
                if info.get("url"):
                    page_urls.append(info["url"])
                scan = ImageOps.exif_transpose(Image.open(raw)).convert("RGB")
                save_jpeg(scan, CLEAN_DIR / f"{sid}-{n}.jpg")
                save_jpeg(phone_photo(scan, seed_for(f"{sid}-{n}")), OUT_DIR / f"{sid}-{n}.jpg")
                print(f"  ✓ {sid}-{n}")
            images.append(f"handwritten/{sid}-{n}.jpg")
            clean_images.append(f"handwritten/clean/{sid}-{n}.jpg")

        # URL « humaine » de la source : page Commons / notice Wellcome.
        if "source_url" in s:
            source_url = s["source_url"]
        elif s["pages"][0]["kind"] == "commons":
            source_url = "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(s["pages"][0]["title"].replace(" ", "_"))
        else:
            source_url = s["pages"][0]["service"]
        extra_urls = []
        if s["pages"][0]["kind"] == "commons" and len(s["pages"]) > 1:
            extra_urls = ["https://commons.wikimedia.org/wiki/" + urllib.parse.quote(p["title"].replace(" ", "_")) for p in s["pages"][1:]]

        license_name, license_url = s["license"]
        entry = {
            "id": sid,
            "category": "handwritten",
            "subtype": s["subtype"],
            "lang": s["lang"],
            "era": s["era"],
            "images": images,
            "clean_images": clean_images,
            "image_variant": "photo-simulee",  # images = version « photographiée au téléphone » (cas testé principal)
            "truth": f"truth/{sid}.json",
            "source_url": source_url,
            "source_title": s.get("source_title") or PZ_SOURCE_TITLE.format(inv=s.get("inv")),
            "license": license_name,
            "license_url": license_url,
            "provenance": s.get("provenance") or PZ_PROVENANCE,
            "difficulty": s["difficulty"],
            "truth_method": "transcription-relue",
            "notes": s["notes"],
        }
        if extra_urls:
            entry["source_url_extra"] = extra_urls
        if s.get("inv"):
            entry["institution_url"] = "https://www.parismuseescollections.paris.fr/fr/musee-de-la-liberation-de-paris-musee-du-general-leclerc-musee-jean-moulin"
        manifest.append(entry)

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"manifeste : {MANIFEST.relative_to(ROOT)} ({len(manifest)} cas)")


if __name__ == "__main__":
    main()
