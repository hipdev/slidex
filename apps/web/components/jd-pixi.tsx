"use client";

import { Application, Container, Graphics } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion, type JDCue, type JDPhase } from "./jd-motion";

const ink = 0x292532, skin = 0xdfa06f, light = 0xf3bc88, yellow = 0xffcb38;

// Each body part has its own pivot: gestures transform vector artwork instead of
// rebuilding it every frame. The reference photo is never shipped to the browser.
function cartoon() {
  const root = new Container();
  root.addChild(new Graphics().ellipse(160, 303, 92, 12).fill({ color: ink, alpha: .12 }));
  const halo = new Graphics().circle(160, 163, 117).fill({ color: 0xffe5aa, alpha: .72 }).circle(160, 163, 110).stroke({ color: 0xa97744, alpha: .2, width: 1.5 });
  root.addChild(halo);
  const body = new Container(); root.addChild(body);
  body.addChild(new Graphics().moveTo(103, 209).quadraticCurveTo(160, 180, 217, 209).quadraticCurveTo(241, 233, 232, 290).quadraticCurveTo(160, 319, 87, 290).quadraticCurveTo(80, 233, 103, 209).fill(yellow).stroke({ color: ink, width: 3 }));
  body.addChild(new Graphics().moveTo(106, 231).quadraticCurveTo(99, 258, 103, 286).moveTo(215, 232).quadraticCurveTo(222, 265, 215, 287).stroke({ color: 0xd79420, width: 3, cap: "round" }));
  body.addChild(new Graphics().roundRect(141, 173, 38, 42, 16).fill(skin).stroke({ color: ink, width: 2 }).moveTo(135, 205).quadraticCurveTo(160, 229, 185, 205).stroke({ color: 0xb87f25, width: 4, cap: "round" }));
  // Forearms articulate at the shoulders; the right hand sweeps a page.
  function arm(x: number, flip: number) {
    const part = new Container(); part.position.set(x, 221); part.scale.x = flip;
    part.addChild(new Graphics().roundRect(-13, -13, 29, 39, 12).fill(yellow).stroke({ color: ink, width: 2.5 }));
    part.addChild(new Graphics().moveTo(-8, 20).lineTo(-7, 54).quadraticCurveTo(6, 70, 17, 53).lineTo(14, 20).fill(light).stroke({ color: ink, width: 2.5 }).circle(5, 54, 12).fill(light).stroke({ color: ink, width: 2 }));
    body.addChild(part); return part;
  }
  const left = arm(105, 1), right = arm(215, -1);
  const head = new Container(); head.position.set(160, 126); body.addChild(head);
  head.addChild(new Graphics().ellipse(0, -7, 70, 74).fill(ink));
  head.addChild(new Graphics().ellipse(-56, 12, 13, 20).ellipse(56, 12, 13, 20).fill(skin).stroke({ color: ink, width: 2.5 }));
  head.addChild(new Graphics().moveTo(-53, -28).quadraticCurveTo(-55, -60, 0, -59).quadraticCurveTo(55, -60, 53, -23).lineTo(52, 27).quadraticCurveTo(47, 64, 4, 71).quadraticCurveTo(-40, 66, -51, 31).closePath().fill(light).stroke({ color: ink, width: 2.5 }));
  head.addChild(new Graphics().moveTo(41, -27).quadraticCurveTo(49, 54, 4, 69).quadraticCurveTo(51, 64, 52, 27).lineTo(53, -23).closePath().fill({ color: skin, alpha: .65 }));
  head.addChild(new Graphics().ellipse(-34, 32, 12, 5).ellipse(34, 32, 12, 5).fill({ color: 0xe48569, alpha: .4 }));
  // Asymmetric curls and a loose lock over the forehead, like JD's photo.
  const curls = new Graphics();
  for (const [x, y, r] of [[-53,-34,21],[-51,-57,20],[-32,-68,22],[-7,-76,23],[18,-74,21],[40,-62,23],[53,-39,20],[-31,-44,19],[-8,-48,18],[17,-48,20],[34,-40,17]]) curls.circle(x, y, r).fill(ink);
  head.addChild(curls);
  head.addChild(new Graphics().moveTo(-24, -63).bezierCurveTo(-1, -72, 6, -35, -5, -27).bezierCurveTo(-15, -20, -24, -35, -12, -39).stroke({ color: 0x171825, width: 10, cap: "round" }));
  head.addChild(new Graphics().arc(-29,-69,11,3.4,5.8).moveTo(11,-82).quadraticCurveTo(25,-88,31,-74).moveTo(-60,-43).quadraticCurveTo(-68,-56,-56,-61).stroke({ color: 0x514555, width: 2.5, cap: "round" }));
  const brows = new Graphics().moveTo(-43,-12).quadraticCurveTo(-29,-20,-16,-14).moveTo(14,-14).quadraticCurveTo(30,-21,43,-13).stroke({ color: ink, width: 4, cap: "round" }); head.addChild(brows);
  const eyes = new Container(); eyes.position.y = 7;
  eyes.addChild(new Graphics().ellipse(-28,0,10,8).ellipse(28,0,10,8).fill(0xfff9ea).ellipse(-26,0,4,6).ellipse(30,0,4,6).fill(ink).circle(-25,-2,1.6).circle(31,-2,1.6).fill(0xffffff)); head.addChild(eyes);
  head.addChild(new Graphics().roundRect(-50,-9,43,31,9).roundRect(7,-9,43,31,9).fill({ color: 0x69788e, alpha: .12 }).stroke({ color: ink, width: 4 }).moveTo(-7,2).quadraticCurveTo(0,-2,7,2).moveTo(-60,-1).lineTo(-50,0).moveTo(50,0).lineTo(59,-2).stroke({ color: ink, width: 4, cap: "round" }));
  head.addChild(new Graphics().moveTo(-43,-1).lineTo(-35,-5).moveTo(14,-1).lineTo(22,-5).stroke({ color: 0xffffff, alpha: .6, width: 2.5, cap: "round" }));
  head.addChild(new Graphics().moveTo(0,9).quadraticCurveTo(-8,26,3,27).lineTo(9,24).stroke({ color: 0xb97553, width: 2.5, cap: "round" }));
  const mouth = new Container(); mouth.position.set(3, 40); head.addChild(mouth);
  mouth.addChild(new Graphics().moveTo(-23,-3).quadraticCurveTo(0,8,23,-5).quadraticCurveTo(18,20,0,18).quadraticCurveTo(-18,17,-23,-3).fill(0x6f3c37).stroke({ color: ink, width: 2 }).moveTo(-19,0).quadraticCurveTo(0,8,19,-2).lineTo(16,6).quadraticCurveTo(0,14,-16,7).closePath().fill(0xfffbed));
  // A little open book ties the portrait to the full-size page turns.
  const book = new Container(); book.position.set(160, 268); root.addChild(book);
  book.addChild(new Graphics().poly([-65,-15,-8,-7,0,1,8,-7,65,-15,65,20,6,30,0,25,-6,30,-65,20]).fill(0x8e4e35).stroke({ color: ink, width: 3 }));
  book.addChild(new Graphics().poly([-60,-19,-11,-12,0,-4,0,23,-11,17,-60,12]).poly([60,-19,11,-12,0,-4,0,23,11,17,60,12]).fill(0xfffae9).stroke({ color: 0xb78b64, width: 1.5 }));
  const leaf = new Graphics().poly([0,-4,11,-12,60,-19,60,12,11,17,0,23]).fill(0xffe9bf).stroke({ color: 0xb78b64, width: 1.2 }); book.addChild(leaf);
  book.addChild(new Graphics().moveTo(-50,-8).lineTo(-17,-3).moveTo(-50,0).lineTo(-19,5).moveTo(18,-3).lineTo(49,-8).moveTo(18,5).lineTo(49,0).stroke({ color: 0xbc9d80, width: 2, cap: "round" }));
  const clock = new Container(); clock.position.set(256, 119); root.addChild(clock); clock.visible = false;
  clock.addChild(new Graphics().circle(0,0,29).fill(0xfff9e9).stroke({ color: ink, width: 3 }).roundRect(-7,-37,14,8,3).fill(yellow).stroke({ color: ink,width:2 }));
  const hands = new Graphics().moveTo(0,-17).lineTo(0,0).lineTo(11,7).stroke({ color: 0xb94b31, width: 3, cap: "round" }); clock.addChild(hands);
  const sparks = Array.from({length: 9}, (_, i) => {
    const g = new Graphics().star(0,0,i % 2 ? 4 : 5, i % 2 ? 5 : 7,2).fill([0xffc439,0xb4553d,0x5b8b7b][i%3]); root.addChild(g); g.visible=false; return g;
  });
  return { root, body, head, eyes, brows, mouth, left, right, book, leaf, clock, hands, sparks, halo };
}

