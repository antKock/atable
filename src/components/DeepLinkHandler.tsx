"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native";

// Routes incoming Universal Links into the WebView. When iOS opens the app from
// an https://mijote… link (e.g. a shared recipe /r/<token>), Capacitor delivers
// the URL via getLaunchUrl (cold start) or the appUrlOpen event (warm). The app
// loads the remote origin as its base, so we just client-navigate to the path.
export default function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;

    let remove: (() => void) | undefined;

    function routeTo(rawUrl: string) {
      try {
        const u = new URL(rawUrl);
        if (!u.hostname.includes("mijote.anthonykocken.fr")) return;
        const target = u.pathname + u.search;
        if (target && target !== "/") router.push(target);
      } catch {
        // Not a parseable URL — ignore.
      }
    }

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        // Cold start: route the launch URL, but ONLY ONCE per app session.
        // getLaunchUrl keeps returning the launch URL across in-app navigations,
        // and a window.location navigation reloads the JS context — without this
        // guard, every full-page navigation re-reads the launch URL and bounces
        // the user back to it (e.g. /r/<token>). sessionStorage survives those
        // reloads but is cleared when the app is genuinely relaunched.
        if (!sessionStorage.getItem("mijote_launch_routed")) {
          sessionStorage.setItem("mijote_launch_routed", "1");
          const launch = await App.getLaunchUrl();
          if (launch?.url) routeTo(launch.url);
        }
        // Warm: link tapped while the app is already running.
        const handle = await App.addListener("appUrlOpen", ({ url }) =>
          routeTo(url),
        );
        remove = () => {
          handle.remove();
        };
      } catch {
        // @capacitor/app unavailable (web) — nothing to wire.
      }
    })();

    return () => remove?.();
  }, [router]);

  return null;
}
