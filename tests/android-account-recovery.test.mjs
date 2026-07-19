import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const recoverySource = "apps/mobile/android/src/main/java/com/gvault/app/MobileRecoveryCrypto.java";
const authStateSource = "apps/mobile/android/src/main/java/com/gvault/app/MobileAuthState.java";
const activitySource = "apps/mobile/android/src/main/java/com/gvault/app/MainActivity.java";

test("Android recovery crypto uses the v1 envelope, rejects wrong master, signs challenges, and rotates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gvault-android-recovery-"));
  const testSource = join(dir, "TestMobileRecoveryCrypto.java");
  await writeFile(testSource, `
import com.gvault.app.MobileRecoveryCrypto;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class TestMobileRecoveryCrypto {
  public static void main(String[] args) throws Exception {
    String master = "android-recovery-master";
    MobileRecoveryCrypto.RecoveryMaterial first = MobileRecoveryCrypto.create(master);
    assertEquals("gvault-recovery-v1", MobileRecoveryCrypto.PROTOCOL);
    assertEquals("PBKDF2-SHA256", first.envelope.kdf);
    assertEquals(210000, first.envelope.iterations);
    assertEquals(1, first.version);
    assertEquals(1, first.envelope.version);
    if (Base64.getDecoder().decode(first.envelope.salt).length != 16) throw new AssertionError("salt length");
    if (Base64.getDecoder().decode(first.envelope.nonce).length != 12) throw new AssertionError("nonce length");

    boolean wrongMasterRejected = false;
    try { MobileRecoveryCrypto.decryptPrivateKey(first.envelope, "wrong-master-password"); }
    catch (Exception expected) { wrongMasterRejected = true; }
    if (!wrongMasterRejected) throw new AssertionError("wrong master accepted");

    String challengeId = "android-challenge-1";
    String challenge = "YW5kcm9pZC1jaGFsbGVuZ2U";
    assertEquals(
      "gvault-recovery-v1\\nandroid-challenge-1\\nYW5kcm9pZC1jaGFsbGVuZ2U",
      new String(MobileRecoveryCrypto.canonicalMessage(challengeId, challenge), StandardCharsets.UTF_8)
    );
    String proof = MobileRecoveryCrypto.sign(first.envelope, master, challengeId, challenge);
    PublicKey publicKey = KeyFactory.getInstance("EC").generatePublic(
      new X509EncodedKeySpec(Base64.getDecoder().decode(first.verifier))
    );
    Signature verifier = Signature.getInstance("SHA256withECDSA");
    verifier.initVerify(publicKey);
    verifier.update(MobileRecoveryCrypto.canonicalMessage(challengeId, challenge));
    if (!verifier.verify(Base64.getDecoder().decode(proof))) throw new AssertionError("proof rejected");

    MobileRecoveryCrypto.RecoveryMaterial rotated = MobileRecoveryCrypto.create(master);
    if (first.verifier.equals(rotated.verifier)) throw new AssertionError("verifier did not rotate");
    if (first.envelope.ciphertext.equals(rotated.envelope.ciphertext)) throw new AssertionError("envelope did not rotate");
  }

  private static void assertEquals(String expected, String actual) {
    if (!expected.equals(actual)) throw new AssertionError("expected=" + expected + " actual=" + actual);
  }
  private static void assertEquals(int expected, int actual) {
    if (expected != actual) throw new AssertionError("expected=" + expected + " actual=" + actual);
  }
}
`, "utf8");

  try {
    const compile = spawnSync("javac", ["-d", dir, authStateSource, recoverySource, testSource], { encoding: "utf8" });
    assert.equal(compile.status, 0, compile.stderr || compile.stdout);
    const run = spawnSync("java", ["-cp", dir, "TestMobileRecoveryCrypto"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr || run.stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Android exposes registration, explicit migration, and forgot-account-password recovery without a master verifier", async () => {
  const source = await readFile(activitySource, "utf8");
  assert.match(source, /Forgot account password\?/);
  assert.match(source, /\/api\/auth\/recovery\/challenge/);
  assert.match(source, /\/api\/auth\/recovery\/complete/);
  assert.match(source, /\/api\/auth\/recovery\/setup/);
  assert.match(source, /Enable \/ rotate recovery/);
  assert.match(source, /MobileRecoveryCrypto\.create\(masterSecret\)/);
  assert.doesNotMatch(source, /body\.put\("masterPassword"/);
  assert.doesNotMatch(source, /body\.put\("recoveryToken"/);
  assert.doesNotMatch(source, /masterPassword(Hash|Verifier)/i);
});
