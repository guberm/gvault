package com.gvault.app;

public final class MobileAutofillLoginDetection {
  private MobileAutofillLoginDetection() {}

  public static boolean isLoginForm(boolean hasUsernameField, boolean hasEmailField, boolean hasPasswordField) {
    return hasPasswordField && (hasUsernameField || hasEmailField);
  }

  public static String preferredLoginIdentifier(String usernameCategory, String emailCategory) {
    if (usernameCategory != null && !usernameCategory.isEmpty()) return usernameCategory;
    if (emailCategory != null && !emailCategory.isEmpty()) return emailCategory;
    return "";
  }
}
