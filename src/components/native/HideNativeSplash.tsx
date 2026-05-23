"use client";

import { useEffect } from "react";
import { hideNativeSplash } from "@/lib/splash";

/**
 * Hides the native Capacitor splash screen as soon as React has mounted.
 * Mounted from the root layout so it fires once per cold launch, before any
 * page-specific content paints. Returns null and is a no-op on the web.
 */
export function HideNativeSplash() {
  useEffect(() => {
    void hideNativeSplash();
  }, []);
  return null;
}
