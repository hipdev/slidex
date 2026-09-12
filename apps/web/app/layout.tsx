import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slidex — presentations that are alive",
  description: "Realtime presentations shaped by people, research, and AI.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
