import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const dir = process.argv[2];
const port = Number(process.argv[3] ?? 5173);
const type = (file) => extname(file) === ".js" ? "text/javascript" : extname(file) === ".css" ? "text/css" : "text/html";

createServer(async (req, res) => {
  const path = req.url === "/" ? "/index.html" : new URL(req.url ?? "/", "http://localhost").pathname;
  try {
    const file = join(dir, path);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": type(file) });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`GVault web on http://127.0.0.1:${port}`));
