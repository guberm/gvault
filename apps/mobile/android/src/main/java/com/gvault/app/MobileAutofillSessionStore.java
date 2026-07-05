package com.gvault.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

public final class MobileAutofillSessionStore {
  private static final String PREFS = "gvault_autofill_session";
  private static final String KEY_ENTRIES = "serverBackedLoginEntries";

  private MobileAutofillSessionStore() {}

  public static void save(Context context, String[] itemJsons) {
    MobileAutofillVault.LoginEntry[] entries = MobileAutofillVault.loginEntriesFromServerBackedItems(itemJsons);
    prefs(context).edit().putString(KEY_ENTRIES, MobileAutofillVault.serializeLoginEntries(entries)).apply();
    Log.i("GVaultAutofill", "saved session entries=" + entries.length);
  }

  public static MobileAutofillVault.LoginEntry[] load(Context context) {
    MobileAutofillVault.LoginEntry[] entries = MobileAutofillVault.deserializeLoginEntries(prefs(context).getString(KEY_ENTRIES, ""));
    Log.i("GVaultAutofill", "loaded session entries=" + entries.length);
    return entries;
  }

  public static void clear(Context context) {
    prefs(context).edit().remove(KEY_ENTRIES).apply();
    Log.i("GVaultAutofill", "cleared session entries");
  }

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }
}
