"use client";

import { lazy, Suspense } from "react";
import { ClientOnly } from "./client-only";
import { useJDCue, type JDCue, type JDPhase } from "./jd-motion";
import { tr } from "../i18n/provider";

const Portrait = lazy(() => import("./jd-pixi"));

export function JDCharacter({ cue, phase = "idle", audience = false }: { cue?: JDCue; phase?: JDPhase; audience?: boolean }) {
  const active = useJDCue(cue);
  const fallback = <span className="jd-portrait-fallback">JD</span>;
  const label = phase === "recording" ? tr("Te escucho") : phase === "thinking" ? tr("Estoy pensando") : phase === "speaking" ? tr("Aquí vamos") : active?.kind === "timer" ? active.deltaSeconds && active.deltaSeconds < 0 ? tr("¡A toda marcha!") : tr("Tiempo ajustado") : active?.kind === "create_slide" ? tr("Una nueva página") : active ? tr("Pasando página") : tr("Tu copiloto");
  return <div className={`jd-character ${audience ? "jd-spectator" : ""} ${active ? "is-acting" : ""}`} data-jd-spectator={audience || undefined}>
    <div className="jd-portrait" aria-hidden="true"><ClientOnly fallback={fallback}><Suspense fallback={fallback}><Portrait cue={active} phase={phase} /></Suspense></ClientOnly></div>
    <span className="jd-character-caption"><b>JD</b><span>{label}</span></span>
  </div>;
}
