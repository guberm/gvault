import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const vaultItemSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileVaultItem.java";
const authStateSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAuthState.java";
const autofillVaultSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAutofillVault.java";

test("Android Autofill cache uses server-backed Login records", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gvault-android-autofill-test-"));
  const testSource = join(dir, "TestMobileAutofillVault.java");
  await writeFile(testSource, `
import com.gvault.app.MobileAutofillVault;
import com.gvault.app.MobileVaultItem;

public final class TestMobileAutofillVault {
  public static void main(String[] args) {
    String login = MobileVaultItem.loginItemJson("login-1", "Example", "https://example.com", "user@example.com", "Secret123", "from server");
    String emptyPassword = MobileVaultItem.loginItemJson("login-2", "No Password", "https://example.com", "user2@example.com", "", "skip");
    String safenote = "{\\\"id\\\":\\\"note-1\\\",\\\"type\\\":\\\"safenote\\\",\\\"title\\\":\\\"Private note\\\",\\\"password\\\":\\\"not-a-login\\\"}";
    MobileAutofillVault.LoginEntry[] entries = MobileAutofillVault.loginEntriesFromServerBackedItems(new String[] { login, emptyPassword, safenote, "" });
    assertEquals(1, entries.length);
    assertEquals("Example", entries[0].title());
    assertEquals("user@example.com", entries[0].username());
    assertEquals("Secret123", entries[0].password());
    assertEquals("Example — user@example.com", entries[0].label());

    MobileAutofillVault.setServerBackedItems(new String[] { login });
    assertEquals(1, MobileAutofillVault.cachedLoginEntries().length);
    MobileAutofillVault.clear();
    assertEquals(0, MobileAutofillVault.cachedLoginEntries().length);
  }

  private static void assertEquals(String expected, String actual) {
    if (!expected.equals(actual)) throw new AssertionError("expected=" + expected + " actual=" + actual);
  }

  private static void assertEquals(int expected, int actual) {
    if (expected != actual) throw new AssertionError("expected=" + expected + " actual=" + actual);
  }
}
`);
  const compile = spawnSync("javac", ["-d", dir, authStateSource, vaultItemSource, autofillVaultSource, testSource], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  const run = spawnSync("java", ["-cp", dir, "TestMobileAutofillVault"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
