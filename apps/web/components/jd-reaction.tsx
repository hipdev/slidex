"use client";

import { useAction, useConvexConnectionState } from "convex/react";
import { useEffect, useState, type CSSProperties } from "react";
import { api } from "@slidex/backend/api";
import type { Doc } from "@slidex/backend/data-model";

const assets = {
  convex_costs: { gif: "/images/jd/convex-costs-reaction.gif", duration: 10_000, label: "JD · MI REACCIÓN", caption: "Yo viendo la factura de Convex.", still: "Así, tal cual.", source: "" },
  farewell: { gif: "/images/jd/thats-all-folks.gif", duration: 20_000, label: "JD · HASTA LA PRÓXIMA", caption: "¡Eso es todo, amigos!", still: "Gracias por acompañarnos.", source: "https://tenor.com/view/thats-all-folks-porky-pig-gif-10849136" },
};

// This layer never replaces or remounts the slide underneath it.
export function JDReaction({ reaction }: { reaction?: Doc<"presentations">["jdReaction"] }) {
  const clock = useAction(api.jd.clock);
  const connection = useConvexConnectionState();
  const [active, setActive] = useState<{ id: string; remaining: number; kind: keyof typeof assets } | null>(null);
  useEffect(() => { for (const asset of Object.values(assets)) { const preload = new Image(); preload.src = asset.gif; } }, []);
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
        const remaining = Math.min(assets[reaction.kind].duration, reaction.endsAt - server - (performance.now() - before) / 2);
        if (remaining <= 0) { setActive(null); return; }
        setActive({ id: `${reaction.requestId}:${reaction.startedAt}`, remaining, kind: reaction.kind });
        timeout = setTimeout(() => setActive(null), remaining);
      } catch { if (alive && generation === attempt) setActive(null); }
    };
    void sync();
    document.addEventListener("visibilitychange", sync);
    return () => { alive = false; generation++; if (timeout) clearTimeout(timeout); document.removeEventListener("visibilitychange", sync); };
  }, [reaction?.requestId, reaction?.startedAt, reaction?.endsAt, reaction?.kind, clock, connection.isWebSocketConnected]);
  if (!active) return null;
  const asset = assets[active.kind];
  return <div key={active.id} className="jd-reaction-overlay" data-jd-reaction style={{ "--jd-reaction-duration": `${active.remaining}ms` } as CSSProperties}>
    <figure className="jd-reaction-card" role="status"><span>{asset.label}</span><img src={asset.gif} alt={asset.caption}/><figcaption>{asset.caption}</figcaption><p className="jd-reaction-still">{asset.still}</p>{asset.source && <a className="jd-reaction-source" href={asset.source} target="_blank" rel="noreferrer">GIF · Tenor ↗</a>}</figure>
  </div>;
}
