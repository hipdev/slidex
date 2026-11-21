"use client";

import { useAction } from "convex/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@slidex/backend/api";
import type { Id } from "@slidex/backend/data-model";
import { JDCharacter } from "./jd-character";
import type { JDCue } from "./jd-motion";
import { tr, useLocale } from "../i18n/provider";

export function JDVoice({ presentationId, cue }: { presentationId: Id<"presentations">; cue?: JDCue }) {
  const talk = useAction(api.jd.talk);
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "permission" | "recording" | "thinking">("idle");
  const [text, setText] = useState("");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const speechGeneration = useRef(0);
  const [spoken, setSpoken] = useState(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const busy = phase === "thinking" || phase === "permission";

  function release() {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }
  function discardRecording() {
    generation.current++;
    const recording = recorder.current;
    recorder.current = null;
    if (recording) {
      recording.onstop = null; recording.ondataavailable = null; recording.onerror = null;
      if (recording.state !== "inactive") recording.stop();
    }
    release();
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      discardRecording(); window.speechSynthesis?.cancel();
    };
  }, []);
  const speak = (message: string) => {
    if (!spoken || !window.speechSynthesis) return;
    const token = ++speechGeneration.current;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = locale === "es" ? "es-CO" : "en-US";
    utterance.onstart = () => { if (mounted.current && speechGeneration.current === token) setSpeaking(true); };
    const finish = () => { if (mounted.current && speechGeneration.current === token) setSpeaking(false); };
    utterance.onend = finish; utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  };
  const showError = (caught: unknown) => {
    const message = caught instanceof Error ? caught.message : String(caught);
    setError(tr(/JD_SLIDE_CHANGED/.test(message) ? "La diapositiva cambió mientras creaba. Pídemela otra vez." : /50 slide/.test(message) ? "Máximo de 50 slides" : /JD_INVALID_DURATION/.test(message) ? "El tiempo debe quedar entre cero y cuatro horas." : /JD_NO_SPEECH/.test(message) ? "No escuché una voz. Intenta otra vez o escribe abajo." : /JD_NOT_CONFIGURED/.test(message) ? "JD no está disponible en este momento." : /rate|limit/i.test(message) ? "Dame unos segundos antes del siguiente comando." : "No pude procesarlo. Intenta de nuevo."));
  };
  const send = async (payload: { text: string } | { audio: ArrayBuffer; mime: string }) => {
    setPhase("thinking"); setError("");
    try {
      const result = await talk({ presentationId, requestId: crypto.randomUUID(), locale, ...payload });
      if (!mounted.current) return;
      setTranscript(result.transcript); setReply(result.reply); speak(result.reply);
    } catch (caught) { if (mounted.current) showError(caught); }
    finally { if (mounted.current) setPhase("idle"); }
  };
  const stop = () => { if (recorder.current?.state === "recording") recorder.current.stop(); release(); };
  const start = async () => {
    if (phase !== "idle") return;
    setOpen(true); setError(""); speechGeneration.current++; setSpeaking(false); window.speechSynthesis?.cancel();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(tr("Tu navegador no permite grabar. Escribe el comando abajo.")); input.current?.focus(); return;
    }
    setPhase("permission");
    const current = ++generation.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || generation.current !== current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(media, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32_000 });
      recorder.current = recording;
      const chunks: Blob[] = [];
      let bytes = 0;
      recording.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); bytes += event.data.size; if (bytes > 480_000) stop(); } };
      recording.onerror = () => { if (!mounted.current || generation.current !== current) return; recording.onstop = null; release(); setPhase("idle"); setError(tr("No se pudo grabar. Escribe el comando abajo.")); };
      recording.onstop = () => {
        if (!mounted.current || generation.current !== current) return;
        release();
        setPhase("thinking");
        const blob = new Blob(chunks, { type: recording.mimeType });
        if (blob.size < 100 || blob.size > 512_000) { setPhase("idle"); setError(tr("No escuché una voz. Intenta otra vez o escribe abajo.")); return; }
        void blob.arrayBuffer().then(audio => { if (mounted.current && generation.current === current) void send({ audio, mime: recording.mimeType.split(";")[0] }); });
      };
      recording.start(500); setPhase("recording");
      timeout.current = setTimeout(stop, 30_000);
    } catch {
      if (!mounted.current || generation.current !== current) return;
      release(); if (mounted.current) { setPhase("idle"); setError(tr("No pude acceder al micrófono. Revisa el permiso o escribe abajo.")); }
    }
  };
  const close = () => {
    if (busy) return;
    discardRecording(); setPhase("idle"); setOpen(false); speechGeneration.current++; setSpeaking(false); window.speechSynthesis?.cancel(); button.current?.focus();
  };
  const cancel = () => {
    discardRecording(); setPhase("idle"); setError(""); button.current?.focus();
  };
  const submit = (event: FormEvent) => { event.preventDefault(); if (text.trim() && phase === "idle") void send({ text: text.trim() }); };
  return <div className={`jd-dock ${open ? "is-open" : ""}`}>
    <JDCharacter cue={cue} phase={phase === "idle" && speaking ? "speaking" : phase} />
    {open && <section id="jd-panel" className="jd-panel" role="region" aria-label={tr("JD, tu copiloto de voz")} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <header><div><strong>{tr("JD, tu copiloto de voz")}</strong><small>{tr("Tú hablas. La sala responde.")}</small></div><button disabled={busy} className="jd-close" aria-label={tr("Cerrar JD")} onClick={close}>×</button></header>
      <p>{tr("Avanza o retrocede, crea slides y ajusta el tiempo con tu voz.")}</p>
      <div className={`jd-listening ${phase}`} role="status">{tr(phase === "recording" ? "Te escucho… pulsa de nuevo para terminar (máx. 30 s)" : phase === "thinking" ? "JD está preparando la respuesta…" : phase === "permission" ? "Esperando permiso del micrófono…" : "Un clic para hablar. Otro para terminar.")}</div>
      {transcript && <blockquote>{transcript}</blockquote>}
      {reply && <p className="jd-reply" role="status">{reply}</p>}
      {error && <p className="jd-error" role="alert">{error}</p>}
      <form onSubmit={submit}><label htmlFor="jd-command">{tr("También puedes escribirle")}</label><div><input ref={input} id="jd-command" value={text} onChange={event => setText(event.target.value)} maxLength={1000} placeholder={tr("JD, crea un slide sobre Convex")} disabled={phase !== "idle"} /><button type="submit" disabled={phase !== "idle" || !text.trim()}>{tr("Enviar")}</button></div></form>
      <label className="jd-spoken"><input type="checkbox" checked={spoken} onChange={event => { setSpoken(event.target.checked); if (!event.target.checked) { speechGeneration.current++; setSpeaking(false); window.speechSynthesis?.cancel(); } }} />{tr("Responder en voz alta")}</label>

      <small className="jd-privacy">{tr("Solo se graba mientras escucho. El audio se procesa en Cloudflare; no se guarda en Slidex.")}</small>
    </section>}
    <div className="jd-buttons"><button ref={button} className={`jd-talk ${phase === "recording" ? "recording" : ""}`} disabled={busy} aria-controls={open ? "jd-panel" : undefined} aria-expanded={open} onClick={() => phase === "recording" ? stop() : void start()}><span aria-hidden="true">{phase === "recording" ? "■" : "✦"}</span>{tr(phase === "recording" ? "Terminar y enviar a JD" : busy ? "JD está pensando…" : "Hablar con JD")}</button>{(phase === "recording" || phase === "permission") && <button type="button" className="jd-cancel" aria-label={tr("Cancelar escucha sin enviar")} title={tr("Cancelar escucha sin enviar")} onClick={cancel}>×</button>}<button className="jd-keyboard" aria-label={tr("Escribir a JD")} aria-expanded={open} onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0); }}>⌨</button></div>
  </div>;
}
