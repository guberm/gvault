import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const routePath = resolve("infra/reverse-proxy/cloudflared-gvault.yml.example");

test("Cloudflare Tunnel route is persisted without production credentials", async () => {
  assert.ok(existsSync(routePath), "versioned Cloudflare Tunnel route must exist");
  const route = await readFile(routePath, "utf8");

  assert.match(route, /^tunnel: REPLACE_WITH_TUNNEL_UUID$/m);
  assert.match(route, /^credentials-file: .*REPLACE_WITH_TUNNEL_UUID\.json$/m);
  assert.match(
    route,
    /ingress:\s*\n\s*- hostname: gvault\.guber\.dev\s*\n\s*service: http:\/\/127\.0\.0\.1:55174\s*\n\s*- service: http_status:404/m,
    "gvault.guber.dev must route only to the managed loopback listener with a deny-by-default fallback",
  );
  assert.doesNotMatch(route, /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/i, "template must not contain a production tunnel UUID");
});
