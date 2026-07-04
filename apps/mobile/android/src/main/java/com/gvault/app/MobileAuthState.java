package com.gvault.app;

public final class MobileAuthState {
  public static final String DEFAULT_SERVER_URL = "https://gvault.guber.dev";
  public static final long MIN_AUTH_LOADING_MS = 1500L;

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

  public static String authLoadingMessage(boolean createAccount) {
    return createAccount ? "Creating account..." : "Signing in...";
  }

  public static String authErrorMessage(int httpCode, String apiError) {
    if (httpCode == 401 || httpCode == 403) return "Wrong email or account password.";
    if (httpCode == 409) return "Account already exists.";
    if (httpCode >= 500) return "Server unavailable. Try again later.";
    if (!isBlank(apiError)) return apiError.trim();
    return "Request failed. Try again.";
  }

  public static String networkErrorMessage(String detail) {
    return "Server unavailable. Check connection or server URL.";
  }

  public static long remainingLoadingDelayMs(long startedAtMs, long nowMs) {
    long elapsed = nowMs - startedAtMs;
    return elapsed >= MIN_AUTH_LOADING_MS ? 0L : MIN_AUTH_LOADING_MS - elapsed;
  }

  public static String syncStatusMessage(int encryptedRecordCount) {
    if (encryptedRecordCount == 0) {
      return "No vault items yet. Add a login on web or import, then sync again.";
    }
    return "Sync complete: " + encryptedRecordCount + " encrypted record" + (encryptedRecordCount == 1 ? "" : "s") + " pulled from server.";
  }

  public static String sessionStoragePolicyMessage() {
    return "Session tokens are kept in memory only; sign in again after app restart.";
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
