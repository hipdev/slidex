"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { tr } from "../i18n/provider";
import { roomLink } from "./join-card";

export function InviteDialog({ slug, onClose, onCopy }: { slug: string; onClose: () => void; onCopy: () => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = async () => {
    const success = await onCopy();
    setCopyStatus(tr(success ? "Enlace copiado; compártelo para invitar a la sala" : "Copia el enlace desde la barra del navegador"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyStatus(""), 4000);
  };
  const [url, setUrl] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    setUrl(roomLink(window.location.origin, slug));
    const modal = dialog.current;
    modal?.showModal();
    return () => { modal?.close(); previous?.focus(); };
  }, [slug]);
  return <dialog ref={dialog} className="invite-dialog" aria-labelledby="invite-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="invite-content">
      <button className="invite-close" aria-label={tr("Cerrar invitación")} onClick={onClose}>×</button>
      <div className="invite-copy"><span className="eyebrow">{tr("SLIDEX · EN VIVO")}</span><h1 id="invite-title">{tr("Únete a la presentación")}</h1><p>{tr("Escanea el QR con la cámara de tu teléfono y participa en vivo.")}</p><strong className="invite-code">{slug}</strong>{url && <a href={url}>{url}</a>}<button className="primary" onClick={() => void copy()}>{tr("Copiar enlace")}</button><span className="invite-copy-status" role="status">{copyStatus}</span></div>
      <div className="invite-qr">{url && <QRCodeSVG value={url} size={640} level="M" marginSize={4} title={tr("Escanea para unirte a la sala")} />}</div>
    </section>
  </dialog>;
}
