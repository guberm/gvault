package com.gvault.app;

public final class MobileUiStyle {
  public static final String POLISH_NAME = "Material-style polish";
  public static final int PRIMARY = 0xFF0F766E;
  public static final int PRIMARY_DARK = 0xFF115E59;
  public static final int BACKGROUND = 0xFFF4F7F9;
  public static final int SURFACE = 0xFFFFFFFF;
  public static final int SURFACE_MUTED = 0xFFEAF2F2;
  public static final int TEXT = 0xFF102027;
  public static final int MUTED_TEXT = 0xFF4C5B63;
  public static final int DANGER = 0xFFB91C1C;
  public static final int CORNER_RADIUS_DP = 24;
  public static final int BUTTON_RADIUS_DP = 18;

  private MobileUiStyle() {}

  public static String polishSummary() {
    return "Rounded cards, elevated actions, and calm vault colors.";
  }
}
