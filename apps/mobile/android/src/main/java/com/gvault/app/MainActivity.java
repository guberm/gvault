package com.gvault.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    LinearLayout layout = new LinearLayout(this);
    layout.setOrientation(LinearLayout.VERTICAL);
    layout.setGravity(Gravity.CENTER);
    layout.setPadding(48, 48, 48, 48);

    TextView title = new TextView(this);
    title.setText("GVault");
    title.setTextSize(28);
    title.setGravity(Gravity.CENTER);

    TextView subtitle = new TextView(this);
    subtitle.setText("Self-hosted vault client preview. Connect to your GVault server from the web client while native Android sync is completed.");
    subtitle.setTextSize(16);
    subtitle.setGravity(Gravity.CENTER);
    subtitle.setPadding(0, 24, 0, 0);

    layout.addView(title);
    layout.addView(subtitle);
    setContentView(layout);
  }
}
