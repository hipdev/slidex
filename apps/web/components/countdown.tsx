"use client";

import { useAction, useConvexConnectionState } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@slidex/backend/api";
import type { Doc } from "@slidex/backend/data-model";
import { tr } from "../i18n/provider";

export function Countdown({ room }: { room: Doc<"presentations"> }) {
  const clock = useAction(api.jd.clock);
  const connection = useConvexConnectionState();
  const [sample, setSample] = useState<{ server: number; local: number } | null>(null);
  const [now, setNow] = useState(0);
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
  const status = tr(!connection.isWebSocketConnected ? "Reconectando… el reloj sigue en tu dispositivo" : finished ? "El tiempo de la charla terminó" : paused ? "Contador en pausa" : "Tiempo restante");
  return <div className={`countdown ${finished ? "finished" : urgent ? "urgent" : ""}`} title={status}>
    <span className="countdown-digits" role="timer" aria-label={status}>{sample || paused ? display : "—:—"}</span>
    <span className="sr-only" role="status">{finished ? tr("El tiempo de la charla terminó") : paused ? tr("Contador en pausa") : ""}</span>
  </div>;
}
