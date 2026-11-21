"use client";

import { useEffect, useRef, useState } from "react";
import type { Doc } from "@slidex/backend/data-model";

export type JDCue = NonNullable<Doc<"presentations">["jdCue"]>;
export type JDPhase = "idle" | "permission" | "recording" | "thinking" | "speaking";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

// A reload, late join or backgrounded tab gets the current state, not a replay.
export function useJDCue(cue?: JDCue) {
  const seen = useRef(cue?.sequence ?? 0);
  const latest = useRef(cue);
  latest.current = cue;
  const [active, setActive] = useState<JDCue>();
  useEffect(() => {
    const hide = () => { seen.current = latest.current?.sequence ?? 0; setActive(undefined); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    const changed = cue && cue.sequence > seen.current;
    seen.current = cue?.sequence ?? 0;
    if (!changed || document.hidden) return;
    setActive(cue);
    const timeout = setTimeout(() => setActive(undefined), 2600);
    return () => clearTimeout(timeout);
  }, [cue?.sequence]);
  return active;
}
