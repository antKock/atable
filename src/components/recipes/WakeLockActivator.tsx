"use client";

import { useWakeLock } from "@/hooks/useWakeLock";

export default function WakeLockActivator() {
  useWakeLock();
  return null;
}
