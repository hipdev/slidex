import { SlidexShell } from "@/components/slidex-shell";
import { ClientOnly } from "@/components/client-only";

export default function Home() {
  // A stored language can initialize before this streamed client boundary
  // hydrates. Keep the initial static document independent of browser state.
  return <ClientOnly fallback={<main className="setup">
    <p className="eyebrow">BIENVENIDO A SLIDEX</p><h1>Preparando tu entrada…</h1>
  </main>}><SlidexShell /></ClientOnly>;
}
