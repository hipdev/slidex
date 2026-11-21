"use client";
import { useState, type ReactNode } from "react";
import spanish from "../i18n/es.json";
import { CreatorLinks, SourceLink } from "./landing-links";

type LaunchpadProps = {
  t?: (key: string) => string;
  ready?: boolean;
  onCreate?: () => Promise<void>;
  notice?: string;
  history?: { title: string; slug: string }[];
  onAccount?: () => void;
  languagePicker?: ReactNode;
};

// The exported document and the interactive landing share the same geometry.
// Explicit Spanish copy keeps this fallback independent of provider hydration.
const staticText = (key: string) => (spanish as Record<string, string>)[key] ?? key;
export function Launchpad({ t = staticText, ready = false, onCreate, notice = "", history, onAccount, languagePicker }: LaunchpadProps) {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  return <main className="launchpad">
    <div className="hero-grid">
      <div className="landing-top">
        <div className="landing-brand"><span className="eyebrow">{t("SLIDEX / BETA")}</span><SourceLink label={t("Código fuente")} /></div>
        <div className="landing-actions">
          <button className="account-link" onClick={onAccount} disabled={!onAccount}>
            {t("Mis presentaciones")}<span className="account-count">{history?.length ? ` (${history.length})` : ""}</span>
          </button>
          {languagePicker ?? <label className="language-picker">
            <span aria-hidden="true">◎</span>
            <select aria-label="Idioma de la interfaz" defaultValue="es" disabled>
              <option value="en">EN · English</option><option value="es">ES · Español</option>
            </select>
          </label>}
        </div>
      </div>
      <h1>{t("Tu próxima charla,")}<br /><em>{t("viva.")}</em></h1>
      <p>{t("Una presentación que escucha. Tu audiencia propone, la web aporta y las mejores ideas llegan al escenario.")}</p>
      <button disabled={!ready || busy} onClick={async () => {
        setBusy(true);
        try { await onCreate?.(); } finally { setBusy(false); }
      }}>{busy ? t("Creando tu sala…") : t("Crear una sala en vivo")} <span>↗</span></button>
      {notice && <p role="alert">{notice}</p>}
      <form className="join-form" onSubmit={event => {
        event.preventDefault();
        window.location.assign(`?r=${encodeURIComponent(code.trim().toUpperCase())}`);
      }}>
        <label htmlFor="room-code">{t("¿Vienes como audiencia?")}</label>
        <div>
          <input id="room-code" required pattern="([Ll][Ii][Vv][Ee]-)?[A-Za-z0-9]{4,5}" maxLength={20} value={code} onChange={e => setCode(e.target.value)} placeholder={t("Código de la sala")} />
          <button disabled={!code.trim()}>{t("Unirme →")}</button>
        </div>
      </form>
      <small>{t("Convex · OpenAI · Firecrawl · AgentMail")}</small>
      <CreatorLinks label={t("Creado por")} navigationLabel={t("Conecta con Julián")} />
    </div>
    <div className="manifesto">
      <div className="signal">✦</div>
      <p>{t("“El último slide todavía no existe. Lo escribirá tu audiencia.”")}</p>
      <div className="feature-list">
        <span>{t("01 · Crea tu sala y comparte el enlace")}</span>
        <span>{t("02 · Presenta, escucha y acepta ideas")}</span>
        <span>{t("03 · Cierra con lo que descubrieron juntos")}</span>
      </div>
    </div>
  </main>;
}
