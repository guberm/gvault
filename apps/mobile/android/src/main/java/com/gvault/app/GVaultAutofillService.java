package com.gvault.app;

import android.app.assist.AssistStructure;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.Dataset;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
import android.service.autofill.FillResponse;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveInfo;
import android.service.autofill.SaveRequest;
import android.view.View;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;
import java.util.List;

public final class GVaultAutofillService extends AutofillService {
  @Override
  public void onFillRequest(FillRequest request, CancellationSignal cancellationSignal, FillCallback callback) {
    FillFields fields = findFields(request.getFillContexts());
    if (fields.usernameId == null && fields.passwordId == null) {
      callback.onSuccess(null);
      return;
    }

    RemoteViews presentation = new RemoteViews(getPackageName(), android.R.layout.simple_list_item_1);
    presentation.setTextViewText(android.R.id.text1, "Open GVault");

    Dataset.Builder dataset = new Dataset.Builder(presentation);
    if (fields.usernameId != null) {
      dataset.setValue(fields.usernameId, AutofillValue.forText(""));
    }
    if (fields.passwordId != null) {
      dataset.setValue(fields.passwordId, AutofillValue.forText(""));
    }

    FillResponse response = new FillResponse.Builder()
      .addDataset(dataset.build())
      .setSaveInfo(new SaveInfo.Builder(SaveInfo.SAVE_DATA_TYPE_PASSWORD, fields.requiredIds()).build())
      .build();
    callback.onSuccess(response);
  }

  @Override
  public void onSaveRequest(SaveRequest request, SaveCallback callback) {
    callback.onSuccess();
  }

  private static FillFields findFields(List<FillContext> contexts) {
    FillFields fields = new FillFields();
    if (contexts == null || contexts.isEmpty()) {
      return fields;
    }
    AssistStructure structure = contexts.get(contexts.size() - 1).getStructure();
    for (int i = 0; i < structure.getWindowNodeCount(); i++) {
      scanNode(structure.getWindowNodeAt(i).getRootViewNode(), fields);
    }
    return fields;
  }

  private static void scanNode(AssistStructure.ViewNode node, FillFields fields) {
    if (node == null) {
      return;
    }
    String hint = lower(node.getHint());
    String id = lower(node.getIdEntry());
    String autofillHint = "";
    String[] hints = node.getAutofillHints();
    if (hints != null && hints.length > 0) {
      autofillHint = lower(hints[0]);
    }

    if (node.getAutofillId() != null) {
      if (fields.passwordId == null && containsAny(hint, id, autofillHint, "password", "pass")) {
        fields.passwordId = node.getAutofillId();
      } else if (fields.usernameId == null && containsAny(hint, id, autofillHint, "username", "email", "login", "user")) {
        fields.usernameId = node.getAutofillId();
      }
    }

    for (int i = 0; i < node.getChildCount(); i++) {
      scanNode(node.getChildAt(i), fields);
    }
  }

  private static boolean containsAny(String hint, String id, String autofillHint, String... needles) {
    String combined = hint + " " + id + " " + autofillHint;
    for (String needle : needles) {
      if (combined.contains(needle)) {
        return true;
      }
    }
    return false;
  }

  private static String lower(String value) {
    return value == null ? "" : value.toLowerCase();
  }

  private static final class FillFields {
    AutofillId usernameId;
    AutofillId passwordId;

    AutofillId[] requiredIds() {
      if (usernameId != null && passwordId != null) {
        return new AutofillId[] { usernameId, passwordId };
      }
      if (passwordId != null) {
        return new AutofillId[] { passwordId };
      }
      return new AutofillId[] { usernameId };
    }
  }
}
