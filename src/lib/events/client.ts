"use client";

import { getPlatform } from "@/lib/native";
import { BUILD_ID } from "@/lib/version";
import {
  DATA_TRACK_NONE,
  EVENTS_BATCH_MAX,
  EVENT_STRING_MAX,
  type EntryInfo,
  type EventName,
  type EventProps,
  type RouteParams,
} from "./catalog";

/**
 * Émission client des événements produit (#28, §7.1). UN module : la file, le
 * vidage (5 s / 20 événements / sortie d'écran / arrière-plan via sendBeacon),
 * et les résolveurs des flux automatiques utilisés par EventsProvider. Aucune
 * identité ici : le serveur lit les cookies. Best-effort de bout en bout —
 * jamais d'erreur visible, pas de localStorage (une file perdue à la fermeture
 * est acceptable).
 */

type Queued = { name: EventName; props: unknown; at: number };

const FLUSH_AFTER_MS = 5_000;
const FLUSH_AT = 20;

const queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let enabled = false;
let retriedOnce = false;

/** Écran courant, tenu à jour par EventsProvider (sert aux explicites). */
export const currentScreen: { route: string; params?: RouteParams } = { route: "" };

export function setEventsEnabled(value: boolean): void {
  enabled = value;
  if (!value) queue.length = 0;
}

export function track<N extends EventName>(name: N, props: EventProps[N]): void {
  if (!enabled) return;
  queue.push({ name, props, at: Date.now() });
  if (queue.length >= FLUSH_AT) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_AFTER_MS);
}

/** Explicite `error.shown` : une erreur affichée sans appel API derrière. */
export function trackError(kind: string): void {
  track("error.shown", { kind, route: currentScreen.route });
}

/** Vide la file. `beacon` : sortie de page, le fetch normal serait annulé. */
export function flush(beacon = false): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  while (queue.length > 0) {
    const events = queue.splice(0, EVENTS_BATCH_MAX);
    send(events, beacon);
  }
}

function send(events: Queued[], beacon: boolean): void {
  const body = JSON.stringify({ platform: getPlatform(), appVersion: BUILD_ID, events });
  if (beacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    try {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      return;
    } catch {
      // Repli fetch ci-dessous.
    }
  }
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Une seule nouvelle tentative par vie de page, puis abandon.
    if (retriedOnce) return;
    retriedOnce = true;
    queue.unshift(...events);
    if (!timer) timer = setTimeout(flush, FLUSH_AFTER_MS);
  });
}

// ----- Résolveurs des flux automatiques ------------------------------------

/**
 * Motif Next d'un écran depuis le chemin concret et `useParams()` :
 * `/recipes/abc-123` + `{ id: "abc-123" }` → `/recipes/[id]`. Les identifiants
 * vont dans `params`, jamais dans `route`.
 */
export function screenRoute(
  pathname: string,
  params: Record<string, string | string[] | undefined>,
): { route: string; params?: RouteParams } {
  let route = pathname;
  const out: RouteParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const joined = Array.isArray(value) ? value.join("/") : value;
    for (const candidate of [joined, encodeURIComponent(joined)]) {
      if (candidate && route.includes(`/${candidate}`)) {
        route = route.replace(`/${candidate}`, `/[${key}]`);
        break;
      }
    }
    out[key] = joined;
  }
  return Object.keys(out).length > 0 ? { route, params: out } : { route };
}

const IN_APP_UA: [string, RegExp][] = [
  ["instagram", /Instagram/i],
  ["messenger", /FB_IAB\/MESSENGER|Messenger/i],
  ["facebook", /FBAN|FBAV|FB_IAB/i],
  ["whatsapp", /WhatsApp/i],
  ["tiktok", /TikTok|BytedanceWebview|musical_ly/i],
  ["linkedin", /LinkedInApp/i],
  ["x", /Twitter/i],
  ["snapchat", /Snapchat/i],
];
const CLICK_IDS = ["fbclid", "gclid", "ttclid", "msclkid"];
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

/**
 * Origine d'entrée d'un chargement de page : referrer (hôte seulement, hors
 * origine propre), UTM, navigateur intégré, présence d'un click-id. `undefined`
 * quand rien n'est connu (shell natif, saisie directe). Pur : testable.
 */
export function entryInfo(input: {
  referrer: string;
  search: string;
  userAgent: string;
  origin: string;
}): EntryInfo | undefined {
  const out: EntryInfo = {};
  if (input.referrer) {
    try {
      const url = new URL(input.referrer);
      if (url.origin !== input.origin) out.referrer_host = url.hostname.slice(0, EVENT_STRING_MAX);
    } catch {
      // referrer illisible : ignoré
    }
  }
  const params = new URLSearchParams(input.search);
  for (const key of UTM_KEYS) {
    const v = params.get(key)?.trim().toLowerCase();
    if (v) out[key] = v.slice(0, EVENT_STRING_MAX);
  }
  const clickId = CLICK_IDS.find((k) => params.has(k));
  if (clickId) out.click_id = clickId;
  // Share Extension iOS : WKWebView chargé avec `?ext=1` (src/lib/share-extension.ts),
  // même cookie jar que l'app mais `getPlatform()` dit `web` — la marquer ici.
  if (params.get("ext") === "1") out.in_app = "share-extension";
  else {
    const inApp = IN_APP_UA.find(([, re]) => re.test(input.userAgent));
    if (inApp) out.in_app = inApp[0];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const CLICKABLE = "button, a, [role=button], input[type=submit]";

/**
 * Cible d'un clic : le `data-track` le plus proche, ou la trace de secours
 * `?tag#id` (jamais le texte — bilinguisme). `null` = pas un élément cliquable
 * ou `data-track="none"`.
 */
export function clickTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const clickable = target.closest(CLICKABLE);
  if (!clickable) return null;
  const tracked = clickable.closest<HTMLElement>("[data-track]");
  const id = tracked?.dataset.track;
  if (id === DATA_TRACK_NONE) return null;
  if (id) return id;
  const tag = clickable.tagName.toLowerCase();
  return `?${tag}${clickable.id ? `#${clickable.id}` : ""}`;
}
