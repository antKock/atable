"use client";

import { useEffect } from "react";
import { getDeviceToken } from "@/hooks/useDeviceToken";

export default function DeviceTokenProvider() {
  useEffect(() => {
    getDeviceToken();
  }, []);

  return null;
}
