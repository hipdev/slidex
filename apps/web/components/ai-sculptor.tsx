"use client";
import { useEffect, useRef, useState } from "react";

// A small slide-making companion. Rendering runs only while work is in progress,
// the canvas is visible and motion is permitted; idle is a single frame.
export default function AiSculptor({ working }: { working: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    void import("three").then(T => {
      if (disposed || !root.current) return;
      const target = root.current;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      target.appendChild(renderer.domElement);
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(35, 1, .1, 50); camera.position.set(0, 1.2, 6.5); camera.lookAt(0, 0, 0);
      scene.add(new T.AmbientLight(0xfff3df, 1.4));
      const light = new T.DirectionalLight(0xffffff, 2.5); light.position.set(2, 4, 5); scene.add(light);
      const group = new T.Group(); group.rotation.y = -.22; scene.add(group);
      const geometries: import("three").BufferGeometry[] = [];
      const materials: import("three").Material[] = [];
      const material = (color: number) => { const m = new T.MeshStandardMaterial({ color, roughness: .38 }); materials.push(m); return m; };
      const cream = material(0xfff2dc), red = material(0xd33e34), ink = material(0x372522), coral = material(0xffb095);
      const box = (x: number, y: number, z: number, m: import("three").Material) => { const g = new T.BoxGeometry(x, y, z); geometries.push(g); return new T.Mesh(g, m); };
      const head = box(1.25, .88, .7, cream); head.position.y = .6; head.rotation.z = -.07; group.add(head);
      for (const x of [-.28, .28]) { const eye = box(.13, .19, .07, ink); eye.position.set(x, .67, .38); group.add(eye); }
      const smile = box(.22, .045, .06, red); smile.position.set(0, .37, .39); group.add(smile);
      const body = box(.8, .6, .55, red); body.position.y = -.2; group.add(body);
      const table = box(2.6, .08, 1.2, coral); table.position.set(0, -.7, .3); group.add(table);
      const hands = [-.65, .65].map(x => { const g = new T.SphereGeometry(.16, 16, 12); geometries.push(g); const hand = new T.Mesh(g, cream); hand.position.set(x, -.4, .6); group.add(hand); return hand; });
      const cards = Array.from({ length: 3 }, (_, i) => { const card = box(.65, .43, .035, i === 1 ? red : cream); card.position.set((i - 1) * 1.1, 1.4 + (i % 2) * .3, -.4); card.rotation.z = (i - 1) * -.17; group.add(card); return card; });
      let frame = 0, visible = true;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      const render = (time = 0) => {
        frame = 0;
        const moving = working && !reduced.matches && visible && !document.hidden;
        const phase = moving ? time / 1000 : 0;
        hands.forEach((hand, i) => { hand.position.y = -.38 + (moving ? Math.sin(phase * 10 + i * Math.PI) * .1 : 0); });
        cards.forEach((card, i) => { card.position.y = 1.4 + (i % 2) * .3 + (moving ? Math.sin(phase * 2.3 + i) * .16 : 0); });
        head.rotation.z = -.07 + (moving ? Math.sin(phase * 2) * .055 : 0);
        renderer.render(scene, camera);
        if (moving) frame = requestAnimationFrame(render);
      };
      const restart = () => { cancelAnimationFrame(frame); render(); };
      const resize = () => { const width = Math.max(target.clientWidth, 1); renderer.setSize(width, 160); camera.aspect = width / 160; camera.updateProjectionMatrix(); restart(); };
      const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(target);
      const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; restart(); }); intersection.observe(target);
      reduced.addEventListener("change", restart); document.addEventListener("visibilitychange", restart);
      const lost = (event: Event) => { event.preventDefault(); setFailed(true); cancelAnimationFrame(frame); };
      renderer.domElement.addEventListener("webglcontextlost", lost); resize();
      cleanup = () => { cancelAnimationFrame(frame); resizeObserver.disconnect(); intersection.disconnect(); reduced.removeEventListener("change", restart); document.removeEventListener("visibilitychange", restart); renderer.domElement.removeEventListener("webglcontextlost", lost); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); renderer.domElement.remove(); };
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; cleanup(); };
  }, [working]);
  return <div className="ai-sculptor" ref={root} aria-hidden="true">{failed && <span className="sculptor-fallback">✦</span>}</div>;
}
