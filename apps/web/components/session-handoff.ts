import type { ConvexReactClient } from "convex/react";
import type { Id } from "@slidex/backend/data-model";
import { api } from "@slidex/backend/api";

// Persisting tokens is not the same as the websocket accepting them. Wait for a
// server-confirmed identity before retiring credentials watched by the old UI.
export async function finishSessionHandoff(client: ConvexReactClient, handoffId: Id<"authSessionHandoffs">) {
  await new Promise<void>((resolve, reject) => {
    const query = client.watchQuery(api.auth.sessionHandoffReady, { handoffId });
    let unsubscribe = () => {};
    const timeout = setTimeout(() => { unsubscribe(); reject(new Error("Session handoff timed out")); }, 20_000);
    const check = () => {
      try {
        if (query.localQueryResult() === true) { clearTimeout(timeout); unsubscribe(); resolve(); }
      } catch (error) { clearTimeout(timeout); unsubscribe(); reject(error); }
    };
    unsubscribe = query.onUpdate(check);
    check();
  });
  await client.mutation(api.auth.completeSessionHandoff, { handoffId });
}
