"use client";
import { useEffect, useRef, useState } from "react";
import { lazy, Suspense } from "react";
import { ClientOnly } from "./client-only";
import { useQuery } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Doc, Id } from "@slidex/backend/data-model";
import { tr, useTranslation } from "../i18n/provider";
const Sculptor = lazy(() => import("./ai-sculptor"));

export function AiCompanion({ operations, slideId, onPrompt, onOpenLatest, onReviewTwist }: { operations: Doc<"operations">[]; slideId: Id<"slides">; onPrompt: (value: string) => void; onOpenLatest?: () => void; onReviewTwist: () => void }) {
  useTranslation();
  const interventions = useQuery(api.interventions.list, { slideId });
  const jobs = [...operations.map(o => ({ kind: "operation", time: o.createdAt, status: o.status, title: o.output })), ...(interventions ?? []).filter(i => i.status !== "pending" && i.status !== "dismissed").map(i => ({ kind: "intervention", time: i._creationTime, status: i.status, title: i.title }))].sort((a, b) => b.time - a.time);
  const busy = jobs.some(j => j.status === "running" || j.status === "queued");
  const latest = jobs[0];
  const state = busy ? "working" : latest?.status === "failed" ? "error" : latest ? "ready" : "idle";
  return <section className={`ai-companion ${state}`} aria-label={tr("Tu compañero creativo")}>
    <div className="companion-art"><ClientOnly fallback={<div className="sculptor-fallback" aria-hidden="true">✦</div>}><Suspense fallback={<div className="sculptor-fallback" aria-hidden="true">✦</div>}><Sculptor working={busy} /></Suspense></ClientOnly><span className="companion-badge">SLY / AI</span></div>
    <div className="companion-copy" role="status" aria-live="polite"><span className="eyebrow">{tr("UN POCO DE MAGIA. TUS IDEAS.")}</span><h2>{tr(state === "working" ? "Dándole forma a tu idea…" : state === "ready" ? "Una idea más, lista." : state === "error" ? "Probemos otro camino." : "¿Qué creamos hoy?")}</h2><p>{tr(state === "working" ? "Estoy trabajando con tus fuentes. Puedes seguir presentando; te avisaré aquí." : state === "ready" ? "Tu resultado está listo para revisar. Tú decides qué llega al escenario." : state === "error" ? "La última tarea no se completó. Revisa el detalle e inténtalo de nuevo." : "Dame una idea. Yo busco, conecto y preparo un slide para tu charla.")}</p></div>
    <div className="companion-steps" aria-label={tr("Flujo de creación")}><span className="done">01 {tr("Tu idea")}</span><span className={busy ? "active" : state === "ready" ? "done" : ""}>02 {tr("Crear")}</span><span className={state === "ready" ? "done" : ""}>03 {tr("Revisar")}</span></div>
    {state === "ready" && (latest?.kind === "intervention" ? <button className="companion-result" onClick={onReviewTwist}>{tr("Revisar giro ↗")}</button> : onOpenLatest && <button className="companion-result" onClick={onOpenLatest}>{tr("Ver slide creado")}</button>)}
    {state === "idle" && <div className="prompt-starters">{["Un dato sorprendente", "Una explicación sencilla", "Un argumento para debatir"].map(prompt => <button key={prompt} onClick={() => onPrompt(tr(prompt))}>{tr(prompt)} ↗</button>)}</div>}
  </section>;
}

export function QuickGuide({ isHost }: { isHost: boolean }) {
  useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => { try { setOpen(!localStorage.getItem("slidex-guide-seen")); } catch {} }, []);
  return <details ref={ref} className="quick-guide" open={open} onToggle={() => setOpen(!!ref.current?.open)}><summary>✦ {tr("Tu primera charla, en 3 pasos")}</summary><div className="guide-steps">{(isHost ? ["Crea con IA o edita tu primer slide.", "Invita a tu audiencia con el enlace de la sala.", "Presenta y transforma sus ideas en nuevos slides."] : ["Reacciona al slide o comparte una sugerencia.", "Pulsa Me perdí o propón un Plot twist.", "Guarda tus conclusiones para el cierre."]).map((text, i) => <p key={text}><b>0{i + 1}</b>{tr(text)}</p>)}</div><button onClick={() => { setOpen(false); try { localStorage.setItem("slidex-guide-seen", "1"); } catch {} }}>{tr("Entendido, vamos ↗")}</button></details>;
}
