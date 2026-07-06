import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const vaultSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAutofillVault.java";
const itemSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileVaultItem.java";
const authStateSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAuthState.java";
const classifierSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAutofillClassifier.java";

test("Android Autofill supports identity and address entries for contact forms", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gvault-android-autofill-identity-"));
  const testSource = join(dir, "TestMobileAutofillIdentity.java");
  await writeFile(testSource, `
import com.gvault.app.MobileAutofillVault;
import com.gvault.app.MobileVaultItem;
import com.gvault.app.MobileAutofillClassifier;

public final class TestMobileAutofillIdentity {
  public static void main(String[] args) {
    String login = MobileVaultItem.loginItemJson("login-1", "Example", "https://example.com/login", "user@example.com", "Secret123", "from server");
    String identity = "{"
      + "\\\"id\\\":\\\"identity-1\\\"," 
      + "\\\"type\\\":\\\"identity\\\"," 
      + "\\\"title\\\":\\\"Personal identity\\\"," 
      + "\\\"fullName\\\":\\\"Jane Smith\\\"," 
      + "\\\"email\\\":\\\"jane@example.com\\\"," 
      + "\\\"phone\\\":\\\"+15550100\\\"," 
      + "\\\"organization\\\":\\\"Acme Inc\\\""
      + "}";
    String address = "{"
      + "\\\"id\\\":\\\"address-1\\\"," 
      + "\\\"type\\\":\\\"address\\\"," 
      + "\\\"title\\\":\\\"Home address\\\"," 
      + "\\\"line1\\\":\\\"100 Main Street\\\"," 
      + "\\\"line2\\\":\\\"Apt 12\\\"," 
      + "\\\"city\\\":\\\"New York\\\"," 
      + "\\\"region\\\":\\\"NY\\\"," 
      + "\\\"postalCode\\\":\\\"10001\\\"," 
      + "\\\"country\\\":\\\"United States\\\""
      + "}";

    MobileAutofillVault.FillEntry[] entries = MobileAutofillVault.fillEntriesFromServerBackedItems(new String[] { login, identity, address, "" });
    assertEquals(3, entries.length);
    assertEquals("login", entries[0].kind());
    assertEquals("identity", entries[1].kind());
    assertEquals("address", entries[2].kind());

    MobileAutofillVault.FillEntry identityEntry = entries[1];
    assertEquals("Jane Smith", identityEntry.fullName());
    assertEquals("jane@example.com", identityEntry.email());
    assertEquals("+15550100", identityEntry.phone());
    assertEquals("Acme Inc", identityEntry.organization());
    assertEquals("Jane", identityEntry.givenName());
    assertEquals("Smith", identityEntry.familyName());
    assertEquals("Personal identity — jane@example.com", identityEntry.label());

    MobileAutofillVault.FillEntry addressEntry = entries[2];
    assertEquals("100 Main Street", addressEntry.line1());
    assertEquals("Apt 12", addressEntry.line2());
    assertEquals("New York", addressEntry.city());
    assertEquals("NY", addressEntry.region());
    assertEquals("10001", addressEntry.postalCode());
    assertEquals("United States", addressEntry.country());
    assertEquals("Home address — New York", addressEntry.label());

    MobileAutofillVault.setServerBackedItems(new String[] { login, identity, address });
    assertEquals(1, MobileAutofillVault.matchingLoginEntries("example.com").length);
    assertEquals(2, MobileAutofillVault.nonLoginFillEntries().length);
    assertEquals("identity", MobileAutofillVault.nonLoginFillEntries()[0].kind());
    assertEquals("address", MobileAutofillVault.nonLoginFillEntries()[1].kind());
    String serializedFill = MobileAutofillVault.serializeFillEntries(MobileAutofillVault.nonLoginFillEntries());
    MobileAutofillVault.setNonLoginEntries(MobileAutofillVault.deserializeFillEntries(serializedFill));
    assertEquals(2, MobileAutofillVault.nonLoginFillEntries().length);
    assertEquals("Jane Smith", MobileAutofillVault.nonLoginFillEntries()[0].fullName());
    assertEquals("10001", MobileAutofillVault.nonLoginFillEntries()[1].postalCode());

    assertEquals("username", MobileAutofillClassifier.classifyField("username", "login_user", "username"));
    assertEquals("password", MobileAutofillClassifier.classifyField("password", "login_password", "password"));
    assertEquals("fullName", MobileAutofillClassifier.classifyField("full name", "full_name", "name"));
    assertEquals("givenName", MobileAutofillClassifier.classifyField("first name", "first_name", "personGivenName"));
    assertEquals("familyName", MobileAutofillClassifier.classifyField("last name", "last_name", "personFamilyName"));
    assertEquals("email", MobileAutofillClassifier.classifyField("email", "email", "emailAddress"));
    assertEquals("phone", MobileAutofillClassifier.classifyField("phone", "phone", "phone"));
    assertEquals("street", MobileAutofillClassifier.classifyField("address", "street", "postalAddress"));
    assertEquals("street", MobileAutofillClassifier.classifyField("street", "street_1", "streetAddress"));
    assertEquals("city", MobileAutofillClassifier.classifyField("city", "city", "addressLocality"));
    assertEquals("region", MobileAutofillClassifier.classifyField("state", "region", "addressRegion"));
    assertEquals("postalCode", MobileAutofillClassifier.classifyField("zip", "postal_code", "postalCode"));
    assertEquals("country", MobileAutofillClassifier.classifyField("country", "country", "addressCountry"));
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
    join(process.cwd(), authStateSource),
    join(process.cwd(), itemSource),
    join(process.cwd(), vaultSource),
    join(process.cwd(), classifierSource),
    testSource,
  ], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  const run = spawnSync("java", ["-cp", dir, "TestMobileAutofillIdentity"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
