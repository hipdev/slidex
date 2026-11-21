import type { ReactNode } from "react";
import "./globals.css";
import { LanguageProvider } from "../i18n/provider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es"><head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Slidex — presentaciones que cobran vida</title>
    <meta name="description" content="Presentaciones en tiempo real creadas con la audiencia, investigación e inteligencia artificial." />
    <link rel="icon" href="/favicon.svg" />
  </head><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
