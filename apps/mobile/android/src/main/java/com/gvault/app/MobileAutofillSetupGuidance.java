package com.gvault.app;

/**
 * Copy and state for guiding the user through enabling GVault as the system
 * Autofill service. Pure logic so it can be unit-tested without the Android
 * framework; MainActivity feeds it real AutofillManager state.
 */
public final class MobileAutofillSetupGuidance {
  private MobileAutofillSetupGuidance() {}

  /** True when the device supports Autofill but GVault is not the enabled service yet. */
  public static boolean shouldShowEnableButton(boolean autofillSupported, boolean gvaultEnabled) {
    return autofillSupported && !gvaultEnabled;
  }

  /**
   * True when the active system Autofill service belongs to this app. activeComponent is the
   * raw Settings.Secure "autofill_service" value (e.g. "com.gvault.app/com.gvault.app.GVaultAutofillService");
   * we compare only its package half so any GVault service component counts. This is the
   * authoritative signal — AutofillManager.hasEnabledAutofillServices() can lag the secure setting.
   */
  public static boolean isActiveAutofillService(String activeComponent, String packageName) {
    if (activeComponent == null || packageName == null || packageName.isEmpty()) return false;
    int slash = activeComponent.indexOf('/');
    String pkg = slash >= 0 ? activeComponent.substring(0, slash) : activeComponent;
    return pkg.equals(packageName);
  }

  public static String setupTitle() {
    return "Autofill setup";
  }

  public static String setupStatusMessage(boolean autofillSupported, boolean gvaultEnabled) {
    if (!autofillSupported) {
      return "Autofill is not available on this device (requires Android 8.0 or newer).";
    }
    if (gvaultEnabled) {
      return "GVault is your Autofill service. Tap a login field in any app and choose GVault to fill.";
    }
    return "GVault is not your Autofill service yet. Tap Enable Autofill, pick GVault, then return here.";
  }

  public static String setupButtonLabel() {
    return "Enable Autofill";
  }
}
