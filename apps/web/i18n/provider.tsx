"use client";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";
import { useEffect, type ReactNode } from "react";
import english from "./en.json";
import spanish from "./es.json";

export const i18n = createInstance();
void i18n.use(initReactI18next).init({
  lng: "es", fallbackLng: "es", supportedLngs: ["es", "en"],
  resources: { es: { translation: spanish }, en: { translation: english } },
  keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false },
  initAsync: false, react: { useSuspense: false },
});
export const tr = (key: string, options?: Record<string, unknown>) => String(i18n.t(key, options));
export function useLocale() { const { i18n } = useTranslation(); return i18n.language === "en" ? "en" : "es"; }
export function LanguageProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let locale = navigator.language.startsWith("en") ? "en" : "es";
    try { const saved = localStorage.getItem("slidex-language"); if (saved === "es" || saved === "en") locale = saved; } catch {}
    void i18n.changeLanguage(locale);
    const update = (language: string) => { document.documentElement.lang = language; try { localStorage.setItem("slidex-language", language); } catch {} };
    update(locale); i18n.on("languageChanged", update);
    return () => { i18n.off("languageChanged", update); };
  }, []);
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
export function LanguagePicker() {
  const locale = useLocale();
  return <label className="language-picker"><span aria-hidden="true">◎</span><select aria-label={locale === "es" ? "Idioma de la interfaz" : "Interface language"} value={locale} onChange={e => void i18n.changeLanguage(e.target.value)}><option value="es">ES · Español</option><option value="en">EN · English</option></select></label>;
}
export { useTranslation };

export function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/rate|too many|limit exceeded/i.test(message)) return tr("error.limit");
  if (/only the presentation host|only the presenter/i.test(message)) return tr("error.owner");
  if (/50 slide|50 intervenciones|reached its|llegó a 50/i.test(message)) return tr("error.full");
  if (/readable|legible|firecrawl/i.test(message)) return tr("error.source");
  if (/slide cambió|not in an active room/i.test(message)) return tr("error.stale");
  if (/configure|not configured/i.test(message)) return tr("error.config");
  return tr("error.generic");
}
