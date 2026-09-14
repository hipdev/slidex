"use client";

import { useEffect, useState } from "react";
import { tr } from "../i18n/provider";

export function PresentationControls({ onExit, onPrevious, onNext, hasPrevious, hasNext, position, onInvite }: {
  onExit: () => void; onPrevious?: () => void; onNext?: () => void;
  hasPrevious: boolean; hasNext: boolean; position: string; onInvite?: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement);
    sync(); document.addEventListener("fullscreenchange", sync);
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if ((event.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "Escape") onExit();
      if (event.key === "ArrowRight" && hasNext && onNext) { event.preventDefault(); onNext(); }
      if (event.key === "ArrowLeft" && hasPrevious && onPrevious) { event.preventDefault(); onPrevious(); }
    };
    window.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("fullscreenchange", sync); window.removeEventListener("keydown", keydown); };
  }, [onExit, onNext, onPrevious, hasNext, hasPrevious]);
  return <nav className="presentation-controls" aria-label={tr("Controles de presentación")}>
    {onPrevious && <button aria-label={tr("← Anterior")} disabled={!hasPrevious} onClick={onPrevious}>←</button>}
    <span>{position}</span>
    {onNext && <button aria-label={tr("Siguiente →")} disabled={!hasNext} onClick={onNext}>→</button>}
    {onInvite && <button onClick={onInvite}>{tr("Mostrar QR")}</button>}
    <button onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* The distraction-free view remains available when fullscreen is unsupported. */ } }}>{tr(fullscreen ? "Salir de pantalla completa" : "Pantalla completa")}</button>
    <button onClick={onExit}>{tr("Salir del escenario")}</button>
  </nav>;
}
