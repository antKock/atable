"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "atable_device_token";

export function getDeviceToken(): string {
  let token = localStorage.getItem(STORAGE_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, token);
  }
  return token;
}

// Mount-only read: localStorage is not reactive, so we don't subscribe to
// updates. useSyncExternalStore gives us a hydration-safe way to read it
// once on mount (server snapshot = null, client snapshot = token).
const noopSubscribe = () => () => {};
const serverSnapshot = (): string | null => null;

export function useDeviceToken(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => getDeviceToken(),
    serverSnapshot,
  );
}
