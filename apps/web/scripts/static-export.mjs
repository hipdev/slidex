import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { REBASK_PLUGIN_NAME } from "@rebask/core/vite";

/**
 * Export only complete, request-independent HTML. PPR shells require a server
 * and must never be silently uploaded to Convex Static Hosting.
 * @param {import('@rebask/core/vite').ShellPrerenderResult[]} snapshots
 */
export function staticPages(snapshots) {
  const pages = [];
  for (const snapshot of snapshots) {
    if (snapshot.kind !== "static-html" || (!snapshot.notFound && !snapshot.rscPayload)) {
      throw new Error("Convex hosting requires fully static Rebask pages. Runtime/PPR routes need a server adapter.");
    }
    const { pathname } = snapshot;
    if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/.test(pathname)) {
      throw new Error(`Unsupported static pathname: ${pathname}`);
    }
    pages.push({
      file: snapshot.notFound ? "404.html" : pathname === "/" ? "index.html" : `${pathname.slice(1)}/index.html`,
      html: snapshot.html,
    });
  }
  if (!pages.some(page => page.file === "index.html")) throw new Error("Rebask did not prerender the home page.");
  if (!pages.some(page => page.file === "404.html")) throw new Error("Rebask did not prerender the 404 page.");
  return pages;
}

/** Copy only public artifacts, even when the workspace itself is in a hidden directory. */
export async function copyPublicClientAssets(clientRoot, output) {
  await cp(clientRoot, output, {
    recursive: true,
    filter: source => !relative(clientRoot, source).split(/[\\/]/).some(part => part.startsWith(".")),
  });
}

/** @returns {import('vite').Plugin} */
export function convexStaticExport() {
  /** @type {import('vite').ResolvedConfig} */
  let config;
  return {
    name: "slidex:convex-static-export",
    configResolved(resolved) { config = resolved; },
    buildApp: {
      order: "post",
      async handler() {
        const api = /** @type {import('@rebask/core/vite').RebaskPluginApi | undefined} */ (
          config.plugins.find(plugin => plugin.name === REBASK_PLUGIN_NAME)?.api
        );
        if (!api) throw new Error("Rebask's build API is unavailable.");
        if (api.getRouteHandlerRoutes().length) throw new Error("HTTP route handlers cannot run on static hosting. Keep API endpoints in Convex.");
        const pages = staticPages(api.takeShellPrerenders());
        const output = resolve(config.root, "out");
        await rm(output, { recursive: true, force: true });
        // Only the client directory is public. RSC/SSR bundles, server manifests
        // and private prerender caches deliberately remain under dist/.
        await copyPublicClientAssets(resolve(config.root, config.environments.client.build.outDir), output);
        for (const page of pages) {
          const target = join(output, page.file);
          await mkdir(resolve(target, ".."), { recursive: true });
          await writeFile(target, page.html);
        }
        console.log(`[slidex] Exported ${pages.length} Rebask pages to out/ for Convex hosting.`);
      },
    },
  };
}
