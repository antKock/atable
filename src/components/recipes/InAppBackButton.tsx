"use client";

import { useSyncExternalStore } from "react";
import { isNativeApp } from "@/lib/native";
import BackCircleButton from "@/components/recipes/BackCircleButton";

// Never changes after load → no real subscription needed.
const subscribe = () => () => {};

// The public share page has no chrome by design (guest-in-browser case). But
// opened inside the native app via a Universal Link, that page is a dead-end —
// there's no system chrome to leave it. So in the native shell only, surface
// the same back control as the fiche, routing to the app home.
//
// useSyncExternalStore gives a stable server snapshot (false) and the real
// client value — no hydration mismatch, no setState-in-effect.
export default function InAppBackButton() {
  const isNative = useSyncExternalStore(
    subscribe,
    () => isNativeApp(),
    () => false,
  );

  if (!isNative) return null;
  return <BackCircleButton href="/home" />;
}
