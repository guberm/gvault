package com.gvault.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Log;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

public final class MobileAutofillSessionStore {
  private static final String PREFS = "gvault_autofill_session";
  private static final String KEY_LOGIN_ENTRIES = "serverBackedLoginEntries";
  private static final String KEY_FILL_ENTRIES = "serverBackedFillEntries";
  private static final String KEY_CIPHERTEXT = "encryptedSession";
  private static final String KEY_IV = "encryptedSessionIv";
  private static final String KEY_ALIAS = "gvault-autofill-session";
  private static volatile long unlockedUntilMs;

  private MobileAutofillSessionStore() {}

  public static void unlock(Context context) {
    clearLegacy(context);
    unlockedUntilMs = MobileAutofillSessionPolicy.unlockUntil(System.currentTimeMillis());
  }

  public static boolean hasActiveUnlock() {
    return isUnlocked();
  }

  public static void save(Context context, String[] itemJsons) {
    if (!isUnlocked()) {
      clear(context);
      return;
    }
    try {
      MobileAutofillVault.LoginEntry[] loginEntries = MobileAutofillVault.loginEntriesFromServerBackedItems(itemJsons);
      MobileAutofillVault.FillEntry[] fillEntries = MobileAutofillVault.nonLoginFillEntries();
      JSONObject payload = new JSONObject()
        .put("loginEntries", MobileAutofillVault.serializeLoginEntries(loginEntries))
        .put("fillEntries", MobileAutofillVault.serializeFillEntries(fillEntries));
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key());
      String encrypted = Base64.getEncoder().encodeToString(cipher.doFinal(payload.toString().getBytes(StandardCharsets.UTF_8)));
      prefs(context).edit()
        .remove(KEY_LOGIN_ENTRIES)
        .remove(KEY_FILL_ENTRIES)
        .putString(KEY_CIPHERTEXT, encrypted)
        .putString(KEY_IV, Base64.getEncoder().encodeToString(cipher.getIV()))
        .apply();
      Log.i("GVaultAutofill", "saved encrypted session entries=" + loginEntries.length + " nonLogin=" + fillEntries.length);
    } catch (Exception error) {
      clear(context);
      Log.e("GVaultAutofill", "unable to save encrypted Autofill session", error);
    }
  }

  public static MobileAutofillVault.LoginEntry[] load(Context context) {
    JSONObject payload = loadPayload(context);
    return MobileAutofillVault.deserializeLoginEntries(payload == null ? "" : payload.optString("loginEntries", ""));
  }

  public static MobileAutofillVault.FillEntry[] loadFillEntries(Context context) {
    JSONObject payload = loadPayload(context);
    return MobileAutofillVault.deserializeFillEntries(payload == null ? "" : payload.optString("fillEntries", ""));
  }

  public static void clear(Context context) {
    unlockedUntilMs = 0L;
    prefs(context).edit()
      .remove(KEY_LOGIN_ENTRIES)
      .remove(KEY_FILL_ENTRIES)
      .remove(KEY_CIPHERTEXT)
      .remove(KEY_IV)
      .apply();
    Log.i("GVaultAutofill", "cleared session entries");
  }

  private static JSONObject loadPayload(Context context) {
    clearLegacy(context);
    if (!isUnlocked()) {
      clear(context);
      return null;
    }
    try {
      String encrypted = prefs(context).getString(KEY_CIPHERTEXT, "");
      String iv = prefs(context).getString(KEY_IV, "");
      if (encrypted.isEmpty() || iv.isEmpty()) return null;
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.getDecoder().decode(iv)));
      byte[] plaintext = cipher.doFinal(Base64.getDecoder().decode(encrypted));
      return new JSONObject(new String(plaintext, StandardCharsets.UTF_8));
    } catch (Exception error) {
      clear(context);
      Log.e("GVaultAutofill", "unable to load encrypted Autofill session", error);
      return null;
    }
  }

  private static boolean isUnlocked() {
    return MobileAutofillSessionPolicy.isUnlocked(unlockedUntilMs, System.currentTimeMillis());
  }

  private static SecretKey key() throws Exception {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (store.containsAlias(KEY_ALIAS)) return (SecretKey) store.getKey(KEY_ALIAS, null);
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .build());
    return generator.generateKey();
  }

  private static void clearLegacy(Context context) {
    prefs(context).edit().remove(KEY_LOGIN_ENTRIES).remove(KEY_FILL_ENTRIES).apply();
  }

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }
}
