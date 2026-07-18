package com.gvault.app;

public final class MobileAutofillSessionPolicy {
  public static final long SESSION_TTL_MS = 15L * 60L * 1000L;

  private MobileAutofillSessionPolicy() {}

  public static long unlockUntil(long nowMs) {
    return nowMs + SESSION_TTL_MS;
  }

  public static boolean isUnlocked(long unlockedUntilMs, long nowMs) {
    return unlockedUntilMs > 0L && nowMs < unlockedUntilMs;
  }
}
