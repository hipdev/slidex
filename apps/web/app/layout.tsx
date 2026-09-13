import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "../i18n/provider";

export const metadata: Metadata = {
  title: "Slidex — presentations that are alive",
  description: "Realtime presentations shaped by people, research, and AI.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
