"use client";

import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import type { Id } from "@slidex/backend/data-model";
import { ClientOnly } from "./client-only";
import { RoomPanel } from "./room-panel";
import { tr } from "../i18n/provider";

const LiveVisual = lazy(() => import("./live-visual"));
export type RoomView = "ideas" | "constellation" | "pulse";

export function RoomInsights({ view, onView, onClose, presentationId, slideId, isHost, showConclusions, reactions, report }: {
  view: RoomView; onView: (view: RoomView) => void; onClose: () => void;
  presentationId: Id<"presentations">; slideId: Id<"slides">; isHost: boolean;
  showConclusions: boolean; reactions: Record<string, number>; report: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [message, setMessage] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus({ preventScroll: true }); };
  }, []);
  const loading = <div className="room-visual-loading">{tr("Preparando visualización…")}</div>;
  return <dialog ref={dialog} className="room-insights" aria-labelledby={titleId} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="room-insights-content">
      <button className="dialog-close" aria-label={tr("Cerrar")} onClick={onClose}>×</button>
      <span className="eyebrow">{tr("LA AUDIENCIA, EN TIEMPO REAL")}</span>
      <h2 id={titleId}>{tr("La sala, en vivo")}</h2>
      <div className="tabs room-view-tabs" aria-label={tr("Vistas de la sala")}>
        {([ ["ideas", "Ideas"], ["constellation", "Constelación 3D"], ["pulse", "Pulso"] ] as const).map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => onView(key)}>{tr(label)}</button>)}
      </div>
      {view === "ideas" ? <RoomPanel presentationId={presentationId} slideId={slideId} isHost={isHost} showConclusions={showConclusions} report={text => { setMessage(text); report(text); }} /> : <>
        <p className="room-view-description">{tr(view === "constellation" ? "Las ideas de esta presentación y los apoyos de la sala." : "Así está reaccionando la audiencia a la presentación.")}</p>
        <ClientOnly fallback={loading}><Suspense fallback={loading}><LiveVisual presentationId={presentationId} visual={view} reactions={reactions} scope="room" /></Suspense></ClientOnly>
      </>}
      {message && <p className="room-view-description" role="status">{message}</p>}
    </div>
  </dialog>;
}