export default function JDPixi({ phase, cue }: { phase: JDPhase; cue?: JDCue }) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef({ phase, cue }); current.current = { phase, cue };
  const reduced = useReducedMotion(); const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const repaint = useRef<() => void>(() => {});
  const [failed, setFailed] = useState(false);
  useEffect(() => { repaint.current(); }, [reduced, phase, cue]);
  useEffect(() => {
    let disposed = false, initialized = false, visible = true;
    const app = new Application();
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    let elapsed = 0, gestureStart = 0, sequence = 0;
    async function mount() {
      try {
        await app.init({ width:320, height:326, backgroundAlpha:0, antialias:true, autoDensity:true, resolution:Math.min(devicePixelRatio || 1,2), autoStart:false, sharedTicker:false, preference:["webgl","canvas"], powerPreference:"low-power" });
        initialized = true;
        if (disposed) { app.destroy({removeView:true},{children:true}); return; }
        host.current?.appendChild(app.canvas);
        const art = cartoon(); app.stage.addChild(art.root); app.ticker.maxFPS = 30;
        const draw = (render = true) => {
          const {phase: p, cue: c} = current.current;
          const still = reducedRef.current;
          if (c && c.sequence !== sequence) { sequence = c.sequence; gestureStart = elapsed; }
          const age = elapsed - gestureStart, acting = !!c && age < 2.4;
          const ease = acting ? Math.sin(Math.min(age / 2.4,1)*Math.PI) : 0;
          const nav = acting && c.kind !== "timer";
          const clock = acting && c.kind === "timer";
          const listen = p === "recording" || p === "permission", thinking = p === "thinking";
          const breath = still ? 0 : Math.sin(elapsed * 2.2);
          art.body.y = breath * 1.7 - (still ? 0 : ease * 5);
          art.head.rotation = listen ? -.12 : thinking ? .1 : -.035 + (still ? 0 : Math.sin(elapsed*1.5)*.025);
          art.head.y = 126 + (still ? 0 : Math.sin(elapsed*2.2)*.6);
          art.brows.y = thinking || listen ? -3 : 0;
          art.eyes.scale.y = !still && elapsed % 4.7 > 4.54 ? .12 : 1;
          art.mouth.scale.y = p === "speaking" && !still ? .7 + Math.abs(Math.sin(elapsed*13))*.6 : 1;
          art.right.rotation = listen ? -1.55 : thinking ? -.9 : nav ? (c.kind === "previous" ? 1 : -1) * (still ? .65 : ease*1.7) : clock ? -ease*.9 : -.12;
          art.left.rotation = .12 + (nav && !still ? ease*.35 : 0);
          art.book.rotation = nav && !still ? Math.sin(age*7)*ease*.07 : 0;
          art.leaf.scale.x = nav && !still ? Math.cos(age*7) : 1;
          art.clock.visible = clock;
          art.clock.scale.set(still ? 1 : .75 + ease*.3);
          art.hands.rotation = still ? 0 : (c?.deltaSeconds && c.deltaSeconds < 0 ? -1 : 1)*age*3;
          art.halo.alpha = listen && !still ? .65 + Math.sin(elapsed*4)*.2 : 1;
          art.sparks.forEach((spark,i) => {
            spark.visible = acting && !still;
            const angle = i / 9 * Math.PI * 2 - Math.PI/2;
            const radius = 85 + ease*55;
            spark.position.set(160 + Math.cos(angle)*radius,150 + Math.sin(angle)*radius);
            spark.rotation = age + i; spark.alpha = ease; spark.scale.set(.6+ease*.5);
          });
          if (render) app.render();
        };
        const sync = () => {
          if (disposed) return;
          if (document.hidden || !visible || media.matches) { app.stop(); draw(); }
          else app.start();
        };
        app.ticker.add(ticker => { elapsed += Math.min(ticker.deltaMS,50)/1000; draw(false); });
        repaint.current = () => { draw(); sync(); };
        document.addEventListener("visibilitychange", sync);
        media.addEventListener("change", sync);
        observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; sync(); });
        if (host.current) observer.observe(host.current);
        cleanup = () => { document.removeEventListener("visibilitychange",sync); media.removeEventListener("change",sync); observer?.disconnect(); };
        draw(); sync();
      } catch { if (!disposed) setFailed(true); }
    }
    let cleanup = () => {};
    void mount();
    return () => { disposed = true; cleanup(); repaint.current = () => {}; if (initialized && app.renderer) app.destroy({removeView:true},{children:true}); };
  }, []);
  return <div ref={host} className="jd-pixi">{failed && <span className="jd-portrait-fallback">JD</span>}</div>;
}
