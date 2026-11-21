"use client";

import { useAction, useConvexConnectionState, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@slidex/backend/api";
import type { Doc } from "@slidex/backend/data-model";
import { tr, useLocale } from "../i18n/provider";

export function Countdown({ room, isHost }: { room: Doc<"presentations">; isHost: boolean }) {
  const clock = useAction(api.jd.clock);
  const control = useMutation(api.jd.control);
  const locale = useLocale();
  const connection = useConvexConnectionState();
  const [sample, setSample] = useState<{ server: number; local: number } | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const timer = room.countdown;
  useEffect(() => {
    if (!timer) return;
    let alive = true;
    const sync = async () => {
      if (document.visibilityState === "hidden") return;
      const before = performance.now();
      try {
        const server = await clock();
        if (alive) {
          const local = performance.now();
          setSample({ server: server + (local - before) / 2, local });
          setNow(local);
        }
      } catch { /* Keep the last clock sample while reconnecting. */ }
    };
    void sync();
    const tick = window.setInterval(() => setNow(performance.now()), 250);
    const resync = window.setInterval(() => void sync(), 60_000);
    document.addEventListener("visibilitychange", sync);
    return () => { alive = false; clearInterval(tick); clearInterval(resync); document.removeEventListener("visibilitychange", sync); };
  }, [clock, timer?.updatedAt, !!timer, connection.isWebSocketConnected]);
  if (!timer) return null;
  const remaining = timer.endsAt === undefined ? timer.remainingMs : sample ? Math.max(0, timer.endsAt - (sample.server + now - sample.local)) : timer.remainingMs;
  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const finished = seconds === 0;
  const paused = timer.endsAt === undefined && !finished;
  const urgent = !finished && seconds <= 60;
  const act = async (operation: "pause" | "resume" | "clear") => {
    setBusy(true); setError(false);
    try { await control({ presentationId: room._id, operation, locale }); }
    catch { setError(true); } finally { setBusy(false); }
  };
  return <section className={`countdown ${finished ? "finished" : urgent ? "urgent" : ""}`} aria-label={tr("Tiempo de la charla")}>
    <div className="countdown-label"><span aria-hidden="true">{finished ? "🏁" : paused ? "⏸" : "⏳"}</span><div><strong>{tr(finished ? "¡Tiempo! Que venga el aplauso." : paused ? "Pausa para respirar" : urgent ? "Último minuto. ¡Hazlo épico!" : "Las ideas vuelan. El tiempo también.")}</strong><small>{tr(!connection.isWebSocketConnected ? "Reconectando… el reloj sigue en tu dispositivo" : "Un mismo reloj en todas las pantallas")}</small></div></div>
    <div className="countdown-digits" role="timer" aria-label={tr("Tiempo restante")}>{sample || paused ? display : "—:—"}</div>
    <div className="countdown-track" aria-hidden="true"><i style={{ width: `${Math.min(100, remaining / (timer.durationSeconds * 1000) * 100)}%` }} /></div>
    {isHost && <div className="countdown-controls"><button disabled={busy || finished} onClick={() => void act(paused ? "resume" : "pause")}>{tr(paused ? "Continuar" : "Pausar")}</button><button disabled={busy} onClick={() => void act("clear")}>{tr("Quitar contador")}</button></div>}
    {error && <p role="alert">{tr("No se pudo cambiar el contador. Intenta de nuevo.")}</p>}
    <span className="sr-only" role="status">{finished ? tr("El tiempo de la charla terminó") : paused ? tr("Contador en pausa") : ""}</span>
  </section>;
}
