import { SlidexShell } from "@/components/slidex-shell";
import { ClientOnly } from "@/components/client-only";

export default function Home() {
  // A stored language can initialize before this streamed client boundary
  // hydrates. Keep the initial static document independent of browser state.
  return <ClientOnly fallback={<main className="setup">
    <p className="eyebrow">WELCOME TO SLIDEX</p><h1>Getting things ready…</h1>
  </main>}><SlidexShell /></ClientOnly>;
}
