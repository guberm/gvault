import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const unitPath = resolve("infra/systemd/cloudflared-gvault.service");
const runbookPath = resolve("docs/deployment/self-hosted.md");

test("production public routing is managed directly without an SSH tunnel", async () => {
  assert.ok(existsSync(unitPath), "versioned cloudflared systemd unit must exist");
  const unit = await readFile(unitPath, "utf8");

  assert.match(unit, /^After=network-online\.target gvault-public\.service$/m);
  assert.match(unit, /^Environment=PATH=%h\/\.local\/bin:\/usr\/local\/bin:\/usr\/bin$/m);
  assert.match(unit, /^ExecStart=\/usr\/bin\/env cloudflared --config %h\/\.cloudflared\/gvault\.yml tunnel run$/m);
  assert.match(unit, /^Restart=always$/m);
  assert.match(unit, /^WantedBy=default\.target$/m);
  assert.doesNotMatch(unit, /\b(?:auto)?ssh\b/i, "public availability must not invoke SSH forwarding");
});

test("deployment runbook enables and verifies linger with administrative rights", async () => {
  const runbook = await readFile(runbookPath, "utf8");

  assert.match(runbook, /^systemctl --user restart cloudflared-gvault\.service\r?$/m);
  assert.match(runbook, /^systemctl --user is-active --quiet cloudflared-gvault\.service\r?$/m);
  assert.match(runbook, /^systemctl --user show cloudflared-gvault\.service -p ExecStart --value \| grep -F -- "--config \$HOME\/.cloudflared\/gvault\.yml tunnel run"\r?$/m);
  assert.match(runbook, /^sudo loginctl enable-linger "\$USER"\r?$/m);
  assert.match(runbook, /^test "\$\(loginctl show-user "\$USER" -p Linger --value\)" = yes\r?$/m);
});
