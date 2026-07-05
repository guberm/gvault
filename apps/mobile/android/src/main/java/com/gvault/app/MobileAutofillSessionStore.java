package com.gvault.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

public final class MobileAutofillSessionStore {
  private static final String PREFS = "gvault_autofill_session";
  private static final String KEY_LOGIN_ENTRIES = "serverBackedLoginEntries";
  private static final String KEY_FILL_ENTRIES = "serverBackedFillEntries";

  private MobileAutofillSessionStore() {}

  public static void save(Context context, String[] itemJsons) {
    MobileAutofillVault.LoginEntry[] loginEntries = MobileAutofillVault.loginEntriesFromServerBackedItems(itemJsons);
    MobileAutofillVault.FillEntry[] fillEntries = MobileAutofillVault.nonLoginFillEntries();
    prefs(context).edit()
      .putString(KEY_LOGIN_ENTRIES, MobileAutofillVault.serializeLoginEntries(loginEntries))
      .putString(KEY_FILL_ENTRIES, MobileAutofillVault.serializeFillEntries(fillEntries))
      .apply();
    Log.i("GVaultAutofill", "saved session entries=" + loginEntries.length + " nonLogin=" + fillEntries.length);
  }

  public static MobileAutofillVault.LoginEntry[] load(Context context) {
    MobileAutofillVault.LoginEntry[] entries = MobileAutofillVault.deserializeLoginEntries(prefs(context).getString(KEY_LOGIN_ENTRIES, ""));
    Log.i("GVaultAutofill", "loaded session entries=" + entries.length);
    return entries;
  }

  public static MobileAutofillVault.FillEntry[] loadFillEntries(Context context) {
    MobileAutofillVault.FillEntry[] entries = MobileAutofillVault.deserializeFillEntries(prefs(context).getString(KEY_FILL_ENTRIES, ""));
    Log.i("GVaultAutofill", "loaded session fill entries=" + entries.length);
    return entries;
  }

  public static void clear(Context context) {
    prefs(context).edit().remove(KEY_LOGIN_ENTRIES).remove(KEY_FILL_ENTRIES).apply();
    Log.i("GVaultAutofill", "cleared session entries");
  }

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }
}
