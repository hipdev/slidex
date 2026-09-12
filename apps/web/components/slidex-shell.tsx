"use client";

import { ConvexAuthProvider, useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { ConvexReactClient, useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@slidex/backend/api";

import dynamic from "next/dynamic";
const LiveVisual = dynamic(() => import("./live-visual"), { ssr: false, loading: () => <p>Preparando visualización…</p> });
import { SlideEditor } from "./slide-editor";
import { VoiceControls, MomentCard } from "./voice-controls";
import { RoomPanel, ClosingWall } from "./room-panel";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export function SlidexShell() {
  const client = useMemo(() => convexUrl ? new ConvexReactClient(convexUrl) : null, []);
  if (!client) return <SetupNotice />;
  return <ConvexAuthProvider client={client}><Slidex /></ConvexAuthProvider>;
}

function SetupNotice() {
  return <main className="setup"><div className="setup-card"><span className="eyebrow">SLIDEX / LIVE SYSTEM</span><h1>Presentations should be alive.</h1><p>Convex is not connected yet. Run <code>pnpm convex:dev</code> inside this repository and copy the generated <code>NEXT_PUBLIC_CONVEX_URL</code> into <code>apps/web/.env.local</code>.</p><p className="muted">The UI is static-export ready; its realtime room activates as soon as the public Convex URL exists.</p></div></main>;
}

function Slidex() {
  const [presenting, setPresenting] = useState(false);
  const [inboxBusy, setInboxBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [panel, setPanel] = useState<"room" | "agent">("room");
  const [slug, setSlug] = useState<string | null>(null);
  const [researchPrompt, setResearchPrompt] = useState("");
  const [researchUrl, setResearchUrl] = useState("");
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const data = useQuery(api.presentations.getBySlug, slug ? { slug } : "skip");
  const createDemo = useMutation(api.presentations.createDemo);
  const join = useMutation(api.presentations.join);
  const react = useMutation(api.presentations.react);
  const vote = useMutation(api.presentations.vote);
  const setCurrentSlide = useMutation(api.presentations.setCurrentSlide);
  const connectInbox = useAction(api.inbox.connect);
  const syncInbox = useAction(api.inbox.sync);
  const emailToSlide = useMutation(api.inbox.turnIntoSlide);
  const addVisual = useMutation(api.live.addVisual);
  const requestResearch = useMutation(api.research.request);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("room");
    if (value) setSlug(value.toUpperCase());
    setPresenting(new URLSearchParams(window.location.search).get("view") === "stage");
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) void signIn("anonymous").catch(error => setNotice(String(error)));
  }, [isAuthenticated, isLoading, signIn]);

  useEffect(() => {
    if (data?.presentation && isAuthenticated) void join({ presentationId: data.presentation._id }).catch(error => setNotice(String(error)));
  }, [data?.presentation?._id, isAuthenticated, join]);

  const createRoom = async () => {
    try { const room = await createDemo({ ownerName: "Presentador" }); window.location.assign(`?room=${room.slug}`); } catch(error) { setNotice(String(error)); }
  };

  if (isLoading || !isAuthenticated) return <main className="setup"><p className="eyebrow">CONVEX AUTH</p><h1>Preparando tu entrada…</h1>{notice && <p role="alert">{notice}</p>}</main>;
  if (!slug) return <Launchpad onCreate={createRoom} notice={notice} />;
  if (data === undefined) return <main className="setup"><p className="eyebrow">CONNECTING TO {slug}</p><h1>Waking the room…</h1></main>;
  if (data === null) return <main className="setup"><div className="setup-card"><span className="eyebrow">ROOM NOT FOUND</span><h1>{slug} is not live.</h1><button onClick={() => setSlug(null)}>Create a new live room</button></div></main>;

  const current = data.slides.find((slide) => slide._id === data.presentation.currentSlideId) ?? data.slides[0];
  const reactions = countBy(data.reactions.filter((reaction) => reaction.slideId === current?._id), "emoji");
  const votes = countBy(data.votes.filter((item) => item.slideId === current?._id), "choiceId");
  const totalVotes = Object.values(votes).reduce((sum, item) => sum + item, 0);
  const isPoll = current?.kind === "poll";

  return <main className={`app-shell ${presenting ? "presentation-mode" : ""}`}>
    <header className="topbar"><a href="/" className="logo">SLID<span>EX</span></a><div className="room-pill"><i /> LIVE · {slug}</div><div className="top-actions"><a className="share" href="#participation" onClick={() => { setPresenting(false); setPanel("room"); }}>Participar ↓</a><button className="share" onClick={() => setPresenting(!presenting)}>{presenting ? "Salir del escenario" : "Presentar ⤢"}</button><span className="status">{data.isHost ? "Presentador" : "Audiencia"} · {data.participantCount} participantes</span><button className="share" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/?room=${slug}`).then(() => setNotice("Enlace copiado; compártelo para invitar a la sala")).catch(() => setNotice("Copia el enlace desde la barra del navegador"))}>Invitar a la sala</button></div></header>
    {notice && <div className="notice" role="status">{notice}<button aria-label="Cerrar aviso" onClick={() => setNotice("")}>×</button></div>}
    {data.isHost && <div className="host-toolbar"><span>Estudio en vivo</span><button disabled={data.slides[0]?._id === current?._id} onClick={() => { const index = data.slides.findIndex(s => s._id === current?._id); if (index > 0) void setCurrentSlide({ presentationId: data.presentation._id, slideId: data.slides[index-1]._id }).catch(error => setNotice(String(error))); }}>← Anterior</button><button disabled={data.slides.at(-1)?._id === current?._id} onClick={() => { const index = data.slides.findIndex(s => s._id === current?._id); if (index < data.slides.length-1) void setCurrentSlide({ presentationId: data.presentation._id, slideId: data.slides[index+1]._id }).catch(error => setNotice(String(error))); }}>Siguiente →</button><button onClick={() => void addVisual({ presentationId: data.presentation._id, visual: "constellation" }).catch(error => setNotice(String(error)))}>✧ Constelación 3D</button><button onClick={() => void addVisual({ presentationId: data.presentation._id, visual: "pulse" }).catch(error => setNotice(String(error)))}>▥ Pulso de la sala</button></div>}
    <section className="deck-grid">
      <aside className="navigator"><div className="nav-heading"><span>DECK / {data.slides.length.toString().padStart(2, "0")}</span><button title="Create a room" onClick={() => setSlug(null)}>+</button></div>{data.slides.map((slide, index) => <button key={slide._id} disabled={!data.isHost} onClick={() => void setCurrentSlide({ presentationId: data.presentation._id, slideId: slide._id }).catch(error => setNotice(String(error)))} className={`thumb ${slide._id === current?._id ? "active" : ""}`}><span>{String(index + 1).padStart(2, "0")}</span><b>{slide.title}</b><em>{slide.kind}</em></button>)}</aside>
      <section className={`stage ${current?.kind ?? "content"}`}>
        <div className="stage-meta"><span>SLIDE {String((current?.order ?? 0) + 1).padStart(2, "0")}</span><span>{current?.kind === "research" ? "✦ RESEARCH AGENT" : "● LIVE CANVAS"}</span></div>
        {data.presentation.showConclusions ? <ClosingWall presentationId={data.presentation._id} /> : <><div className="slide-copy"><p className="accent-label">{current?.kind === "poll" ? "AUDIENCE TAKEOVER" : current?.kind === "research" ? "FRESHLY GENERATED" : "A REALTIME PRESENTATION SYSTEM"}</p><h1>{current?.title}</h1><p>{current?.body}</p></div>
        {current?.visual && <LiveVisual presentationId={data.presentation._id} visual={current.visual} reactions={reactions} />}
        {isPoll && <div className="poll-results">{current.choices?.map((choice) => { const value = votes[choice.id] ?? 0; const pct = totalVotes ? Math.round(value / totalVotes * 100) : 0; return <button key={choice.id} onClick={() => void vote({ presentationId: data.presentation._id, slideId: current._id, choiceId: choice.id }).catch(error => setNotice(String(error)))}><span>{choice.label}</span><strong>{pct}%</strong><i style={{ width: `${Math.max(pct, 2)}%` }} /></button>; })}<small>{totalVotes} live votes</small></div>}
        </>}<div className="reaction-strip">{([ ["fire", "🔥"], ["mind", "🤯"], ["heart", "♥"], ["question", "?" ]] as const).map(([key, icon]) => <button key={key} onClick={() => current && void react({ presentationId: data.presentation._id, slideId: current._id, emoji: key }).catch(error => setNotice(String(error)))}><span>{icon}</span><b>{reactions[key] ?? 0}</b></button>)}</div>
        {current?.sourceUrls?.length ? <div className="source-links">{current.sourceUrls.map((url,index) => /^https?:\/\//i.test(url) && <a href={url} key={url} target="_blank" rel="noreferrer">Fuente {index+1} ↗</a>)}</div> : null}
        {data.presentation.moment && <MomentCard key={data.presentation.moment.createdAt} moment={data.presentation.moment} presentationId={data.presentation._id} isHost={data.isHost} />}
        <div className="slide-footer"><span>POWERED BY PEOPLE + AI</span><span>◒ {data.presentation.status.toUpperCase()}</span></div>
      </section>
      <aside className="agent-panel" id="participation"><div className="tabs"><button aria-pressed={panel === "room"} onClick={() => setPanel("room")}>La sala</button><button aria-pressed={panel === "agent"} onClick={() => setPanel("agent")}>Copiloto ✦</button></div>{panel === "room" && current ? <RoomPanel presentationId={data.presentation._id} slideId={current._id} isHost={data.isHost} showConclusions={!!data.presentation.showConclusions} report={setNotice} /> : <>{data.isHost && current && <SlideEditor key={`${current._id}:${current.title}:${current.body}`} slide={current} report={setNotice} />}{data.isHost && <VoiceControls room={data.presentation} slides={data.slides} report={setNotice} />}<div className="agent-head"><div className="orb">✦</div><div><strong>Slide Agent</strong><small>Investiga y crea en vivo</small></div></div><div className="agent-log">{data.operations.length ? data.operations.map((operation) => <div key={operation._id} className={`log ${operation.status}`}><span>{operation.status === "complete" ? "✦" : operation.status === "failed" ? "!" : "◌"}</span><p><b>{operation.kind} {operation.status}</b><br />{operation.output ?? operation.error ?? operation.input}</p></div>) : <p className="empty">Pide un tema y consulta fuentes reales sin salir de tu presentación.</p>}</div>{data.isHost && <form onSubmit={(event) => { event.preventDefault(); if (!researchPrompt.trim()) return; void requestResearch({ presentationId: data.presentation._id, prompt: researchPrompt, url: researchUrl || undefined }).then(() => { setResearchPrompt(""); setResearchUrl(""); }).catch(error => setNotice(String(error))); }}><label htmlFor="research-prompt">Investigar un tema</label><input id="research-prompt" maxLength={500} value={researchPrompt} onChange={(event) => setResearchPrompt(event.target.value)} placeholder="Una idea para explorar…" /><label htmlFor="research-url">Fuente web (opcional)</label><input id="research-url" type="url" value={researchUrl} onChange={(event) => setResearchUrl(event.target.value)} placeholder="https://fuente.com/artículo" /><button type="submit">Investigar y crear slide ↗</button></form>}<div className="inbox"><span>AGENTMAIL / IDEAS POR CORREO</span>{data.isHost ? <><p className="panel-hint">El correo entra a tu sala. Tú eliges qué se convierte en slide.</p>{data.presentation.agentInboxAddress ? <><a className="inbox-address" href={`mailto:${data.presentation.agentInboxAddress}`}>{data.presentation.agentInboxAddress}</a><button className="secondary" disabled={inboxBusy} onClick={async () => { setInboxBusy(true); try { const count = await syncInbox({ presentationId: data.presentation._id }); setNotice(`${count} correos revisados`); } catch(error) { setNotice(String(error)); } finally { setInboxBusy(false); } }}>{inboxBusy ? "Consultando…" : "Consultar correos"}</button></> : <button className="secondary" disabled={inboxBusy} onClick={async () => { setInboxBusy(true); try { await connectInbox({ presentationId: data.presentation._id }); setNotice("Buzón de la presentación activado"); } catch(error) { setNotice(String(error)); } finally { setInboxBusy(false); } }}>{inboxBusy ? "Creando buzón…" : "Activar buzón de esta sala"}</button>}{data.inbox.map(item => <article className="inbox-item" key={item._id}><b>{item.subject}</b><small>{item.sender}</small><p>{item.text.slice(0,180)}</p><button className="secondary" disabled={item.status === "processed"} onClick={() => void emailToSlide({ inboxItemId: item._id }).catch(error => setNotice(String(error)))}>{item.status === "processed" ? "Enviado al copiloto" : "Convertir en slide ↗"}</button></article>)}</> : <p className="empty">El presentador revisa los correos antes de llevarlos al escenario.</p>}</div></>}</aside>
    </section>
  </main>;
}

function Launchpad({ onCreate, notice }: { onCreate: () => Promise<void>; notice: string }) {
  const [busy,setBusy] = useState(false);
  const [code,setCode] = useState("");
  return <main className="launchpad"><div className="hero-grid"><span className="eyebrow">SLIDEX / BETA</span><h1>Tu próxima charla,<br /><em>viva.</em></h1><p>Una presentación que escucha. Tu audiencia propone, la web aporta y las mejores ideas llegan al escenario.</p><button disabled={busy} onClick={async () => { setBusy(true); try { await onCreate(); } finally { setBusy(false); } }}>{busy ? "Creando tu sala…" : "Crear una sala en vivo"} <span>↗</span></button>{notice && <p role="alert">{notice}</p>}<form className="join-form" onSubmit={event => { event.preventDefault(); window.location.assign(`?room=${encodeURIComponent(code.trim().toUpperCase())}`); }}><label htmlFor="room-code">¿Vienes como audiencia?</label><div><input id="room-code" required pattern="[Ll][Ii][Vv][Ee]-[A-Za-z0-9]+" maxLength={20} value={code} onChange={e => setCode(e.target.value)} placeholder="Código LIVE-XXXXX"/><button disabled={!code.trim()}>Unirme →</button></div></form><small>Convex · OpenAI · Firecrawl · AgentMail</small></div><div className="manifesto"><div className="signal">✦</div><p>“El último slide todavía no existe. Lo escribirá tu audiencia.”</p><div className="feature-list"><span>01 · Crea tu sala y comparte el enlace</span><span>02 · Presenta, escucha y acepta ideas</span><span>03 · Cierra con lo que descubrieron juntos</span></div></div></main>;
}

function countBy<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.reduce<Record<string, number>>((counts, item) => { const value = String(item[key]); counts[value] = (counts[value] ?? 0) + 1; return counts; }, {});
}
