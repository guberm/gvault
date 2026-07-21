import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { handleRequest } from "../../apps/server/dist/index.js";

const root = process.cwd();
const webDir = join(root, "apps", "web", "dist");
const host = process.env.GV_PUBLIC_HOST ?? "127.0.0.1";
const port = Number(process.env.GV_PUBLIC_PORT ?? "55174");
const htmlCacheControl = "public, max-age=0, must-revalidate, no-transform";
const securityHeaders = {
  "content-security-policy": "default-src 'self'; base-uri 'none'; connect-src 'self' https:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'; style-src 'self'",
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), clipboard-read=(), clipboard-write=(self)",
};

function contentType(path) {
  const ext = extname(path);
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "text/html; charset=utf-8";
}

function safeWebPath(urlPath) {
  const path = urlPath === "/" ? "/index.html" : urlPath;
  const normalized = normalize(path).replace(/^([/\\])+/, "");
  return join(webDir, normalized);
}

createServer(async (req, res) => {
  for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value);
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/healthz" || url.pathname.startsWith("/api/")) {
    await handleRequest(req, res);
    return;
  }

  try {
    const filePath = safeWebPath(url.pathname);
    const body = await readFile(filePath);
    const type = contentType(filePath);
    if (extname(filePath).toLowerCase() === ".html") res.setHeader("cache-control", htmlCacheControl);
    res.writeHead(200, { "content-type": type });
    res.end(body);
  } catch {
    const fallback = join(webDir, "index.html");
    const body = await readFile(fallback);
    res.setHeader("cache-control", htmlCacheControl);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  }
}).listen(port, host, () => {
  console.log(`GVault public server listening on http://${host}:${port}`);
});
