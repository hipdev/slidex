"use client";
import { useEffect, useRef, useState } from "react";
import { scaleLinear, scaleBand } from "d3-scale";
import { useQuery } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Id } from "@slidex/backend/data-model";

export default function LiveVisual({ presentationId, visual, reactions }: { presentationId: Id<"presentations">; visual: "constellation" | "pulse"; reactions: Record<string, number> }) {
  const ideas = useQuery(api.live.list, { presentationId });
  const visible = (ideas ?? []).filter(i => i.status !== "dismissed");
  return <div className="live-visual">{visual === "constellation" ? <><Constellation count={visible.length} weight={visible.reduce((n,i) => n+i.votes,0)} /><div className="visual-caption"><b>{visible.length} ideas · {visible.reduce((n,i)=>n+i.votes,0)} apoyos</b><span>Cada esfera es una idea. Sus apoyos le dan tamaño.</span></div><div className="idea-orbit">{visible.slice(0,4).map(i => <span key={i._id}>{i.text}</span>)}</div></> : <Pulse reactions={reactions} />}</div>;
}
function Pulse({ reactions }: { reactions: Record<string,number> }) {
  const rows = [{ key: "fire", label: "Me inspira", color: "#fd975b" }, { key: "mind", label: "Me sorprende", color: "#b9a0ff" }, { key: "heart", label: "Me encanta", color: "#ff88bd" }, { key: "question", label: "Tengo preguntas", color: "#d4ff43" }];
  const x = scaleLinear().domain([0, Math.max(5, ...Object.values(reactions))]).range([0,310]);
  const y = scaleBand().domain(rows.map(r=>r.key)).range([15,235]).padding(.32);
  return <><svg viewBox="0 0 510 265" role="img" aria-label="Reacciones de la audiencia en tiempo real">{rows.map(row => <g key={row.key} transform={`translate(0 ${y(row.key)})`}><text x="0" y="24" fill="#efedf8" fontSize="13">{row.label}</text><rect x="145" width={x(reactions[row.key] ?? 0)} height={y.bandwidth()} rx="6" fill={row.color}/><text x={155+x(reactions[row.key] ?? 0)} y="24" fill="#fff" fontSize="16">{reactions[row.key] ?? 0}</text></g>)}</svg><p className="visual-caption">Datos reales de este slide · Reacciona y mira cómo cambia.</p></>;
}
function Constellation({ count, weight }: { count: number; weight: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let clean = () => {};
    void import("three").then(THREE => {
      if (disposed || !container.current) return;
      const target = container.current;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      target.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45,1,.1,100);
      camera.position.z = 7;
      const group = new THREE.Group(); scene.add(group);
      scene.add(new THREE.AmbientLight(0xffffff,2));
      const light = new THREE.PointLight(0xb5a0ff,35); light.position.set(2,3,4); scene.add(light);
      const geometry = new THREE.SphereGeometry(.13+Math.min(weight,.5*count)*.009,20,20);
      const material = new THREE.MeshStandardMaterial({ color: 0xd4ff43, roughness: .25, metalness: .25 });
      const positions: number[] = [];
      for(let i=0;i<Math.min(count,100);i++) {
        const phi = Math.acos(1-2*(i+.5)/Math.max(count,1)); const theta = Math.PI*(1+Math.sqrt(5))*i;
        const mesh = new THREE.Mesh(geometry,material);
        mesh.position.setFromSphericalCoords(2,phi,theta); group.add(mesh);
        positions.push(0,0,0,mesh.position.x,mesh.position.y,mesh.position.z);
      }
      const lineGeometry = new THREE.BufferGeometry(); lineGeometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
      const lineMaterial = new THREE.LineBasicMaterial({color:0x9483d9,transparent:true,opacity:.4});
      group.add(new THREE.LineSegments(lineGeometry,lineMaterial));
      const resize = () => { const width=target.clientWidth; renderer.setSize(width,280); camera.aspect=width/280; camera.updateProjectionMatrix(); renderer.render(scene,camera); };
      const observer = new ResizeObserver(resize); observer.observe(target); resize();
      let frame=0;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const draw = () => { if (!reduced.matches) {group.rotation.y+=.003; group.rotation.x=.18;} renderer.render(scene,camera); frame=requestAnimationFrame(draw); };
      draw();
      clean = () => {cancelAnimationFrame(frame); observer.disconnect(); geometry.dispose(); material.dispose(); lineGeometry.dispose(); lineMaterial.dispose(); renderer.dispose(); renderer.domElement.remove();};
    }).catch(() => setFailed(true));
    return () => { disposed=true; clean(); };
  },[count,weight]);
  return <div className="constellation" ref={container} role="img" aria-label={`Constelación de ${count} ideas con ${weight} apoyos`}>{(failed || count===0) && <p className="constellation-empty">{failed ? `${count} ideas conectadas · vista 3D no disponible en este dispositivo` : "Tu primera idea enciende esta constelación."}</p>}</div>;
}
