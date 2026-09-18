#!/usr/bin/env python3
"""
Pool OCR Mijote — famille « pages imprimées photographiées au téléphone ».

Transforme des pages propres (scans d'archive ou pages modernes rendues par
Playwright) en images qui ressemblent à une photo prise à main levée :
page de biais (perspective), légère rotation, courbure près de la reliure,
double page, table ou plan de travail visible autour, lumière chaude de
cuisine, vignettage, ombre portée (main / téléphone), flou de bougé,
mise au point imparfaite, bruit capteur, compression JPEG.

Usage (appelé par build-printed.mjs, mais utilisable seul) :

    uv run --with numpy --with opencv-python-headless \
        python scripts/bench/ocr-pool/distort-printed.py jobs.json

jobs.json = liste d'objets :
    {
      "pages": ["chemin/page-gauche.png", "chemin/page-droite.png"],  # 1 ou 2 pages
      "profile": "facile" | "moyen" | "difficile",
      "seed": 1234,                        # graine fixe => sortie reproductible
      "out": "printed/<id>-<n>.jpg",       # image « photo »
      "clean_pages": ["..."],              # page(s) propre(s) à exporter telles quelles
      "clean_out": ["printed/clean/<id>-<n>.jpg", ...],
      "binding": "left" | "right" | null   # côté de la reliure pour une page seule
    }

Chaque job écrit sur la sortie standard une ligne JSON décrivant les
déformations réellement tirées (pour le manifeste).

Format final (celui qu'envoie le client Mijote) : JPEG qualité 85,
côté long ≤ 2048 px.
"""
import json
import math
import sys

import cv2
import numpy as np

MAX_SIDE = 2048
JPEG_QUALITY = 85


# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------

def load_rgb(path):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"image illisible : {path}")
    return img  # BGR uint8


def prepare(img, prep):
    """
    Pré-traitement d'un scan d'archive (facultatif, décrit dans printed-scans.json) :
    - crop  : [x0, y0, x1, y1] en fractions — retire les bords de numérisation
              (plateau du scanner, liseré de la page voisine) ;
    - paper : true — un microfilm bitonal rendu en gris est ramené à un papier
              clair et une encre sombre (sinon la « photo » serait une page grise).
    """
    if not prep:
        return img
    h, w = img.shape[:2]
    if prep.get("crop"):
        x0, y0, x1, y1 = prep["crop"]
        img = img[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    if prep.get("paper"):
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
        lo, hi = np.percentile(g, 1), np.percentile(g, 60)
        t = np.clip((g - lo) / max(hi - lo, 1), 0, 1)[..., None]
        ink = np.array([38, 34, 32], np.float32)
        paper = np.array([214, 228, 236], np.float32)  # BGR crème
        img = np.clip(ink + (paper - ink) * t, 0, 255).astype(np.uint8)
    return img


def fit_max_side(img, max_side=MAX_SIDE):
    h, w = img.shape[:2]
    s = max_side / max(h, w)
    if s >= 1:
        return img
    return cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)


def save_jpeg(img, path, quality=JPEG_QUALITY):
    ok = cv2.imwrite(path, img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise SystemExit(f"écriture impossible : {path}")


def jpeg_roundtrip(img, quality):
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, int(quality)])
    return cv2.imdecode(buf, cv2.IMREAD_COLOR)


# ---------------------------------------------------------------------------
# Fonds : table en bois, plan de travail, nappe, ardoise
# ---------------------------------------------------------------------------

def smooth_noise(rng, h, w, scale):
    """Bruit basse fréquence (bruit blanc agrandi puis lissé)."""
    sh, sw = max(2, h // scale), max(2, w // scale)
    n = rng.random((sh, sw)).astype(np.float32)
    n = cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)
    return cv2.GaussianBlur(n, (0, 0), scale / 3)


