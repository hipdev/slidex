"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { tr } from "../i18n/provider";

export function roomLink(origin: string, slug: string) {
  return `${origin}/?r=${encodeURIComponent(slug.replace(/^LIVE-/, ""))}`;
}

export function JoinCard({ slug, onExpand }: { slug: string; onExpand: () => void }) {
  const code = slug.replace(/^LIVE-/, "");
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(roomLink(window.location.origin, slug)); }, [slug]);
  return <section className="join-card" aria-label={tr("Únete a la presentación")}>
    {url && <button className="join-card-qr" onClick={onExpand} aria-label={tr("Ampliar QR para la audiencia")}><QRCodeSVG value={url} size={320} marginSize={4} level="M" title={tr("Escanea para unirte a la sala")} /></button>}
    <div className="join-card-copy"><span className="eyebrow">{tr("Esta charla también es tuya")}</span><h2>{tr("Escanea. Entra. Participa.")}</h2><p>{tr("Escanea con tu celular o escribe este código en la página de inicio.")}</p><span className="join-code-label">{tr("Código de la sala")}</span><strong className="join-room-code">{code}</strong>{url && <a href={url}>{url.replace(/^https?:\/\//, "")}</a>}<button onClick={onExpand}>{tr("Mostrar QR")}</button></div>
  </section>;
}
