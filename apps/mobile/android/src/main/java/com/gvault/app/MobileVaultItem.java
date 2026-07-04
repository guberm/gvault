package com.gvault.app;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

public final class MobileVaultItem {
  private static final int PBKDF2_ITERATIONS = 150000;
  private static final int AES_KEY_BITS = 256;
  private static final int GCM_TAG_BITS = 128;

  private MobileVaultItem() {}

  public static String decryptItemJson(String ciphertextBase64, String nonceBase64, String saltBase64, String masterPassword) throws Exception {
    byte[] salt = Base64.getDecoder().decode(saltBase64);
    byte[] nonce = Base64.getDecoder().decode(nonceBase64);
    byte[] ciphertext = Base64.getDecoder().decode(ciphertextBase64);
    SecretKeySpec key = deriveAesKey(masterPassword, salt);
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, nonce));
    return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
  }

  public static String[] encryptItemJson(String itemJson, String masterPassword) throws Exception {
    SecureRandom random = new SecureRandom();
    byte[] salt = new byte[16];
    byte[] nonce = new byte[12];
    random.nextBytes(salt);
    random.nextBytes(nonce);
    SecretKeySpec key = deriveAesKey(masterPassword, salt);
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, nonce));
    byte[] ciphertext = cipher.doFinal(itemJson.getBytes(StandardCharsets.UTF_8));
    return new String[] {
      Base64.getEncoder().encodeToString(ciphertext),
      Base64.getEncoder().encodeToString(nonce),
      Base64.getEncoder().encodeToString(salt)
    };
  }

  public static String loginItemJson(String id, String title, String url, String username, String password, String notes) {
    return "{"
      + "\"id\":\"" + escapeJson(id) + "\"," 
      + "\"type\":\"login\"," 
      + "\"title\":\"" + escapeJson(title) + "\"," 
      + "\"url\":\"" + escapeJson(url) + "\"," 
      + "\"username\":\"" + escapeJson(username) + "\"," 
      + "\"password\":\"" + escapeJson(password) + "\"," 
      + "\"notes\":\"" + escapeJson(notes) + "\"," 
      + "\"urls\":[\"" + escapeJson(url) + "\"],"
      + "\"tags\":[],\"favorite\":false,\"customFields\":[]"
      + "}";
  }

  private static SecretKeySpec deriveAesKey(String masterPassword, byte[] salt) throws Exception {
    SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
    KeySpec spec = new PBEKeySpec(masterPassword.toCharArray(), salt, PBKDF2_ITERATIONS, AES_KEY_BITS);
    SecretKey secret = factory.generateSecret(spec);
    return new SecretKeySpec(secret.getEncoded(), "AES");
  }

  public static String listLineFromItemJson(String itemJson) {
    String title = firstNonEmpty(extractString(itemJson, "title"), "Untitled item");
    String type = extractString(itemJson, "type");
    if ("login".equals(type)) {
      String username = extractString(itemJson, "username");
      return username.isEmpty() ? title : title + " — " + username;
    }
    return title;
  }

  public static String itemListStatus(int itemCount) {
    if (itemCount == 0) return MobileAuthState.syncStatusMessage(0);
    return itemCount + " item" + (itemCount == 1 ? "" : "s") + " in your vault";
  }

  public static String detailTextFromItemJson(String itemJson) {
    String title = firstNonEmpty(extractString(itemJson, "title"), "Untitled item");
    String type = firstNonEmpty(extractString(itemJson, "type"), "item");
    String username = extractString(itemJson, "username");
    String url = extractString(itemJson, "url");
    String notes = extractString(itemJson, "notes");
    StringBuilder builder = new StringBuilder();
    builder.append("Title: ").append(title);
    builder.append("\nType: ").append(type);
    if (!username.isEmpty()) builder.append("\nUsername: ").append(username);
    if (!url.isEmpty()) builder.append("\nURL: ").append(url);
    if (!notes.isEmpty()) builder.append("\nNotes: ").append(notes);
    return builder.toString();
  }

  private static String firstNonEmpty(String value, String fallback) {
    return value == null || value.trim().isEmpty() ? fallback : value.trim();
  }

  private static String extractString(String json, String field) {
    if (json == null) return "";
    Pattern pattern = Pattern.compile("\\\"" + Pattern.quote(field) + "\\\"\\s*:\\s*\\\"((?:\\\\.|[^\\\"])*)\\\"");
    Matcher matcher = pattern.matcher(json);
    if (!matcher.find()) return "";
    return unescapeJsonString(matcher.group(1));
  }

  private static String unescapeJsonString(String value) {
    return value.replace("\\\"", "\"").replace("\\/", "/").replace("\\\\", "\\");
  }

  private static String escapeJson(String value) {
    if (value == null) return "";
    return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
  }
}
