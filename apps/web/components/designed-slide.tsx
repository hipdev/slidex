"use client";

import type { Doc } from "@slidex/backend/data-model";
import { useEffect, useRef } from "react";
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
  if (slide.layout === "abstractions" || slide.layout === "architecture") return <ThinkingSlide slide={slide} />;
  if (slide.layout === "demo") return <DemoSlide slide={slide} />;
  if (slide.layout === "rebask") return <div className="story-rebask">
    <div className="rebask-brand"><span className="rebask-mark" aria-hidden="true">R</span><span>Rebask</span><span className="rebask-stack">React + Vite</span></div>
    <div className="rebask-layout"><div className="rebask-editorial"><span className="story-kicker">EL FRAMEWORK DE ESTA PRESENTACIÓN</span><h1>{slide.title}</h1><div className="rebask-features">{slide.body.split("\n").filter(line=>line.trim()).slice(0,3).map((line,index)=><div key={index}><span>0{index+1}</span><h2>{line}</h2></div>)}</div><div className="rebask-command"><span aria-hidden="true">$</span><code>pnpm create rebask-app</code></div></div>
    <aside className="rebask-creator"><img src="/images/rebask/lfades.jpg" alt="Luis Alvarez, LFades"/><div className="rebask-creator-copy"><span className="story-kicker">SU CREADOR</span><h2>Luis Alvarez</h2><a href="https://lfades.com" target="_blank" rel="noreferrer">@lfades ↗</a><p>Ingeniero en Vercel.<br/>Creador de Rebask.</p></div></aside></div>
    <footer className="rebask-footer"><span>Slidex corre sobre Rebask.</span><a href="https://www.rebask.com" target="_blank" rel="noreferrer">rebask.com ↗</a></footer>
  </div>;
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
  if (slide.layout === "pricing") {
    const rows = slide.body.split("\n").filter(line => line.trim()).slice(0,10).map(line => line.split("|").map(cell=>cell.trim()));
    return <div className="story-pricing">
      <div className="story-services-header"><div><span className="story-kicker">{tr("CONVEX CLOUD · TU INFRAESTRUCTURA")}</span><h1>{slide.title}</h1></div><img src={brand} alt="Convex" /></div>
      <div className="pricing-layout"><div className="pricing-cloud"><table><caption>{tr("Cuotas incluidas de Convex Cloud")}</caption><thead><tr><th scope="col">{tr("Recurso")}</th><th scope="col">Free / Starter</th><th scope="col">Professional</th></tr></thead><tbody>{rows.map((cells,i)=><tr key={i}><th scope="row">{cells[0]}</th><td>{cells[1]??"—"}</td><td>{cells[2]??"—"}</td></tr>)}</tbody></table>
      <p className="pricing-metering">{tr("Free: límites fijos. Starter y Pro: excedentes por uso.")}<br/>{tr("Las actualizaciones de suscripción y tareas también cuentan como llamadas.")}</p></div>
      <aside className="pricing-selfhost"><span className="story-kicker">SELF-HOSTED</span><div className="selfhost-icon"><ServiceIcon index={0}/></div><h2>{tr("El mismo backend. En tus servidores.")}</h2><ul><li>{tr("Docker + backend + dashboard")}</li><li>{tr("Código y datos bajo tu control")}</li><li>{tr("Infraestructura y operación a tu cargo")}</li></ul><div className="pricing-license"><b>FSL → Apache 2.0</b><p>{tr("Fair source: Apache tras 2 años por versión. Restringe servicios comerciales competidores.")}</p></div><p className="pricing-portability">{tr("Portabilidad de hosting; las APIs siguen siendo Convex.")}</p></aside></div>
      <footer className="pricing-sources"><span>{tr("Cuotas por equipo · USD · US East · 21 nov 2026")}</span><div><a href="https://www.convex.dev/pricing" target="_blank" rel="noreferrer">Pricing ↗</a><a href="https://docs.convex.dev/self-hosting" target="_blank" rel="noreferrer">Self-hosting ↗</a><a href="https://github.com/convex/convex-backend/blob/main/LICENSE.md" target="_blank" rel="noreferrer">{tr("Licencia")} ↗</a></div></footer>
    </div>;
  }
  if (slide.layout === "cache") {
    const steps = slide.body.split("\n").filter(line => line.trim()).slice(0,3).map(line => { const [title,...detail] = line.split("|"); return {title:title.trim(),detail:detail.join("|").trim()}; });
    return <div className="story-cache">
      <div className="cache-heading"><div><span className="story-kicker">{tr("EL MOTOR DETRÁS DE LA MAGIA")}</span><h1>{slide.title}</h1></div><img src={symbol} alt="Convex" /></div>
      <div className="cache-flow">{steps.map((step,index) => <article key={index} className={`cache-step cache-step-${index}`}><div className="cache-step-heading"><span>{String(index+1).padStart(2,"0")}</span><ServiceIcon index={[2,0,1][index]} /></div><h2>{step.title}</h2><p>{step.detail}</p>{index<2 && <span className="cache-arrow" aria-hidden="true">→</span>}</article>)}</div>
      <div className="cache-invalidation"><span className="cache-write-icon" aria-hidden="true">↻</span><div><b>{tr("¿Cambió algo de lo que leyó?")}</b><p>{tr("Invalida → recalcula → actualiza las pantallas.")}</p></div><span className="cache-readset-tag">read set</span></div>
      <div className="cache-foundations"><span>{tr("Bajo el capó")}</span><b>Determinismo</b><b>{tr("Read sets: validez")}</b><b>{tr("LRU: libera espacio")}</b><b>MVCC</b><b>OCC</b></div>
      <footer className="cache-history"><a href="https://www.convex.dev/about-us" target="_blank" rel="noreferrer">{tr("De la experiencia en Dropbox a un motor propio.")} ↗</a><a href="https://stack.convex.dev/how-convex-works" target="_blank" rel="noreferrer">{tr("Cómo funciona")} ↗</a></footer>
    </div>;
  }
  if (slide.layout === "services") {
    const cards = slide.body.split("\n").map(line => line.trim()).filter(Boolean).slice(0, 8).map(line => { const [title, ...detail] = line.split("|"); return { title: title.trim(), detail: detail.join("|").trim() }; });
    return <div className="story-services"><div className="story-services-header"><div><span className="story-kicker">{tr("DE LA IDEA A PRODUCCIÓN")}</span><h1>{slide.title}</h1></div><img src={brand} alt="Convex" /></div>
      <div className="story-services-grid">{cards.map((card, index) => <article className={`story-service tone-${index % 4}`} key={index}><div className="story-service-top"><span className="story-service-icon"><ServiceIcon index={index} title={card.title} /></span><small>{String(index+1).padStart(2,"0")}</small></div><h2>{card.title}</h2>{card.detail && <p>{card.detail}</p>}</article>)}</div>
      <div className="story-services-footer"><span>{tr("Todo conectado. Todo TypeScript.")}</span><a href="https://docs.convex.dev/understanding/overview" target="_blank" rel="noreferrer">{tr("Documentación oficial")} ↗</a></div>
    </div>;
  }
  return <><div className="slide-copy"><h1>{slide.title}</h1><p>{slide.body}</p></div>{slide.imageUrl && <figure className="slide-image"><img src={slide.imageUrl} alt={slide.title} /></figure>}</>;
}

