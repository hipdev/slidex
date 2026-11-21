"use client";
import { tr, friendlyError, useTranslation } from "../i18n/provider";
import { useId, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Id } from "@slidex/backend/data-model";

const labels = { suggestion: "Sugerencia", conclusion: "Conclusión", question: "Pregunta", fact: "Dato curioso" } as const;
type Kind = keyof typeof labels;
export function RoomPanel({ presentationId, slideId, isHost, showConclusions, report }: { presentationId: Id<"presentations">; slideId: Id<"slides">; isHost: boolean; showConclusions: boolean; report: (message: string) => void }) {
  useTranslation();
  const items = useQuery(api.live.list, { presentationId });
  const contribute = useMutation(api.live.contribute);
  const endorse = useMutation(api.live.endorse);
  const moderate = useMutation(api.live.moderate);
  const settings = useMutation(api.live.settings);
  const formId = useId();
  const voting = useRef(false);
  const [votingBusy, setVotingBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [kind, setKind] = useState<Kind>("suggestion");
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"slide" | "closing">("slide");
  const visible = (items ?? []).filter(item => item.status !== "dismissed" && (tab === "slide" ? item.kind === "suggestion" && item.slideId === slideId : item.kind !== "suggestion")).sort((a,b) => b.votes-a.votes);
  const run = (job: Promise<unknown>) => { void job.catch(error => report(friendlyError(error))); };
  return <section className="collab-panel">
    <div className="panel-title"><span className="eyebrow">{tr("LA SALA ESCRIBE CONTIGO")}</span><span className="live-dot" /></div>
    <div className="tabs"><button aria-pressed={tab === "slide"} onClick={() => { setTab("slide"); setKind("suggestion"); }}>{tr("Este slide")}</button><button aria-pressed={tab === "closing"} onClick={() => { setTab("closing"); setKind("conclusion"); }}>{tr("Para el cierre")}</button></div>
    <p className="panel-hint">{tab === "slide" ? tr("Propón una mejora. La sala la apoya y el presentador la incorpora en vivo.") : tr("Lo que te llevas, lo que te intriga. El presentador elige qué mostrar al final.")}</p>
    <h3 className="ideas-heading">{tr("Apoya las ideas")}</h3>
    <div className="contribution-list">{items === undefined ? <p className="empty">{tr("Cargando ideas…")}</p> : visible.length === 0 && <p className="empty">{tr("La primera idea puede ser tuya.")}</p>}{visible.map((item, index) => <article className="contribution" key={item._id}><div className="contribution-meta"><span>{tr(labels[item.kind])} · {item.authorName}</span>{item.status === "accepted" && <b>{tr("✓ Elegida")}</b>}</div><p><b className="idea-rank">#{index + 1}</b>{item.text}</p><div className="contribution-actions"><button disabled={votingBusy} aria-pressed={item.endorsed} aria-label={tr("Apoyar aporte", { text: item.text })} onClick={async () => { if (voting.current) return; voting.current = true; setVotingBusy(true); try { await endorse({ contributionId: item._id }); } catch (error) { report(friendlyError(error)); } finally { voting.current = false; setVotingBusy(false); } }}>↑ {item.votes} · {tr(item.endorsed ? "Apoyada" : "Apoyar")}</button>{isHost && item.status === "pending" && <><button onClick={() => run(moderate({ contributionId: item._id, accept: true }))}>{item.kind === "suggestion" ? tr("Incorporar") : tr("Elegir para el cierre")}</button><button aria-label={tr("Descartar aporte")} onClick={() => run(moderate({ contributionId: item._id, accept: false }))}>×</button></>}</div></article>)}</div>
    <button className="secondary compose-idea" aria-expanded={composing} aria-controls={`${formId}-form`} onClick={() => setComposing(value => !value)}>{tr(composing ? "Cerrar propuesta" : "+ Proponer una idea")}</button>
    {composing && <form id={`${formId}-form`} onSubmit={async event => { event.preventDefault(); setBusy(true); try { await contribute({ presentationId, slideId, text, kind, authorName: name }); setText(""); setComposing(false); report(tr("Tu idea ya está en la sala")); } catch(error) { report(friendlyError(error)); } finally { setBusy(false); } }}>
      <label htmlFor={`${formId}-guest-name`}>{tr("Tu nombre")} <small>{tr("opcional")}</small></label><input id={`${formId}-guest-name`} maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder={tr("¿Cómo te llamas?")} />
      {tab === "closing" && <><label htmlFor={`${formId}-idea-kind`}>{tr("Tipo de aporte")}</label><select id={`${formId}-idea-kind`} value={kind} onChange={e => setKind(e.target.value as Kind)}>{Object.entries(labels).filter(([key]) => key !== "suggestion").map(([key,label]) => <option key={key} value={key}>{tr(label)}</option>)}</select></>}
      <label htmlFor={`${formId}-idea-text`}>{tr(labels[kind])}</label><textarea id={`${formId}-idea-text`} required maxLength={500} value={text} onChange={e => setText(e.target.value)} placeholder={tab === "slide" ? tr("¿Y si agregamos un ejemplo del mundo real?") : tr("Hoy descubrí que…")} rows={3} />
      <button className="primary" disabled={busy || !text.trim()}>{busy ? tr("Compartiendo…") : tr("Compartir con la sala ↗")}</button>
    </form>}
    {isHost && <button className="secondary closing-button" onClick={() => run(settings({ presentationId, showConclusions: !showConclusions }))}>{showConclusions ? tr("Volver al slide") : tr("Mostrar cierre colectivo ↗")}</button>}
  </section>;
}

export function ClosingWall({ presentationId }: { presentationId: Id<"presentations"> }) {
  useTranslation();
  const items = useQuery(api.live.list, { presentationId });
  const chosen = (items ?? []).filter(i => i.kind !== "suggestion" && i.status === "accepted").sort((a,b) => b.votes-a.votes);
  return <div className="closing-wall"><p className="accent-label">{tr("EL ÚLTIMO SLIDE LO ESCRIBIMOS JUNTOS")}</p><h1>{tr("Lo que nos")}<br/>{tr("llevamos.")}</h1>{chosen.length ? <div className="closing-cards">{chosen.map(item => <article key={item._id}><small>{tr(labels[item.kind])} · {item.authorName}</small><p>{item.text}</p><span>↑ {item.votes} {tr("apoyos")}</span></article>)}</div> : <p>{tr("Las ideas elegidas aparecerán aquí. Comparte una conclusión, pregunta o dato en «Para el cierre».")}</p>}</div>;
}
