package com.gvault.app;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
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
  private EditText editTitle;
  private EditText editUrl;
  private EditText editUsername;
  private EditText editPassword;
  private EditText editNotes;
  private Button saveLoginButton;
  private String[] currentItemJsons = new String[0];
  private int[] currentItemRevisions = new int[0];
  private int selectedItemIndex = -1;
  private String token = "";
  private String email = "";
  private String masterPassword = "";
  private String serverUrl = MobileAuthState.DEFAULT_SERVER_URL;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    prefs = getSharedPreferences("gvault", MODE_PRIVATE);
    serverUrl = prefs.getString("serverUrl", MobileAuthState.DEFAULT_SERVER_URL);
    showAccountScreen();
  }

  private void showAccountScreen() {
    root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(40, 48, 40, 40);
    root.setBackgroundColor(Color.rgb(244, 247, 249));

    TextView title = title("GVault");
    TextView subtitle = body("Sign in or create an account to use your server-backed encrypted vault.");
    subtitle.setGravity(Gravity.CENTER);
    subtitle.setPadding(0, 8, 0, 24);

    final EditText server = field("Server URL", false);
    server.setText(serverUrl);
    server.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);

    final EditText emailField = field("Email", false);
    emailField.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);

    final EditText accountPassword = field("Account password", true);
    final EditText masterPassword = field("Master password", true);
    final EditText confirmMaster = field("Confirm master password (create account)", true);

    final Button signIn = actionButton("Sign in");
    final Button createAccount = secondaryButton("Create account");
    signIn.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        submitAuth(false, server, emailField, accountPassword, masterPassword, confirmMaster, signIn, createAccount);
      }
    });

    createAccount.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        submitAuth(true, server, emailField, accountPassword, masterPassword, confirmMaster, signIn, createAccount);
      }
    });

    status = body("Ready. Registration is available from this screen.\n" + MobileAuthState.sessionStoragePolicyMessage());
    status.setPadding(0, 18, 0, 0);

    root.addView(title, fullWidth());
    root.addView(subtitle, fullWidth());
    root.addView(server, spaced());
    root.addView(emailField, spaced());
    root.addView(accountPassword, spaced());
    root.addView(masterPassword, spaced());
    root.addView(confirmMaster, spaced());
    root.addView(signIn, spaced());
    root.addView(createAccount, spaced());
    root.addView(status, fullWidth());
    setScrollable(root);
  }

  private void submitAuth(boolean create, EditText server, EditText emailField, EditText accountPassword, EditText masterPassword, EditText confirmMaster, final Button signIn, final Button createAccount) {
    final String nextServerUrl = server.getText().toString().trim();
    final String nextEmail = emailField.getText().toString().trim();
    final String accountSecret = accountPassword.getText().toString();
    final String masterSecret = masterPassword.getText().toString();
    final String confirmSecret = confirmMaster.getText().toString();
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
          MainActivity.this.masterPassword = masterSecret;
          prefs.edit().putString("serverUrl", serverUrl).putString("email", email).apply();
          finishAuthAfterLoading(authStartedAt, new Runnable() { @Override public void run() {
            showVaultScreen("Server session established.");
            syncPull();
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

  private void showVaultScreen(String message) {
    root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(40, 48, 40, 40);
    root.setBackgroundColor(Color.rgb(244, 247, 249));
    root.addView(title("GVault"), fullWidth());
    TextView account = body("Signed in as " + email + "\nServer: " + serverUrl);
    account.setPadding(0, 12, 0, 20);
    root.addView(account, fullWidth());

    status = card("Vault", message + "\nSyncing server-backed encrypted records...");
    root.addView(status, fullWidth());

    itemList = new LinearLayout(this);
    itemList.setOrientation(LinearLayout.VERTICAL);
    itemList.setPadding(0, 12, 0, 8);
    root.addView(itemList, fullWidth());
    itemDetail = card("Item detail", "Select a vault item to view details.");
    root.addView(itemDetail, spaced());
    renderVaultList(new String[0], new String[0], new int[0], MobileAuthState.syncStatusMessage(0));

    TextView addLoginTitle = body("Add Login");
    addLoginTitle.setTypeface(null, 1);
    addLoginTitle.setPadding(0, 18, 0, 0);
    root.addView(addLoginTitle, fullWidth());
    editTitle = field("Login title", false);
    editUrl = field("URL", false);
    editUrl.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    editUsername = field("Username", false);
    editUsername.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    editPassword = field("Password", true);
    editNotes = field("Notes", false);
    root.addView(editTitle, spaced());
    root.addView(editUrl, spaced());
    root.addView(editUsername, spaced());
    root.addView(editPassword, spaced());
    root.addView(editNotes, spaced());
    saveLoginButton = actionButton("Save Login");
    saveLoginButton.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { submitSaveLogin(); }
    });
    root.addView(saveLoginButton, spaced());

    Button sync = actionButton("Sync now");
    sync.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) { syncPull(); }
    });
    root.addView(sync, spaced());

    Button signOut = secondaryButton("Sign out");
    signOut.setOnClickListener(new View.OnClickListener() {
      @Override public void onClick(View view) {
        token = "";
        email = "";
        masterPassword = "";
        showAccountScreen();
      }
    });
    root.addView(signOut, spaced());
    setScrollable(root);
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

  private void syncPull() {
    if (token.isEmpty()) return;
    setStatusOnMain("Syncing server-backed encrypted records...", false);
    new Thread(new Runnable() {
      @Override public void run() {
        try {
          JSONObject response = postJson(MobileAuthState.endpoint(serverUrl, "/api/sync/pull"), new JSONObject(), token);
          JSONArray records = response.optJSONArray("records");
          int count = records == null ? 0 : records.length();
          final String[] lines = new String[count];
          final String[] itemJsons = new String[count];
          final int[] revisions = new int[count];
          for (int index = 0; index < count; index++) {
            JSONObject record = records.getJSONObject(index);
            revisions[index] = record.optInt("revision", 1);
            try {
              String itemJson = MobileVaultItem.decryptItemJson(record.optString("ciphertext"), record.optString("nonce"), record.optString("salt"), masterPassword);
              itemJsons[index] = itemJson;
              lines[index] = MobileVaultItem.listLineFromItemJson(itemJson);
            } catch (Exception decryptError) {
              itemJsons[index] = "";
              lines[index] = "Encrypted item could not be decrypted";
            }
          }
          runOnMain(new Runnable() { @Override public void run() {
            renderVaultList(lines, itemJsons, revisions, MobileVaultItem.itemListStatus(lines.length));
          } });
        } catch (Exception error) {
          setStatusOnMain(friendlyError(error), true);
        }
      }
    }).start();
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
    if (editNotes != null) editNotes.setText(MobileVaultItem.stringFieldFromItemJson(itemJson, "notes"));
    if (saveLoginButton != null) saveLoginButton.setText("Update Login");
  }

  private void clearLoginForm() {
    if (editTitle != null) editTitle.setText("");
    if (editUrl != null) editUrl.setText("");
    if (editUsername != null) editUsername.setText("");
    if (editPassword != null) editPassword.setText("");
    if (editNotes != null) editNotes.setText("");
    if (saveLoginButton != null) saveLoginButton.setText("Save Login");
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
    status.setTextColor(warning ? Color.rgb(185, 28, 28) : Color.rgb(16, 32, 39));
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
    ScrollView scroll = new ScrollView(this);
    scroll.addView(content);
    setContentView(scroll);
  }

  private TextView title(String text) {
    TextView view = new TextView(this);
    view.setText(text);
    view.setTextSize(30);
    view.setTextColor(Color.rgb(16, 32, 39));
    view.setTypeface(null, 1);
    view.setGravity(Gravity.CENTER);
    return view;
  }

  private TextView body(String text) {
    TextView view = new TextView(this);
    view.setText(text);
    view.setTextSize(16);
    view.setTextColor(Color.rgb(76, 91, 99));
    return view;
  }

  private TextView card(String label, String detail) {
    TextView view = body(label + "\n" + detail);
    view.setTextColor(Color.rgb(16, 32, 39));
    view.setBackgroundColor(Color.WHITE);
    view.setPadding(28, 24, 28, 24);
    return view;
  }

  private EditText field(String hint, boolean secret) {
    EditText field = new EditText(this);
    field.setHint(hint);
    field.setSingleLine(true);
    field.setTextSize(16);
    field.setInputType(secret ? (InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD) : (InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS));
    return field;
  }

  private Button actionButton(String text) {
    Button button = new Button(this);
    button.setText(text);
    button.setAllCaps(false);
    button.setTextColor(Color.WHITE);
    button.setBackgroundColor(Color.rgb(15, 118, 110));
    return button;
  }

  private Button secondaryButton(String text) {
    Button button = new Button(this);
    button.setText(text);
    button.setAllCaps(false);
    button.setTextColor(Color.rgb(16, 32, 39));
    button.setBackgroundColor(Color.WHITE);
    return button;
  }

  private static LinearLayout.LayoutParams fullWidth() {
    return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
  }

  private static LinearLayout.LayoutParams spaced() {
    LinearLayout.LayoutParams params = fullWidth();
    params.setMargins(0, 12, 0, 0);
    return params;
  }
}
