"use client";
import { useEffect, useState, type ReactNode } from "react";

// Keep browser-only lazy modules out of SSR while retaining their exact fallback.
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? children : fallback;
}
