"use client";

import { useEffect, useRef } from "react";
import { useParams, usePathname } from "next/navigation";
import {
  clickTarget,
  currentScreen,
  entryInfo,
  flush,
  screenRoute,
  setEventsEnabled,
  track,
} from "@/lib/events/client";

/**
 * Flux automatiques des événements produit (#28) : écrans (A), clics (B),
 * impressions (`ui.seen`, opt-in `data-seen`), ouverture/reprise. Monté une
 * fois dans le layout racine ; se désactive sur /admin.
 *
 * Durées : `screen.left` porte le temps depuis l'entrée sur l'écran ou depuis
 * la dernière reprise (`app.resumed`) — une reprise ne compte pas comme une
 * nouvelle vue (sinon les consultations de recettes seraient gonflées).
 */
export default function EventsProvider() {
  const pathname = usePathname();
  const params = useParams();
  const screen = useRef<{ route: string; params?: Record<string, string>; since: number } | null>(
    null,
  );
  const seen = useRef(new Set<string>());
  // `useParams()` peut rendre un nouvel objet à chaque rendu : clé stable.
  const paramsKey = JSON.stringify(params);

  // Ouverture/reprise, clics, impressions, sortie de page : posés une fois.
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    track("app.opened", {});

    const onClick = (e: MouseEvent) => {
      const target = clickTarget(e.target);
      if (!target) return;
      track("ui.clicked", { target, ...screenRef() });
    };

    const onVisibility = () => {
      const s = screen.current;
      if (document.visibilityState === "hidden") {
        if (s)
          track("screen.left", {
            route: s.route,
            params: s.params,
            duration_ms: Date.now() - s.since,
          });
        flush(true);
      } else {
        if (s) s.since = Date.now();
        track("app.resumed", {});
      }
    };
    const onPageHide = () => flush(true);

    // Impressions : une fois par écran et par identifiant, quand la moitié de
    // l'élément est visible. Les éléments apparaissent après le rendu (données
    // SWR, hints) → un MutationObserver ré-inspecte le DOM, avec un délai.
    const observed = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.track;
          if (!id || seen.current.has(id)) continue;
          seen.current.add(id);
          track("ui.seen", { target: id, ...screenRef() });
        }
      },
      { threshold: 0.5 },
    );
    const scan = () => {
      document.querySelectorAll<HTMLElement>("[data-track][data-seen]").forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        io.observe(el);
      });
    };
    let scanTimer: ReturnType<typeof setTimeout> | null = null;
    const mo = new MutationObserver(() => {
      if (scanTimer) return;
      scanTimer = setTimeout(() => {
        scanTimer = null;
        scan();
      }, 300);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    scan();

    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      mo.disconnect();
      io.disconnect();
      if (scanTimer) clearTimeout(scanTimer);
    };
    // Le premier chemin décide (admin ou non) ; les changements suivants sont
    // gérés par l'effet écrans.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Écrans : vue à chaque changement de chemin, sortie du précédent avec durée.
  useEffect(() => {
    const admin = pathname.startsWith("/admin");
    setEventsEnabled(!admin);
    if (admin) return;

    const current = screenRoute(pathname, params as Record<string, string | string[] | undefined>);
    const prev = screen.current;
    // Idempotent : un re-rendu sur le même écran (Strict Mode en dev, double
    // rendu) n'est ni une sortie ni une nouvelle vue.
    if (
      prev &&
      prev.route === current.route &&
      JSON.stringify(prev.params ?? {}) === JSON.stringify(current.params ?? {})
    ) {
      return;
    }
    if (prev) {
      track("screen.left", { ...prev, duration_ms: Date.now() - prev.since });
      flush();
    }
    currentScreen.route = current.route;
    currentScreen.params = current.params;
    // Origine d'entrée sur la PREMIÈRE vue d'un chargement (pas de `prev`) :
    // referrer, UTM, navigateur intégré — d'où vient la personne.
    const entry = prev
      ? undefined
      : entryInfo({
          referrer: document.referrer,
          search: window.location.search,
          userAgent: navigator.userAgent,
          origin: window.location.origin,
        });
    screen.current = { ...current, since: Date.now() };
    seen.current = new Set();
    track("screen.viewed", entry ? { ...current, entry } : current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, paramsKey]);

  return null;
}

function screenRef(): { route: string; params?: Record<string, string> } {
  return currentScreen.params
    ? { route: currentScreen.route, params: currentScreen.params }
    : { route: currentScreen.route };
}
