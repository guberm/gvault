import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const source = "apps/mobile/android/src/main/java/com/gvault/app/MobileAutofillSetupGuidance.java";

test("Android Autofill setup guidance surfaces enable state and copy", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gvault-android-autofill-setup-"));
  const testSource = join(dir, "TestMobileAutofillSetupGuidance.java");
  await writeFile(testSource, `
import com.gvault.app.MobileAutofillSetupGuidance;

public final class TestMobileAutofillSetupGuidance {
  public static void main(String[] args) {
    // Enable button only when Autofill is supported and GVault is not the active service.
    assertTrue(MobileAutofillSetupGuidance.shouldShowEnableButton(true, false));
    assertFalse(MobileAutofillSetupGuidance.shouldShowEnableButton(true, true));
    assertFalse(MobileAutofillSetupGuidance.shouldShowEnableButton(false, false));
    assertFalse(MobileAutofillSetupGuidance.shouldShowEnableButton(false, true));

    assertEquals("Autofill setup", MobileAutofillSetupGuidance.setupTitle());
    assertEquals("Enable Autofill", MobileAutofillSetupGuidance.setupButtonLabel());

    assertEquals("Autofill is not available on this device (requires Android 8.0 or newer).",
      MobileAutofillSetupGuidance.setupStatusMessage(false, false));
    assertEquals("GVault is your Autofill service. Tap a login field in any app and choose GVault to fill.",
      MobileAutofillSetupGuidance.setupStatusMessage(true, true));
    assertEquals("GVault is not your Autofill service yet. Tap Enable Autofill, pick GVault, then return here.",
      MobileAutofillSetupGuidance.setupStatusMessage(true, false));
  }

  private static void assertEquals(String expected, String actual) {
    if (!expected.equals(actual)) throw new AssertionError("expected=" + expected + " actual=" + actual);
  }

  private static void assertTrue(boolean value) {
    if (!value) throw new AssertionError("expected true");
  }

  private static void assertFalse(boolean value) {
    if (value) throw new AssertionError("expected false");
  }
}
`);
  const compile = spawnSync("javac", ["-d", dir, source, testSource], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  const run = spawnSync("java", ["-cp", dir, "TestMobileAutofillSetupGuidance"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
