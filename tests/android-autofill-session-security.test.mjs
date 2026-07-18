import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const policySource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAutofillSessionPolicy.java";
const storeSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAutofillSessionStore.java";
const serviceSource = "apps/mobile/android/src/main/java/com/gvault/app/GVaultAutofillService.java";

test("Android Autofill cache is encrypted and requires a live unlock grant", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gvault-autofill-session-test-"));
  const testSource = join(dir, "TestMobileAutofillSessionPolicy.java");
  await writeFile(testSource, `
import com.gvault.app.MobileAutofillSessionPolicy;

public final class TestMobileAutofillSessionPolicy {
  public static void main(String[] args) {
    if (!MobileAutofillSessionPolicy.isUnlocked(2000L, 1999L)) throw new AssertionError("active grant rejected");
    if (MobileAutofillSessionPolicy.isUnlocked(2000L, 2000L)) throw new AssertionError("expired grant accepted");
    if (MobileAutofillSessionPolicy.isUnlocked(0L, 1L)) throw new AssertionError("missing grant accepted");
  }
}
`);
  const compile = spawnSync("javac", ["-d", dir, policySource, testSource], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  const run = spawnSync("java", ["-cp", dir, "TestMobileAutofillSessionPolicy"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const source = await readFile(storeSource, "utf8");
  assert.match(source, /AndroidKeyStore/);
  assert.match(source, /AES\/GCM\/NoPadding/);
  assert.match(source, /MobileAutofillSessionPolicy\.isUnlocked/);
  assert.doesNotMatch(source, /putString\(KEY_LOGIN_ENTRIES/);
  assert.doesNotMatch(source, /putString\(KEY_FILL_ENTRIES/);

  const service = await readFile(serviceSource, "utf8");
  assert.match(service, /MobileAutofillSessionStore\.hasActiveUnlock\(\)/);
  assert.match(service, /MobileAutofillVault\.clear\(\)/);
});
