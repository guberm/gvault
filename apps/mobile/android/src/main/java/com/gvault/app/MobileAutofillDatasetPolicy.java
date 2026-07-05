package com.gvault.app;

public final class MobileAutofillDatasetPolicy {
  private MobileAutofillDatasetPolicy() {}

  public static boolean shouldAttemptFillResponse(boolean hasLoginFields, int loginEntryCount, boolean hasNonLoginFields, int nonLoginEntryCount) {
    if (!hasLoginFields && !hasNonLoginFields) return false;
    if (hasLoginFields && loginEntryCount > 0) return true;
    if (hasNonLoginFields && nonLoginEntryCount > 0) return true;
    return false;
  }

  public static boolean shouldReturnFillResponse(int datasetCount) {
    return datasetCount > 0;
  }
}
