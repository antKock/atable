"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "atable_device_token";

export function getDeviceToken(): string {
  let token = localStorage.getItem(STORAGE_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, token);
  }
  return token;
}

export function useDeviceToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    // One-shot mount-only read from localStorage. setState here is the
    // intent — we don't want to subscribe to anything, just hydrate once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(getDeviceToken());
  }, []);
  return token;
}
