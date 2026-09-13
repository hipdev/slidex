"use client";
import { tr, friendlyError, useTranslation, useLocale } from "../i18n/provider";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Id } from "@slidex/backend/data-model";

type Props = { presentationId: Id<"presentations">; slideId: Id<"slides">; isHost: boolean; report: (message: string) => void };
const statusLabels = { pending: "La sala propone", running: "Preparando respuesta…", ready: "Borrador listo", published: "En el deck", dismissed: "Resuelta", failed: "Inténtalo de nuevo" };
export function InterventionsPanel({ presentationId, slideId, isHost, report }: Props) {
  useTranslation();
  const locale = useLocale();
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
    try { await job(); } catch (error) { report(friendlyError(error)); } finally { setBusy(false); }
  };
  return <section className="interventions-panel" aria-label={tr("Giros en vivo")}>
    <div className="panel-title"><span className="eyebrow">{tr("CAMBIA EL RUMBO")}</span><span className="intervention-tag">{tr("EN VIVO")}</span></div>
    <div className="intervention-triggers">
      <button disabled={busy || !rows} aria-pressed={!!lost?.supported} onClick={() => void run(() => lost ? support({ id: lost._id }) : propose({ presentationId, slideId, kind: "lost" }))}><span>↶</span><b>{lost?.supported ? tr("Pediste una pausa") : tr("Me perdí")}</b><small>{lost ? tr("clarityCount", { count: lost.votes }) : tr("Otra forma de entenderlo")}</small></button>
      <button aria-expanded={open} onClick={() => setOpen(!open)}><span>↯</span><b>{tr("Plot twist")}</b><small>{tr("¿Y si fuera al revés?")}</small></button>
    </div>
    <p className="panel-hint">{tr("Tu señal de «Me perdí» no muestra tu nombre. Propón un giro, apoya uno y deja que la charla evolucione.")}</p>
    {open && <form onSubmit={e => { e.preventDefault(); void run(async () => { await propose({ presentationId, slideId, kind: "twist", text }); setText(""); setOpen(false); report(tr("Plot twist compartido. La sala ya puede apoyarlo.")); }); }}>
      <label htmlFor="twist-text">{tr("Cuestiona una idea de este slide")}</label>
      <textarea id="twist-text" required maxLength={300} rows={3} value={text} onChange={e => setText(e.target.value)} placeholder={tr("¿Y si colaborar también nos hiciera pensar igual?")} />
      <button className="primary" disabled={busy || !text.trim()}>{tr("Proponer giro ↗")}</button>
    </form>}
    <div className="intervention-list">{visible.map(row => <article className={`intervention-card ${row.kind}`} key={row._id}>
      <div className="contribution-meta"><b>{row.kind === "lost" ? tr("↶ Me perdí") : tr("↯ Plot twist")}</b><span>{tr(statusLabels[row.status])}</span></div>
      <p>{row.kind === "lost" ? tr("Me perdí. ¿Lo explicamos con un ejemplo?") : row.text}</p>
      {row.kind === "lost" && row.votes >= 3 && row.status === "pending" && <p className="intervention-alert">{tr("La sala necesita una pausa. Un ejemplo puede ayudar.")}</p>}
      <div className="contribution-actions"><button disabled={busy || ["published", "dismissed"].includes(row.status)} aria-pressed={row.supported} aria-label={tr("Apoyar aporte", { text: row.kind === "lost" ? tr("Me perdí") : row.text })} onClick={() => void run(() => support({ id: row._id }))}>↑ {row.votes}{row.supported ? tr(" · Te sumaste") : tr(" · Me sumo")}</button>
        {isHost && ["pending", "failed"].includes(row.status) && <button disabled={busy || row.votes === 0} onClick={() => void run(() => prepare({ id: row._id, locale }))}>{row.status === "failed" ? tr("Reintentar") : row.kind === "lost" ? tr("Explicar más fácil") : tr("Investigar giro")}</button>}
      </div>
      {isHost && row.status === "running" && <p role="status" className="panel-hint">{row.kind === "twist" ? tr("Firecrawl busca evidencia y OpenAI prepara el contrapunto.") : tr("OpenAI prepara una analogía y un ejemplo.")} {tr("Puedes seguir presentando.")}</p>}
      {isHost && row.error && <p role="alert" className="intervention-alert">{friendlyError(row.error)}</p>}
      {row.body && <details className="intervention-draft" open={row.status !== "published"}><summary>{row.status === "published" ? tr("Ver respuesta publicada") : tr("SOLO TÚ · REVISA ANTES DE PUBLICAR")}</summary><h3>{row.title}</h3><p>{row.body}</p><div className="source-links">{row.sourceUrls?.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">{tr("Fuente")} {index + 1} ↗</a>)}</div></details>}
      {isHost && !["published", "dismissed"].includes(row.status) && <div className="intervention-review">{row.status === "ready" && <button className="primary" disabled={busy} onClick={() => void run(() => resolve({ id: row._id, publish: true }))}>{tr("Mostrar como slide ↗")}</button>}<button disabled={busy} onClick={() => void run(() => resolve({ id: row._id, publish: false }))}>{row.kind === "lost" ? tr("Ya lo expliqué") : tr("Descartar giro")}</button></div>}
    </article>)}</div>
  </section>;
}

export function InterventionCue({ slideId, onReview }: { slideId: Id<"slides">; onReview: () => void }) {
  useTranslation();
  const rows = useQuery(api.interventions.list, { slideId });
  const lost = rows?.find(r => r.kind === "lost" && !["published", "dismissed"].includes(r.status) && r.votes > 0);
  const twists = rows?.filter(r => r.kind === "twist" && !["published", "dismissed"].includes(r.status)).length ?? 0;
  if (!lost && !twists) return null;
  return <a className="intervention-cue" href="#live-interventions" onClick={onReview} aria-live="polite">{lost ? tr("cueClarity", { count: lost.votes }) : ""}{lost && twists ? " · " : ""}{twists ? tr("cueTwists", { count: twists }) : ""} <span>{tr("Revisar ↓")}</span></a>;
}
