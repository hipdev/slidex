import { SlidexShell } from "@/components/slidex-shell";
import { Launchpad } from "@/components/launchpad";
import { ClientOnly } from "@/components/client-only";

export default function Home() {
  // A stored language can initialize before this streamed client boundary
  // hydrates. Keep the initial static document independent of browser state.
  return <ClientOnly fallback={<Launchpad />}><SlidexShell /></ClientOnly>;
}
