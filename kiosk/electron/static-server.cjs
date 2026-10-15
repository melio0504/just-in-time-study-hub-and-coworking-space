const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self' https: wss:",
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
  ].join("; "),
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function resolveRequestPath(rootDirectory, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  } catch {
    return null;
  }

  if (pathname.includes("\0")) return null;

  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const root = path.resolve(rootDirectory);
  const candidate = path.resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;

  return candidate;
}

function createStaticServer(rootDirectory) {
  return http.createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { ...SECURITY_HEADERS, Allow: "GET, HEAD" });
      response.end();
      return;
    }

    const candidate = resolveRequestPath(rootDirectory, request.url || "/");
    if (!candidate) {
      response.writeHead(400, SECURITY_HEADERS);
      response.end("Bad request");
      return;
    }

    let filePath = candidate;
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isDirectory()) filePath = path.join(filePath, "index.html");
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      response.writeHead(404, SECURITY_HEADERS);
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const cacheControl = filePath.includes(`${path.sep}_next${path.sep}static${path.sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-store";
    const headers = {
      ...SECURITY_HEADERS,
      "Cache-Control": cacheControl,
      "Content-Type": CONTENT_TYPES.get(extension) || "application/octet-stream",
    };

    if (request.method === "HEAD") {
      response.writeHead(200, headers);
      response.end();
      return;
    }

    response.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => response.destroy());
    stream.pipe(response);
  });
}

function listenOnLoopback(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("The kiosk server did not receive a loopback port."));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

module.exports = { createStaticServer, listenOnLoopback, resolveRequestPath };
