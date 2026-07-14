"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SnipMemory PWA Service Worker active: ", reg.scope);
        })
        .catch((err) => {
          console.error("SnipMemory PWA Service Worker failed: ", err);
        });
    }
  }, []);

  return null;
}
