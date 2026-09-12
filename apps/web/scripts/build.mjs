import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
  stdio: "inherit",
  env: { ...process.env, ...(process.env.VITE_CONVEX_URL ? { NEXT_PUBLIC_CONVEX_URL: process.env.VITE_CONVEX_URL } : {}) },
});
process.exit(result.status ?? 1);
