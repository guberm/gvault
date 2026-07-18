package com.gvault.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

public final class MainActivity extends Activity {
  private final Handler main = new Handler(Looper.getMainLooper());
  private SharedPreferences prefs;
  private LinearLayout root;
  private TextView status;
  private LinearLayout itemList;
  private TextView itemDetail;
  private EditText searchVault;
  private Button filterAllButton;
  private Button filterLoginsButton;
  private Button filterFavoritesButton;
  private EditText editTitle;
  private EditText editUrl;
  private EditText editUsername;
  private EditText editPassword;
  private EditText editNotes;
  private Button saveLoginButton;
  private Button deleteLoginButton;
  private Button copyUsernameButton;
  private Button copyPasswordButton;
  private Button revealPasswordButton;
  private Button generatePasswordButton;
  private String[] currentItemJsons = new String[0];
  private int[] currentItemRevisions = new int[0];
  private String[] allItemJsons = new String[0];
  private int[] allItemRevisions = new int[0];
  private String selectedTypeFilter = "all";
  private boolean favoritesOnly = false;
  private boolean vaultLoading = false;
  private boolean passwordRevealed = false;
  private int selectedItemIndex = -1;
  private String token = "";
  private String email = "";
  private String masterPassword = "";
  private String serverUrl = MobileAuthState.DEFAULT_SERVER_URL;
  private boolean settingsVisible = false;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    MobileAutofillVault.clear();
    MobileAutofillSessionStore.clear(this);
    prefs = getSharedPreferences("gvault", MODE_PRIVATE);
    serverUrl = prefs.getString("serverUrl", MobileAuthState.DEFAULT_SERVER_URL);
    getWindow().setStatusBarColor(MobileUiStyle.PRIMARY_DARK);
    showAccountScreen();
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (settingsVisible) {
      showSettingsScreen();
    }
  }

  @Override
  public void onBackPressed() {
    if (settingsVisible) {
      showVaultScreen("Settings closed.");
      renderFilteredVaultList(searchVault == null ? "" : searchVault.getText().toString());
      return;
    }
    super.onBackPressed();
  }

  private void showAccountScreen() {
    settingsVisible = false;
    root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(20), dp(24), dp(20), dp(24));
    root.setBackgroundColor(MobileUiStyle.BACKGROUND);
    root.setGravity(Gravity.CENTER_VERTICAL);

    LinearLayout authCard = new LinearLayout(this);
    authCard.setOrientation(LinearLayout.VERTICAL);
    authCard.setPadding(dp(20), dp(22), dp(20), dp(20));
    authCard.setBackground(rounded(MobileUiStyle.SURFACE, 0xFFD3E1E4, MobileUiStyle.CORNER_RADIUS_DP));
    authCard.setElevation(dp(2));

    TextView title = title("GVault");
    TextView subtitle = body("Sign in or create an account to use your server-backed encrypted vault.");
    subtitle.setGravity(Gravity.CENTER);
    subtitle.setPadding(0, dp(8), 0, dp(20));

    final EditText server = field("https://gvault.guber.dev", false);
    server.setText(serverUrl);
    server.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);

    final EditText emailField = field("name@example.com", false);
    emailField.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);

    final EditText accountPassword = field("Enter account password", true);
    final EditText masterPassword = field("Enter master password", true);
    final EditText confirmMaster = field("Repeat master password", true);

    final Button signIn = actionButton("Sign in");
    final Button createAccount = secondaryButton("Create account");

    status = body("Regular sign in uses only email and account password.\n" + MobileAuthState.sessionStoragePolicyMessage());
    status.setTextSize(14);
    status.setBackground(rounded(MobileUiStyle.SURFACE_MUTED, 0, MobileUiStyle.BUTTON_RADIUS_DP));
    status.setPadding(dp(14), dp(12), dp(14), dp(12));

    authCard.addView(title, fullWidth());
    authCard.addView(subtitle, fullWidth());
    addLabeledField(authCard, "Server URL", server);
    addLabeledField(authCard, "Email", emailField);
    addLabeledField(authCard, "Account password", accountPassword);
    final LinearLayout masterGroup = addLabeledField(authCard, "Master password", masterPassword);
    final LinearLayout confirmMasterGroup = addLabeledField(authCard, "Confirm master password", confirmMaster);
    masterGroup.setVisibility(View.GONE);
    confirmMasterGroup.setVisibility(View.GONE);
    authCard.addView(signIn, spaced());
    authCard.addView(createAccount, spaced());
    authCard.addView(status, spaced());
    final boolean[] creatingAccount = new boolean[] { false };
    signIn.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        submitAuth(false, server, emailField, accountPassword, masterPassword, confirmMaster, signIn, createAccount);
      }
    });
    createAccount.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        if (!creatingAccount[0]) {
          creatingAccount[0] = true;
          masterGroup.setVisibility(View.VISIBLE);
          confirmMasterGroup.setVisibility(View.VISIBLE);
          createAccount.setText("Finish creating account");
          setStatus("Account creation requires a new master password and confirmation.", false);
          masterPassword.requestFocus();
          return;
        }
        submitAuth(true, server, emailField, accountPassword, masterPassword, confirmMaster, signIn, createAccount);
      }
    });
    root.addView(authCard, fullWidth());
    setScrollable(root);
  }

  private void submitAuth(boolean create, EditText server, EditText emailField, EditText accountPassword, EditText masterPassword, EditText confirmMaster, final Button signIn, final Button createAccount) {
    final String nextServerUrl = server.getText().toString().trim();
    final String nextEmail = emailField.getText().toString().trim();
    final String accountSecret = accountPassword.getText().toString();
    final String masterSecret;
    final String confirmSecret;
    if (create) {
      masterSecret = masterPassword.getText().toString();
      confirmSecret = confirmMaster.getText().toString();
    } else {
      masterSecret = "";
      confirmSecret = "";
    }
    String validation = MobileAuthState.validate(nextEmail, accountSecret, masterSecret, confirmSecret, create);
    if (!validation.isEmpty()) {
      setStatus(validation, true);
      return;
    }
    serverUrl = nextServerUrl.isEmpty() ? MobileAuthState.DEFAULT_SERVER_URL : nextServerUrl;
    setAuthControlsEnabled(false, signIn, createAccount);
    setStatus(MobileAuthState.authLoadingMessage(create), false);
    final long authStartedAt = System.currentTimeMillis();
    new Thread(new Runnable() {
      @Override public void run() {
        try {
          JSONObject body = new JSONObject();
          body.put("email", nextEmail);
          body.put("password", accountSecret);
          JSONObject response = postJson(MobileAuthState.endpoint(serverUrl, create ? "/api/auth/register" : "/api/auth/login"), body, "");
          token = response.getString("token");
          email = nextEmail;
          prefs.edit().putString("serverUrl", serverUrl).putString("email", email).apply();
          finishAuthAfterLoading(authStartedAt, new Runnable() { @Override public void run() {
            if (create) {
              MainActivity.this.masterPassword = masterSecret;
              MobileAutofillSessionStore.unlock(MainActivity.this);
              showVaultScreen("Account created and vault unlocked.");
              syncPull();
            } else {
              MainActivity.this.masterPassword = "";
              MobileAutofillVault.clear();
              MobileAutofillSessionStore.clear(MainActivity.this);
              showVaultUnlockScreen();
            }
          } });
        } catch (Exception error) {
          final String message = friendlyError(error);
          finishAuthAfterLoading(authStartedAt, new Runnable() { @Override public void run() {
            setAuthControlsEnabled(true, signIn, createAccount);
            setStatus(message, true);
          } });
        }
      }
    }).start();
  }

  private void showVaultUnlockScreen() {
    settingsVisible = false;
    root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(20), dp(24), dp(20), dp(24));
    root.setBackgroundColor(MobileUiStyle.BACKGROUND);
    root.setGravity(Gravity.CENTER_VERTICAL);

    LinearLayout unlockCard = new LinearLayout(this);
    unlockCard.setOrientation(LinearLayout.VERTICAL);
    unlockCard.setPadding(dp(20), dp(22), dp(20), dp(20));
    unlockCard.setBackground(rounded(MobileUiStyle.SURFACE, 0xFFD3E1E4, MobileUiStyle.CORNER_RADIUS_DP));
    unlockCard.setElevation(dp(2));

    TextView unlockTitle = title("Unlock or restore vault");
    TextView unlockCopy = body("Account login succeeded. Enter the master password only to decrypt this vault on this device.");
    final EditText master = field("Enter master password", true);
    final Button unlock = actionButton("Unlock vault");
    final Button signOut = secondaryButton("Sign out");
    status = body("Server session established. Vault remains locked.");
    status.setTextSize(14);
    status.setBackground(rounded(MobileUiStyle.SURFACE_MUTED, 0, MobileUiStyle.BUTTON_RADIUS_DP));
    status.setPadding(dp(14), dp(12), dp(14), dp(12));

    unlock.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        String secret = master.getText().toString();
        String validation = MobileAuthState.validateMasterPassword(secret);
        if (!validation.isEmpty()) {
          setStatus(validation, true);
          return;
        }
        restoreVault(secret, master, unlock);
      }
    });
    signOut.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { signOutToAccountScreen(); }
    });

    unlockCard.addView(unlockTitle, fullWidth());
    unlockCard.addView(unlockCopy, spaced());
    addLabeledField(unlockCard, "Master password", master);
    unlockCard.addView(unlock, spaced());
    unlockCard.addView(signOut, spaced());
    unlockCard.addView(status, spaced());
    root.addView(unlockCard, fullWidth());
    setScrollable(root);
  }

  private void restoreVault(final String secret, final EditText master, final Button unlock) {
    final String restoreToken = token;
    unlock.setEnabled(false);
    setStatus("Checking master password and restoring encrypted vault...", false);
    new Thread(new Runnable() {
      @Override public void run() {
        try {
          JSONObject response = postJson(MobileAuthState.endpoint(serverUrl, "/api/sync/pull"), new JSONObject(), restoreToken);
          JSONArray records = response.optJSONArray("records");
          int total = records == null ? 0 : records.length();
          int count = 0;
          for (int index = 0; index < total; index++) {
            if (MobileVaultItem.shouldRenderRecord(records.getJSONObject(index).optBoolean("deleted", false))) count++;
          }
          final String[] itemJsons = new String[count];
          final int[] revisions = new int[count];
          int visibleIndex = 0;
          for (int index = 0; index < total; index++) {
            JSONObject record = records.getJSONObject(index);
            String itemJson;
            try {
              itemJson = MobileVaultItem.decryptItemJson(record.optString("ciphertext"), record.optString("nonce"), record.optString("salt"), secret);
            } catch (Exception decryptError) {
              throw new Exception("Master password could not decrypt this vault.");
            }
            if (!MobileVaultItem.shouldRenderRecord(record.optBoolean("deleted", false))) continue;
            revisions[visibleIndex] = record.optInt("revision", 1);
            itemJsons[visibleIndex] = itemJson;
            visibleIndex++;
          }
          runOnMain(new Runnable() { @Override public void run() {
            if (!restoreToken.equals(token)) return;
            MainActivity.this.masterPassword = secret;
            master.setText("");
            MobileAutofillSessionStore.unlock(MainActivity.this);
            showVaultScreen("Vault unlocked after account login.");
            allItemJsons = itemJsons;
            allItemRevisions = revisions;
            MobileAutofillVault.setServerBackedItems(itemJsons);
            MobileAutofillSessionStore.save(MainActivity.this, itemJsons);
            renderFilteredVaultList("");
          } });
        } catch (Exception error) {
          final String message = friendlyError(error);
          runOnMain(new Runnable() { @Override public void run() {
            if (!restoreToken.equals(token)) return;
            MainActivity.this.masterPassword = "";
            master.setText("");
            MobileAutofillVault.clear();
            MobileAutofillSessionStore.clear(MainActivity.this);
            unlock.setEnabled(true);
            setStatus(message, true);
          } });
        }
      }
    }).start();
  }

  private void showVaultScreen(String message) {
    settingsVisible = false;
    root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(20), dp(24), dp(20), dp(24));
    root.setBackgroundColor(MobileUiStyle.BACKGROUND);
    root.addView(title("GVault"), fullWidth());
    TextView account = body("Signed in as " + email + "\nServer: " + serverUrl);
    account.setPadding(0, dp(12), 0, dp(20));
    root.addView(account, fullWidth());

    status = card("Vault", message + "\nSyncing server-backed encrypted records...");
    root.addView(status, fullWidth());

    Button refreshVault = secondaryButton("Refresh vault");
    refreshVault.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        setStatus(MobileAuthState.refreshLoadingMessage(), false);
        syncPull();
      }
    });
    root.addView(refreshVault, spaced());

    Button settingsButton = secondaryButton(MobileAuthState.settingsTitle());
    settingsButton.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { showSettingsScreen(); }
    });
    root.addView(settingsButton, spaced());

    searchVault = field("Search vault", false);
    searchVault.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    searchVault.addTextChangedListener(new TextWatcher() {
      @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
      @Override public void onTextChanged(CharSequence s, int start, int before, int count) {
        renderFilteredVaultList(s == null ? "" : s.toString());
      }
      @Override public void afterTextChanged(Editable s) {}
    });
    root.addView(searchVault, spaced());
    LinearLayout typeFilters = new LinearLayout(this);
    typeFilters.setOrientation(LinearLayout.HORIZONTAL);
    filterAllButton = secondaryButton("All items");
    filterLoginsButton = secondaryButton("Logins");
    filterFavoritesButton = secondaryButton("Favorites");
    filterAllButton.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        selectedTypeFilter = "all";
        favoritesOnly = false;
        renderFilteredVaultList(searchVault == null ? "" : searchVault.getText().toString());
      }
    });
    filterLoginsButton.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        selectedTypeFilter = "login";
        favoritesOnly = false;
        renderFilteredVaultList(searchVault == null ? "" : searchVault.getText().toString());
      }
    });
    filterFavoritesButton.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        selectedTypeFilter = "all";
        favoritesOnly = true;
        renderFilteredVaultList(searchVault == null ? "" : searchVault.getText().toString());
      }
    });
    typeFilters.addView(filterAllButton, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
    typeFilters.addView(filterLoginsButton, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
    typeFilters.addView(filterFavoritesButton, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
    root.addView(typeFilters, spaced());

    itemList = new LinearLayout(this);
    itemList.setOrientation(LinearLayout.VERTICAL);
    itemList.setPadding(0, dp(12), 0, dp(8));
    root.addView(itemList, fullWidth());
    itemDetail = card("Item detail", "Select a vault item to view details.");
    root.addView(itemDetail, spaced());
    LinearLayout copyActions = new LinearLayout(this);
    copyActions.setOrientation(LinearLayout.HORIZONTAL);
    copyUsernameButton = secondaryButton("Copy username");
    copyPasswordButton = secondaryButton("Copy password");
    copyUsernameButton.setEnabled(false);
    copyPasswordButton.setEnabled(false);
    copyUsernameButton.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { copySelectedField("username"); }
    });
    copyPasswordButton.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { copySelectedField("password"); }
    });
    copyActions.addView(copyUsernameButton, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
    copyActions.addView(copyPasswordButton, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
    root.addView(copyActions, spaced());
    renderVaultLoading();

    LinearLayout editorCard = new LinearLayout(this);
    editorCard.setOrientation(LinearLayout.VERTICAL);
    editorCard.setPadding(dp(18), dp(16), dp(18), dp(18));
    editorCard.setBackground(rounded(MobileUiStyle.SURFACE, 0xFFD3E1E4, MobileUiStyle.CORNER_RADIUS_DP));
    editorCard.setElevation(dp(2));

    TextView addLoginTitle = body("Add Login");
    addLoginTitle.setTypeface(null, 1);
    addLoginTitle.setTextColor(MobileUiStyle.TEXT);
    editorCard.addView(addLoginTitle, fullWidth());
    editTitle = field("Give this Login a name", false);
    editUrl = field("https://example.com/login", false);
    editUrl.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    editUsername = field("name@example.com", false);
    editUsername.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    editPassword = field("Enter or generate a password", true);
    revealPasswordButton = secondaryButton(MobileAuthState.passwordRevealButtonLabel(false));
    revealPasswordButton.setEnabled(false);
    revealPasswordButton.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { togglePasswordReveal(); }
    });
    generatePasswordButton = secondaryButton("Generate password");
    generatePasswordButton.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { generatePasswordForEditor(); }
    });
    editNotes = field("Optional notes", false);
    addLabeledField(editorCard, "Login title", editTitle);
    addLabeledField(editorCard, "Website URL", editUrl);
    addLabeledField(editorCard, "Username", editUsername);
    addLabeledField(editorCard, "Password", editPassword);
    editorCard.addView(revealPasswordButton, spaced());
    editorCard.addView(generatePasswordButton, spaced());
    addLabeledField(editorCard, "Notes", editNotes);
    saveLoginButton = actionButton("Save Login");
    saveLoginButton.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { submitSaveLogin(); }
    });
    editorCard.addView(saveLoginButton, spaced());
    deleteLoginButton = secondaryButton("Delete Login");
    deleteLoginButton.setEnabled(false);
    deleteLoginButton.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { submitDeleteSelectedLogin(); }
    });
    editorCard.addView(deleteLoginButton, spaced());
    root.addView(editorCard, spaced());

    Button sync = actionButton("Sync now");
    sync.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { syncPull(); }
    });
    root.addView(sync, spaced());

    Button signOut = secondaryButton("Sign out");
    signOut.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { signOutToAccountScreen(); }
    });
    root.addView(signOut, spaced());
    setScrollable(root);
  }

  private void showSettingsScreen() {
    settingsVisible = true;
    root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(20), dp(24), dp(20), dp(24));
    root.setBackgroundColor(MobileUiStyle.BACKGROUND);
    root.addView(title("GVault " + MobileAuthState.settingsTitle()), fullWidth());
    root.addView(card(MobileAuthState.settingsTitle(), MobileAuthState.settingsAccountLine(email) + "\n" + MobileAuthState.settingsServerLine(serverUrl) + "\n" + MobileAuthState.sessionStoragePolicyMessage()), fullWidth());

    boolean autofillSupported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
    boolean gvaultEnabled = false;
    if (autofillSupported) {
      String activeComponent = Settings.Secure.getString(getContentResolver(), "autofill_service");
      gvaultEnabled = MobileAutofillSetupGuidance.isActiveAutofillService(activeComponent, getPackageName());
    }
    root.addView(card(MobileAutofillSetupGuidance.setupTitle(),
        MobileAutofillSetupGuidance.setupStatusMessage(autofillSupported, gvaultEnabled)), fullWidth());
    if (MobileAutofillSetupGuidance.shouldShowEnableButton(autofillSupported, gvaultEnabled)) {
      Button enableAutofill = actionButton(MobileAutofillSetupGuidance.setupButtonLabel());
      enableAutofill.setOnClickListener(new View.OnClickListener() {
        @Override public void onClick(View view) { openAutofillSettings(); }
      });
      root.addView(enableAutofill, spaced());
    }

    Button back = actionButton("Back to vault");
    back.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        showVaultScreen("Settings closed.");
        renderFilteredVaultList(searchVault == null ? "" : searchVault.getText().toString());
      }
    });
    root.addView(back, spaced());
    Button signOut = secondaryButton("Sign out");
    signOut.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { signOutToAccountScreen(); }
    });
    root.addView(signOut, spaced());
    setScrollable(root);
  }

  private void openAutofillSettings() {
    // ponytail: two-step fallback covers OEMs that reject the targeted request intent.
    try {
      Intent intent = new Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE);
      intent.setData(Uri.parse("package:" + getPackageName()));
      startActivity(intent);
    } catch (Exception error) {
      try {
        startActivity(new Intent(Settings.ACTION_SETTINGS));
      } catch (Exception fallbackError) {
        setStatus("Open Settings and set GVault as your Autofill service manually.", true);
      }
    }
  }

  private void signOutToAccountScreen() {
    token = "";
    email = "";
    masterPassword = "";
    MobileAutofillVault.clear();
    MobileAutofillSessionStore.clear(this);
    showAccountScreen();
  }

  private void generatePasswordForEditor() {
    if (editPassword == null) return;
    String generated = MobileVaultItem.generateStrongPassword(20);
    editPassword.setText(generated);
    updatePasswordReveal(true, false);
    setStatus(MobileVaultItem.passwordStrengthLabel(generated) + " password generated.", false);
  }

  private void submitSaveLogin() {
    if (token.isEmpty()) return;
    final String title = editTitle == null ? "" : editTitle.getText().toString().trim();
    if (title.isEmpty()) {
      setStatus("Login title is required.", true);
      return;
    }
    final String url = editUrl == null ? "" : editUrl.getText().toString().trim();
    final String username = editUsername == null ? "" : editUsername.getText().toString().trim();
    final String password = editPassword == null ? "" : editPassword.getText().toString();
    final String notes = editNotes == null ? "" : editNotes.getText().toString();
    final int editIndex = selectedItemIndex;
    final boolean editing = editIndex >= 0 && editIndex < currentItemJsons.length && !currentItemJsons[editIndex].isEmpty();
    setStatus(editing ? "Updating encrypted login on server..." : "Saving encrypted login to server...", false);
    new Thread(new Runnable() {
      @Override public void run() {
        try {
          String id = editing
            ? MobileVaultItem.stringFieldFromItemJson(currentItemJsons[editIndex], "id")
            : "android-login-" + System.currentTimeMillis();
          int nextRevision = MobileVaultItem.nextRevision(editing && editIndex < currentItemRevisions.length ? currentItemRevisions[editIndex] : 0, editing);
          String itemJson = editing
            ? MobileVaultItem.updateLoginItemJson(currentItemJsons[editIndex], title, url, username, password, notes)
            : MobileVaultItem.loginItemJson(id, title, url, username, password, notes);
          String[] encrypted = MobileVaultItem.encryptItemJson(itemJson, masterPassword);
          JSONObject record = new JSONObject();
          record.put("id", id);
          record.put("deviceId", "android-app");
          record.put("collection", "vault-items");
          record.put("ciphertext", encrypted[0]);
          record.put("nonce", encrypted[1]);
          record.put("salt", encrypted[2]);
          record.put("schemaVersion", 1);
          record.put("deleted", false);
          record.put("updatedAt", isoNow());
          record.put("revision", nextRevision);
          JSONArray records = new JSONArray();
          records.put(record);
          JSONObject body = new JSONObject();
          body.put("deviceId", "android-app");
          body.put("records", records);
          postJson(MobileAuthState.endpoint(serverUrl, "/api/sync/push"), body, token);
          runOnMain(new Runnable() { @Override public void run() {
            selectedItemIndex = -1;
            clearLoginForm();
            setStatus(editing ? "Login updated. Syncing list..." : "Login saved. Syncing list...", false);
            syncPull();
          } });
        } catch (Exception error) {
          setStatusOnMain(friendlyError(error), true);
        }
      }
    }).start();
  }

  private static String isoNow() {
    java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
    format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
    return format.format(new java.util.Date());
  }

  private void submitDeleteSelectedLogin() {
    if (token.isEmpty() || selectedItemIndex < 0 || selectedItemIndex >= currentItemJsons.length || currentItemJsons[selectedItemIndex].isEmpty()) return;
    final int deleteIndex = selectedItemIndex;
    setStatus("Deleting encrypted login from server...", false);
    new Thread(new Runnable() {
      @Override public void run() {
        try {
          String id = MobileVaultItem.stringFieldFromItemJson(currentItemJsons[deleteIndex], "id");
          String[] encrypted = MobileVaultItem.encryptItemJson(currentItemJsons[deleteIndex], masterPassword);
          JSONObject record = new JSONObject();
          record.put("id", id);
          record.put("deviceId", "android-app");
          record.put("collection", "vault-items");
          record.put("ciphertext", encrypted[0]);
          record.put("nonce", encrypted[1]);
          record.put("salt", encrypted[2]);
          record.put("schemaVersion", 1);
          record.put("deleted", true);
          record.put("updatedAt", isoNow());
          record.put("revision", MobileVaultItem.nextRevision(deleteIndex < currentItemRevisions.length ? currentItemRevisions[deleteIndex] : 0, true));
          JSONArray records = new JSONArray();
          records.put(record);
          JSONObject body = new JSONObject();
          body.put("deviceId", "android-app");
          body.put("records", records);
          postJson(MobileAuthState.endpoint(serverUrl, "/api/sync/push"), body, token);
          runOnMain(new Runnable() { @Override public void run() {
            selectedItemIndex = -1;
            clearLoginForm();
            if (itemDetail != null) itemDetail.setText("Item detail\nSelect a vault item to view details.");
            setStatus("Login deleted. Syncing list...", false);
            syncPull();
          } });
        } catch (Exception error) {
          setStatusOnMain(friendlyError(error), true);
        }
      }
    }).start();
  }

  private void syncPull() {
    if (token.isEmpty()) return;
    final long syncStartedAtMs = System.currentTimeMillis();
    runOnMain(new Runnable() { @Override public void run() { renderVaultLoading(); } });
    new Thread(new Runnable() {
      @Override public void run() {
        try {
          JSONObject response = postJson(MobileAuthState.endpoint(serverUrl, "/api/sync/pull"), new JSONObject(), token);
          JSONArray records = response.optJSONArray("records");
          int total = records == null ? 0 : records.length();
          int count = 0;
          for (int index = 0; index < total; index++) {
            if (MobileVaultItem.shouldRenderRecord(records.getJSONObject(index).optBoolean("deleted", false))) count++;
          }
          final String[] lines = new String[count];
          final String[] itemJsons = new String[count];
          final int[] revisions = new int[count];
          int visibleIndex = 0;
          for (int index = 0; index < total; index++) {
            JSONObject record = records.getJSONObject(index);
            if (!MobileVaultItem.shouldRenderRecord(record.optBoolean("deleted", false))) continue;
            revisions[visibleIndex] = record.optInt("revision", 1);
            try {
              String itemJson = MobileVaultItem.decryptItemJson(record.optString("ciphertext"), record.optString("nonce"), record.optString("salt"), masterPassword);
              itemJsons[visibleIndex] = itemJson;
              lines[visibleIndex] = MobileVaultItem.listLineFromItemJson(itemJson);
            } catch (Exception decryptError) {
              itemJsons[visibleIndex] = "";
              lines[visibleIndex] = "Encrypted item could not be decrypted";
            }
            visibleIndex++;
          }
          runOnMain(new Runnable() { @Override public void run() {
            allItemJsons = itemJsons;
            allItemRevisions = revisions;
            MobileAutofillVault.setServerBackedItems(itemJsons);
            MobileAutofillSessionStore.save(MainActivity.this, itemJsons);
            long delayMs = MobileAuthState.remainingVaultLoadingDelayMs(syncStartedAtMs, System.currentTimeMillis());
            main.postDelayed(new Runnable() { @Override public void run() {
              renderFilteredVaultList(searchVault == null ? "" : searchVault.getText().toString());
            } }, delayMs);
          } });
        } catch (Exception error) {
          setStatusOnMain(friendlyError(error), true);
        }
      }
    }).start();
  }

  private void renderFilteredVaultList(String query) {
    vaultLoading = false;
    int count = 0;
    for (int index = 0; index < allItemJsons.length; index++) {
      if (MobileVaultItem.matchesType(allItemJsons[index], selectedTypeFilter) && MobileVaultItem.matchesFavorite(allItemJsons[index], favoritesOnly) && MobileVaultItem.matchesQuery(allItemJsons[index], query)) count++;
    }
    String[] lines = new String[count];
    String[] itemJsons = new String[count];
    int[] revisions = new int[count];
    int visibleIndex = 0;
    for (int index = 0; index < allItemJsons.length; index++) {
      if (!MobileVaultItem.matchesType(allItemJsons[index], selectedTypeFilter) || !MobileVaultItem.matchesFavorite(allItemJsons[index], favoritesOnly) || !MobileVaultItem.matchesQuery(allItemJsons[index], query)) continue;
      itemJsons[visibleIndex] = allItemJsons[index];
      revisions[visibleIndex] = index < allItemRevisions.length ? allItemRevisions[index] : 1;
      lines[visibleIndex] = MobileVaultItem.listLineFromItemJson(allItemJsons[index]);
      visibleIndex++;
    }
    String trimmed = query == null ? "" : query.trim();
    boolean typeFiltered = !"all".equals(selectedTypeFilter) || favoritesOnly;
    String summary = trimmed.isEmpty() && !typeFiltered
      ? MobileVaultItem.itemListStatus(allItemJsons.length)
      : (count == 0 ? "No matching vault items." : count + " matching item" + (count == 1 ? "" : "s"));
    renderVaultList(lines, itemJsons, revisions, summary);
  }

  private void renderVaultLoading() {
    vaultLoading = true;
    currentItemJsons = new String[0];
    currentItemRevisions = new int[0];
    selectedItemIndex = -1;
    setStatus(MobileAuthState.vaultLoadingMessage(), false);
    if (itemList == null) return;
    itemList.removeAllViews();
    TextView header = body("Items");
    header.setTypeface(null, 1);
    itemList.addView(header, fullWidth());
    itemList.addView(card("Loading vault", "Decrypting server-backed encrypted records..."), spaced());
    if (itemDetail != null) itemDetail.setText("Item detail\nSelect a vault item to view details.");
    clearLoginForm();
  }

  private void renderVaultList(String[] lines, String[] itemJsons, int[] revisions, String summary) {
    currentItemJsons = itemJsons;
    currentItemRevisions = revisions;
    selectedItemIndex = -1;
    setStatus(summary, false);
    if (itemList == null) return;
    itemList.removeAllViews();
    TextView header = body("Items");
    header.setTypeface(null, 1);
    itemList.addView(header, fullWidth());
    if (lines.length == 0) {
      itemList.addView(card("Empty vault", MobileAuthState.syncStatusMessage(0)), spaced());
      if (itemDetail != null) itemDetail.setText("Item detail\nSelect a vault item to view details.");
      clearLoginForm();
      return;
    }
    for (int index = 0; index < lines.length; index++) {
      final int selectedIndex = index;
      Button row = secondaryButton(lines[index]);
      row.setOnClickListener(new View.OnClickListener() {
        @Override public void onClick(View view) { showItemDetail(selectedIndex); }
      });
      itemList.addView(row, spaced());
    }
    if (itemDetail != null) itemDetail.setText("Item detail\nSelect a vault item to view details.");
    clearLoginForm();
  }

  private void showItemDetail(int index) {
    if (itemDetail == null || index < 0 || index >= currentItemJsons.length || currentItemJsons[index].isEmpty()) return;
    selectedItemIndex = index;
    String itemJson = currentItemJsons[index];
    itemDetail.setText("Item detail\n" + MobileVaultItem.detailTextFromItemJson(itemJson));
    if (editTitle != null) editTitle.setText(MobileVaultItem.stringFieldFromItemJson(itemJson, "title"));
    if (editUrl != null) editUrl.setText(MobileVaultItem.stringFieldFromItemJson(itemJson, "url"));
    if (editUsername != null) editUsername.setText(MobileVaultItem.stringFieldFromItemJson(itemJson, "username"));
    if (editPassword != null) editPassword.setText(MobileVaultItem.stringFieldFromItemJson(itemJson, "password"));
    updatePasswordReveal(false, false);
    if (editNotes != null) editNotes.setText(MobileVaultItem.stringFieldFromItemJson(itemJson, "notes"));
    if (saveLoginButton != null) saveLoginButton.setText("Update Login");
    if (deleteLoginButton != null) deleteLoginButton.setEnabled(true);
    if (copyUsernameButton != null) copyUsernameButton.setEnabled(true);
    if (copyPasswordButton != null) copyPasswordButton.setEnabled(true);
    if (revealPasswordButton != null) revealPasswordButton.setEnabled(true);
  }

  private void togglePasswordReveal() {
    updatePasswordReveal(!passwordRevealed, true);
  }

  private void updatePasswordReveal(boolean revealed, boolean announce) {
    passwordRevealed = revealed;
    if (editPassword != null) {
      int inputType = InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS |
        (revealed ? InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD : InputType.TYPE_TEXT_VARIATION_PASSWORD);
      editPassword.setInputType(inputType);
      editPassword.setSelection(editPassword.getText().length());
    }
    if (revealPasswordButton != null) revealPasswordButton.setText(MobileAuthState.passwordRevealButtonLabel(revealed));
    if (announce) setStatus(MobileAuthState.passwordRevealStatus(revealed), false);
  }

  private void copySelectedField(String field) {
    if (selectedItemIndex < 0 || selectedItemIndex >= currentItemJsons.length || currentItemJsons[selectedItemIndex].isEmpty()) return;
    String value = MobileVaultItem.stringFieldFromItemJson(currentItemJsons[selectedItemIndex], field);
    if (value == null || value.isEmpty()) {
      setStatus("No " + field + " saved for selected item.", true);
      return;
    }
    ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
    if (clipboard != null) {
      clipboard.setPrimaryClip(ClipData.newPlainText("GVault " + field, value));
    }
    setStatus(MobileAuthState.copyStatusMessage(field), false);
  }

  private void clearLoginForm() {
    if (editTitle != null) editTitle.setText("");
    if (editUrl != null) editUrl.setText("");
    if (editUsername != null) editUsername.setText("");
    if (editPassword != null) editPassword.setText("");
    if (editNotes != null) editNotes.setText("");
    if (saveLoginButton != null) saveLoginButton.setText("Save Login");
    if (deleteLoginButton != null) deleteLoginButton.setEnabled(false);
    if (copyUsernameButton != null) copyUsernameButton.setEnabled(false);
    if (copyPasswordButton != null) copyPasswordButton.setEnabled(false);
    if (revealPasswordButton != null) revealPasswordButton.setEnabled(false);
    updatePasswordReveal(false, false);
  }

  private JSONObject postJson(String target, JSONObject body, String bearerToken) throws Exception {
    HttpURLConnection connection = (HttpURLConnection) new URL(target).openConnection();
    connection.setRequestMethod("POST");
    connection.setConnectTimeout(15000);
    connection.setReadTimeout(15000);
    connection.setRequestProperty("content-type", "application/json; charset=utf-8");
    if (bearerToken != null && !bearerToken.isEmpty()) {
      connection.setRequestProperty("authorization", "Bearer " + bearerToken);
    }
    connection.setDoOutput(true);
    byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
    try (OutputStream out = connection.getOutputStream()) {
      out.write(payload);
    }
    int code = connection.getResponseCode();
    String raw = readAll(code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream());
    JSONObject parsed = raw.isEmpty() ? new JSONObject() : new JSONObject(raw);
    if (code < 200 || code >= 300) {
      throw new Exception(MobileAuthState.authErrorMessage(code, parsed.optString("error", "HTTP " + code)));
    }
    return parsed;
  }

  private static String friendlyError(Exception error) {
    if (error instanceof java.io.IOException) {
      return MobileAuthState.networkErrorMessage(error.getMessage());
    }
    String message = error.getMessage();
    return message == null || message.trim().isEmpty() ? "Request failed. Try again." : message;
  }

  private static String readAll(InputStream stream) throws Exception {
    if (stream == null) return "";
    StringBuilder builder = new StringBuilder();
    try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) builder.append(line);
    }
    return builder.toString();
  }

  private void setStatus(String text, boolean warning) {
    if (status == null) return;
    status.setText(text);
    status.setTextColor(warning ? MobileUiStyle.DANGER : MobileUiStyle.TEXT);
  }

  private static void setAuthControlsEnabled(boolean enabled, Button signIn, Button createAccount) {
    signIn.setEnabled(enabled);
    createAccount.setEnabled(enabled);
  }

  private void setStatusOnMain(final String text, final boolean warning) {
    runOnMain(new Runnable() { @Override public void run() { setStatus(text, warning); } });
  }

  private void runOnMain(Runnable runnable) {
    main.post(runnable);
  }

  private void finishAuthAfterLoading(long startedAtMs, Runnable runnable) {
    long delayMs = MobileAuthState.remainingLoadingDelayMs(startedAtMs, System.currentTimeMillis());
    main.postDelayed(runnable, delayMs);
  }

  private void setScrollable(LinearLayout content) {
    final ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    scroll.setClipToPadding(true);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      scroll.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
        @Override public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
          android.graphics.Insets systemBars = insets.getInsets(WindowInsets.Type.systemBars());
          view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
          return insets;
        }
      });
    } else {
      scroll.setFitsSystemWindows(true);
    }
    final float[] pullStartY = new float[] { -1f };
    scroll.setOnTouchListener(new View.OnTouchListener() {
      @Override public boolean onTouch(View view, MotionEvent event) {
        if (token == null || token.isEmpty()) return false;
        if (event.getAction() == MotionEvent.ACTION_DOWN && scroll.getScrollY() == 0) {
          pullStartY[0] = event.getRawY();
        } else if (event.getAction() == MotionEvent.ACTION_UP && pullStartY[0] >= 0f) {
          float pulled = event.getRawY() - pullStartY[0];
          pullStartY[0] = -1f;
          if (scroll.getScrollY() == 0 && pulled > 180f) {
            setStatus(MobileAuthState.refreshLoadingMessage(), false);
            syncPull();
          }
        } else if (event.getAction() == MotionEvent.ACTION_CANCEL) {
          pullStartY[0] = -1f;
        }
        return false;
      }
    });
    scroll.addView(content);
    setContentView(scroll);
  }

  private TextView title(String text) {
    TextView view = new TextView(this);
    view.setText(text);
    view.setTextSize(30);
    view.setTextColor(MobileUiStyle.TEXT);
    view.setTypeface(null, 1);
    view.setGravity(Gravity.CENTER);
    return view;
  }

  private TextView body(String text) {
    TextView view = new TextView(this);
    view.setText(text);
    view.setTextSize(16);
    view.setTextColor(MobileUiStyle.MUTED_TEXT);
    return view;
  }

  private TextView card(String label, String detail) {
    TextView view = body(label + "\n" + detail);
    view.setTextColor(MobileUiStyle.TEXT);
    view.setBackground(rounded(MobileUiStyle.SURFACE, 0, MobileUiStyle.CORNER_RADIUS_DP));
    view.setElevation(dp(2));
    view.setPadding(dp(20), dp(18), dp(20), dp(18));
    return view;
  }

  private EditText field(String hint, boolean secret) {
    EditText field = new EditText(this);
    field.setHint(hint);
    field.setSingleLine(true);
    field.setTextSize(16);
    field.setMinHeight(dp(48));
    field.setTextColor(MobileUiStyle.TEXT);
    field.setHintTextColor(MobileUiStyle.MUTED_TEXT);
    field.setBackground(rounded(MobileUiStyle.SURFACE, 0xFFD3E1E4, MobileUiStyle.BUTTON_RADIUS_DP));
    field.setPadding(dp(16), 0, dp(16), 0);
    field.setInputType(secret ? (InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD) : (InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS));
    return field;
  }

  private LinearLayout addLabeledField(LinearLayout parent, String labelText, EditText field) {
    LinearLayout group = new LinearLayout(this);
    group.setOrientation(LinearLayout.VERTICAL);
    TextView label = body(labelText);
    label.setTextSize(13);
    label.setTextColor(MobileUiStyle.TEXT);
    label.setTypeface(null, 1);
    label.setPadding(dp(2), 0, 0, dp(6));
    group.addView(label, fullWidth());
    group.addView(field, fullWidth());
    parent.addView(group, spaced());
    return group;
  }

  private Button actionButton(String text) {
    Button button = new Button(this);
    button.setText(text);
    button.setAllCaps(false);
    button.setTextColor(Color.WHITE);
    button.setBackground(rounded(MobileUiStyle.PRIMARY, 0, MobileUiStyle.BUTTON_RADIUS_DP));
    button.setElevation(dp(2));
    return button;
  }

  private Button secondaryButton(String text) {
    Button button = new Button(this);
    button.setText(text);
    button.setAllCaps(false);
    button.setTextColor(MobileUiStyle.TEXT);
    button.setBackground(rounded(MobileUiStyle.SURFACE, 0xFFD3E1E4, MobileUiStyle.BUTTON_RADIUS_DP));
    button.setElevation(dp(1));
    return button;
  }

  private GradientDrawable rounded(int fill, int stroke, int radiusDp) {
    GradientDrawable drawable = new GradientDrawable();
    drawable.setColor(fill);
    drawable.setCornerRadius(dp(radiusDp));
    if (stroke != 0) drawable.setStroke(dp(1), stroke);
    return drawable;
  }

  private int dp(int value) {
    return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
  }

  private static LinearLayout.LayoutParams fullWidth() {
    return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
  }

  private LinearLayout.LayoutParams spaced() {
    LinearLayout.LayoutParams params = fullWidth();
    params.setMargins(0, dp(12), 0, 0);
    return params;
  }
}
