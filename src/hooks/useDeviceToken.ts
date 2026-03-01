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
    setToken(getDeviceToken());
  }, []);
  return token;
}
