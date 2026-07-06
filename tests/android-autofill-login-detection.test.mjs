import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const detectionSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAutofillLoginDetection.java";
const classifierSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAutofillClassifier.java";

test("Android Autofill treats email-plus-password fields as a Login form", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gvault-android-login-detection-"));
  const testSource = join(dir, "TestMobileAutofillLoginDetection.java");
  await writeFile(testSource, `
import com.gvault.app.MobileAutofillClassifier;
import com.gvault.app.MobileAutofillLoginDetection;

public final class TestMobileAutofillLoginDetection {
  public static void main(String[] args) {
    assertEquals("email", MobileAutofillClassifier.classifyField("Email address", "email", "emailAddress"));
    assertEquals("password", MobileAutofillClassifier.classifyField("Password", "password", "password"));

    assertTrue(MobileAutofillLoginDetection.isLoginForm(true, false, true));
    assertTrue(MobileAutofillLoginDetection.isLoginForm(false, true, true));
    assertFalse(MobileAutofillLoginDetection.isLoginForm(false, true, false));
    assertFalse(MobileAutofillLoginDetection.isLoginForm(false, false, true));

    assertEquals("username", MobileAutofillLoginDetection.preferredLoginIdentifier("username", "email"));
    assertEquals("email", MobileAutofillLoginDetection.preferredLoginIdentifier("", "email"));
    assertEquals("", MobileAutofillLoginDetection.preferredLoginIdentifier("", ""));
  }

  private static void assertTrue(boolean value) {
    if (!value) throw new AssertionError("expected true");
  }

  private static void assertFalse(boolean value) {
    if (value) throw new AssertionError("expected false");
  }

  private static void assertEquals(Object expected, Object actual) {
    if (expected == null ? actual != null : !expected.equals(actual)) {
      throw new AssertionError("expected=" + expected + " actual=" + actual);
    }
  }
}
`);
  const compile = spawnSync("javac", [
    "-d", dir,
    classifierSource,
    detectionSource,
    testSource,
  ], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  const run = spawnSync("java", ["-cp", dir, "TestMobileAutofillLoginDetection"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
