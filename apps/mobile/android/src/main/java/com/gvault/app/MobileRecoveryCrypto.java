package com.gvault.app;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

public final class MobileRecoveryCrypto {
  public static final String PROTOCOL = "gvault-recovery-v1";
  public static final int ITERATIONS = 210000;
  public static final int PLAINTEXT_BYTES = 256;
  private static final int GCM_TAG_BITS = 128;
  private static final SecureRandom RANDOM = new SecureRandom();

  private MobileRecoveryCrypto() {}

  public static final class RecoveryEnvelope {
    public final int version;
    public final String kdf;
    public final int iterations;
    public final String salt;
    public final String nonce;
    public final String ciphertext;

    public RecoveryEnvelope(int version, String kdf, int iterations, String salt, String nonce, String ciphertext) {
      this.version = version;
      this.kdf = kdf;
      this.iterations = iterations;
      this.salt = salt;
      this.nonce = nonce;
      this.ciphertext = ciphertext;
    }
  }

  public static final class RecoveryMaterial {
    public final int version;
    public final String verifier;
    public final RecoveryEnvelope envelope;

    RecoveryMaterial(String verifier, RecoveryEnvelope envelope) {
      this.version = 1;
      this.verifier = verifier;
      this.envelope = envelope;
    }
  }

  public static RecoveryMaterial create(String masterPassword) throws Exception {
    validateMasterPassword(masterPassword);
    KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
    generator.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
    KeyPair keyPair = generator.generateKeyPair();
    byte[] privateKey = keyPair.getPrivate().getEncoded();
    if (privateKey.length < 1 || privateKey.length > PLAINTEXT_BYTES - 2) throw new IllegalStateException("Recovery key encoding is too large.");

    byte[] plaintext = new byte[PLAINTEXT_BYTES];
    RANDOM.nextBytes(plaintext);
    plaintext[0] = (byte) ((privateKey.length >>> 8) & 0xff);
    plaintext[1] = (byte) (privateKey.length & 0xff);
    System.arraycopy(privateKey, 0, plaintext, 2, privateKey.length);
    byte[] salt = new byte[16];
    byte[] nonce = new byte[12];
    RANDOM.nextBytes(salt);
    RANDOM.nextBytes(nonce);
    SecretKeySpec key = deriveKey(masterPassword, salt);
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, nonce));
    cipher.updateAAD(PROTOCOL.getBytes(StandardCharsets.UTF_8));
    byte[] ciphertext = cipher.doFinal(plaintext);

    Arrays.fill(privateKey, (byte) 0);
    Arrays.fill(plaintext, (byte) 0);
    return new RecoveryMaterial(
      Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded()),
      new RecoveryEnvelope(
        1,
        "PBKDF2-SHA256",
        ITERATIONS,
        Base64.getEncoder().encodeToString(salt),
        Base64.getEncoder().encodeToString(nonce),
        Base64.getEncoder().encodeToString(ciphertext)
      )
    );
  }

  public static byte[] decryptPrivateKey(RecoveryEnvelope envelope, String masterPassword) throws Exception {
    validateMasterPassword(masterPassword);
    if (envelope == null || envelope.version != 1 || !"PBKDF2-SHA256".equals(envelope.kdf) || envelope.iterations != ITERATIONS) {
      throw new IllegalArgumentException("Recovery envelope is invalid.");
    }
    byte[] salt = Base64.getDecoder().decode(envelope.salt);
    byte[] nonce = Base64.getDecoder().decode(envelope.nonce);
    byte[] ciphertext = Base64.getDecoder().decode(envelope.ciphertext);
    if (salt.length != 16 || nonce.length != 12 || ciphertext.length != PLAINTEXT_BYTES + 16) {
      throw new IllegalArgumentException("Recovery envelope is invalid.");
    }
    SecretKeySpec key = deriveKey(masterPassword, salt);
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, nonce));
    cipher.updateAAD(PROTOCOL.getBytes(StandardCharsets.UTF_8));
    byte[] plaintext = cipher.doFinal(ciphertext);
    if (plaintext.length != PLAINTEXT_BYTES) throw new IllegalArgumentException("Recovery envelope is invalid.");
    int length = ((plaintext[0] & 0xff) << 8) | (plaintext[1] & 0xff);
    if (length < 1 || length > PLAINTEXT_BYTES - 2) throw new IllegalArgumentException("Recovery envelope is invalid.");
    byte[] privateKey = Arrays.copyOfRange(plaintext, 2, 2 + length);
    Arrays.fill(plaintext, (byte) 0);
    return privateKey;
  }

  public static String sign(RecoveryEnvelope envelope, String masterPassword, String challengeId, String challenge) throws Exception {
    byte[] privateKeyBytes = decryptPrivateKey(envelope, masterPassword);
    try {
      Signature signature = Signature.getInstance("SHA256withECDSA");
      signature.initSign(KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(privateKeyBytes)), RANDOM);
      signature.update(canonicalMessage(challengeId, challenge));
      return Base64.getEncoder().encodeToString(signature.sign());
    } finally {
      Arrays.fill(privateKeyBytes, (byte) 0);
    }
  }

  public static byte[] canonicalMessage(String challengeId, String challenge) {
    return (PROTOCOL + "\n" + safe(challengeId) + "\n" + safe(challenge)).getBytes(StandardCharsets.UTF_8);
  }

  private static SecretKeySpec deriveKey(String masterPassword, byte[] salt) throws Exception {
    PBEKeySpec spec = new PBEKeySpec(masterPassword.toCharArray(), salt, ITERATIONS, 256);
    try {
      SecretKey derived = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec);
      return new SecretKeySpec(derived.getEncoded(), "AES");
    } finally {
      spec.clearPassword();
    }
  }

  private static void validateMasterPassword(String masterPassword) {
    if (masterPassword == null || masterPassword.length() < MobileAuthState.MIN_MASTER_PASSWORD_LENGTH) {
      throw new IllegalArgumentException("Master password must be at least 12 characters.");
    }
  }

  private static String safe(String value) {
    return value == null ? "" : value;
  }
}
