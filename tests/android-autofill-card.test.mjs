import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const vaultSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAutofillVault.java";
const itemSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileVaultItem.java";
const authStateSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAuthState.java";
const classifierSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAutofillClassifier.java";

test("Android Autofill supports payment-card entries for card forms", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gvault-android-autofill-card-"));
  const testSource = join(dir, "TestMobileAutofillCard.java");
  await writeFile(testSource, `
import com.gvault.app.MobileAutofillVault;
import com.gvault.app.MobileAutofillClassifier;

public final class TestMobileAutofillCard {
  public static void main(String[] args) {
    String paymentCard = "{"
      + "\\\"id\\\":\\\"card-1\\\"," 
      + "\\\"type\\\":\\\"payment-card\\\"," 
      + "\\\"title\\\":\\\"Personal Visa\\\"," 
      + "\\\"cardholderName\\\":\\\"Jane Smith\\\"," 
      + "\\\"number\\\":\\\"4111111111111111\\\"," 
      + "\\\"expiryMonth\\\":\\\"08\\\"," 
      + "\\\"expiryYear\\\":\\\"2030\\\"," 
      + "\\\"securityCode\\\":\\\"123\\\""
      + "}";

    MobileAutofillVault.FillEntry[] entries = MobileAutofillVault.fillEntriesFromServerBackedItems(new String[] { paymentCard, "" });
    assertEquals(1, entries.length);
    MobileAutofillVault.FillEntry cardEntry = entries[0];
    assertEquals("payment-card", cardEntry.kind());
    assertEquals("Jane Smith", cardEntry.cardholderName());
    assertEquals("4111111111111111", cardEntry.cardNumber());
    assertEquals("08", cardEntry.cardExpiryMonth());
    assertEquals("2030", cardEntry.cardExpiryYear());
    assertEquals("123", cardEntry.cardSecurityCode());
    assertEquals("08/2030", cardEntry.cardExpiryDate());
    assertEquals("Personal Visa — **** 1111", cardEntry.label());

    MobileAutofillVault.setServerBackedItems(new String[] { paymentCard });
    assertEquals(1, MobileAutofillVault.nonLoginFillEntries().length);
    assertEquals("payment-card", MobileAutofillVault.nonLoginFillEntries()[0].kind());
    String serialized = MobileAutofillVault.serializeFillEntries(MobileAutofillVault.nonLoginFillEntries());
    MobileAutofillVault.setNonLoginEntries(MobileAutofillVault.deserializeFillEntries(serialized));
    assertEquals("4111111111111111", MobileAutofillVault.nonLoginFillEntries()[0].cardNumber());
    assertEquals("08/2030", MobileAutofillVault.nonLoginFillEntries()[0].cardExpiryDate());

    assertEquals("cardNumber", MobileAutofillClassifier.classifyField("card number", "card_number", "creditCardNumber"));
    assertEquals("cardholderName", MobileAutofillClassifier.classifyField("name on card", "cardholder_name", ""));
    assertEquals("cardExpiryMonth", MobileAutofillClassifier.classifyField("expiry month", "exp_month", "creditCardExpirationMonth"));
    assertEquals("cardExpiryYear", MobileAutofillClassifier.classifyField("expiry year", "exp_year", "creditCardExpirationYear"));
    assertEquals("cardExpiryDate", MobileAutofillClassifier.classifyField("expiry", "card_exp", "creditCardExpirationDate"));
    assertEquals("cardSecurityCode", MobileAutofillClassifier.classifyField("cvv", "card_cvv", "creditCardSecurityCode"));
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
    join("/tmp/gvault-push", authStateSource),
    join("/tmp/gvault-push", itemSource),
    join("/tmp/gvault-push", vaultSource),
    join("/tmp/gvault-push", classifierSource),
    testSource,
  ], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  const run = spawnSync("java", ["-cp", dir, "TestMobileAutofillCard"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
