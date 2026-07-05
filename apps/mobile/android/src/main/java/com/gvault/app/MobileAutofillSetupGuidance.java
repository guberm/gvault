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
