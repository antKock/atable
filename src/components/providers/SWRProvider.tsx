"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

function localStorageProvider() {
  if (typeof window === "undefined") return new Map();

  const map = new Map<string, unknown>(
    JSON.parse(localStorage.getItem("swr-cache") || "[]"),
  );

  window.addEventListener("beforeunload", () => {
    const entries = Array.from(map.entries());
    localStorage.setItem("swr-cache", JSON.stringify(entries));
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
