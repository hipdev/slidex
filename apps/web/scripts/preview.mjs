import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".woff2": "font/woff2", ".ico": "image/x-icon",
};

// Preview the actual public export, without an RSC server masking missing files.
export function staticServer(root) {
  const output = resolve(root);
  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end(); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
    catch { response.writeHead(400).end(); return; }
    let target = resolve(output, `.${pathname}`);
    let status = pathname === "/404" || pathname === "/404.html" ? 404 : 200;
    try {
      if (!target.startsWith(`${output}${sep}`) && target !== output) throw new Error("Invalid path");
      if (pathname.split("/").some(part => part.startsWith("."))) throw new Error("Private path");
      if (pathname === "/404") target = join(output, "404.html");
      if ((await stat(target)).isDirectory()) target = join(target, "index.html");
      if (!(await stat(target)).isFile()) throw new Error("Missing file");
    } catch {
      target = join(output, "404.html"); status = 404;
    }
    try {
      const file = await stat(target);
      response.writeHead(status, {
        "Content-Type": types[extname(target)] ?? "application/octet-stream",
        "Content-Length": file.size,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      if (request.method === "HEAD") response.end();
      else createReadStream(target).on("error", () => response.destroy()).pipe(response);
    } catch { response.writeHead(503).end("Run pnpm build first."); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const portIndex = process.argv.indexOf("--port");
  const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT ?? 3000);
  const output = resolve(dirname(fileURLToPath(import.meta.url)), "../out");
  staticServer(output).listen(port, "127.0.0.1", () => console.log(`Slidex static preview: http://127.0.0.1:${port}`));
}
