"use client";

import type { Doc } from "@slidex/backend/data-model";
import { tr } from "../i18n/provider";

const brand = "/images/convex/logo-color.svg";
const symbol = "/images/convex/symbol-color.svg";
const iconPaths = [
  "M4 6c0-4 16-4 16 0s-16 4-16 0m0 0v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0",
  "M3 12h4l3-8 4 16 3-8h4",
  "m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18",
  "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM8 12l3 3 5-6",
  "M3 5h7l3 3h8v12H3ZM3 8h18",
  "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 7 7",
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 4v6l4 3",
  "M3 3h6v6H3Zm12 0h6v6h-6ZM3 15h6v6H3Zm12 0h6v6h-6ZM9 6h6M6 9v6m12-6v6m-9 3h6",
];
const componentIcons: Record<string, string> = {
  agent: "M5 7h14v13H5ZM12 3v4M9 12h.01M15 12h.01M9 16h6M2 11v5m20-5v5",
  workflow: "M3 3h6v6H3Zm12 12h6v6h-6ZM9 6h9v9m-3-3 3 3 3-3",
  workpool: "M3 5h12M3 12h12M3 19h12m3-16 4 2-4 2m0 3 4 2-4 2m0 3 4 2-4 2",
  rag: "M3 3h8v16H3Zm8 0h10v16H11ZM6 7h2M6 11h2m6-4h4m-4 4h4m-7 8v3",
  "rate limiter": "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM8 12h8",
  aggregate: "M4 20V10h4v10m4 0V4h4v16m4 0v-7h3v7",
  resend: "M2 5h20v14H2Zm0 0 10 8L22 5",
  stripe: "M2 4h20v16H2Zm0 5h20M6 15h4",
};
export function ServiceIcon({ index, title = "" }: { index: number; title?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={componentIcons[title.toLowerCase()] ?? iconPaths[index % iconPaths.length]} /></svg>;
}

export function DesignedSlide({ slide }: { slide: Doc<"slides"> }) {
  if (slide.layout === "photo" && slide.imageUrl) return <div className="story-photo">
    <img className="story-photo-image" src={slide.imageUrl} alt={slide.title} />
    <div className="story-photo-shade" />
    <div className="story-photo-copy"><span className="story-kicker">{tr("EL ORIGEN")}</span><h1>{slide.title}</h1><p>{slide.body}</p><span className="story-photo-rule" /></div>
    <span className="story-photo-label">{tr("UNA HISTORIA REAL")}</span>
  </div>;
  if (slide.layout === "reactivity") return <div className="story-reactivity">
    <div className="story-brand"><img src={brand} alt="Convex" /><span>{tr("UNA SOLA FUENTE DE VERDAD")}</span></div>
    <div className="story-reactivity-grid"><div className="story-editorial"><span className="story-kicker">{tr("PROGRAMACIÓN REACTIVA")}</span><h1>{slide.title}</h1><p>{slide.body}</p><div className="story-pill"><i />{tr("Sin recargar. Sin polling manual.")}</div></div>
      <div className="reactivity-diagram"><ReactivityDiagram /><div className="reactivity-caption"><b>{tr("Un cambio.")}</b> {tr("Todas las pantallas al día.")}</div></div>
    </div>
    <a className="story-source" href="https://docs.convex.dev/realtime" target="_blank" rel="noreferrer">{tr("Cómo funciona")} ↗</a>
  </div>;
  if (slide.layout === "services") {
    const cards = slide.body.split("\n").map(line => line.trim()).filter(Boolean).slice(0, 8).map(line => { const [title, ...detail] = line.split("|"); return { title: title.trim(), detail: detail.join("|").trim() }; });
    return <div className="story-services"><div className="story-services-header"><div><span className="story-kicker">{tr("DE LA IDEA A PRODUCCIÓN")}</span><h1>{slide.title}</h1></div><img src={brand} alt="Convex" /></div>
      <div className="story-services-grid">{cards.map((card, index) => <article className={`story-service tone-${index % 4}`} key={index}><div className="story-service-top"><span className="story-service-icon"><ServiceIcon index={index} title={card.title} /></span><small>{String(index+1).padStart(2,"0")}</small></div><h2>{card.title}</h2>{card.detail && <p>{card.detail}</p>}</article>)}</div>
      <div className="story-services-footer"><span>{tr("Todo conectado. Todo TypeScript.")}</span><a href="https://docs.convex.dev/understanding/overview" target="_blank" rel="noreferrer">{tr("Documentación oficial")} ↗</a></div>
    </div>;
  }
  return <><div className="slide-copy"><h1>{slide.title}</h1><p>{slide.body}</p></div>{slide.imageUrl && <figure className="slide-image"><img src={slide.imageUrl} alt={slide.title} /></figure>}</>;
}

function ReactivityDiagram() {
  return <svg className="reactivity-svg" viewBox="0 0 620 470" role="img" aria-labelledby="reactivity-title reactivity-description">
    <title id="reactivity-title">{tr("De Convex a todas tus pantallas")}</title><desc id="reactivity-description">{tr("Al cambiar los datos, Convex actualiza automáticamente las consultas suscritas de cada dispositivo.")}</desc>
    <defs><pattern id="reactivity-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d6cabb" /></pattern><linearGradient id="reactivity-node" x2="1" y2="1"><stop stopColor="#fffefb"/><stop offset="1" stopColor="#f5ebdd"/></linearGradient></defs>
    <rect width="620" height="470" rx="30" fill="url(#reactivity-dots)" />
    <g fill="none" strokeWidth="3"><path className="reactivity-route" d="M255 235h70V95h65" stroke="#ee342f"/><path className="reactivity-route route-two" d="M255 235h135" stroke="#8d2676"/><path className="reactivity-route route-three" d="M255 235h70v140h65" stroke="#b87f09"/></g>
    <rect x="65" y="147" width="190" height="176" rx="28" fill="url(#reactivity-node)" stroke="#b19a80" strokeWidth="1.5" />
    <image href={symbol} x="118" y="169" width="84" height="78" />
    <text x="160" y="275" textAnchor="middle" fill="#2b211b" fontSize="25" fontWeight="750">Convex</text><text x="160" y="301" textAnchor="middle" fill="#795e4a" fontSize="15">{tr("DATOS + FUNCIONES")}</text>
    {[{y:45,label:tr("Laptop"),color:"#ee342f",phone:false},{y:185,label:tr("Celular"),color:"#8d2676",phone:true},{y:325,label:tr("La sala"),color:"#b87f09",phone:false}].map(node => <g key={node.y}>
      <rect x="390" y={node.y} width="190" height="100" rx="20" fill="#fffefb" stroke="#cbb8a2" strokeWidth="1.5" />
      {node.phone ? <rect x="412" y={node.y+22} width="28" height="53" rx="6" fill="none" stroke={node.color} strokeWidth="2.5"/> : <g fill="none" stroke={node.color} strokeWidth="2.5"><rect x="405" y={node.y+26} width="47" height="32" rx="5"/><path d={`M400 ${node.y+65}h57`}/></g>}
      <text x="469" y={node.y+44} fill="#302219" fontSize="21" fontWeight="650">{node.label}</text><circle cx="475" cy={node.y+66} r="4" fill={node.color}/><text x="487" y={node.y+71} fill="#795e4a" fontSize="13">{tr("al día")}</text>
    </g>)}
    <rect x="35" y="49" width="223" height="45" rx="22" fill="#ee342f"/><text x="146" y="78" textAnchor="middle" fill="white" fontSize="16" fontWeight="650">{tr("Cambias un dato")}</text>
    <path d="M147 95v37" fill="none" stroke="#ee342f" strokeWidth="2" strokeDasharray="4 4"/>
  </svg>;
}
