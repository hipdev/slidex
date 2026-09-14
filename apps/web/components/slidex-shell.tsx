"use client";
import { tr, friendlyError, useTranslation, useLocale } from "../i18n/provider";

import { ConvexAuthProvider, useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useAnonymousAuth } from "@convex-dev/auth/providers/anonymous/react";
import { useSignInWithPassword, useSignUpWithPassword } from "@convex-dev/auth/providers/password/react";
import { ConvexReactClient, useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "@slidex/backend/api";

import dynamic from "next/dynamic";
const LiveVisual = dynamic(() => import("./live-visual"), { ssr: false, loading: () => <p>{tr("Preparando visualización…")}</p> });
import { LanguagePicker } from "../i18n/provider";
import { AiCompanion, QuickGuide } from "./ai-companion";
import { SlideEditor } from "./slide-editor";
import { SlideNavigator } from "./slide-navigator";
import { VoiceControls, MomentCard } from "./voice-controls";
import { InterventionsPanel, InterventionCue } from "./interventions-panel";
import { RoomPanel, ClosingWall } from "./room-panel";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export function SlidexShell() {
  useTranslation();
  const client = useMemo(() => convexUrl ? new ConvexReactClient(convexUrl) : null, []);
  if (!client) return <SetupNotice />;
  return <ConvexAuthProvider client={client} api={{ refreshSession: api.auth.refreshSession, signOut: api.auth.signOut }}><Slidex /></ConvexAuthProvider>;
}

function SetupNotice() {
  useTranslation();
  return <main className="setup"><div className="setup-card"><span className="eyebrow">{tr("SLIDEX / LIVE SYSTEM")}</span><h1>{tr("Presentations should be alive.")}</h1><p>{tr("Convex is not connected yet. Run")} <code>pnpm convex:dev</code> {tr("inside this repository and copy the generated")} <code>NEXT_PUBLIC_CONVEX_URL</code> {tr("into")} <code>apps/web/.env.local</code>.</p><p className="muted">{tr("The UI is static-export ready; its realtime room activates as soon as the public Convex URL exists.")}</p></div></main>;
}

function Slidex() {
  useTranslation();
  const locale = useLocale();
  const [editorRequest, setEditorRequest] = useState({ fresh: false, version: 0 });
  const [researchBusy, setResearchBusy] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [inboxBusy, setInboxBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [copyNotice, setCopyNotice] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?room=${slug}`);
      setCopyNotice(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopyNotice(false), 4000);
    } catch { setNotice(tr("Copia el enlace desde la barra del navegador")); }
  };
  const [panel, setPanel] = useState<"room" | "agent" | "twists">("agent");
  const [accountOpen, setAccountOpen] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [researchPrompt, setResearchPrompt] = useState("");
  const [researchUrl, setResearchUrl] = useState("");
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const { signInAnonymous } = useAnonymousAuth(api.auth.signInAnonymous);
  const { signUp, pending: signUpPending } = useSignUpWithPassword(api.auth.signUpWithPassword);
  const { signIn, pending: signInPending } = useSignInWithPassword(api.auth.signInWithPassword);
  const account = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const history = useQuery(api.presentations.listMine, isAuthenticated ? {} : "skip");
  const data = useQuery(api.presentations.getBySlug, slug ? { slug } : "skip");
  const createDemo = useMutation(api.presentations.createDemo);
  const join = useMutation(api.presentations.join);
  const react = useMutation(api.presentations.react);
  const vote = useMutation(api.presentations.vote);
  const setCurrentSlide = useMutation(api.presentations.setCurrentSlide);
  const reorderSlides = useMutation(api.presentations.reorderSlides);
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
    if (!isLoading && !isAuthenticated) void signInAnonymous().catch(error => setNotice(friendlyError(error)));
  }, [isAuthenticated, isLoading, signInAnonymous]);

  useEffect(() => {
    if (data?.presentation && isAuthenticated) void join({ presentationId: data.presentation._id }).catch(error => setNotice(friendlyError(error)));
  }, [data?.presentation?._id, isAuthenticated, join]);

  const createRoom = async () => {
    try { const room = await createDemo({ ownerName: tr("Presentador"), locale }); window.location.assign(`?room=${room.slug}`); } catch(error) { setNotice(friendlyError(error)); }
  };

  if (isLoading || !isAuthenticated) return <main className="setup"><p className="eyebrow">{tr("CONVEX AUTH")}</p><h1>{tr("Preparando tu entrada…")}</h1>{notice && <p role="alert">{notice}</p>}</main>;
  if (!slug) return <><Launchpad onCreate={createRoom} notice={notice} account={account} history={history} onAccount={() => setAccountOpen(true)} />{accountOpen && <AccountDialog account={account} history={history} signUp={signUp} signIn={signIn} signUpPending={signUpPending} signInPending={signInPending} onClose={() => setAccountOpen(false)} onSignOut={() => void signOut()} />}</>;
  if (data === undefined) return <main className="setup"><p className="eyebrow">{tr("CONNECTING TO")} {slug}</p><h1>{tr("Waking the room…")}</h1></main>;
  if (data === null) return <main className="setup"><div className="setup-card"><span className="eyebrow">{tr("ROOM NOT FOUND")}</span><h1>{slug} {tr("is not live.")}</h1><button onClick={() => setSlug(null)}>{tr("Create a new live room")}</button></div></main>;

  const current = data.slides.find((slide) => slide._id === data.presentation.currentSlideId) ?? data.slides[0];
  const reactions = countBy(data.reactions.filter((reaction) => reaction.slideId === current?._id), "emoji");
  const votes = countBy(data.votes.filter((item) => item.slideId === current?._id), "choiceId");
  const totalVotes = Object.values(votes).reduce((sum, item) => sum + item, 0);
  const isPoll = current?.kind === "poll";

  const editCurrentSlide = (fresh = false) => {
    setEditorRequest(value => ({ fresh, version: value.version + 1 }));
    setPresenting(false); setPanel("agent");
    window.setTimeout(() => { const editor = document.getElementById("slide-editor") as HTMLDetailsElement | null; if (editor) { editor.open = true; editor.scrollIntoView({ behavior: "smooth", block: "center" }); document.getElementById("slide-title")?.focus({ preventScroll: true }); } }, 0);
  };
  return <main className={`app-shell ${presenting ? "presentation-mode" : ""}`}>
    <header className="topbar">
      <div className="header-identity"><a href="/" className="logo">SLID<span>EX</span></a><div className="header-room"><strong title={data.presentation.title}>{data.presentation.title}</strong><span><i />{slug} · {tr("participantCount", { count: data.participantCount })}</span></div></div>
      <div className="top-actions">
        <LanguagePicker />
        <button className="share account-action" title={account?.email} onClick={() => setAccountOpen(true)}><span>{account?.isAnonymous ? tr("Guardar cuenta") : tr("Mi cuenta")}</span>{account?.email && <small className="account-email">{account.email}</small>}</button>
        {!data.isHost && <a className="share" href="#participation" onClick={() => { setPresenting(false); setPanel("room"); }}>{tr("Participar ↓")}</a>}
        <button className="share" onClick={() => void copyInvite()}>{tr("Invitar a la sala")}</button>
        <button className="share present-action" onClick={() => setPresenting(!presenting)}>{presenting ? tr("Salir del escenario") : tr("Presentar ⤢")}</button>
      </div>
    </header>
    {accountOpen && <AccountDialog account={account} history={history} signUp={signUp} signIn={signIn} signUpPending={signUpPending} signInPending={signInPending} onClose={() => setAccountOpen(false)} onSignOut={() => void signOut()} />}
    {data.isHost && current && <InterventionCue slideId={current._id} onReview={() => { setPresenting(false); setPanel("twists"); }} />}
    {copyNotice && <div className="copy-toast" role="status"><span>✓ {tr("Enlace copiado; compártelo para invitar a la sala")}</span><button aria-label={tr("Cerrar aviso")} onClick={() => setCopyNotice(false)}>×</button></div>}
    {notice && <div className="notice" role="status">{notice}<button aria-label={tr("Cerrar aviso")} onClick={() => setNotice("")}>×</button></div>}
    {data.isHost && <div className="host-toolbar"><span>{tr("Estudio en vivo")} <b> / {data.presentation.title}</b></span><button onClick={() => editCurrentSlide()}>✎ Edit slide</button><button disabled={data.slides[0]?._id === current?._id} onClick={() => { const index = data.slides.findIndex(s => s._id === current?._id); if (index > 0) void setCurrentSlide({ presentationId: data.presentation._id, slideId: data.slides[index-1]._id }).catch(error => setNotice(friendlyError(error))); }}>{tr("← Anterior")}</button><button disabled={data.slides.at(-1)?._id === current?._id} onClick={() => { const index = data.slides.findIndex(s => s._id === current?._id); if (index < data.slides.length-1) void setCurrentSlide({ presentationId: data.presentation._id, slideId: data.slides[index+1]._id }).catch(error => setNotice(friendlyError(error))); }}>{tr("Siguiente →")}</button><button onClick={() => void addVisual({ presentationId: data.presentation._id, visual: "constellation", locale }).catch(error => setNotice(friendlyError(error)))}>{tr("✧ Constelación 3D")}</button><button onClick={() => void addVisual({ presentationId: data.presentation._id, visual: "pulse", locale }).catch(error => setNotice(friendlyError(error)))}>{tr("▥ Pulso de la sala")}</button></div>}
    <section className="deck-grid">
      <SlideNavigator
        slides={data.slides}
        currentSlideId={current?._id}
        isHost={data.isHost}
        onCreate={() => editCurrentSlide(true)}
        onSelect={(slideId) => void setCurrentSlide({ presentationId: data.presentation._id, slideId }).catch(error => setNotice(friendlyError(error)))}
        onReorder={async (slideIds) => {
          try { await reorderSlides({ presentationId: data.presentation._id, slideIds }); }
          catch (error) { setNotice(friendlyError(error)); throw error; }
        }}
      />
      <section className={`stage ${current?.kind ?? "content"}`}>
        <div className="stage-meta"><span>{tr("SLIDE")} {String((current?.order ?? 0) + 1).padStart(2, "0")}</span><span>{current?.kind === "research" ? tr("✦ RESEARCH AGENT") : tr("● LIVE CANVAS")}</span></div>
        {data.presentation.showConclusions ? <ClosingWall presentationId={data.presentation._id} /> : <><div className="slide-copy" key={current?._id}><p className="accent-label">{current?.kind === "poll" ? tr("AUDIENCE TAKEOVER") : current?.kind === "research" ? tr("FRESHLY GENERATED") : tr("A REALTIME PRESENTATION SYSTEM")}</p><h1>{current?.title}</h1><p>{current?.body}</p></div>
        {current?.imageUrl && <figure className="slide-image"><img src={current.imageUrl} alt="Related visual" referrerPolicy="no-referrer" />{current.imageSourceUrl && <figcaption><a href={current.imageSourceUrl} target="_blank" rel="noreferrer">Image source ↗</a></figcaption>}</figure>}
        {current?.visual && <LiveVisual presentationId={data.presentation._id} visual={current.visual} reactions={reactions} />}
        {isPoll && <div className="poll-results">{current.choices?.map((choice) => { const value = votes[choice.id] ?? 0; const pct = totalVotes ? Math.round(value / totalVotes * 100) : 0; return <button key={choice.id} onClick={() => void vote({ presentationId: data.presentation._id, slideId: current._id, choiceId: choice.id }).catch(error => setNotice(friendlyError(error)))}><span>{choice.label}</span><strong>{pct}%</strong><i style={{ width: `${Math.max(pct, 2)}%` }} /></button>; })}<small>{totalVotes} {tr("live votes")}</small></div>}
        </>}<div className="reaction-strip">{([ ["fire", "🔥"], ["mind", "🤯"], ["heart", "♥"], ["question", "?" ]] as const).map(([key, icon]) => <button key={key} onClick={() => current && void react({ presentationId: data.presentation._id, slideId: current._id, emoji: key }).catch(error => setNotice(friendlyError(error)))}><span>{icon}</span><b>{reactions[key] ?? 0}</b></button>)}</div>
        {current?.sourceUrls?.length ? <div className="source-links">{current.sourceUrls.map((url,index) => /^https?:\/\//i.test(url) && <a href={url} key={url} target="_blank" rel="noreferrer">{tr("Fuente")} {index+1} ↗</a>)}</div> : null}
        {data.presentation.moment && <MomentCard key={data.presentation.moment.createdAt} moment={data.presentation.moment} presentationId={data.presentation._id} isHost={data.isHost} />}
        <div className="slide-footer"><span>{tr("POWERED BY PEOPLE + AI")}</span><span>◒ {data.presentation.status.toUpperCase()}</span></div>
      </section>
      <aside className="agent-panel" id="participation"><div className="studio-tabs" role="tablist" aria-label={tr("Herramientas de la sala")}>{(data.isHost ? ["agent", "room", "twists"] : ["room", "twists"]).map(tab => <button key={tab} role="tab" id={`studio-tab-${tab}`} aria-controls="studio-workspace" tabIndex={(data.isHost ? panel : panel === "agent" ? "room" : panel) === tab ? 0 : -1} onKeyDown={event => { const tabs = data.isHost ? ["agent", "room", "twists"] : ["room", "twists"]; const index = tabs.indexOf(tab); const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1; if (next >= 0) { event.preventDefault(); setPanel(tabs[next] as typeof panel); (event.currentTarget.parentElement?.querySelectorAll("button")[next] as HTMLButtonElement)?.focus(); } }} aria-selected={(data.isHost ? panel : panel === "agent" ? "room" : panel) === tab} onClick={() => setPanel(tab as "agent" | "room" | "twists")}>{tr(tab === "agent" ? "✦ Crear" : tab === "room" ? "◉ La sala" : "↯ Giros")}</button>)}</div><div className="workspace-panel" id="studio-workspace" role="tabpanel" aria-labelledby={`studio-tab-${data.isHost ? panel : panel === "agent" ? "room" : panel}`}><QuickGuide isHost={data.isHost} />{current && <div hidden={panel !== "twists"} id="live-interventions"><InterventionsPanel key={current._id} presentationId={data.presentation._id} slideId={current._id} isHost={data.isHost} report={setNotice} /></div>}{current && <div hidden={data.isHost ? panel !== "room" : panel === "twists"}><RoomPanel presentationId={data.presentation._id} slideId={current._id} isHost={data.isHost} showConclusions={!!data.presentation.showConclusions} report={setNotice} /></div>}{data.isHost && <div hidden={panel !== "agent"}>{current && <AiCompanion operations={data.operations} slideId={current._id} onReviewTwist={() => setPanel("twists")} onOpenLatest={data.slides.some(s => s.generatedAt) ? () => { const slide = [...data.slides].reverse().find(s => s.generatedAt); if (slide) void setCurrentSlide({ presentationId: data.presentation._id, slideId: slide._id }).catch(error => setNotice(friendlyError(error))); } : undefined} onPrompt={value => { setResearchPrompt(value); document.getElementById("research-prompt")?.focus(); }} />}{data.isHost && <form className="creation-form" onSubmit={async (event) => { event.preventDefault(); if (!researchPrompt.trim() || researchBusy) return; setResearchBusy(true); try { await requestResearch({ presentationId: data.presentation._id, prompt: researchPrompt, url: researchUrl || undefined, locale }); setResearchPrompt(""); setResearchUrl(""); } catch(error) { setNotice(friendlyError(error)); } finally { setResearchBusy(false); } }}><label htmlFor="research-prompt">{tr("Investigar un tema")}</label><textarea id="research-prompt" rows={3} maxLength={500} value={researchPrompt} onChange={(event) => setResearchPrompt(event.target.value)} placeholder={tr("Una idea para explorar…")} /><label htmlFor="research-url">{tr("Fuente web (opcional)")}</label><input id="research-url" type="url" value={researchUrl} onChange={(event) => setResearchUrl(event.target.value)} placeholder={tr("https://fuente.com/artículo")} /><button className="primary" type="submit" disabled={researchBusy || !researchPrompt.trim()}>{researchBusy ? tr("Enviando…") : tr("Investigar y crear slide ↗")}</button></form>}{data.isHost && current && <SlideEditor key={`${current._id}:${current.title}:${current.body}:${editorRequest.version}`} initialFresh={editorRequest.fresh} onSaved={() => setEditorRequest(value => ({ ...value, fresh: false }))} slide={current} report={setNotice} />}{data.isHost && <VoiceControls active={panel === "agent" && !presenting} room={data.presentation} slides={data.slides} report={setNotice} />}<details className="activity-history"><summary>{tr("Actividad reciente")}</summary><div className="agent-head"><div className="orb">✦</div><div><strong>{tr("Slide Agent")}</strong><small>{tr("Investiga y crea en vivo")}</small></div></div><div className="agent-log">{data.operations.length ? data.operations.map((operation) => <div key={operation._id} className={`log ${operation.status}`}><span>{operation.status === "complete" ? "✦" : operation.status === "failed" ? "!" : "◌"}</span><p><b>{tr(`operation.${operation.kind}`)} · {tr(`status.${operation.status}`)}</b><br />{operation.output ?? (operation.error ? friendlyError(operation.error) : operation.input)}</p></div>) : <p className="empty">{tr("Pide un tema y consulta fuentes reales sin salir de tu presentación.")}</p>}</div></details><div className="inbox"><span>{tr("AGENTMAIL / IDEAS POR CORREO")}</span>{data.isHost ? <><p className="panel-hint">{tr("El correo entra a tu sala. Tú eliges qué se convierte en slide.")}</p>{data.presentation.agentInboxAddress ? <><a className="inbox-address" href={`mailto:${data.presentation.agentInboxAddress}`}>{data.presentation.agentInboxAddress}</a><button className="secondary" disabled={inboxBusy} onClick={async () => { setInboxBusy(true); try { const count = await syncInbox({ presentationId: data.presentation._id }); setNotice(tr("Correos revisados", { count })); } catch(error) { setNotice(friendlyError(error)); } finally { setInboxBusy(false); } }}>{inboxBusy ? tr("Consultando…") : tr("Consultar correos")}</button></> : <button className="secondary" disabled={inboxBusy} onClick={async () => { setInboxBusy(true); try { await connectInbox({ presentationId: data.presentation._id }); setNotice(tr("Buzón de la presentación activado")); } catch(error) { setNotice(friendlyError(error)); } finally { setInboxBusy(false); } }}>{inboxBusy ? tr("Creando buzón…") : tr("Activar buzón de esta sala")}</button>}{data.inbox.map(item => <article className="inbox-item" key={item._id}><b>{item.subject}</b><small>{item.sender}</small><p>{item.text.slice(0,180)}</p><button className="secondary" disabled={item.status === "processed"} onClick={() => void emailToSlide({ inboxItemId: item._id, locale }).catch(error => setNotice(friendlyError(error)))}>{item.status === "processed" ? tr("Enviado al copiloto") : tr("Convertir en slide ↗")}</button></article>)}</> : <p className="empty">{tr("El presentador revisa los correos antes de llevarlos al escenario.")}</p>}</div></div>}</div></aside>
    </section>
  </main>;
}

function Launchpad({ onCreate, notice, account, history, onAccount }: { onCreate: () => Promise<void>; notice: string; account: { isAnonymous?: boolean } | null | undefined; history: { title: string; slug: string }[] | undefined; onAccount: () => void }) {
  useTranslation();
  const [busy,setBusy] = useState(false);
  const [code,setCode] = useState("");
  return <main className="launchpad"><div className="hero-grid"><div className="landing-top"><span className="eyebrow">{tr("SLIDEX / BETA")}</span><div className="landing-actions"><button className="account-link" onClick={onAccount}>{account?.isAnonymous ? "Save your work" : "My presentations"}{history?.length ? ` (${history.length})` : ""}</button><LanguagePicker /></div></div><h1>{tr("Tu próxima charla,")}<br /><em>{tr("viva.")}</em></h1><p>{tr("Una presentación que escucha. Tu audiencia propone, la web aporta y las mejores ideas llegan al escenario.")}</p><button disabled={busy} onClick={async () => { setBusy(true); try { await onCreate(); } finally { setBusy(false); } }}>{busy ? tr("Creando tu sala…") : tr("Crear una sala en vivo")} <span>↗</span></button>{notice && <p role="alert">{notice}</p>}<form className="join-form" onSubmit={event => { event.preventDefault(); window.location.assign(`?room=${encodeURIComponent(code.trim().toUpperCase())}`); }}><label htmlFor="room-code">{tr("¿Vienes como audiencia?")}</label><div><input id="room-code" required pattern="[Ll][Ii][Vv][Ee]-[A-Za-z0-9]+" maxLength={20} value={code} onChange={e => setCode(e.target.value)} placeholder={tr("Código LIVE-XXXXX")}/><button disabled={!code.trim()}>{tr("Unirme →")}</button></div></form><small>{tr("Convex · OpenAI · Firecrawl · AgentMail")}</small></div><div className="manifesto"><div className="signal">✦</div><p>{tr("“El último slide todavía no existe. Lo escribirá tu audiencia.”")}</p><div className="feature-list"><span>{tr("01 · Crea tu sala y comparte el enlace")}</span><span>{tr("02 · Presenta, escucha y acepta ideas")}</span><span>{tr("03 · Cierra con lo que descubrieron juntos")}</span></div></div></main>;
}

type PasswordResult = { success: boolean; userError?: { error: string; minimumLength?: number; retryAfterMs?: number } };

function AccountDialog({ account, history, signUp, signIn, signUpPending, signInPending, onClose, onSignOut }: { account: { email?: string; isAnonymous?: boolean } | null | undefined; history: { title: string; slug: string; status: string; createdAt: number }[] | undefined; signUp: (credentials: { username: string; password: string }) => Promise<PasswordResult>; signIn: (credentials: { username: string; password: string }) => Promise<PasswordResult>; signUpPending: boolean; signInPending: boolean; onClose: () => void; onSignOut: () => void }) {
  const [mode, setMode] = useState<"upgrade" | "signIn">(account?.isAnonymous ? "upgrade" : "signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const pending = signUpPending || signInPending;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const result = mode === "upgrade" ? await signUp({ username: email, password }) : await signIn({ username: email, password });
    if (result.success) { setPassword(""); onClose(); return; }
    setError(passwordError(result.userError));
  };
  return <div className="account-backdrop" role="presentation" onMouseDown={onClose}><section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title" onMouseDown={event => event.stopPropagation()}><button className="dialog-close" aria-label="Close account" onClick={onClose}>×</button><p className="eyebrow">YOUR SLIDEX ACCOUNT</p><h2 id="account-title">{account?.isAnonymous ? "Save your presentations" : "Your presentations"}</h2>{account?.isAnonymous ? <p>You're using a private anonymous session. Create an account to keep this work and open it again on any device.</p> : <p>{account?.email ? `Signed in as ${account.email}.` : "Sign in to see your saved presentations."}</p>}<form onSubmit={submit}><label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={pending} /></label><label>Password<input type="password" autoComplete={mode === "upgrade" ? "new-password" : "current-password"} minLength={8} value={password} onChange={event => setPassword(event.target.value)} required disabled={pending} /></label>{error && <p className="account-error" role="alert">{error}</p>}<button className="primary" disabled={pending}>{pending ? "Please wait…" : mode === "upgrade" ? "Create account & save work" : "Sign in"}</button></form><button className="account-switch" onClick={() => { setMode(mode === "upgrade" ? "signIn" : "upgrade"); setError(""); }}>{mode === "upgrade" ? "Already have an account? Sign in" : "New here? Create an account"}</button>{history && <div className="presentation-history"><h3>Presentation history</h3>{history.length ? history.map(item => <a key={item.slug} href={`/?room=${item.slug}`}><span>{item.title}</span><small>{item.status} · {new Date(item.createdAt).toLocaleDateString()}</small></a>) : <p>No presentations yet.</p>}</div>} {!account?.isAnonymous && <button className="account-signout" onClick={onSignOut}>Sign out</button>}</section></div>;
}

function passwordError(error?: { error: string; minimumLength?: number; retryAfterMs?: number }) {
  if (!error) return "Something went wrong. Please try again.";
  if (error.error === "USERNAME_TAKEN") return "An account already exists for this email. Sign in instead.";
  if (error.error === "USER_NOT_FOUND") return "No account exists for this email.";
  if (error.error === "INVALID_CREDENTIALS") return "Incorrect email or password.";
  if (error.error === "PASSWORD_TOO_SHORT") return `Password must be at least ${error.minimumLength ?? 8} characters.`;
  if (error.error === "RATE_LIMITED") return `Too many attempts. Try again in ${Math.ceil((error.retryAfterMs ?? 0) / 1000)} seconds.`;
  return "Please check your details and try again.";
}

function countBy<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.reduce<Record<string, number>>((counts, item) => { const value = String(item[key]); counts[value] = (counts[value] ?? 0) + 1; return counts; }, {});
}
