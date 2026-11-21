"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { tr } from "../i18n/provider";

export function roomLink(origin: string, slug: string) {
  return `${origin}/?r=${encodeURIComponent(slug.replace(/^LIVE-/, ""))}`;
}

export function JoinCard({ slug, onExpand }: { slug: string; onExpand: () => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(roomLink(window.location.origin, slug)); }, [slug]);
  return <section className="join-card" aria-label={tr("Únete a la presentación")}>
    {url && <button className="join-card-qr" onClick={onExpand} aria-label={tr("Ampliar QR para la audiencia")}><QRCodeSVG value={url} size={160} marginSize={3} level="M" title={tr("Escanea para unirte a la sala")} /></button>}
    <div><span className="eyebrow">{tr("Esta charla también es tuya")}</span><h2>{tr("Escanea. Entra. Participa.")}</h2><p>{tr("Desde tu laptop, abre el enlace o entra al inicio y escribe el código.")}</p>{url && <a href={url}>{url.replace(/^https?:\/\//, "")}</a>}<strong>{slug}</strong><button onClick={onExpand}>{tr("Mostrar QR")}</button></div>
  </section>;
}
