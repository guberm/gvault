import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { handleRequest } from "../../apps/server/dist/index.js";

const root = process.cwd();
const webDir = join(root, "apps", "web", "dist");
const host = process.env.GV_PUBLIC_HOST ?? "127.0.0.1";
const port = Number(process.env.GV_PUBLIC_PORT ?? "55174");

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
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/healthz" || url.pathname.startsWith("/api/")) {
    await handleRequest(req, res);
    return;
  }

  try {
    const filePath = safeWebPath(url.pathname);
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": contentType(filePath) });
    res.end(body);
  } catch {
    const fallback = join(webDir, "index.html");
    const body = await readFile(fallback);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  }
}).listen(port, host, () => {
  console.log(`GVault public server listening on http://${host}:${port}`);
});
