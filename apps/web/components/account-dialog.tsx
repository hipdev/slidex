"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useConvex, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@slidex/backend/api";
import { tr, useLocale, useTranslation } from "../i18n/provider";
import { OtpCodeInput } from "./otp-input";
import { finishSessionHandoff } from "./session-handoff";
import { starterText } from "../i18n/starter-copy";

type Account = { email?: string; isAnonymous?: boolean } | null | undefined;
type History = { title: string; slug: string; status: string; createdAt: number }[] | undefined;

export function AccountDialog({ account, history, onClose, onSignOut }: {
  account: Account; history: History; onClose: () => void; onSignOut: () => Promise<void>;
}) {
  useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [success, setSuccess] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const signedIn = account?.isAnonymous === false && !verifying;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal?.showModal();
    modal?.querySelector<HTMLInputElement>("input")?.focus();
    return () => { modal?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="account-dialog" aria-labelledby="account-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="account-content">
      <button className="dialog-close" aria-label={tr("Cerrar cuenta")} onClick={onClose}>×</button>
      <p className="eyebrow">{tr("TU CUENTA SLIDEX")}</p>
      <h2 id="account-title">{tr(signedIn ? "Tus presentaciones" : "Guarda tus presentaciones")}</h2>
      {signedIn ? <><p className="account-intro">{tr("Sesión iniciada como {{email}}.", { email: account?.email ?? "" })}</p>{success && <p className="otp-success" role="status">{tr("Correo verificado. Tus presentaciones están guardadas.")}</p>}</> : <><p className="account-intro">{tr("Tu trabajo está en una sesión invitada. Verifica tu correo para conservarlo y volver desde cualquier dispositivo.")}</p><ConnectedEmailOtpForm onAuthenticated={() => setSuccess(true)} onVerifying={setVerifying} /></>}
      {history && <div className="presentation-history"><h3>{tr("Historial de presentaciones")}</h3>{history.length ? history.map(item => <a key={item.slug} href={`/?room=${item.slug}`}><span>{starterText(item.title)}</span><small>{tr(item.status === "live" ? "En vivo" : item.status === "ended" ? "Finalizada" : "Borrador")} · {new Date(item.createdAt).toLocaleDateString()}</small></a>) : <p>{tr("Todavía no hay presentaciones.")}</p>}</div>}
      {signedIn && <button className="account-signout" disabled={signingOut} onClick={async () => {
        setSigningOut(true); setSignOutError(false);
        try { await onSignOut(); onClose(); } catch { setSignOutError(true); setSigningOut(false); }
      }}>{tr(signingOut ? "Cerrando sesión…" : "Cerrar sesión")}</button>}
      {signOutError && <p className="account-error" role="alert">{tr("No pudimos cerrar la sesión. Intenta de nuevo.")}</p>}
    </div>
  </dialog>;
}

function ConnectedEmailOtpForm({ onAuthenticated, onVerifying }: { onAuthenticated: () => void; onVerifying: (value: boolean) => void }) {
  const client = useConvex();
  const request = useMutation(api.authOtp.request);
  // Use the authenticated browser client so the server can preserve guest ownership.
  const verifyCode = useMutation(api.auth.signInWithEmailOtp);
  const { setSession } = useAuthActions();
  const locale = useLocale();
  return <EmailOtpForm onAuthenticated={onAuthenticated}
    requestCode={async email => { await request({ email, locale }); }}
    checkCode={async (email, code) => {
      onVerifying(true);
      try {
        const result = await verifyCode({ email, code });
        if (result.status !== "complete") return false;
        await setSession(result.tokens);
        if (result.handoffId) await finishSessionHandoff(client, result.handoffId);
        return true;
      } finally { onVerifying(false); }
    }}
  />;
}

export function EmailOtpForm({ onAuthenticated, requestCode, checkCode }: {
  onAuthenticated: () => void; requestCode: (email: string) => Promise<void>;
  checkCode: (email: string, code: string) => Promise<boolean>;
}) {
  useTranslation();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!retryAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [retryAt]);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const verify = async (value: string) => {
    if (inFlight.current || !/^\d{6}$/.test(value)) return;
    inFlight.current = true; setPending(true); setError("");
    try {
      const complete = await checkCode(email.trim().toLowerCase(), value);
      if (!complete) {
        if (mounted.current) setError(tr("El código no es válido o venció. Usa el más reciente o solicita otro."));
        return;
      }
      onAuthenticated();
    } catch { if (mounted.current) setError(tr("No pudimos completar el acceso. Revisa el código o solicita otro.")); }
    finally { inFlight.current = false; if (mounted.current) setPending(false); }
  };
  const send = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError("");
    try {
      await requestCode(email.trim().toLowerCase());
      if (mounted.current) { setEmail(value => value.trim().toLowerCase()); setSent(true); setCode(""); setNow(Date.now()); setRetryAt(Date.now() + 60_000); }
    } catch { if (mounted.current) setError(tr("No pudimos enviar el código. Espera un momento e inténtalo de nuevo.")); }
    finally { inFlight.current = false; if (mounted.current) setPending(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (sent) void verify(code); else void send(); };
  return <div className="email-otp">
    <div className="otp-steps" aria-label={tr("Acceso por correo")}><span className={!sent ? "active" : "complete"}>{sent ? "✓" : "1"} · {tr("Tu correo")}</span><i aria-hidden="true" /><span className={sent ? "active" : ""}>2 · {tr("Verifica el código")}</span></div>
    <form className="otp-form" onSubmit={submit}>
      {!sent ? <label htmlFor="otp-email">{tr("Correo electrónico")}<input autoFocus id="otp-email" type="email" autoComplete="email" required maxLength={254} placeholder="tu@correo.com" value={email} onChange={event => { setEmail(event.target.value); setError(""); }} disabled={pending} /></label> : <>
        <div className="otp-context"><span className="otp-mail-icon" aria-hidden="true">✉</span><h3>{tr("Revisa tu correo")}</h3><p>{tr("Te enviamos un código a")}</p><strong className="otp-destination">{email}</strong></div>
        <span className="otp-label">{tr("Código de verificación")}</span>
        <OtpCodeInput value={code} onChange={value => { setCode(value); setError(""); if (value.length === 6) void verify(value); }} disabled={pending} invalid={!!error} />
        <p className="otp-helper" id="otp-helper">{tr("Entrarás automáticamente al completar los 6 dígitos.")}</p>
      </>}
      {error && <p className="account-error" id="otp-error" role="alert">{error}</p>}
      <button className="primary" disabled={pending || (sent && code.length !== 6)} aria-busy={pending}>{tr(pending ? sent ? "Verificando código…" : "Enviando código…" : sent ? "Verificar y guardar" : "Recibir código por correo")}<span aria-hidden="true">↗</span></button>
    </form>
    {sent ? <div className="otp-support"><p>{tr("El código vence en 5 minutos. Revisa también spam.")}</p><div className="otp-links"><button disabled={pending || remaining > 0} onClick={() => void send()}>{remaining > 0 ? tr("Reenviar en {{count}} s", { count: remaining }) : tr("Reenviar código")}</button><button disabled={pending} onClick={() => { setSent(false); setCode(""); setError(""); }}>{tr("Cambiar correo")}</button></div></div> : <p className="otp-assurance">{tr("Sin contraseña. Un código, tu correo y todas tus ideas.")}</p>}
  </div>;
}
