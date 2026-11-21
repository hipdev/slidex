"use client";

import { useAction, useConvexConnectionState } from "convex/react";
import { useEffect, useState, type CSSProperties } from "react";
import { api } from "@slidex/backend/api";
import type { Doc } from "@slidex/backend/data-model";

const gif = "/images/jd/convex-costs-reaction.gif";

// This layer never replaces or remounts the slide underneath it.
export function JDReaction({ reaction }: { reaction?: Doc<"presentations">["jdReaction"] }) {
  const clock = useAction(api.jd.clock);
  const connection = useConvexConnectionState();
  const [active, setActive] = useState<{ id: string; remaining: number } | null>(null);
  useEffect(() => { const preload = new Image(); preload.src = gif; }, []);
  useEffect(() => {
    let alive = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    setActive(null);
    if (!reaction) return;
    const sync = async () => {
      const attempt = ++generation;
      if (timeout) clearTimeout(timeout);
      if (document.hidden) { setActive(null); return; }
      const before = performance.now();
      try {
        const server = await clock();
        if (!alive || generation !== attempt || document.hidden) return;
        const remaining = Math.min(10_000, reaction.endsAt - server - (performance.now() - before) / 2);
        if (remaining <= 0) { setActive(null); return; }
        setActive({ id: `${reaction.requestId}:${reaction.startedAt}`, remaining });
        timeout = setTimeout(() => setActive(null), remaining);
      } catch { if (alive && generation === attempt) setActive(null); }
    };
    void sync();
    document.addEventListener("visibilitychange", sync);
    return () => { alive = false; generation++; if (timeout) clearTimeout(timeout); document.removeEventListener("visibilitychange", sync); };
  }, [reaction?.requestId, reaction?.startedAt, reaction?.endsAt, clock, connection.isWebSocketConnected]);
  if (!active) return null;
  return <div key={active.id} className="jd-reaction-overlay" data-jd-reaction style={{ "--jd-reaction-duration": `${active.remaining}ms` } as CSSProperties}>
    <figure className="jd-reaction-card" role="status"><span>JD · MI REACCIÓN</span><img src={gif} alt="Mi reacción al ver la factura de Convex"/><figcaption>Yo viendo la factura de Convex.</figcaption><p className="jd-reaction-still">Así, tal cual.</p></figure>
  </div>;
}
