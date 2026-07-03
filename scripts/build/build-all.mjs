import { spawnSync } from "node:child_process";

const workspaces = [
  "@gvault/shared-utils",
  "@gvault/vault-models",
  "@gvault/crypto",
  "@gvault/core",
  "@gvault/sync",
  "@gvault/api-client",
  "@gvault/ui",
  "@gvault/server",
  "@gvault/web",
  "@gvault/admin",
  "@gvault/desktop",
  "@gvault/mobile",
  "@gvault/browser-extension"
];

for (const workspace of workspaces) {
  const result = spawnSync("npm", ["run", "build", "-w", workspace], { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
