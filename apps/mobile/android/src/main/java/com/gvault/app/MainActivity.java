package com.gvault.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    SharedPreferences prefs = getSharedPreferences("gvault", MODE_PRIVATE);
    final boolean[] darkMode = new boolean[] { prefs.getString("theme", "light").equals("dark") };

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER_HORIZONTAL);
    root.setPadding(48, 56, 48, 48);
    root.setBackgroundColor(Color.rgb(244, 247, 249));

    TextView mark = new TextView(this);
    mark.setText("G");
    mark.setTextSize(26);
    mark.setTextColor(Color.rgb(6, 37, 33));
    mark.setGravity(Gravity.CENTER);
    mark.setTypeface(null, 1);
    mark.setBackgroundColor(Color.rgb(34, 199, 184));
    LinearLayout.LayoutParams markParams = new LinearLayout.LayoutParams(96, 96);
    root.addView(mark, markParams);

    TextView title = new TextView(this);
    title.setText("GVault");
    title.setTextSize(30);
    title.setTextColor(Color.rgb(16, 32, 39));
    title.setTypeface(null, 1);
    title.setGravity(Gravity.CENTER);
    title.setPadding(0, 22, 0, 0);
    root.addView(title, fullWidth());

    TextView subtitle = new TextView(this);
    subtitle.setText("Self-hosted password and identity vault");
    subtitle.setTextSize(16);
    subtitle.setTextColor(Color.rgb(99, 114, 122));
    subtitle.setGravity(Gravity.CENTER);
    subtitle.setPadding(0, 8, 0, 28);
    root.addView(subtitle, fullWidth());

    TextView serverCard = statusCard("Server", "http://127.0.0.1:8080", "Use your own GVault server for encrypted sync.");
    TextView vaultCard = statusCard("Vault", "Locked by default", "Native Android sync and biometric unlock are prepared for the mobile track.");
    TextView securityCard = statusCard("Security", "Client-side encryption", "The server is designed to store encrypted vault records only.");
    TextView[] cards = new TextView[] { serverCard, vaultCard, securityCard };
    root.addView(serverCard);
    root.addView(vaultCard);
    root.addView(securityCard);

    Button openWeb = new Button(this);
    openWeb.setText("Open Web Vault");
    openWeb.setAllCaps(false);
    openWeb.setTextColor(Color.WHITE);
    openWeb.setBackgroundColor(Color.rgb(15, 118, 110));
    openWeb.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("http://127.0.0.1:5173")));
      }
    });
    LinearLayout.LayoutParams buttonParams = fullWidth();
    buttonParams.setMargins(0, 28, 0, 0);
    root.addView(openWeb, buttonParams);

    Button themeButton = new Button(this);
    themeButton.setAllCaps(false);
    themeButton.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View view) {
        darkMode[0] = !darkMode[0];
        prefs.edit().putString("theme", darkMode[0] ? "dark" : "light").apply();
        applyTheme(darkMode[0], root, title, subtitle, cards, openWeb, themeButton);
      }
    });
    LinearLayout.LayoutParams themeParams = fullWidth();
    themeParams.setMargins(0, 14, 0, 0);
    root.addView(themeButton, themeParams);

    applyTheme(darkMode[0], root, title, subtitle, cards, openWeb, themeButton);
    setContentView(root);
  }

  private static LinearLayout.LayoutParams fullWidth() {
    return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
  }

  private TextView statusCard(String label, String value, String detail) {
    TextView card = new TextView(this);
    card.setText(label + "\n" + value + "\n" + detail);
    card.setTextSize(15);
    card.setTextColor(Color.rgb(16, 32, 39));
    card.setGravity(Gravity.START);
    card.setPadding(26, 22, 26, 22);
    card.setBackgroundColor(Color.WHITE);
    LinearLayout.LayoutParams params = fullWidth();
    params.setMargins(0, 0, 0, 14);
    card.setLayoutParams(params);
    return card;
  }

  private static void applyTheme(boolean dark, LinearLayout root, TextView title, TextView subtitle, TextView[] cards, Button openWeb, Button themeButton) {
    int bg = dark ? Color.rgb(7, 19, 22) : Color.rgb(244, 247, 249);
    int surface = dark ? Color.rgb(16, 32, 39) : Color.WHITE;
    int ink = dark ? Color.rgb(238, 247, 247) : Color.rgb(16, 32, 39);
    int muted = dark ? Color.rgb(173, 196, 200) : Color.rgb(99, 114, 122);
    root.setBackgroundColor(bg);
    title.setTextColor(ink);
    subtitle.setTextColor(muted);
    for (TextView card : cards) {
      card.setTextColor(ink);
      card.setBackgroundColor(surface);
    }
    openWeb.setTextColor(Color.WHITE);
    openWeb.setBackgroundColor(Color.rgb(15, 118, 110));
    themeButton.setText(dark ? "Light mode" : "Dark mode");
    themeButton.setTextColor(ink);
    themeButton.setBackgroundColor(surface);
  }
}