def background(rng, h, w, kind):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    if kind == "bois":
        base = np.array([48, 92, 150], np.float32)  # BGR brun
        warp = smooth_noise(rng, h, w, 60) * 40
        grain = np.sin((yy + warp) / rng.uniform(6, 14)) * 0.5 + 0.5
        fine = smooth_noise(rng, h, w, 4)
        v = 0.75 + 0.18 * grain + 0.10 * fine
        img = base[None, None, :] * v[..., None]
        # lames de parquet / planches
        plank = int(rng.uniform(h / 5, h / 3))
        for y0 in range(plank, h, plank):
            img[max(0, y0 - 2):y0 + 1] *= 0.6
    elif kind == "plan-de-travail":
        base = np.array(rng.choice([[200, 200, 198], [170, 176, 182], [215, 222, 228]]), np.float32)
        speck = (rng.random((h, w)) > 0.985).astype(np.float32)
        speck = cv2.GaussianBlur(speck, (0, 0), 1.2) * 3
        v = 0.92 + 0.08 * smooth_noise(rng, h, w, 80) - 0.25 * np.clip(speck, 0, 1)
        img = base[None, None, :] * v[..., None]
    elif kind == "nappe":
        color = np.array(rng.choice([[60, 60, 170], [150, 110, 60], [90, 140, 90]]), np.float32)
        period = rng.uniform(40, 90)
        stripes = ((np.floor(xx / period) + np.floor(yy / period)) % 2).astype(np.float32)
        weave = (np.sin(xx * 1.3) * np.sin(yy * 1.3)) * 0.04
        v = 0.55 + 0.4 * stripes + weave
        white = np.array([235, 238, 240], np.float32)
        img = white[None, None, :] * v[..., None] * 0.5 + color[None, None, :] * (1 - v[..., None]) + color * 0.3
    else:  # ardoise
        base = np.array([55, 58, 60], np.float32)
        v = 0.85 + 0.25 * smooth_noise(rng, h, w, 30) + 0.05 * rng.random((h, w)).astype(np.float32)
        img = base[None, None, :] * v[..., None]
    return np.clip(img, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# Assemblage de la double page et courbure près de la reliure
# ---------------------------------------------------------------------------

def make_spread(pages):
    h = max(p.shape[0] for p in pages)
    rs = [cv2.resize(p, (round(p.shape[1] * h / p.shape[0]), h), interpolation=cv2.INTER_AREA)
          if p.shape[0] != h else p for p in pages]
    return np.concatenate(rs, axis=1), rs[0].shape[1]


def curl_and_shade(img, gutter_x, rng, strength, sides):
    """
    Courbure : près de la reliure (gutter_x), les lignes se tordent (déplacement
    vertical croissant vers la reliure, plus fort en haut et en bas de page) et
    le papier est comprimé horizontalement ; l'ombre du pli assombrit la zone.
    sides : "both" (double page), "left" ou "right" (page seule, reliure du côté indiqué).
    """
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.abs(xx - gutter_x)
    if sides == "left":
        d = xx - gutter_x
    elif sides == "right":
        d = gutter_x - xx
    d = np.clip(d, 0, None)
    sigma = w * rng.uniform(0.06, 0.12) * (1 if sides == "both" else 2)
    g = np.exp(-d / sigma)
    cy = h / 2
    amp = strength * h * 0.035
    # les lignes descendent en bas de page et remontent en haut (effet « sourire »)
    dy = amp * g * ((yy - cy) / cy) + amp * 0.35 * g
    # compression horizontale vers la reliure
    sign = np.where(xx < gutter_x, 1.0, -1.0) if sides == "both" else (1.0 if sides == "right" else -1.0)
    dx = sign * strength * sigma * 0.25 * g
    map_x = (xx - dx).astype(np.float32)
    map_y = (yy - dy).astype(np.float32)
    out = cv2.remap(img, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    shade = 1 - (0.15 + 0.35 * strength) * np.exp(-d / (sigma * 0.45))
    out = out.astype(np.float32) * shade[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# Mise en scène : page posée sur la table, tranche du livre, ombre
# ---------------------------------------------------------------------------

def place_on_table(page, rng, margin_ratio, bg_kind, book_edges):
    ph, pw = page.shape[:2]
    m = int(max(ph, pw) * margin_ratio)
    H, W = ph + 2 * m, pw + 2 * m
    canvas = background(rng, H, W, bg_kind).astype(np.float32)
    # ombre portée de la page sur la table
    mask = np.zeros((H, W), np.float32)
    off = int(m * 0.08) + 4
    cv2.rectangle(mask, (m + off, m + off), (m + pw + off, m + ph + off), 1.0, -1)
    mask = cv2.GaussianBlur(mask, (0, 0), max(3, m * 0.06))
    canvas *= (1 - 0.45 * mask)[..., None]
    # tranche du livre : feuillets empilés visibles sous la page
    if book_edges:
        for i in range(int(rng.integers(3, 8)), 0, -1):
            dx = i * 2 * (1 if rng.random() < 0.5 else -1)
            dy = i * 3
            tone = 225 - i * 9
            cv2.rectangle(canvas, (m + dx, m + dy), (m + pw + dx, m + ph + dy), (tone - 8, tone, tone + 4), -1)
    canvas[m:m + ph, m:m + pw] = page.astype(np.float32)
    corners = np.float32([[m, m], [m + pw, m], [m + pw, m + ph], [m, m + ph]])
    return np.clip(canvas, 0, 255).astype(np.uint8), corners


def perspective(img, corners, rng, tilt_deg, rot_deg):
    """Rotation 3D de la scène (page de biais) puis projection pinhole."""
    H, W = img.shape[:2]
    f = 1.1 * max(H, W)
    ax = math.radians(tilt_deg) * (1 if rng.random() < 0.5 else -1)
    ay = math.radians(tilt_deg * rng.uniform(0.2, 0.8)) * (1 if rng.random() < 0.5 else -1)
    if rng.random() < 0.5:
        ax, ay = ay, ax
    az = math.radians(rot_deg)
    Rx = np.array([[1, 0, 0], [0, math.cos(ax), -math.sin(ax)], [0, math.sin(ax), math.cos(ax)]])
    Ry = np.array([[math.cos(ay), 0, math.sin(ay)], [0, 1, 0], [-math.sin(ay), 0, math.cos(ay)]])
    Rz = np.array([[math.cos(az), -math.sin(az), 0], [math.sin(az), math.cos(az), 0], [0, 0, 1]])
    R = Rz @ Ry @ Rx
    src = np.float32([[0, 0], [W, 0], [W, H], [0, H]])
    dst = []
    for x, y in src:
        p = R @ np.array([x - W / 2, y - H / 2, 0.0])
        z = f + p[2]
        dst.append([f * p[0] / z, f * p[1] / z])
    dst = np.float32(dst)
    dst -= dst.min(axis=0)
    M = cv2.getPerspectiveTransform(src, dst)
    ow, oh = int(math.ceil(dst[:, 0].max())), int(math.ceil(dst[:, 1].max()))
    out = cv2.warpPerspective(img, M, (ow, oh), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    pc = cv2.perspectiveTransform(corners.reshape(-1, 1, 2), M).reshape(-1, 2)
    return out, pc


def frame_crop(img, page_corners, rng, fill):
    """Recadre comme le ferait l'utilisateur : la page occupe ~fill du cadre, rien n'est coupé."""
    H, W = img.shape[:2]
    x0, y0 = page_corners.min(axis=0)
    x1, y1 = page_corners.max(axis=0)
    pw, ph = x1 - x0, y1 - y0
    cw, ch = pw / fill, ph / fill
    # format portrait ou paysage de téléphone (4:3)
    if cw / ch > 1:
        ch = max(ch, cw * 3 / 4)
        cw = max(cw, ch * 4 / 3)
    else:
        cw = max(cw, ch * 3 / 4)
        ch = max(ch, cw * 4 / 3)
    cx = (x0 + x1) / 2 + rng.uniform(-0.3, 0.3) * (cw - pw) / 2
    cy = (y0 + y1) / 2 + rng.uniform(-0.3, 0.3) * (ch - ph) / 2
    a, b = int(max(0, cx - cw / 2)), int(max(0, cy - ch / 2))
    c, d = int(min(W, cx + cw / 2)), int(min(H, cy + ch / 2))
    return img[b:d, a:c]


# ---------------------------------------------------------------------------
# Lumière, ombre portée, flou, bruit
# ---------------------------------------------------------------------------

def lighting(img, rng, warmth, vignette, brightness):
    h, w = img.shape[:2]
    f = img.astype(np.float32)
    # balance des blancs chaude (ampoule de cuisine) : moins de bleu, un peu moins de vert
    f[..., 0] *= 1 - 0.22 * warmth
    f[..., 1] *= 1 - 0.07 * warmth
    f[..., 2] *= 1 + 0.03 * warmth
    # éclairage non uniforme : gradient linéaire dans une direction aléatoire
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ang = rng.uniform(0, 2 * math.pi)
    grad = ((xx / w - 0.5) * math.cos(ang) + (yy / h - 0.5) * math.sin(ang))
    f *= (brightness + 0.25 * vignette * grad)[..., None]
    # vignettage radial
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    f *= (1 - vignette * 0.45 * np.clip(r - 0.35, 0, None) ** 1.6)[..., None]
    return np.clip(f, 0, 255).astype(np.uint8)


def cast_shadow(img, rng, depth):
    """Ombre douce d'une main ou du téléphone qui entre par un bord et couvre une partie du texte."""
    h, w = img.shape[:2]
    mask = np.zeros((h, w), np.float32)
    edge = rng.integers(0, 4)
    reach = rng.uniform(0.3, 0.55)
    thick = rng.uniform(0.25, 0.5)
    if edge == 0:  # depuis le bas
        cx = rng.uniform(0.3, 0.8) * w
        pts = [[cx - thick * w / 2, h], [cx + thick * w / 2, h],
               [cx + thick * w * 0.3, h * (1 - reach)], [cx - thick * w * 0.4, h * (1 - reach * 0.9)]]
    elif edge == 1:  # depuis la droite
        cy = rng.uniform(0.3, 0.8) * h
        pts = [[w, cy - thick * h / 2], [w, cy + thick * h / 2],
               [w * (1 - reach), cy + thick * h * 0.3], [w * (1 - reach * 0.85), cy - thick * h * 0.35]]
    elif edge == 2:  # depuis la gauche
        cy = rng.uniform(0.3, 0.8) * h
        pts = [[0, cy - thick * h / 2], [0, cy + thick * h / 2],
               [w * reach, cy + thick * h * 0.3], [w * reach * 0.85, cy - thick * h * 0.35]]
    else:  # bande diagonale (ombre du téléphone tenu au-dessus)
        pts = [[0, h * rng.uniform(0.2, 0.5)], [w * rng.uniform(0.5, 0.9), 0],
               [w, 0], [w, h * rng.uniform(0.05, 0.2)], [w * 0.2, h * rng.uniform(0.7, 0.95)], [0, h]]
    cv2.fillPoly(mask, [np.int32(pts)], 1.0)
    mask = cv2.GaussianBlur(mask, (0, 0), max(h, w) * rng.uniform(0.02, 0.05))
    f = img.astype(np.float32) * (1 - depth * mask)[..., None]
    # l'ombre est légèrement bleutée (lumière d'ambiance froide)
    f[..., 0] += depth * mask * 6
    return np.clip(f, 0, 255).astype(np.uint8)


def motion_blur(img, length, angle):
    k = np.zeros((length, length), np.float32)
    k[length // 2, :] = 1
    M = cv2.getRotationMatrix2D((length / 2 - 0.5, length / 2 - 0.5), angle, 1)
    k = cv2.warpAffine(k, M, (length, length))
    k /= max(k.sum(), 1e-6)
    return cv2.filter2D(img, -1, k)


def sensor_noise(img, rng, sigma):
    f = img.astype(np.float32)
    lum = rng.normal(0, sigma, img.shape[:2]).astype(np.float32)[..., None]
    chroma = rng.normal(0, sigma * 0.5, img.shape).astype(np.float32)
    f += lum + chroma
    return np.clip(f, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# Profils
# ---------------------------------------------------------------------------

def draw_params(rng, profile, n_pages):
    if profile == "facile":
        return dict(
            tilt=rng.uniform(0, 3), rot=rng.uniform(-1.5, 1.5),
            curl=rng.uniform(0.0, 0.25) if n_pages == 2 else 0.0,
            warmth=rng.uniform(0, 0.15), vignette=rng.uniform(0, 0.15), brightness=rng.uniform(0.97, 1.03),
            shadow=None, blur=rng.uniform(0, 0.4), motion=0, noise=rng.uniform(1, 2),
            pre_jpeg=None, fill=rng.uniform(0.88, 0.95), margin=0.12,
        )
    if profile == "moyen":
        return dict(
            tilt=rng.uniform(5, 12), rot=rng.uniform(-4, 4),
            curl=rng.uniform(0.3, 0.7),
            warmth=rng.uniform(0.3, 0.6), vignette=rng.uniform(0.3, 0.6), brightness=rng.uniform(0.85, 0.98),
            shadow=rng.uniform(0.3, 0.5) if rng.random() < 0.5 else None,
            blur=rng.uniform(0.4, 0.9), motion=int(rng.integers(0, 4)), noise=rng.uniform(2.5, 4.0),
            pre_jpeg=int(rng.integers(70, 85)) if rng.random() < 0.5 else None,
            fill=rng.uniform(0.8, 0.9), margin=0.2,
        )
    return dict(  # difficile
        tilt=rng.uniform(12, 20), rot=rng.uniform(-8, 8),
        curl=rng.uniform(0.7, 1.0),
        warmth=rng.uniform(0.6, 0.9), vignette=rng.uniform(0.6, 0.9), brightness=rng.uniform(0.72, 0.9),
        shadow=rng.uniform(0.45, 0.65),
        blur=rng.uniform(0.7, 1.3), motion=int(rng.integers(3, 6)), noise=rng.uniform(4.0, 6.5),
        pre_jpeg=int(rng.integers(55, 72)),
        fill=rng.uniform(0.74, 0.86), margin=0.25,
    )


def run_job(job):
    rng = np.random.default_rng(job["seed"])
    preps = job.get("prep") or [None] * len(job["pages"])
    pages = [prepare(load_rgb(p), pr) for p, pr in zip(job["pages"], preps)]
    p = draw_params(rng, job["profile"], len(pages))
    labels = []

    # 1. page seule ou double page
    if len(pages) == 2:
        page, gutter = make_spread(pages)
        sides = "both"
        labels.append("double-page")
    else:
        page = pages[0]
        binding = job.get("binding") or ("left" if rng.random() < 0.5 else "right")
        gutter = 0 if binding == "left" else page.shape[1]
        sides = binding

    # les pages très grandes sont d'abord ramenées à ~3000 px pour garder un temps raisonnable
    s = 3000 / max(page.shape[:2])
    if s < 1:
        page = cv2.resize(page, (round(page.shape[1] * s), round(page.shape[0] * s)), interpolation=cv2.INTER_AREA)
        gutter = int(gutter * s)

    # 2. courbure près de la reliure
    if p["curl"] > 0.05:
        page = curl_and_shade(page, gutter, rng, p["curl"], sides)
        labels.append(f"courbure-reliure-{p['curl']:.1f}")

    # 3. page posée sur la table
    bg_kind = str(rng.choice(["bois", "plan-de-travail", "nappe", "ardoise"]))
    scene, corners = place_on_table(page, rng, p["margin"], bg_kind, book_edges=len(pages) == 1)
    labels.append(f"fond-{bg_kind}")

    # 4. perspective + rotation
    scene, corners = perspective(scene, corners, rng, p["tilt"], p["rot"])
    labels.append(f"perspective-{p['tilt']:.0f}deg")
    if abs(p["rot"]) >= 0.5:
        labels.append(f"rotation-{p['rot']:+.1f}deg")
    # une double page se photographie en remplissant davantage le cadre
    scene = frame_crop(scene, corners, rng, min(0.96, p["fill"] + (0.06 if len(pages) == 2 else 0)))

    # 5. mise à l'échelle d'un capteur de téléphone (le bruit s'applique à cette échelle)
    scene = fit_max_side(scene, int(rng.integers(1800, MAX_SIDE + 1)))

    # 6. lumière chaude, vignettage, ombre portée
    scene = lighting(scene, rng, p["warmth"], p["vignette"], p["brightness"])
    if p["warmth"] >= 0.3:
        labels.append("lumiere-chaude")
    if p["vignette"] >= 0.3:
        labels.append("vignettage")
    if p["shadow"]:
        scene = cast_shadow(scene, rng, p["shadow"])
        labels.append("ombre-portee")

    # 7. mise au point imparfaite + flou de bougé
    if p["blur"] > 0.2:
        scene = cv2.GaussianBlur(scene, (0, 0), p["blur"])
        if p["blur"] >= 0.8:
            labels.append(f"flou-{p['blur']:.1f}")
    if p["motion"] >= 3:
        scene = motion_blur(scene, p["motion"], rng.uniform(0, 180))
        labels.append(f"bouge-{p['motion']}px")

    # 8. bruit capteur + compression intermédiaire (appareil / messagerie)
    scene = sensor_noise(scene, rng, p["noise"])
    labels.append("bruit")
    if p["pre_jpeg"]:
        scene = jpeg_roundtrip(scene, p["pre_jpeg"])
        labels.append(f"jpeg-{p['pre_jpeg']}")

    # 9. format final Mijote
    scene = fit_max_side(scene)
    save_jpeg(scene, job["out"])
    labels.append("jpeg-85")

    # version propre (avant déformation) : page(s) cible(s) seules, droites
    cpreps = job.get("clean_prep") or [None] * len(job.get("clean_pages", []))
    for src, dst, pr in zip(job.get("clean_pages", []), job.get("clean_out", []), cpreps):
        save_jpeg(fit_max_side(prepare(load_rgb(src), pr)), dst)

    h, w = scene.shape[:2]
    return {"out": job["out"], "size": [w, h], "distortions": labels}


def main():
    jobs = json.load(open(sys.argv[1]))
    for job in jobs:
        print(json.dumps(run_job(job), ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
