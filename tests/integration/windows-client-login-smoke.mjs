import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(".");

test("Windows desktop client performs real server-backed login smoke", { skip: process.platform !== "win32" && "Windows-only smoke" }, async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "gvault-windows-login-"));
  const port = 23080 + Math.floor(Math.random() * 1000);
  const server = spawn(process.execPath, ["apps/server/dist/index.js"], {
    cwd: root,
    env: { ...process.env, GV_DATA_DIR: dataDir, GV_SERVER_HOST: "127.0.0.1", GV_SERVER_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(port, server);
    const base = `http://127.0.0.1:${port}`;
    const email = `windows-smoke-${Date.now()}@example.local`;
    const password = "change-me-strong-password";
    const register = await post(base, "/api/auth/register", { email, password });
    assert.ok(register.token, "test account registration returns a token");

    await run("dotnet", [
      "publish",
      "apps/desktop/windows/GVault.Desktop.csproj",
      "-c",
      "Release",
      "-r",
      "win-x64",
      "--self-contained",
      "true",
      "-p:PublishSingleFile=true",
      "-p:PublishTrimmed=false",
      "-o",
      "apps/desktop/dist/windows-x64"
    ]);

    const binary = join(root, "apps/desktop/dist/windows-x64/GVault.exe");
    assert.ok(existsSync(binary), "Windows GVault.exe exists after publish");

    const evidencePath = join(dataDir, "windows-login-smoke.txt");
    await run(binary, ["--login-smoke", "--server", base, "--email", email, "--password", password, "--evidence", evidencePath]);
    const evidence = await readFile(evidencePath, "utf8");
    assert.match(evidence, /GVault Windows login smoke ok/, "Windows desktop client reports successful server-backed login");

    const failureEvidencePath = join(dataDir, "windows-login-smoke-failure.txt");
    await assert.rejects(
      () => run(binary, ["--login-smoke", "--server", base, "--email", email, "--password", "wrong-password", "--evidence", failureEvidencePath]),
      "Windows desktop client rejects wrong login credentials"
    );
    const failureEvidence = await readFile(failureEvidencePath, "utf8");
    assert.match(failureEvidence, /Login failed with HTTP 401/, "Windows desktop client records the 401 rejection");
  } finally {
    server.kill();
  }
});

async function post(base, path, body) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) assert.fail(`${path} returned ${response.status}: ${await response.text()}`);
  return response.json();
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited ${child.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("server did not start");
}

async function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      const output = stdout + stderr;
      if (code === 0) resolveRun(output);
      else reject(new Error(`${command} ${args.join(" ")} failed ${code}: ${output}`));
    });
  });
}
