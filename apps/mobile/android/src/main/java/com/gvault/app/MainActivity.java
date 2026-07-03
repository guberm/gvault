package com.gvault.app;

import android.app.Activity;
import android.content.Intent;
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

    root.addView(statusCard("Server", "http://127.0.0.1:8080", "Use your own GVault server for encrypted sync."));
    root.addView(statusCard("Vault", "Locked by default", "Native Android sync and biometric unlock are prepared for the mobile track."));
    root.addView(statusCard("Security", "Client-side encryption", "The server is designed to store encrypted vault records only."));

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
}
