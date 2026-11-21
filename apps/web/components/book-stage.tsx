"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { JDCue } from "./jd-motion";

// Freeze the outgoing DOM, never a second React tree: no duplicate queries,
// microphone controls, accessible content or timers during the page turn.
export function BookStage({ children, className, slideId, cue }: { children: ReactNode; className: string; slideId?: string; cue?: JDCue }) {
  const stage = useRef<HTMLElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const previous = useRef<{ slideId?: string; sequence: number; snapshot: HTMLElement }>(undefined);
  const animation = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const element = stage.current, layer = overlay.current;
    if (!element || !layer) return;
    const old = previous.current;
    const changed = old && old.slideId !== slideId;
    const fromJD = cue && cue.sequence !== old?.sequence && cue.slideId === slideId && cue.kind !== "timer";
    const stop = () => { animation.current?.cancel(); animation.current = null; layer.replaceChildren(); };
    if (changed || matchMedia("(prefers-reduced-motion: reduce)").matches) stop();
    if (changed && fromJD && !document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const leaf = document.createElement("div"); leaf.className = "book-leaf";
      leaf.style.transformOrigin = cue.kind === "previous" ? "100% 50%" : "0% 50%";
      old.snapshot.classList.add("book-page-copy");
      leaf.appendChild(old.snapshot);
      const back = document.createElement("div"); back.className = "book-page-back"; leaf.appendChild(back);
      layer.appendChild(leaf);
      const turn = leaf.animate([
        { transform:"rotateY(0deg)", filter:"brightness(1)" },
        { transform:`rotateY(${cue.kind === "previous" ? "" : "-"}80deg)`, filter:"brightness(.84)", offset:.55 },
        { transform:`rotateY(${cue.kind === "previous" ? "" : "-"}175deg)`, filter:"brightness(.98)" },
      ], {duration:900, easing:"cubic-bezier(.3,.05,.22,1)", fill:"forwards"});
      animation.current = turn;
      turn.onfinish = () => { if (animation.current === turn) stop(); };
    }
    const snapshot = element.cloneNode(true) as HTMLElement;
    snapshot.removeAttribute("id"); snapshot.setAttribute("aria-hidden", "true"); snapshot.inert = true;
    snapshot.querySelectorAll("[data-book-overlay], [data-jd-spectator], .countdown").forEach(node => node.remove());
    snapshot.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
    // Canvas pixels aren't cloned by the DOM. Keep their geometry without
    // presenting an empty interactive visualization on the outgoing page.
    snapshot.querySelectorAll("canvas").forEach(node => { node.style.visibility = "hidden"; });
    previous.current = { slideId, sequence:cue?.sequence ?? 0, snapshot };
  });
  useLayoutEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const cancel = () => { animation.current?.cancel(); animation.current = null; overlay.current?.replaceChildren(); };
    let width = stage.current?.clientWidth, height = stage.current?.clientHeight;
    const resize = new ResizeObserver(() => {
      if (width !== stage.current?.clientWidth || height !== stage.current?.clientHeight) cancel();
      width = stage.current?.clientWidth; height = stage.current?.clientHeight;
    });
    if (stage.current) resize.observe(stage.current);
    motion.addEventListener("change",cancel); document.addEventListener("visibilitychange",cancel);
    return () => { cancel(); resize.disconnect(); motion.removeEventListener("change",cancel); document.removeEventListener("visibilitychange",cancel); };
  }, []);
  return <section ref={stage} className={className}>{children}<div ref={overlay} className="book-turn-viewport" data-book-overlay aria-hidden="true" inert /></section>;
}
