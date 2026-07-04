import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const source = "apps/mobile/android/src/main/java/com/gvault/app/MobileAuthState.java";

test("Android auth state defaults to public GVault and validates account forms", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gvault-android-auth-test-"));
  const testSource = join(dir, "TestMobileAuthState.java");
  await writeFile(testSource, `
import com.gvault.app.MobileAuthState;

public final class TestMobileAuthState {
  public static void main(String[] args) {
    assertEquals("https://gvault.guber.dev", MobileAuthState.DEFAULT_SERVER_URL);
    assertEquals("https://gvault.guber.dev/api/auth/login", MobileAuthState.endpoint("https://gvault.guber.dev/", "/api/auth/login"));
    assertEquals("", MobileAuthState.validate("michael@example.com", "account-password", "master-password", "master-password", true));
    assertEquals("Confirm master password does not match.", MobileAuthState.validate("michael@example.com", "account-password", "master-password", "different", true));
    assertEquals("Email is required.", MobileAuthState.validate("", "account-password", "master-password", "master-password", false));
    assertEquals("Signing in...", MobileAuthState.authLoadingMessage(false));
    assertEquals("Creating account...", MobileAuthState.authLoadingMessage(true));
    assertEquals("Wrong email or account password.", MobileAuthState.authErrorMessage(401, "Invalid credentials"));
    assertEquals("Server unavailable. Check connection or server URL.", MobileAuthState.networkErrorMessage("Connection refused"));
    assertLongEquals(1500L, MobileAuthState.MIN_AUTH_LOADING_MS);
    assertLongEquals(2500L, MobileAuthState.MIN_VAULT_LOADING_MS);
    assertLongEquals(1500L, MobileAuthState.remainingLoadingDelayMs(1000L, 1000L));
    assertLongEquals(550L, MobileAuthState.remainingLoadingDelayMs(1000L, 1950L));
    assertLongEquals(0L, MobileAuthState.remainingLoadingDelayMs(1000L, 2600L));
    assertLongEquals(2500L, MobileAuthState.remainingVaultLoadingDelayMs(1000L, 1000L));
    assertLongEquals(1850L, MobileAuthState.remainingVaultLoadingDelayMs(1000L, 1650L));
    assertLongEquals(0L, MobileAuthState.remainingVaultLoadingDelayMs(1000L, 3600L));
    assertEquals("No vault items yet. Add a login on web or import, then sync again.", MobileAuthState.syncStatusMessage(0));
    assertEquals("Sync complete: 2 encrypted records pulled from server.", MobileAuthState.syncStatusMessage(2));
    assertEquals("Refreshing vault from server...", MobileAuthState.refreshLoadingMessage());
    assertEquals("Loading vault\\nDecrypting server-backed encrypted records...", MobileAuthState.vaultLoadingMessage());
    assertEquals("Username copied to clipboard.", MobileAuthState.copyStatusMessage("username"));
    assertEquals("Password copied to clipboard.", MobileAuthState.copyStatusMessage("password"));
    assertEquals("Reveal password", MobileAuthState.passwordRevealButtonLabel(false));
    assertEquals("Hide password", MobileAuthState.passwordRevealButtonLabel(true));
    assertEquals("Password revealed.", MobileAuthState.passwordRevealStatus(true));
    assertEquals("Password hidden.", MobileAuthState.passwordRevealStatus(false));
    assertEquals("Settings", MobileAuthState.settingsTitle());
    assertEquals("Account: michael@example.com", MobileAuthState.settingsAccountLine("michael@example.com"));
    assertEquals("Server: https://gvault.guber.dev", MobileAuthState.settingsServerLine("https://gvault.guber.dev"));
    assertEquals("Session tokens are kept in memory only; sign in again after app restart.", MobileAuthState.sessionStoragePolicyMessage());
  }

  private static void assertEquals(String expected, String actual) {
    if (!expected.equals(actual)) throw new AssertionError("expected=" + expected + " actual=" + actual);
  }

  private static void assertLongEquals(long expected, long actual) {
    if (expected != actual) throw new AssertionError("expected=" + expected + " actual=" + actual);
  }
}
`);
  const compile = spawnSync("javac", ["-d", dir, source, testSource], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  const run = spawnSync("java", ["-cp", dir, "TestMobileAuthState"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
