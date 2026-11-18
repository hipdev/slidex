import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, writeFile, rm, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { staticPages, copyPublicClientAssets } from "./static-export.mjs";
import { staticServer } from "./preview.mjs";

const home = { kind: "static-html", pathname: "/", html: "home", rscPayload: "public flight", notFound: false };
const missing = { kind: "static-html", pathname: "/404", html: "missing", notFound: true };

test("static hosting accepts complete pages and rejects runtime/PPR or request-bound output", () => {
  assert.deepEqual(staticPages([home, missing]).map(page => page.file), ["index.html", "404.html"]);
  assert.throws(() => staticPages([{ ...home, kind: "static", postponedState: "private" }, missing]), /fully static/);
  assert.throws(() => staticPages([{ ...home, rscPayload: undefined }, missing]), /fully static/);
  assert.throws(() => staticPages([missing]), /home page/);
  assert.throws(() => staticPages([home]), /404 page/);
  assert.throws(() => staticPages([home, missing, { ...home, pathname: "/../../secret" }]), /pathname/);
});

test("public preview serves query URLs and HEAD; unknown/private routes are 404, not the home page", async () => {
  const root = await mkdtemp(join(tmpdir(), "slidex-rebask-"));
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "index.html"), "<h1>Slidex</h1>");
  await writeFile(join(root, "404.html"), "<h1>Missing</h1>");
  await writeFile(join(root, "assets/app.js"), "export {};");
  const server = staticServer(root);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const room = await fetch(`${base}/?room=LIVE-TEST&view=stage`);
    assert.equal(room.status, 200);
    assert.match(await room.text(), /Slidex/);
    const head = await fetch(`${base}/`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.match(head.headers.get("content-type"), /text\/html/);
    assert.equal(await head.text(), "");
    const script = await fetch(`${base}/assets/app.js`);
    assert.match(script.headers.get("content-type"), /javascript/);
    for (const path of ["/unknown", "/.rebask/private", "/%2e%2e%2fsecret", "/404"]) {
      const result = await fetch(`${base}${path}`);
      assert.equal(result.status, 404);
      assert.match(await result.text(), /Missing/);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});


test("export copies client assets from hidden workspaces without publishing private manifests or server siblings", async () => {
  const root = await mkdtemp(join(tmpdir(), ".slidex-rebask-"));
  const client = join(root, "dist/client");
  const output = join(root, "out");
  try {
    await mkdir(join(client, "assets"), { recursive: true });
    await mkdir(join(client, ".vite"));
    await mkdir(join(root, "dist/rsc"));
    await writeFile(join(client, "assets/app.js"), "public");
    await writeFile(join(client, ".vite/manifest.json"), "private manifest");
    await writeFile(join(root, "dist/rsc/server.js"), "private server");
    await copyPublicClientAssets(client, output);
    assert.equal(await readFile(join(output, "assets/app.js"), "utf8"), "public");
    await assert.rejects(access(join(output, ".vite/manifest.json")));
    await assert.rejects(access(join(output, "rsc/server.js")));
  } finally { await rm(root, { recursive: true, force: true }); }
});
