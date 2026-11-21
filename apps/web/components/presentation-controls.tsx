"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { tr } from "../i18n/provider";

export function PresentationControls({ onExit, onPrevious, onNext, hasPrevious, hasNext, position, onInvite, onRoom }: {
  onExit: () => void; onPrevious?: () => void; onNext?: () => void;
  hasPrevious: boolean; hasNext: boolean; position: string; onInvite?: () => void; onRoom?: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [inputMode, setInputMode] = useState<"pointer" | "keyboard">("pointer");
  const dock = useRef<HTMLElement>(null);
  const tab = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mode = useRef<"pointer" | "keyboard">("pointer");
  const open = useRef(true);
  const panelId = useId();
  const cancelHide = useCallback(() => { clearTimeout(timer.current); }, []);
  const hide = useCallback(() => {
    cancelHide();
    open.current = false; setExpanded(false);
    // Keep focus on a visible control when a clicked button slides away.
    if (dock.current?.contains(document.activeElement)) tab.current?.focus({ preventScroll: true });
  }, [cancelHide]);
  const scheduleHide = useCallback(() => {
    cancelHide();
    if (!open.current) return;
    timer.current = setTimeout(() => {
      if (mode.current === "keyboard" && dock.current?.contains(document.activeElement)) return;
      hide();
    }, 3500);
  }, [cancelHide, hide]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Tab") { mode.current = "keyboard"; setInputMode("keyboard"); }
    };
    scheduleHide(); window.addEventListener("keydown", keyboard, true);
    return () => { cancelHide(); window.removeEventListener("keydown", keyboard, true); };
  }, [cancelHide, scheduleHide]);
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
  return <nav ref={dock} className={`presentation-controls ${expanded ? "is-expanded" : "is-collapsed"}`} data-input={inputMode} aria-label={tr("Controles de presentación")}
    onPointerDownCapture={() => { mode.current = "pointer"; setInputMode("pointer"); scheduleHide(); }}
    onPointerMove={scheduleHide} onPointerLeave={scheduleHide}
    onFocusCapture={() => { if (mode.current === "keyboard") cancelHide(); }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) scheduleHide(); }}>
    <button ref={tab} className="presentation-controls-tab" aria-expanded={expanded} aria-controls={panelId} onClick={() => {
      if (expanded) hide();
      else { open.current = true; setExpanded(true); scheduleHide(); }
    }}><span aria-hidden="true">{expanded ? "⌄" : "⌃"}</span>{tr(expanded ? "Ocultar controles" : "Mostrar controles")}<small>{position}</small></button>
    <div id={panelId} className="presentation-controls-panel" inert={!expanded}>
    {onPrevious && <button aria-label={tr("← Anterior")} disabled={!hasPrevious} onClick={onPrevious}>←</button>}
    <span>{position}</span>
    {onNext && <button aria-label={tr("Siguiente →")} disabled={!hasNext} onClick={onNext}>→</button>}
    {onRoom && <button aria-label={tr("Ver ideas y pulso de la sala")} onClick={onRoom}>◉</button>}
    {onInvite && <button onClick={onInvite}>{tr("Mostrar QR")}</button>}
    <button onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* The distraction-free view remains available when fullscreen is unsupported. */ } }}>{tr(fullscreen ? "Salir de pantalla completa" : "Pantalla completa")}</button>
    <button onClick={onExit}>{tr("Salir del escenario")}</button>
    </div>
  </nav>;
}
