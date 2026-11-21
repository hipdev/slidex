import { fileURLToPath } from "node:url";
import { rebask } from "@rebask/core/vite";
import react from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { defineConfig, loadEnv } from "vite";
import { convexStaticExport } from "./scripts/static-export.mjs";

export default defineConfig(({ mode }) => {
  // Read only public values. Never copy the backend's env file into define.
  const env = loadEnv(mode, process.cwd(), ["VITE_", "NEXT_PUBLIC_"]);
  const convexUrl = env.VITE_CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL;
  return {
    resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
    environments: {
      client: {
        optimizeDeps: {
          // Adapted from Conjuntify: prevent late dependency discovery from
          // replacing React's chunks underneath an already running document.
          noDiscovery: true,
          include: [
            "@convex-dev/auth/react",
            "input-otp",
            "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities",
            "convex/react", "convex/server", "convex/values",
            "d3-scale", "i18next", "qrcode.react", "react-i18next",
            "react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime",
            "three",
          ],
        },
      },
    },
    plugins: [rsc(), react(), rebask({ prerender: { failOnDynamic: true } }), convexStaticExport()],
    define: {
      // Temporary compatibility with the existing local environment symlink.
      "import.meta.env.VITE_CONVEX_URL": JSON.stringify(convexUrl ?? ""),
    },
  };
});
