package com.gvault.app;

public final class MobileAuthState {
  public static final String DEFAULT_SERVER_URL = "https://gvault.guber.dev";
  public static final long MIN_AUTH_LOADING_MS = 1500L;
  public static final long MIN_VAULT_LOADING_MS = 2500L;
  public static final int MIN_MASTER_PASSWORD_LENGTH = 12;

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
    if (createAccount) {
      String masterValidation = validateMasterPassword(masterPassword);
      if (!masterValidation.isEmpty()) return masterValidation;
      if (!masterPassword.equals(confirmMasterPassword == null ? "" : confirmMasterPassword)) {
        return "Confirm master password does not match.";
      }
    }
    return "";
  }

  public static String validateMasterPassword(String masterPassword) {
    if (isBlank(masterPassword)) return "Master password is required.";
    if (masterPassword.length() < MIN_MASTER_PASSWORD_LENGTH) return "Master password must be at least 12 characters.";
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

  public static long remainingVaultLoadingDelayMs(long startedAtMs, long nowMs) {
    long elapsed = nowMs - startedAtMs;
    return elapsed >= MIN_VAULT_LOADING_MS ? 0L : MIN_VAULT_LOADING_MS - elapsed;
  }

  public static String syncStatusMessage(int encryptedRecordCount) {
    if (encryptedRecordCount == 0) {
      return "No vault items yet. Add a login on web or import, then sync again.";
    }
    return "Sync complete: " + encryptedRecordCount + " encrypted record" + (encryptedRecordCount == 1 ? "" : "s") + " pulled from server.";
  }

  public static String refreshLoadingMessage() {
    return "Refreshing vault from server...";
  }

  public static String vaultLoadingMessage() {
    return "Loading vault\nDecrypting server-backed encrypted records...";
  }

  public static String copyStatusMessage(String field) {
    String normalized = field == null ? "" : field.trim().toLowerCase();
    if ("password".equals(normalized)) return "Password copied to clipboard.";
    if ("username".equals(normalized)) return "Username copied to clipboard.";
    return "Copied to clipboard.";
  }

  public static String passwordRevealButtonLabel(boolean revealed) {
    return revealed ? "Hide password" : "Reveal password";
  }

  public static String passwordRevealStatus(boolean revealed) {
    return revealed ? "Password revealed." : "Password hidden.";
  }

  public static String settingsTitle() {
    return "Settings";
  }

  public static String settingsAccountLine(String email) {
    return "Account: " + (isBlank(email) ? "Not signed in" : email.trim());
  }

  public static String settingsServerLine(String serverUrl) {
    return "Server: " + (isBlank(serverUrl) ? DEFAULT_SERVER_URL : serverUrl.trim());
  }

  public static String deviceName(String model) {
    return isBlank(model) ? "Android device" : "Android " + model.trim();
  }

  public static String sessionExpiredMessage() {
    return "Session expired or revoked. Sign in again.";
  }

  public static String sessionStoragePolicyMessage() {
    return "Session tokens stay in memory only and expire on the server after 24 hours; sign in again after app restart.";
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
