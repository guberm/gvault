import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("desktop login smoke clients identify their server sessions", async () => {
  const windows = await readFile("apps/desktop/windows/Program.cs", "utf8");
  const linux = await readFile("apps/desktop/linux/Program.cs", "utf8");

  assert.match(windows, /JsonSerializer\.Serialize\(new \{ email, password, deviceName = "Windows desktop" \}\)/);
  assert.match(linux, /JsonSerializer\.Serialize\(new \{ email, password, deviceName = "Linux desktop" \}\)/);
});
