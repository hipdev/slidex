"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { tr } from "../i18n/provider";

const options = [ ["fire", "🔥", "Me inspira"], ["mind", "🤯", "Me sorprende"], ["heart", "❤️", "Me encanta"], ["question", "❓", "Tengo preguntas"] ] as const;
type Emoji = typeof options[number][0];
type Reaction = { _id: string; slideId: string; emoji: Emoji };

export function SlideReactions({ counts, onReact, onIdeas, position }: { counts: Record<string, number>; onReact: (emoji: Emoji) => Promise<unknown>; onIdeas: () => void; position?: number }) {
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  return <div className="slide-participation">
    <small>{position ? `${tr("Slide")} ${position} · ` : ""}{tr("Reacciona en vivo")}</small>
    <div className="slide-participation-actions">
      {options.map(([key, icon, label]) => <button key={key} disabled={busy} aria-label={`${tr(label)} · ${counts[key] ?? 0}`} onClick={async () => {
        if (sending.current) return;
        sending.current = true; setBusy(true);
        try { await onReact(key); } finally { sending.current = false; setBusy(false); }
      }}><span aria-hidden="true">{icon}</span><b>{counts[key] ?? 0}</b></button>)}
      <button className="participation-ideas" onClick={onIdeas}><span aria-hidden="true">↑</span>{tr("Ideas")}</button>
    </div>
  </div>;
}

type Particle = { id: string; icon: string; left: number; drift: number };
export function ReactionEffects({ slideId, reactions }: { slideId: string; reactions: Reaction[] }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const previous = useRef<{ slideId: string; ids: Set<string> } | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    // A reconnect, first load or slide change establishes a baseline, not a burst.
    const reset = () => { previous.current = null; setParticles([]); };
    document.addEventListener("visibilitychange", reset);
    return () => { document.removeEventListener("visibilitychange", reset); for (const timer of timers.current) clearTimeout(timer); timers.current.clear(); };
  }, []);
  useEffect(() => {
    const before = previous.current;
    previous.current = { slideId, ids: new Set(reactions.map(r => r._id)) };
    if (!before || before.slideId !== slideId || document.hidden) { setParticles([]); return; }
    const fresh = reactions.filter(r => r.slideId === slideId && !before.ids.has(r._id)).slice(0, 8);
    if (!fresh.length) return;
    const added = fresh.map(r => ({ id: r._id, icon: options.find(([key]) => key === r.emoji)![1], left: 15 + Math.random() * 70, drift: Math.random() * 100 - 50 }));
    setParticles(current => [...current, ...added].slice(-24));
    const timer = setTimeout(() => { const ids = new Set(added.map(p => p.id)); setParticles(current => current.filter(p => !ids.has(p.id))); timers.current.delete(timer); }, 2400);
    timers.current.add(timer);
  }, [slideId, reactions]);
  return <div className="reaction-effects" data-reaction-effects aria-hidden="true">{particles.map(p => <span key={p.id} style={{ left: `${p.left}%`, "--reaction-drift": `${p.drift}px` } as CSSProperties}>{p.icon}</span>)}</div>;
}
