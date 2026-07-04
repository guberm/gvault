import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";

const source = "apps/mobile/android/src/main/java/com/gvault/app/MobileVaultItem.java";
const authSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAuthState.java";

test("Android vault item list decrypts server-backed login records", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gvault-android-vault-list-test-"));
  const masterPassword = "MasterPass12345";
  const login = {
    id: "login_1",
    type: "login",
    title: "Example Login",
    username: "michael@example.com",
    url: "https://example.com/login"
  };
  const encrypted = await encryptJson(login, masterPassword);
  const testSource = join(dir, "TestMobileVaultItem.java");
  await writeFile(testSource, `
import com.gvault.app.MobileVaultItem;

public final class TestMobileVaultItem {
  public static void main(String[] args) throws Exception {
    String json = MobileVaultItem.decryptItemJson("${encrypted.ciphertext}", "${encrypted.nonce}", "${encrypted.salt}", "${masterPassword}");
    assertContains(json, "Example Login");
    assertContains(json, "michael@example.com");
    assertEquals("Example Login — michael@example.com", MobileVaultItem.listLineFromItemJson(json));
    String detail = MobileVaultItem.detailTextFromItemJson(json);
    assertContains(detail, "Title: Example Login");
    assertContains(detail, "Username: michael@example.com");
    assertContains(detail, "URL: https://example.com/login");
    String createdJson = MobileVaultItem.loginItemJson("android-created-1", "Android Created Login", "https://created.example/login", "created@example.com", "CreatedPass123", "Created from Android");
    String[] encryptedCreated = MobileVaultItem.encryptItemJson(createdJson, "${masterPassword}");
    String decryptedCreated = MobileVaultItem.decryptItemJson(encryptedCreated[0], encryptedCreated[1], encryptedCreated[2], "${masterPassword}");
    assertContains(decryptedCreated, "Android Created Login");
    assertContains(decryptedCreated, "created@example.com");
    String updatedJson = MobileVaultItem.updateLoginItemJson(createdJson, "Android Edited Login", "https://edited.example/login", "edited@example.com", "EditedPass123", "Edited from Android");
    assertContains(updatedJson, "android-created-1");
    assertContains(updatedJson, "Android Edited Login");
    assertContains(updatedJson, "edited@example.com");
    assertContains(updatedJson, "Edited from Android");
    assertEquals("Android Edited Login — edited@example.com", MobileVaultItem.listLineFromItemJson(updatedJson));
    assertContains(MobileVaultItem.detailTextFromItemJson(updatedJson), "Title: Android Edited Login");
    assertEquals("EditedPass123", MobileVaultItem.stringFieldFromItemJson(updatedJson, "password"));
    assertEquals(2, MobileVaultItem.nextRevision(1, true));
    assertEquals(1, MobileVaultItem.nextRevision(0, false));
    if (!MobileVaultItem.shouldRenderRecord(false)) throw new AssertionError("active records should render");
    if (MobileVaultItem.shouldRenderRecord(true)) throw new AssertionError("deleted records should not render");
    if (!MobileVaultItem.matchesQuery(updatedJson, "edited")) throw new AssertionError("title query should match");
    if (!MobileVaultItem.matchesQuery(updatedJson, "edited@example")) throw new AssertionError("username query should match");
    if (!MobileVaultItem.matchesQuery(updatedJson, "edited.example")) throw new AssertionError("URL query should match");
    if (!MobileVaultItem.matchesQuery(updatedJson, "")) throw new AssertionError("empty query should match");
    if (MobileVaultItem.matchesQuery(updatedJson, "missing-value")) throw new AssertionError("unmatched query should not match");
    if (!MobileVaultItem.matchesType(updatedJson, "all")) throw new AssertionError("all type should match");
    if (!MobileVaultItem.matchesType(updatedJson, "login")) throw new AssertionError("login type should match login item");
    if (MobileVaultItem.matchesType(updatedJson, "safenote")) throw new AssertionError("safenote type should not match login item");
    String favoriteJson = updatedJson.replace("\\\"favorite\\\":false", "\\\"favorite\\\":true");
    if (!MobileVaultItem.matchesFavorite(favoriteJson, true)) throw new AssertionError("favorite item should match favorite-only filter");
    if (MobileVaultItem.matchesFavorite(updatedJson, true)) throw new AssertionError("non-favorite should not match favorite-only filter");
    if (!MobileVaultItem.matchesFavorite(updatedJson, false)) throw new AssertionError("non-favorite should match non-filtered list");
    String generatedPassword = MobileVaultItem.generateStrongPassword(20);
    assertEquals(20, generatedPassword.length());
    if (!containsUppercase(generatedPassword)) throw new AssertionError("generated password needs uppercase");
    if (!containsLowercase(generatedPassword)) throw new AssertionError("generated password needs lowercase");
    if (!containsDigit(generatedPassword)) throw new AssertionError("generated password needs digit");
    if (!containsSymbol(generatedPassword)) throw new AssertionError("generated password needs symbol");
    assertEquals("Strong", MobileVaultItem.passwordStrengthLabel(generatedPassword));
    assertEquals("Weak", MobileVaultItem.passwordStrengthLabel("short"));
    assertEquals("2 items in your vault", MobileVaultItem.itemListStatus(2));
  }

  private static void assertContains(String actual, String expected) {
    if (!actual.contains(expected)) throw new AssertionError("missing " + expected + " in " + actual);
  }

  private static void assertEquals(String expected, String actual) {
    if (!expected.equals(actual)) throw new AssertionError("expected [" + expected + "] got [" + actual + "]");
  }

  private static void assertEquals(int expected, int actual) {
    if (expected != actual) throw new AssertionError("expected [" + expected + "] got [" + actual + "]");
  }

  private static boolean containsUppercase(String value) {
    for (int index = 0; index < value.length(); index++) if (Character.isUpperCase(value.charAt(index))) return true;
    return false;
  }

  private static boolean containsLowercase(String value) {
    for (int index = 0; index < value.length(); index++) if (Character.isLowerCase(value.charAt(index))) return true;
    return false;
  }

  private static boolean containsDigit(String value) {
    for (int index = 0; index < value.length(); index++) if (Character.isDigit(value.charAt(index))) return true;
    return false;
  }

  private static boolean containsSymbol(String value) {
    for (int index = 0; index < value.length(); index++) {
      char current = value.charAt(index);
      if (!Character.isLetterOrDigit(current)) return true;
    }
    return false;
  }
}
`);

  const compile = spawnSync("javac", ["-d", dir, authSource, source, testSource], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  const run = spawnSync("java", ["-cp", dir, "TestMobileVaultItem"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

async function encryptJson(value, masterPassword) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(masterPassword), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { ciphertext: toBase64(ciphertext), nonce: toBase64(iv), salt: toBase64(salt) };
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}
