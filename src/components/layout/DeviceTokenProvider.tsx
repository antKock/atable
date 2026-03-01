"use client";

import { useEffect } from "react";

export default function DeviceTokenProvider() {
  useEffect(() => {
    if (!localStorage.getItem("atable_device_token")) {
      localStorage.setItem("atable_device_token", crypto.randomUUID());
    }
  }, []);

  return null;
}
