import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [{
    name: "convex-wasm",
    enforce: "pre",
    // Convex bundles WASM as modules. Vitest needs to pass the bytes to the
    // same wasm-bindgen initializer instead of using Node's WASM imports.
    load(id) {
      if (id.endsWith(".wasm")) {
        return `export default new Uint8Array(${JSON.stringify([...readFileSync(id)])});`;
      }
    },
  }],
  ssr: { noExternal: ["password-hash-wasm"] },
  test: {
    environment: "edge-runtime",
    env: { CONVEX_CLOUD_URL: "https://test.convex.cloud" },
    include: ["convex/**/*.test.ts"],
    server: { deps: { inline: [/password-hash-wasm/] } },
  },
});
