package com.gvault.app;

public final class MobileAutofillVault {
  private static LoginEntry[] cachedLoginEntries = new LoginEntry[0];

  private MobileAutofillVault() {}

  public static void setServerBackedItems(String[] itemJsons) {
    cachedLoginEntries = loginEntriesFromServerBackedItems(itemJsons);
  }

  public static LoginEntry[] cachedLoginEntries() {
    LoginEntry[] copy = new LoginEntry[cachedLoginEntries.length];
    System.arraycopy(cachedLoginEntries, 0, copy, 0, cachedLoginEntries.length);
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
  }

  private static String clean(String value, String fallback) {
    if (value == null || value.trim().isEmpty()) return fallback;
    return value.trim();
  }
}
