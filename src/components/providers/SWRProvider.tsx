"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { SWR_CACHE_KEY, isSwrCacheDropped } from "@/lib/swr";

function localStorageProvider() {
  if (typeof window === "undefined") return new Map();

  let map: Map<string, unknown>;
  try {
    map = new Map(JSON.parse(localStorage.getItem(SWR_CACHE_KEY) || "[]"));
  } catch {
    map = new Map();
  }

  // `pagehide`, not `beforeunload`: WKWebView/iOS Safari kill the page without
  // firing beforeunload, so on the main platform the cache was rarely saved.
  const persist = () => {
    if (isSwrCacheDropped()) return; // session transition — don't resurrect it
    try {
      localStorage.setItem(SWR_CACHE_KEY, JSON.stringify(Array.from(map.entries())));
    } catch {
      // Storage full or unavailable — losing the warm cache is fine.
    }
  };
  window.addEventListener("pagehide", persist);
  // iOS may freeze the page (bfcache) without pagehide on app kill; persisting
  // when the app goes to background covers that path too.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist();
  });

  return map;
}

export default function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: localStorageProvider,
        revalidateOnFocus: false,
        dedupingInterval: 10_000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
