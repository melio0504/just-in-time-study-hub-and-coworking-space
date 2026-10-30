const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createStaticServer, listenOnLoopback, resolveRequestPath } = require("./static-server.cjs");

test("serves the exported kiosk only from loopback with security headers", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "jit-kiosk-server-"));
  fs.mkdirSync(path.join(root, "_next", "static"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "<h1>Kiosk</h1>");
  fs.writeFileSync(path.join(root, "success.mp3"), "audio fixture");
  fs.writeFileSync(path.join(root, "_next", "static", "app.js"), "console.log('kiosk')");

  const server = createStaticServer(root);
  context.after(() => {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  const origin = await listenOnLoopback(server);

  const response = await fetch(`${origin}/`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<h1>Kiosk</h1>");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(
    response.headers.get("permissions-policy"),
    "camera=(self), microphone=(), geolocation=()",
  );

  const asset = await fetch(`${origin}/_next/static/app.js`);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");

  const sound = await fetch(`${origin}/success.mp3`);
  assert.equal(sound.status, 200);
  assert.equal(sound.headers.get("content-type"), "audio/mpeg");
});

test("rejects missing files and paths outside the export directory", async () => {
  const root = path.resolve("/tmp/jit-kiosk-export");
  assert.equal(resolveRequestPath(root, "/%2e%2e%2f%2e%2e%2fsecret"), null);
  assert.equal(resolveRequestPath(root, "/%00"), null);

  const server = createStaticServer(root);
  const origin = await listenOnLoopback(server);
  try {
    const response = await fetch(`${origin}/missing`);
    assert.equal(response.status, 404);
  } finally {
    server.close();
  }
});
