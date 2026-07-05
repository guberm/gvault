package com.gvault.app;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class MobileAutofillVault {
  private static LoginEntry[] cachedLoginEntries = new LoginEntry[0];

  private MobileAutofillVault() {}

  public static void setServerBackedItems(String[] itemJsons) {
    cachedLoginEntries = loginEntriesFromServerBackedItems(itemJsons);
  }

  public static void setLoginEntries(LoginEntry[] entries) {
    cachedLoginEntries = entries == null ? new LoginEntry[0] : copyOf(entries);
  }

  public static LoginEntry[] cachedLoginEntries() {
    return copyOf(cachedLoginEntries);
  }

  public static LoginEntry[] matchingLoginEntries(String domain) {
    String normalizedDomain = normalizeDomain(domain);
    if (normalizedDomain.isEmpty()) return cachedLoginEntries();
    int count = 0;
    for (LoginEntry entry : cachedLoginEntries) {
      if (entry.matchesDomain(normalizedDomain)) count++;
    }
    LoginEntry[] matches = new LoginEntry[count];
    int visibleIndex = 0;
    for (LoginEntry entry : cachedLoginEntries) {
      if (entry.matchesDomain(normalizedDomain)) matches[visibleIndex++] = entry;
    }
    return matches;
  }

  private static LoginEntry[] copyOf(LoginEntry[] entries) {
    LoginEntry[] copy = new LoginEntry[entries.length];
    System.arraycopy(entries, 0, copy, 0, entries.length);
    return copy;
  }

  public static void clear() {
    cachedLoginEntries = new LoginEntry[0];
  }

  public static LoginEntry[] loginEntriesFromServerBackedItems(String[] itemJsons) {
    if (itemJsons == null || itemJsons.length == 0) return new LoginEntry[0];
    int count = 0;
    for (String itemJson : itemJsons) {
      if (isFillableLogin(itemJson)) count++;
    }
    LoginEntry[] entries = new LoginEntry[count];
    int visibleIndex = 0;
    for (String itemJson : itemJsons) {
      if (!isFillableLogin(itemJson)) continue;
      entries[visibleIndex++] = new LoginEntry(
        MobileVaultItem.stringFieldFromItemJson(itemJson, "title"),
        MobileVaultItem.stringFieldFromItemJson(itemJson, "url"),
        MobileVaultItem.stringFieldFromItemJson(itemJson, "username"),
        MobileVaultItem.stringFieldFromItemJson(itemJson, "password")
      );
    }
    return entries;
  }

  public static String serializeLoginEntries(LoginEntry[] entries) {
    if (entries == null || entries.length == 0) return "";
    StringBuilder serialized = new StringBuilder();
    for (LoginEntry entry : entries) {
      if (serialized.length() > 0) serialized.append('\n');
      serialized.append(encode(entry.title())).append('\t')
        .append(encode(entry.url())).append('\t')
        .append(encode(entry.username())).append('\t')
        .append(encode(entry.password()));
    }
    return serialized.toString();
  }

  public static LoginEntry[] deserializeLoginEntries(String serialized) {
    if (serialized == null || serialized.trim().isEmpty()) return new LoginEntry[0];
    String[] lines = serialized.split("\\n");
    LoginEntry[] decoded = new LoginEntry[lines.length];
    int count = 0;
    for (String line : lines) {
      String[] parts = line.split("\\t", -1);
      if (parts.length != 4) continue;
      decoded[count++] = new LoginEntry(decode(parts[0]), decode(parts[1]), decode(parts[2]), decode(parts[3]));
    }
    LoginEntry[] entries = new LoginEntry[count];
    System.arraycopy(decoded, 0, entries, 0, count);
    return entries;
  }

  private static String encode(String value) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(clean(value, "").getBytes(StandardCharsets.UTF_8));
  }

  private static String decode(String value) {
    try {
      return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
    } catch (IllegalArgumentException error) {
      return "";
    }
  }

  private static boolean isFillableLogin(String itemJson) {
    if (itemJson == null || itemJson.trim().isEmpty()) return false;
    if (!"login".equals(MobileVaultItem.stringFieldFromItemJson(itemJson, "type"))) return false;
    return !MobileVaultItem.stringFieldFromItemJson(itemJson, "password").trim().isEmpty();
  }

  public static final class LoginEntry {
    private final String title;
    private final String url;
    private final String username;
    private final String password;

    LoginEntry(String title, String url, String username, String password) {
      this.title = clean(title, "Untitled login");
      this.url = clean(url, "");
      this.username = clean(username, "");
      this.password = clean(password, "");
    }

    public String title() { return title; }
    public String url() { return url; }
    public String username() { return username; }
    public String password() { return password; }

    public String label() {
      return username.isEmpty() ? title : title + " — " + username;
    }

    boolean matchesDomain(String requestedDomain) {
      String ownDomain = normalizeDomain(url);
      return !ownDomain.isEmpty() && (ownDomain.equals(requestedDomain) || ownDomain.endsWith("." + requestedDomain) || requestedDomain.endsWith("." + ownDomain));
    }
  }

  private static String normalizeDomain(String value) {
    if (value == null) return "";
    String normalized = value.trim().toLowerCase(java.util.Locale.US);
    if (normalized.startsWith("http://")) normalized = normalized.substring(7);
    if (normalized.startsWith("https://")) normalized = normalized.substring(8);
    int slash = normalized.indexOf('/');
    if (slash >= 0) normalized = normalized.substring(0, slash);
    int colon = normalized.indexOf(':');
    if (colon >= 0) normalized = normalized.substring(0, colon);
    if (normalized.startsWith("www.")) normalized = normalized.substring(4);
    return normalized;
  }

  private static String clean(String value, String fallback) {
    if (value == null || value.trim().isEmpty()) return fallback;
    return value.trim();
  }
}
