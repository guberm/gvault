package com.gvault.app;

public final class MobileAuthState {
  public static final String DEFAULT_SERVER_URL = "https://gvault.guber.dev";

  private MobileAuthState() {}

  public static String endpoint(String serverUrl, String path) {
    String base = serverUrl == null ? DEFAULT_SERVER_URL : serverUrl.trim();
    while (base.endsWith("/")) {
      base = base.substring(0, base.length() - 1);
    }
    String cleanPath = path == null ? "" : path.trim();
    if (!cleanPath.startsWith("/")) {
      cleanPath = "/" + cleanPath;
    }
    return base + cleanPath;
  }

  public static String validate(String email, String accountPassword, String masterPassword, String confirmMasterPassword, boolean createAccount) {
    if (isBlank(email)) return "Email is required.";
    if (isBlank(accountPassword)) return "Account password is required.";
    if (isBlank(masterPassword)) return "Master password is required.";
    if (createAccount && !masterPassword.equals(confirmMasterPassword == null ? "" : confirmMasterPassword)) {
      return "Confirm master password does not match.";
    }
    return "";
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
