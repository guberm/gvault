package com.gvault.app;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class MobileAutofillVault {
  private static LoginEntry[] cachedLoginEntries = new LoginEntry[0];
  private static FillEntry[] cachedNonLoginEntries = new FillEntry[0];

  private MobileAutofillVault() {}

  public static void setServerBackedItems(String[] itemJsons) {
    cachedLoginEntries = loginEntriesFromServerBackedItems(itemJsons);
    cachedNonLoginEntries = nonLoginEntriesFromServerBackedItems(itemJsons);
  }

  public static void setLoginEntries(LoginEntry[] entries) {
    cachedLoginEntries = entries == null ? new LoginEntry[0] : copyOf(entries);
  }

  public static void setNonLoginEntries(FillEntry[] entries) {
    cachedNonLoginEntries = entries == null ? new FillEntry[0] : copyOf(entries);
  }

  public static LoginEntry[] cachedLoginEntries() {
    return copyOf(cachedLoginEntries);
  }

  public static FillEntry[] nonLoginFillEntries() {
    return copyOf(cachedNonLoginEntries);
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

  private static FillEntry[] copyOf(FillEntry[] entries) {
    FillEntry[] copy = new FillEntry[entries.length];
    System.arraycopy(entries, 0, copy, 0, entries.length);
    return copy;
  }

  public static void clear() {
    cachedLoginEntries = new LoginEntry[0];
    cachedNonLoginEntries = new FillEntry[0];
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

  public static FillEntry[] fillEntriesFromServerBackedItems(String[] itemJsons) {
    if (itemJsons == null || itemJsons.length == 0) return new FillEntry[0];
    LoginEntry[] loginEntries = loginEntriesFromServerBackedItems(itemJsons);
    FillEntry[] nonLoginEntries = nonLoginEntriesFromServerBackedItems(itemJsons);
    FillEntry[] entries = new FillEntry[loginEntries.length + nonLoginEntries.length];
    int index = 0;
    for (LoginEntry loginEntry : loginEntries) entries[index++] = FillEntry.fromLogin(loginEntry);
    for (FillEntry entry : nonLoginEntries) entries[index++] = entry;
    return entries;
  }

  private static FillEntry[] nonLoginEntriesFromServerBackedItems(String[] itemJsons) {
    if (itemJsons == null || itemJsons.length == 0) return new FillEntry[0];
    int count = 0;
    for (String itemJson : itemJsons) {
      if (isFillableIdentity(itemJson) || isFillableAddress(itemJson)) count++;
    }
    FillEntry[] entries = new FillEntry[count];
    int index = 0;
    for (String itemJson : itemJsons) {
      if (isFillableIdentity(itemJson)) {
        entries[index++] = FillEntry.fromIdentity(itemJson);
      } else if (isFillableAddress(itemJson)) {
        entries[index++] = FillEntry.fromAddress(itemJson);
      }
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

  public static String serializeFillEntries(FillEntry[] entries) {
    if (entries == null || entries.length == 0) return "";
    StringBuilder serialized = new StringBuilder();
    for (FillEntry entry : entries) {
      if (serialized.length() > 0) serialized.append('\n');
      serialized.append(encode(entry.kind())).append('\t')
        .append(encode(entry.title())).append('\t')
        .append(encode(entry.url())).append('\t')
        .append(encode(entry.username())).append('\t')
        .append(encode(entry.password())).append('\t')
        .append(encode(entry.fullName())).append('\t')
        .append(encode(entry.givenName())).append('\t')
        .append(encode(entry.familyName())).append('\t')
        .append(encode(entry.email())).append('\t')
        .append(encode(entry.phone())).append('\t')
        .append(encode(entry.organization())).append('\t')
        .append(encode(entry.line1())).append('\t')
        .append(encode(entry.line2())).append('\t')
        .append(encode(entry.city())).append('\t')
        .append(encode(entry.region())).append('\t')
        .append(encode(entry.postalCode())).append('\t')
        .append(encode(entry.country()));
    }
    return serialized.toString();
  }

  public static FillEntry[] deserializeFillEntries(String serialized) {
    if (serialized == null || serialized.trim().isEmpty()) return new FillEntry[0];
    String[] lines = serialized.split("\\n");
    FillEntry[] decoded = new FillEntry[lines.length];
    int count = 0;
    for (String line : lines) {
      String[] parts = line.split("\\t", -1);
      if (parts.length != 17) continue;
      decoded[count++] = new FillEntry(
        decode(parts[0]), decode(parts[1]), decode(parts[2]), decode(parts[3]), decode(parts[4]),
        decode(parts[5]), decode(parts[6]), decode(parts[7]), decode(parts[8]), decode(parts[9]),
        decode(parts[10]), decode(parts[11]), decode(parts[12]), decode(parts[13]), decode(parts[14]),
        decode(parts[15]), decode(parts[16])
      );
    }
    FillEntry[] entries = new FillEntry[count];
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

  private static boolean isFillableIdentity(String itemJson) {
    if (itemJson == null || itemJson.trim().isEmpty()) return false;
    if (!"identity".equals(MobileVaultItem.stringFieldFromItemJson(itemJson, "type"))) return false;
    return !MobileVaultItem.stringFieldFromItemJson(itemJson, "fullName").trim().isEmpty()
      || !MobileVaultItem.stringFieldFromItemJson(itemJson, "email").trim().isEmpty()
      || !MobileVaultItem.stringFieldFromItemJson(itemJson, "phone").trim().isEmpty();
  }

  private static boolean isFillableAddress(String itemJson) {
    if (itemJson == null || itemJson.trim().isEmpty()) return false;
    if (!"address".equals(MobileVaultItem.stringFieldFromItemJson(itemJson, "type"))) return false;
    return !MobileVaultItem.stringFieldFromItemJson(itemJson, "line1").trim().isEmpty()
      || !MobileVaultItem.stringFieldFromItemJson(itemJson, "city").trim().isEmpty()
      || !MobileVaultItem.stringFieldFromItemJson(itemJson, "postalCode").trim().isEmpty();
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

  public static final class FillEntry {
    private final String kind;
    private final String title;
    private final String url;
    private final String username;
    private final String password;
    private final String fullName;
    private final String givenName;
    private final String familyName;
    private final String email;
    private final String phone;
    private final String organization;
    private final String line1;
    private final String line2;
    private final String city;
    private final String region;
    private final String postalCode;
    private final String country;

    private FillEntry(String kind, String title, String url, String username, String password, String fullName, String givenName, String familyName, String email, String phone, String organization, String line1, String line2, String city, String region, String postalCode, String country) {
      this.kind = clean(kind, "item");
      this.title = clean(title, "Untitled item");
      this.url = clean(url, "");
      this.username = clean(username, "");
      this.password = clean(password, "");
      this.fullName = clean(fullName, "");
      this.givenName = clean(givenName, "");
      this.familyName = clean(familyName, "");
      this.email = clean(email, "");
      this.phone = clean(phone, "");
      this.organization = clean(organization, "");
      this.line1 = clean(line1, "");
      this.line2 = clean(line2, "");
      this.city = clean(city, "");
      this.region = clean(region, "");
      this.postalCode = clean(postalCode, "");
      this.country = clean(country, "");
    }

    static FillEntry fromLogin(LoginEntry entry) {
      return new FillEntry("login", entry.title(), entry.url(), entry.username(), entry.password(), "", "", "", "", "", "", "", "", "", "", "", "");
    }

    static FillEntry fromIdentity(String itemJson) {
      String fullName = MobileVaultItem.stringFieldFromItemJson(itemJson, "fullName");
      String[] parts = splitName(fullName);
      return new FillEntry(
        "identity",
        MobileVaultItem.stringFieldFromItemJson(itemJson, "title"),
        "",
        "",
        "",
        fullName,
        parts[0],
        parts[1],
        MobileVaultItem.stringFieldFromItemJson(itemJson, "email"),
        MobileVaultItem.stringFieldFromItemJson(itemJson, "phone"),
        MobileVaultItem.stringFieldFromItemJson(itemJson, "organization"),
        "",
        "",
        "",
        "",
        "",
        ""
      );
    }

    static FillEntry fromAddress(String itemJson) {
      return new FillEntry(
        "address",
        MobileVaultItem.stringFieldFromItemJson(itemJson, "title"),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        MobileVaultItem.stringFieldFromItemJson(itemJson, "line1"),
        MobileVaultItem.stringFieldFromItemJson(itemJson, "line2"),
        MobileVaultItem.stringFieldFromItemJson(itemJson, "city"),
        MobileVaultItem.stringFieldFromItemJson(itemJson, "region"),
        MobileVaultItem.stringFieldFromItemJson(itemJson, "postalCode"),
        MobileVaultItem.stringFieldFromItemJson(itemJson, "country")
      );
    }

    public String kind() { return kind; }
    public String title() { return title; }
    public String url() { return url; }
    public String username() { return username; }
    public String password() { return password; }
    public String fullName() { return fullName; }
    public String givenName() { return givenName; }
    public String familyName() { return familyName; }
    public String email() { return email; }
    public String phone() { return phone; }
    public String organization() { return organization; }
    public String line1() { return line1; }
    public String line2() { return line2; }
    public String city() { return city; }
    public String region() { return region; }
    public String postalCode() { return postalCode; }
    public String country() { return country; }

    public String label() {
      if ("login".equals(kind)) return username.isEmpty() ? title : title + " — " + username;
      if ("identity".equals(kind)) return email.isEmpty() ? title : title + " — " + email;
      if ("address".equals(kind)) return city.isEmpty() ? title : title + " — " + city;
      return title;
    }
  }

  private static String[] splitName(String fullName) {
    String normalized = clean(fullName, "");
    if (normalized.isEmpty()) return new String[] { "", "" };
    int firstSpace = normalized.indexOf(' ');
    if (firstSpace < 0) return new String[] { normalized, "" };
    return new String[] { normalized.substring(0, firstSpace).trim(), normalized.substring(firstSpace + 1).trim() };
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
