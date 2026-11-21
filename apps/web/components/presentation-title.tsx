"use client";

import { useId, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@slidex/backend/api";
import type { Doc } from "@slidex/backend/data-model";
import { friendlyError, tr } from "../i18n/provider";
import { starterText } from "../i18n/starter-copy";

export function PresentationTitle({ presentation, isHost, report }: { presentation: Doc<"presentations">; isHost: boolean; report: (message: string) => void }) {
  const rename = useMutation(api.presentations.rename);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(presentation.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setEditing(false); setError(""); trigger.current?.focus(); };
  if (!isHost) return <strong title={starterText(presentation.title)}>{starterText(presentation.title)}</strong>;
  return <div className="presentation-title-editor">
    <button ref={trigger} className="presentation-title-trigger" aria-expanded={editing} aria-controls={editing ? id : undefined} aria-label={tr("Cambiar título de la presentación")} title={tr("Cambiar título de la presentación")} onClick={() => { setTitle(presentation.title); setError(""); setEditing(value => !value); }}><strong>{starterText(presentation.title)}</strong><span aria-hidden="true">✎</span></button>
    {editing && <form id={id} className="presentation-title-form" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!busy) close(); } }} onSubmit={async event => {
      event.preventDefault(); if (busy || !title.trim()) return;
      setBusy(true); setError("");
      try { await rename({ presentationId: presentation._id, title }); close(); report(tr("Título actualizado")); }
      catch (caught) { setError(friendlyError(caught)); }
      finally { setBusy(false); }
    }}>
      <label htmlFor={`${id}-input`}>{tr("Título de la presentación")}</label>
      <input id={`${id}-input`} autoFocus value={title} onChange={event => setTitle(event.target.value)} required maxLength={100} disabled={busy} />
      <div><button type="submit" disabled={busy || !title.trim()}>{tr(busy ? "Guardando…" : "Guardar")}</button><button type="button" disabled={busy} onClick={close}>{tr("Cancelar")}</button></div>
      {error && <p role="alert">{error}</p>}
    </form>}
  </div>;
}
