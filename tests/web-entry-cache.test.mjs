import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("web entry loads the current app asset instead of a stale CDN object", async () => {
  const html = await readFile("apps/web/public/index.html", "utf8");
  assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css\?v=0\.1\.17" \/>/);
  assert.match(html, /<script src="\.\/app\.js\?v=0\.1\.17" type="module"><\/script>/);
  assert.match(html, /<span>v0\.1\.17<\/span>/);
});
