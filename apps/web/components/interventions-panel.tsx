"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Id } from "@slidex/backend/data-model";

type Props = { presentationId: Id<"presentations">; slideId: Id<"slides">; isHost: boolean; report: (message: string) => void };
const statusLabels = { pending: "La sala propone", running: "Preparando respuesta…", ready: "Borrador listo", published: "En el deck", dismissed: "Resuelta", failed: "Inténtalo de nuevo" };
export function InterventionsPanel({ presentationId, slideId, isHost, report }: Props) {
  const rows = useQuery(api.interventions.list, { slideId });
  const propose = useMutation(api.interventions.propose);
  const support = useMutation(api.interventions.support);
  const prepare = useMutation(api.interventions.prepare);
  const resolve = useMutation(api.interventions.resolve);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const lost = rows?.find(r => r.kind === "lost" && !["dismissed", "published"].includes(r.status));
  const visible = (rows ?? []).filter(r => r.status !== "dismissed").sort((a, b) => b.votes - a.votes);
  const run = async (job: () => Promise<unknown>) => {
    setBusy(true);
    try { await job(); } catch (error) { report(error instanceof Error ? error.message : "No se pudo guardar"); } finally { setBusy(false); }
  };
  return <section className="interventions-panel" aria-label="Giros en vivo">
    <div className="panel-title"><span className="eyebrow">CAMBIA EL RUMBO</span><span className="intervention-tag">EN VIVO</span></div>
    <div className="intervention-triggers">
      <button disabled={busy || !rows} aria-pressed={!!lost?.supported} onClick={() => void run(() => lost ? support({ id: lost._id }) : propose({ presentationId, slideId, kind: "lost" }))}><span>↶</span><b>{lost?.supported ? "Pediste una pausa" : "Me perdí"}</b><small>{lost ? `${lost.votes} ${lost.votes === 1 ? "persona pide" : "personas piden"} claridad` : "Otra forma de entenderlo"}</small></button>
      <button aria-expanded={open} onClick={() => setOpen(!open)}><span>↯</span><b>Plot twist</b><small>¿Y si fuera al revés?</small></button>
    </div>
    <p className="panel-hint">Tu señal de «Me perdí» no muestra tu nombre. Propón un giro, apoya uno y deja que la charla evolucione.</p>
    {open && <form onSubmit={e => { e.preventDefault(); void run(async () => { await propose({ presentationId, slideId, kind: "twist", text }); setText(""); setOpen(false); report("Plot twist compartido. La sala ya puede apoyarlo."); }); }}>
      <label htmlFor="twist-text">Cuestiona una idea de este slide</label>
      <textarea id="twist-text" required maxLength={300} rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="¿Y si colaborar también nos hiciera pensar igual?" />
      <button className="primary" disabled={busy || !text.trim()}>Proponer giro ↗</button>
    </form>}
    <div className="intervention-list">{visible.map(row => <article className={`intervention-card ${row.kind}`} key={row._id}>
      <div className="contribution-meta"><b>{row.kind === "lost" ? "↶ Me perdí" : "↯ Plot twist"}</b><span>{statusLabels[row.status]}</span></div>
      <p>{row.text}</p>
      {row.kind === "lost" && row.votes >= 3 && row.status === "pending" && <p className="intervention-alert">La sala necesita una pausa. Un ejemplo puede ayudar.</p>}
      <div className="contribution-actions"><button disabled={busy || ["published", "dismissed"].includes(row.status)} aria-pressed={row.supported} aria-label={`Apoyar intervención: ${row.text}`} onClick={() => void run(() => support({ id: row._id }))}>↑ {row.votes}{row.supported ? " · Te sumaste" : " · Me sumo"}</button>
        {isHost && ["pending", "failed"].includes(row.status) && <button disabled={busy || row.votes === 0} onClick={() => void run(() => prepare({ id: row._id }))}>{row.status === "failed" ? "Reintentar" : row.kind === "lost" ? "Explicar más fácil" : "Investigar giro"}</button>}
      </div>
      {isHost && row.status === "running" && <p role="status" className="panel-hint">{row.kind === "twist" ? "Firecrawl busca evidencia y OpenAI prepara el contrapunto." : "OpenAI prepara una analogía y un ejemplo."} Puedes seguir presentando.</p>}
      {isHost && row.error && <p role="alert" className="intervention-alert">{row.error}</p>}
      {row.body && <details className="intervention-draft" open={row.status !== "published"}><summary>{row.status === "published" ? "Ver respuesta publicada" : "SOLO TÚ · REVISA ANTES DE PUBLICAR"}</summary><h3>{row.title}</h3><p>{row.body}</p><div className="source-links">{row.sourceUrls?.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">Fuente {index + 1} ↗</a>)}</div></details>}
      {isHost && !["published", "dismissed"].includes(row.status) && <div className="intervention-review">{row.status === "ready" && <button className="primary" disabled={busy} onClick={() => void run(() => resolve({ id: row._id, publish: true }))}>Mostrar como slide ↗</button>}<button disabled={busy} onClick={() => void run(() => resolve({ id: row._id, publish: false }))}>{row.kind === "lost" ? "Ya lo expliqué" : "Descartar giro"}</button></div>}
    </article>)}</div>
  </section>;
}

export function InterventionCue({ slideId, onReview }: { slideId: Id<"slides">; onReview: () => void }) {
  const rows = useQuery(api.interventions.list, { slideId });
  const lost = rows?.find(r => r.kind === "lost" && !["published", "dismissed"].includes(r.status) && r.votes > 0);
  const twists = rows?.filter(r => r.kind === "twist" && !["published", "dismissed"].includes(r.status)).length ?? 0;
  if (!lost && !twists) return null;
  return <a className="intervention-cue" href="#live-interventions" onClick={onReview} aria-live="polite">{lost ? `↶ ${lost.votes} ${lost.votes === 1 ? "persona pide" : "personas piden"} otra explicación` : ""}{lost && twists ? " · " : ""}{twists ? `↯ ${twists} ${twists === 1 ? "giro propuesto" : "giros propuestos"}` : ""} <span>Revisar ↓</span></a>;
}
