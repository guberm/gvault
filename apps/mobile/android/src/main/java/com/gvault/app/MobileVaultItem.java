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
  private static final SecureRandom RANDOM = new SecureRandom();

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
    String now = isoNow();
    return loginItemJson(id, title, url, username, password, notes, now, now);
  }

  private static String loginItemJson(String id, String title, String url, String username, String password, String notes, String createdAt, String updatedAt) {
    return "{"
      + "\"id\":\"" + escapeJson(id) + "\"," 
      + "\"type\":\"login\"," 
      + "\"title\":\"" + escapeJson(title) + "\"," 
      + "\"url\":\"" + escapeJson(url) + "\"," 
      + "\"username\":\"" + escapeJson(username) + "\"," 
      + "\"password\":\"" + escapeJson(password) + "\"," 
      + "\"notes\":\"" + escapeJson(notes) + "\"," 
      + "\"urls\":[\"" + escapeJson(url) + "\"],"
      + "\"tags\":[],\"favorite\":false,"
      + "\"createdAt\":\"" + escapeJson(createdAt) + "\","
      + "\"updatedAt\":\"" + escapeJson(updatedAt) + "\","
      + "\"customFields\":[]"
      + "}";
  }

  public static String updateLoginItemJson(String existingItemJson, String title, String url, String username, String password, String notes) {
    String id = firstNonEmpty(extractString(existingItemJson, "id"), "android-login-" + System.currentTimeMillis());
    String createdAt = firstNonEmpty(extractString(existingItemJson, "createdAt"), isoNow());
    return loginItemJson(id, title, url, username, password, notes, createdAt, isoNowAfter(createdAt));
  }

  private static String isoNow() {
    return isoFormat().format(new java.util.Date());
  }

  private static String isoNowAfter(String floor) {
    java.text.SimpleDateFormat format = isoFormat();
    long nextMs = System.currentTimeMillis();
    try {
      java.util.Date floorDate = format.parse(floor);
      if (floorDate != null && floorDate.getTime() >= nextMs) nextMs = floorDate.getTime() + 1L;
    } catch (java.text.ParseException ignored) {
      // Invalid legacy timestamps are replaced by the current canonical timestamp.
    }
    return format.format(new java.util.Date(nextMs));
  }

  private static java.text.SimpleDateFormat isoFormat() {
    java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
    format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
    return format;
  }

  private static SecretKeySpec deriveAesKey(String masterPassword, byte[] salt) throws Exception {
    if (masterPassword == null || masterPassword.length() < MobileAuthState.MIN_MASTER_PASSWORD_LENGTH) {
      throw new IllegalArgumentException("Master password must be at least 12 characters.");
    }
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

  public static int nextRevision(int currentRevision, boolean editing) {
    return editing ? Math.max(1, currentRevision) + 1 : 1;
  }

  public static boolean shouldRenderRecord(boolean deleted) {
    return !deleted;
  }

  public static boolean matchesQuery(String itemJson, String query) {
    if (query == null || query.trim().isEmpty()) return true;
    String normalized = query.trim().toLowerCase(java.util.Locale.US);
    String haystack = (firstNonEmpty(extractString(itemJson, "title"), "") + "\n"
      + extractString(itemJson, "username") + "\n"
      + extractString(itemJson, "url") + "\n"
      + extractString(itemJson, "notes")).toLowerCase(java.util.Locale.US);
    return haystack.contains(normalized);
  }

  public static boolean matchesType(String itemJson, String typeFilter) {
    if (typeFilter == null || typeFilter.trim().isEmpty() || "all".equals(typeFilter)) return true;
    return typeFilter.trim().equals(extractString(itemJson, "type"));
  }

  public static boolean matchesFavorite(String itemJson, boolean favoritesOnly) {
    if (!favoritesOnly) return true;
    return extractBoolean(itemJson, "favorite");
  }

  public static String generateStrongPassword(int length) {
    final String upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    final String lower = "abcdefghijkmnopqrstuvwxyz";
    final String digits = "23456789";
    final String symbols = "!@#$%^&*";
    final String all = upper + lower + digits + symbols;
    int targetLength = Math.max(4, length);
    char[] value = new char[targetLength];
    value[0] = randomChar(upper);
    value[1] = randomChar(lower);
    value[2] = randomChar(digits);
    value[3] = randomChar(symbols);
    for (int index = 4; index < targetLength; index++) value[index] = randomChar(all);
    for (int index = value.length - 1; index > 0; index--) {
      int swapIndex = RANDOM.nextInt(index + 1);
      char temporary = value[index];
      value[index] = value[swapIndex];
      value[swapIndex] = temporary;
    }
    return new String(value);
  }

  public static String passwordStrengthLabel(String password) {
    if (password == null) return "Weak";
    int classes = 0;
    if (containsUppercase(password)) classes++;
    if (containsLowercase(password)) classes++;
    if (containsDigit(password)) classes++;
    if (containsSymbol(password)) classes++;
    if (password.length() >= 16 && classes == 4) return "Strong";
    if (password.length() >= 12 && classes >= 3) return "Medium";
    return "Weak";
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

  public static String stringFieldFromItemJson(String itemJson, String field) {
    return extractString(itemJson, field);
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

  private static boolean extractBoolean(String json, String field) {
    if (json == null) return false;
    Pattern pattern = Pattern.compile("\\\"" + Pattern.quote(field) + "\\\"\\s*:\\s*true");
    return pattern.matcher(json).find();
  }

  private static char randomChar(String characters) {
    return characters.charAt(RANDOM.nextInt(characters.length()));
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
    for (int index = 0; index < value.length(); index++) if (!Character.isLetterOrDigit(value.charAt(index))) return true;
    return false;
  }

  private static String unescapeJsonString(String value) {
    return value.replace("\\\"", "\"").replace("\\/", "/").replace("\\\\", "\\");
  }

  private static String escapeJson(String value) {
    if (value == null) return "";
    return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
  }
}
