"use client";

import { useEffect, useRef, useState } from "react";
import type { Id } from "@slidex/backend/data-model";
import { tr, useLocale } from "../i18n/provider";
import { starterText } from "../i18n/starter-copy";

type Entry = { _id: Id<"presentations">; title: string; slug: string; status: string; createdAt: number };

export function PresentationHistory({ history, onDelete }: { history: Entry[]; onDelete: (id: Id<"presentations">) => Promise<void> }) {
  const locale = useLocale();
  const [selected, setSelected] = useState<Entry>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cancelButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (selected) cancelButton.current?.focus(); }, [selected?._id]);
  const cancel = () => { setSelected(undefined); setError(""); trigger.current?.focus(); };
  const remove = async () => {
    if (!selected || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await onDelete(selected._id);
      if (mounted.current) { setSelected(undefined); setNotice(tr("Presentación eliminada.")); heading.current?.focus(); }
    } catch { if (mounted.current) setError(tr("No pudimos eliminar la presentación. Intenta de nuevo.")); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return <section className="presentation-history" aria-labelledby="presentation-history-title">
    <h3 id="presentation-history-title" ref={heading} tabIndex={-1}>{tr("Historial de presentaciones")}</h3>
    {notice && <p className="history-notice" role="status">{notice}</p>}
    {history.length ? history.map(item => <article className="history-item" key={item._id}>
      <div className="history-row"><a href={`/?room=${encodeURIComponent(item.slug)}`}><span>{starterText(item.title)}</span><small>{tr(item.status === "live" ? "En vivo" : item.status === "ended" ? "Finalizada" : "Borrador")} · {new Date(item.createdAt).toLocaleDateString(locale)}<code>{item.slug.replace(/^LIVE-/, "")}</code></small></a>
        <button className="history-delete" disabled={busy} aria-label={tr("Eliminar presentación {{code}}", { code: item.slug.replace(/^LIVE-/, "") })} aria-expanded={selected?._id === item._id} onClick={event => { trigger.current = event.currentTarget; setNotice(""); setError(""); setSelected(item); }}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
        </button>
      </div>
      {selected?._id === item._id && <div className="history-delete-confirm" role="group" aria-label={tr("Confirmar eliminación")} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!busy) cancel(); } }}>
        <p><strong>{tr("¿Eliminar «{{title}}»?", { title: starterText(item.title) })}</strong></p><small>{tr("Se borrarán sus diapositivas y participaciones. Esta acción no se puede deshacer.")}</small>
        {error && <p role="alert">{error}</p>}
        <div><button ref={cancelButton} disabled={busy} onClick={cancel}>{tr("Cancelar")}</button><button className="history-delete-confirm-button" disabled={busy} aria-busy={busy} onClick={() => void remove()}>{tr(busy ? "Eliminando…" : "Eliminar presentación")}</button></div>
      </div>}
    </article>) : <p>{tr("Todavía no hay presentaciones.")}</p>}
  </section>;
}