function ThinkingSlide({ slide }: { slide: Doc<"slides"> }) {
  const architecture = slide.layout === "architecture";
  const cards = slide.body.split("\n").filter(line=>line.trim()).slice(0,3).map(line=>{const [title,...description]=line.split("|");return {title:title.trim(),description:description.join("|").trim()};});
  return <div className={`story-thinking ${architecture ? "thinking-systems" : "thinking-abstractions"}`}>
    <div className="thinking-grid"><div className="thinking-copy"><span className="story-kicker">{architecture ? "DISEÑAR PARA EL MUNDO REAL" : "CONSTRUIR CON IA · PENSAR EN CAPAS"}</span><h1>{slide.title}</h1><p>{architecture ? "La red falla. Los modelos tardan. El sistema debe responder." : "La sintaxis importa. Entender qué estás construyendo, todavía más."}</p></div>
    <div className="thinking-art">{architecture ? <ReliabilityImage/> : <AbstractionImage/>}</div></div>
    <div className="thinking-cards">{cards.map((card,index)=><article key={index}><span>0{index+1}</span><h2>{card.title}</h2><p>{card.description}</p></article>)}</div>
    <footer className="thinking-footer"><span>{architecture ? "Una transacción no deshace una llamada externa." : "La IA propone la implementación. Tú defines las garantías."}</span><b>{architecture ? "Arquitectura = decisiones + consecuencias" : "Menos memorizar. Más comprender."}</b></footer>
  </div>;
}

