import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const policySource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAutofillDatasetPolicy.java";

test("Android Autofill suppresses blank placeholder responses when no dataset can be built", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gvault-android-autofill-placeholder-"));
  const testSource = join(dir, "TestMobileAutofillDatasetPolicy.java");
  await writeFile(testSource, `
import com.gvault.app.MobileAutofillDatasetPolicy;

public final class TestMobileAutofillDatasetPolicy {
  public static void main(String[] args) {
    assertFalse(MobileAutofillDatasetPolicy.shouldAttemptFillResponse(false, 0, false, 0));
    assertFalse(MobileAutofillDatasetPolicy.shouldAttemptFillResponse(true, 0, false, 0));
    assertFalse(MobileAutofillDatasetPolicy.shouldAttemptFillResponse(false, 0, true, 0));
    assertFalse(MobileAutofillDatasetPolicy.shouldAttemptFillResponse(true, 0, true, 0));
    assertTrue(MobileAutofillDatasetPolicy.shouldAttemptFillResponse(true, 1, false, 0));
    assertTrue(MobileAutofillDatasetPolicy.shouldAttemptFillResponse(false, 0, true, 1));
    assertTrue(MobileAutofillDatasetPolicy.shouldAttemptFillResponse(true, 0, true, 1));
    assertFalse(MobileAutofillDatasetPolicy.shouldReturnFillResponse(0));
    assertTrue(MobileAutofillDatasetPolicy.shouldReturnFillResponse(1));
  }

  private static void assertTrue(boolean value) {
    if (!value) throw new AssertionError("expected true");
  }

  private static void assertFalse(boolean value) {
    if (value) throw new AssertionError("expected false");
  }
}
`);
  const compile = spawnSync("javac", [
    "-d", dir,
    join("/tmp/gvault-push", policySource),
    testSource,
  ], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  const run = spawnSync("java", ["-cp", dir, "TestMobileAutofillDatasetPolicy"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
