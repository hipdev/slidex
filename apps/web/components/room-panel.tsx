"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Id } from "@slidex/backend/data-model";

const labels = { suggestion: "Sugerencia", conclusion: "Conclusión", question: "Pregunta", fact: "Dato curioso" } as const;
type Kind = keyof typeof labels;
export function RoomPanel({ presentationId, slideId, isHost, showConclusions, report }: { presentationId: Id<"presentations">; slideId: Id<"slides">; isHost: boolean; showConclusions: boolean; report: (message: string) => void }) {
  const items = useQuery(api.live.list, { presentationId });
  const contribute = useMutation(api.live.contribute);
  const endorse = useMutation(api.live.endorse);
  const moderate = useMutation(api.live.moderate);
  const settings = useMutation(api.live.settings);
  const [kind, setKind] = useState<Kind>("suggestion");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"slide" | "closing">("slide");
  const visible = (items ?? []).filter(item => item.status !== "dismissed" && (tab === "slide" ? item.kind === "suggestion" && item.slideId === slideId : item.kind !== "suggestion")).sort((a,b) => b.votes-a.votes);
  const run = (job: Promise<unknown>) => { void job.catch(error => report(error instanceof Error ? error.message : "No se pudo guardar")); };
  return <section className="collab-panel">
    <div className="panel-title"><span className="eyebrow">LA SALA ESCRIBE CONTIGO</span><span className="live-dot" /></div>
    <div className="tabs"><button aria-pressed={tab === "slide"} onClick={() => { setTab("slide"); setKind("suggestion"); }}>Este slide</button><button aria-pressed={tab === "closing"} onClick={() => { setTab("closing"); setKind("conclusion"); }}>Para el cierre</button></div>
    <p className="panel-hint">{tab === "slide" ? "Propón una mejora. La sala la apoya y el presentador la incorpora en vivo." : "Lo que te llevas, lo que te intriga. El presentador elige qué mostrar al final."}</p>
    <form onSubmit={async event => { event.preventDefault(); setBusy(true); try { await contribute({ presentationId, slideId, text, kind, authorName: name }); setText(""); report("Tu idea ya está en la sala"); } catch(error) { report(error instanceof Error ? error.message : "No se pudo guardar"); } finally { setBusy(false); } }}>
      <label htmlFor="guest-name">Tu nombre <small>opcional</small></label><input id="guest-name" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="¿Cómo te llamas?" />
      {tab === "closing" && <><label htmlFor="idea-kind">Tipo de aporte</label><select id="idea-kind" value={kind} onChange={e => setKind(e.target.value as Kind)}>{Object.entries(labels).filter(([key]) => key !== "suggestion").map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></>}
      <label htmlFor="idea-text">{labels[kind]}</label><textarea id="idea-text" required maxLength={500} value={text} onChange={e => setText(e.target.value)} placeholder={tab === "slide" ? "¿Y si agregamos un ejemplo del mundo real?" : "Hoy descubrí que…"} rows={3} />
      <button className="primary" disabled={busy || !text.trim()}>{busy ? "Compartiendo…" : "Compartir con la sala ↗"}</button>
    </form>
    <div className="contribution-list">{visible.length === 0 && <p className="empty">La primera idea puede ser tuya.</p>}{visible.map(item => <article className="contribution" key={item._id}><div className="contribution-meta"><span>{labels[item.kind]} · {item.authorName}</span>{item.status === "accepted" && <b>✓ Elegida</b>}</div><p>{item.text}</p><div className="contribution-actions"><button aria-pressed={item.endorsed} aria-label={`Apoyar: ${item.text}`} onClick={() => run(endorse({ contributionId: item._id }))}>↑ {item.votes}</button>{isHost && item.status === "pending" && <><button onClick={() => run(moderate({ contributionId: item._id, accept: true }))}>{item.kind === "suggestion" ? "Incorporar" : "Elegir para el cierre"}</button><button aria-label="Descartar aporte" onClick={() => run(moderate({ contributionId: item._id, accept: false }))}>×</button></>}</div></article>)}</div>
    {isHost && <button className="secondary closing-button" onClick={() => run(settings({ presentationId, showConclusions: !showConclusions }))}>{showConclusions ? "Volver al slide" : "Mostrar cierre colectivo ↗"}</button>}
  </section>;
}

export function ClosingWall({ presentationId }: { presentationId: Id<"presentations"> }) {
  const items = useQuery(api.live.list, { presentationId });
  const chosen = (items ?? []).filter(i => i.kind !== "suggestion" && i.status === "accepted").sort((a,b) => b.votes-a.votes);
  return <div className="closing-wall"><p className="accent-label">EL ÚLTIMO SLIDE LO ESCRIBIMOS JUNTOS</p><h1>Lo que nos<br/>llevamos.</h1>{chosen.length ? <div className="closing-cards">{chosen.map(item => <article key={item._id}><small>{labels[item.kind]} · {item.authorName}</small><p>{item.text}</p><span>↑ {item.votes} apoyos</span></article>)}</div> : <p>Las ideas elegidas aparecerán aquí. Comparte una conclusión, pregunta o dato en «Para el cierre».</p>}</div>;
}