function AbstractionImage() {
  return <svg viewBox="0 0 600 390" role="img" aria-label="Tres capas conectadas: intención del producto, contratos del sistema e implementación asistida por IA">
    <defs><pattern id="thinking-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#9a9dbe" opacity=".45"/></pattern></defs><rect width="600" height="390" rx="26" fill="url(#thinking-grid)"/>
    <path className="thinking-wire" d="M140 90v200h320V90" fill="none" stroke="#8271e8" strokeWidth="3" strokeDasharray="8 10"/>
    <g transform="translate(84 24) rotate(-4 216 48)"><rect width="432" height="88" rx="16" fill="#342b54" stroke="#746294"/><text x="24" y="32" fill="#d7b5ff" fontSize="12" fontFamily="monospace">01 / INTENCIÓN</text><text x="24" y="65" fill="#fff9ee" fontSize="25" fontWeight="650">¿Qué problema resolvemos?</text><path d="m378 28 8 12 14 4-14 4-8 12-4-12-14-4 14-4Z" fill="#d7b5ff"/></g>
    <g transform="translate(58 140)"><rect width="484" height="104" rx="16" fill="#e4dfb1" stroke="#8d885c"/><text x="24" y="33" fill="#575139" fontSize="12" fontFamily="monospace">02 / CONTRATOS</text><text x="24" y="69" fill="#332f22" fontSize="29" fontWeight="700">Estado · límites · garantías</text></g>
    <g transform="translate(84 272) rotate(4 216 48)"><rect width="432" height="90" rx="16" fill="#fffaf1" stroke="#aea7bd"/><text x="24" y="32" fill="#655e78" fontSize="12" fontFamily="monospace">03 / IMPLEMENTACIÓN</text><text x="24" y="66" fill="#342b54" fontSize="24" fontWeight="650">Código + IA + herramientas</text></g>
  </svg>;
}

function ReliabilityImage() {
  return <svg viewBox="0 0 600 390" role="img" aria-label="Una solicitud se reserva en Convex, llama al modelo y puede quedar incierta tras un timeout; la reconciliación verifica su estado">
    <rect x="12" y="20" width="576" height="350" rx="26" fill="#143039" stroke="#58818a"/>
    <text x="38" y="58" fill="#a4c1c9" fontFamily="monospace" fontSize="12">UNA SOLICITUD · VARIOS PUNTOS DE FALLO</text>
    <path className="thinking-wire" d="M126 151h338" fill="none" stroke="#74d6d0" strokeWidth="3" strokeDasharray="7 9"/>
    {[{x:38,label:"App",sub:"solicita"},{x:228,label:"Convex",sub:"reserva"},{x:418,label:"LLM",sub:"ejecuta"}].map(node=><g key={node.x}><rect x={node.x} y="98" width="144" height="108" rx="18" fill="#1b4650" stroke="#79abb5"/><text x={node.x+72} y="142" textAnchor="middle" fill="#fff9eb" fontSize="25" fontWeight="650">{node.label}</text><text x={node.x+72} y="176" textAnchor="middle" fill="#b9d4d8" fontSize="16">{node.sub}</text></g>)}
    <path d="M490 207v44H300v31" fill="none" stroke="#efb77b" strokeWidth="2" strokeDasharray="6 5"/><rect x="353" y="229" width="148" height="32" rx="16" fill="#efb77b"/><text x="427" y="251" textAnchor="middle" fill="#332d24" fontSize="15" fontWeight="650">¿Timeout?</text>
    <rect x="92" y="286" width="416" height="53" rx="14" fill="#263c42" stroke="#a6c7c5"/><text x="300" y="319" textAnchor="middle" fill="#d7f2cf" fontSize="22" fontWeight="650">Verificar → reconciliar</text>
  </svg>;
}

function DemoSlide({ slide }: { slide: Doc<"slides"> }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const player = video.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => { if (preference.matches || document.hidden) player?.pause(); };
    if (!preference.matches && !document.hidden) void player?.play().catch(() => {});
    preference.addEventListener("change", stop);
    document.addEventListener("visibilitychange", stop);
    return () => { player?.pause(); preference.removeEventListener("change", stop); document.removeEventListener("visibilitychange", stop); };
  }, []);
  return <div className="story-demo"><div className="demo-copy"><span className="story-kicker">AHORA SÍ · MANOS A LA OBRA</span><p className="demo-quote">A lo que yo vine<br/>fue a esto…</p><h1>{slide.title}</h1><p className="demo-subtitle">{slide.body}</p><div className="demo-stack"><img src={symbol} alt="Convex"/><span>Ideas → productos reales</span></div></div><figure className="demo-meme"><div className="demo-sticker">DEMO TIME ↗</div><video ref={video} src="/images/demo/a-lo-que-yo-vine.mp4" muted loop playsInline controls preload="auto" aria-label="Meme: A lo que yo vine fue a esto"/><figcaption><span>El mood de este momento.</span><a href="https://tenor.com/view/a-lo-que-yo-vine-fue-a-esto-adivina-qu%C3%A9-hago-bartender-acrobatico-fremantle-gif-1876391802803682162" target="_blank" rel="noreferrer">GIF · adivinaquehago / Tenor ↗</a></figcaption></figure></div>;
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
