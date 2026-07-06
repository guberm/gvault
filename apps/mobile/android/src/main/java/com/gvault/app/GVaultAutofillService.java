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
import android.util.Log;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;
import java.util.List;

public final class GVaultAutofillService extends AutofillService {
  @Override
  public void onFillRequest(FillRequest request, CancellationSignal cancellationSignal, FillCallback callback) {
    FillFields fields = findFields(request.getFillContexts());
    String webDomain = findWebDomain(request.getFillContexts());
    MobileAutofillVault.LoginEntry[] loginEntries = MobileAutofillVault.matchingLoginEntries(webDomain);
    MobileAutofillVault.FillEntry[] nonLoginEntries = MobileAutofillVault.nonLoginFillEntries();
    if (loginEntries.length == 0 && nonLoginEntries.length == 0 && MobileAutofillVault.cachedLoginEntries().length == 0) {
      MobileAutofillVault.setLoginEntries(MobileAutofillSessionStore.load(this));
      MobileAutofillVault.setNonLoginEntries(MobileAutofillSessionStore.loadFillEntries(this));
      loginEntries = MobileAutofillVault.matchingLoginEntries(webDomain);
      nonLoginEntries = MobileAutofillVault.nonLoginFillEntries();
    }
    Log.i("GVaultAutofill", "fillRequest username=" + (fields.usernameId != null) + " email=" + (fields.emailId != null) + " password=" + (fields.passwordId != null) + " login=" + fields.hasLoginFields() + " address=" + fields.hasAddressFields() + " identity=" + fields.hasIdentityFields() + " card=" + fields.hasCardFields() + " domain=" + webDomain + " entries=" + loginEntries.length + " nonLogin=" + nonLoginEntries.length);

    if (!MobileAutofillDatasetPolicy.shouldAttemptFillResponse(
      fields.hasLoginFields(),
      loginEntries.length,
      fields.hasNonLoginFields(),
      nonLoginEntries.length
    )) {
      callback.onSuccess(null);
      return;
    }

    FillResponse.Builder response = new FillResponse.Builder();
    int datasetCount = 0;
    if (fields.hasLoginFields()) {
      for (MobileAutofillVault.LoginEntry entry : loginEntries) {
        Dataset dataset = loginDataset(entry, fields);
        if (dataset != null) {
          response.addDataset(dataset);
          datasetCount++;
        }
      }
    }
    if (fields.hasNonLoginFields()) {
      for (MobileAutofillVault.FillEntry entry : nonLoginEntries) {
        Dataset dataset = nonLoginDataset(entry, fields);
        if (dataset != null) {
          response.addDataset(dataset);
          datasetCount++;
        }
      }
    }

    if (!MobileAutofillDatasetPolicy.shouldReturnFillResponse(datasetCount)) {
      callback.onSuccess(null);
      return;
    }

    AutofillId[] requiredIds = fields.requiredIds();
    if (requiredIds.length > 0) {
      response.setSaveInfo(new SaveInfo.Builder(fields.saveDataType(), requiredIds).build());
      response.setFillDialogTriggerIds(requiredIds);
    }
    callback.onSuccess(response.build());
  }

  @Override
  public void onSaveRequest(SaveRequest request, SaveCallback callback) {
    callback.onSuccess();
  }

  private static Dataset loginDataset(MobileAutofillVault.LoginEntry entry, FillFields fields) {
    RemoteViews presentation = new RemoteViews("com.gvault.app", android.R.layout.simple_list_item_1);
    presentation.setTextViewText(android.R.id.text1, entry.label());
    Dataset.Builder dataset = new Dataset.Builder(presentation);
    boolean hasValue = false;
    AutofillId loginIdentifierId = fields.loginIdentifierId();
    if (loginIdentifierId != null && !entry.username().isEmpty()) {
      dataset.setValue(loginIdentifierId, AutofillValue.forText(entry.username()));
      hasValue = true;
    }
    if (fields.passwordId != null && !entry.password().isEmpty()) {
      dataset.setValue(fields.passwordId, AutofillValue.forText(entry.password()));
      hasValue = true;
    }
    return hasValue ? dataset.build() : null;
  }

  private static Dataset nonLoginDataset(MobileAutofillVault.FillEntry entry, FillFields fields) {
    RemoteViews presentation = new RemoteViews("com.gvault.app", android.R.layout.simple_list_item_1);
    presentation.setTextViewText(android.R.id.text1, entry.label());
    Dataset.Builder dataset = new Dataset.Builder(presentation);
    boolean hasValue = false;
    if (fields.fullNameId != null && !entry.fullName().isEmpty()) {
      dataset.setValue(fields.fullNameId, AutofillValue.forText(entry.fullName()));
      hasValue = true;
    }
    if (fields.givenNameId != null && !entry.givenName().isEmpty()) {
      dataset.setValue(fields.givenNameId, AutofillValue.forText(entry.givenName()));
      hasValue = true;
    }
    if (fields.familyNameId != null && !entry.familyName().isEmpty()) {
      dataset.setValue(fields.familyNameId, AutofillValue.forText(entry.familyName()));
      hasValue = true;
    }
    if (fields.emailId != null && !entry.email().isEmpty()) {
      dataset.setValue(fields.emailId, AutofillValue.forText(entry.email()));
      hasValue = true;
    }
    if (fields.phoneId != null && !entry.phone().isEmpty()) {
      dataset.setValue(fields.phoneId, AutofillValue.forText(entry.phone()));
      hasValue = true;
    }
    if (fields.streetId != null) {
      String street = joinStreet(entry.line1(), entry.line2());
      if (!street.isEmpty()) {
        dataset.setValue(fields.streetId, AutofillValue.forText(street));
        hasValue = true;
      }
    }
    if (fields.cityId != null && !entry.city().isEmpty()) {
      dataset.setValue(fields.cityId, AutofillValue.forText(entry.city()));
      hasValue = true;
    }
    if (fields.regionId != null && !entry.region().isEmpty()) {
      dataset.setValue(fields.regionId, AutofillValue.forText(entry.region()));
      hasValue = true;
    }
    if (fields.postalCodeId != null && !entry.postalCode().isEmpty()) {
      dataset.setValue(fields.postalCodeId, AutofillValue.forText(entry.postalCode()));
      hasValue = true;
    }
    if (fields.countryId != null && !entry.country().isEmpty()) {
      dataset.setValue(fields.countryId, AutofillValue.forText(entry.country()));
      hasValue = true;
    }
    if (fields.cardholderNameId != null && !entry.cardholderName().isEmpty()) {
      dataset.setValue(fields.cardholderNameId, AutofillValue.forText(entry.cardholderName()));
      hasValue = true;
    }
    if (fields.cardNumberId != null && !entry.cardNumber().isEmpty()) {
      dataset.setValue(fields.cardNumberId, AutofillValue.forText(entry.cardNumber()));
      hasValue = true;
    }
    if (fields.cardExpiryDateId != null && !entry.cardExpiryDate().isEmpty()) {
      dataset.setValue(fields.cardExpiryDateId, AutofillValue.forText(entry.cardExpiryDate()));
      hasValue = true;
    }
    if (fields.cardExpiryMonthId != null && !entry.cardExpiryMonth().isEmpty()) {
      dataset.setValue(fields.cardExpiryMonthId, AutofillValue.forText(entry.cardExpiryMonth()));
      hasValue = true;
    }
    if (fields.cardExpiryYearId != null && !entry.cardExpiryYear().isEmpty()) {
      dataset.setValue(fields.cardExpiryYearId, AutofillValue.forText(entry.cardExpiryYear()));
      hasValue = true;
    }
    if (fields.cardSecurityCodeId != null && !entry.cardSecurityCode().isEmpty()) {
      dataset.setValue(fields.cardSecurityCodeId, AutofillValue.forText(entry.cardSecurityCode()));
      hasValue = true;
    }
    return hasValue ? dataset.build() : null;
  }

  private static String joinStreet(String line1, String line2) {
    if (line1 == null) line1 = "";
    if (line2 == null) line2 = "";
    String first = line1.trim();
    String second = line2.trim();
    if (first.isEmpty()) return second;
    if (second.isEmpty()) return first;
    return first + ", " + second;
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

  private static String findWebDomain(List<FillContext> contexts) {
    if (contexts == null || contexts.isEmpty()) {
      return "";
    }
    AssistStructure structure = contexts.get(contexts.size() - 1).getStructure();
    for (int i = 0; i < structure.getWindowNodeCount(); i++) {
      String domain = scanWebDomain(structure.getWindowNodeAt(i).getRootViewNode());
      if (!domain.isEmpty()) return domain;
    }
    return "";
  }

  private static String scanWebDomain(AssistStructure.ViewNode node) {
    if (node == null) return "";
    String domain = lower(node.getWebDomain());
    if (!domain.isEmpty()) return domain;
    for (int i = 0; i < node.getChildCount(); i++) {
      String childDomain = scanWebDomain(node.getChildAt(i));
      if (!childDomain.isEmpty()) return childDomain;
    }
    return "";
  }

  private static void scanNode(AssistStructure.ViewNode node, FillFields fields) {
    if (node == null) return;
    String hint = lower(node.getHint());
    String id = lower(node.getIdEntry());
    String autofillHint = firstAutofillHint(node.getAutofillHints());
    String category = MobileAutofillClassifier.classifyField(hint, id, autofillHint);

    if (node.getAutofillId() != null) {
      fields.assign(category, node.getAutofillId());
    }

    for (int i = 0; i < node.getChildCount(); i++) {
      scanNode(node.getChildAt(i), fields);
    }
  }

  private static String firstAutofillHint(String[] hints) {
    if (hints == null || hints.length == 0) return "";
    return lower(hints[0]);
  }

  private static String lower(String value) {
    return value == null ? "" : value.toLowerCase(java.util.Locale.US);
  }

  static final class FillFields {
    AutofillId usernameId;
    AutofillId passwordId;
    AutofillId fullNameId;
    AutofillId givenNameId;
    AutofillId familyNameId;
    AutofillId emailId;
    AutofillId phoneId;
    AutofillId streetId;
    AutofillId cityId;
    AutofillId regionId;
    AutofillId postalCodeId;
    AutofillId countryId;
    AutofillId cardholderNameId;
    AutofillId cardNumberId;
    AutofillId cardExpiryDateId;
    AutofillId cardExpiryMonthId;
    AutofillId cardExpiryYearId;
    AutofillId cardSecurityCodeId;

    void assign(String category, AutofillId id) {
      if (id == null || category == null || category.isEmpty()) return;
      if ("password".equals(category) && passwordId == null) passwordId = id;
      else if ("username".equals(category) && usernameId == null) usernameId = id;
      else if ("fullName".equals(category) && fullNameId == null) fullNameId = id;
      else if ("givenName".equals(category) && givenNameId == null) givenNameId = id;
      else if ("familyName".equals(category) && familyNameId == null) familyNameId = id;
      else if ("email".equals(category) && emailId == null) emailId = id;
      else if ("phone".equals(category) && phoneId == null) phoneId = id;
      else if ("street".equals(category) && streetId == null) streetId = id;
      else if ("city".equals(category) && cityId == null) cityId = id;
      else if ("region".equals(category) && regionId == null) regionId = id;
      else if ("postalCode".equals(category) && postalCodeId == null) postalCodeId = id;
      else if ("country".equals(category) && countryId == null) countryId = id;
      else if ("cardholderName".equals(category) && cardholderNameId == null) cardholderNameId = id;
      else if ("cardNumber".equals(category) && cardNumberId == null) cardNumberId = id;
      else if ("cardExpiryDate".equals(category) && cardExpiryDateId == null) cardExpiryDateId = id;
      else if ("cardExpiryMonth".equals(category) && cardExpiryMonthId == null) cardExpiryMonthId = id;
      else if ("cardExpiryYear".equals(category) && cardExpiryYearId == null) cardExpiryYearId = id;
      else if ("cardSecurityCode".equals(category) && cardSecurityCodeId == null) cardSecurityCodeId = id;
    }

    boolean hasAnyFields() {
      return requiredIds().length > 0;
    }

    boolean hasLoginFields() {
      return MobileAutofillLoginDetection.isLoginForm(usernameId != null, emailId != null, passwordId != null);
    }

    AutofillId loginIdentifierId() {
      return usernameId != null ? usernameId : emailId;
    }

    boolean hasIdentityFields() {
      return fullNameId != null || givenNameId != null || familyNameId != null || emailId != null || phoneId != null;
    }

    boolean hasAddressFields() {
      return streetId != null || cityId != null || regionId != null || postalCodeId != null || countryId != null;
    }

    boolean hasCardFields() {
      return cardholderNameId != null || cardNumberId != null || cardExpiryDateId != null || cardExpiryMonthId != null || cardExpiryYearId != null || cardSecurityCodeId != null;
    }

    boolean hasNonLoginFields() {
      return hasIdentityFields() || hasAddressFields() || hasCardFields();
    }

    int saveDataType() {
      int type = SaveInfo.SAVE_DATA_TYPE_GENERIC;
      if (hasAddressFields()) type |= SaveInfo.SAVE_DATA_TYPE_ADDRESS;
      if (hasCardFields()) type |= SaveInfo.SAVE_DATA_TYPE_CREDIT_CARD;
      if (emailId != null) type |= SaveInfo.SAVE_DATA_TYPE_EMAIL_ADDRESS;
      if (usernameId != null) type |= SaveInfo.SAVE_DATA_TYPE_USERNAME;
      if (passwordId != null) type |= SaveInfo.SAVE_DATA_TYPE_PASSWORD;
      return type;
    }

    AutofillId[] requiredIds() {
      AutofillId[] ids = new AutofillId[18];
      int count = 0;
      if (usernameId != null) ids[count++] = usernameId;
      if (passwordId != null) ids[count++] = passwordId;
      if (fullNameId != null) ids[count++] = fullNameId;
      if (givenNameId != null) ids[count++] = givenNameId;
      if (familyNameId != null) ids[count++] = familyNameId;
      if (emailId != null) ids[count++] = emailId;
      if (phoneId != null) ids[count++] = phoneId;
      if (streetId != null) ids[count++] = streetId;
      if (cityId != null) ids[count++] = cityId;
      if (regionId != null) ids[count++] = regionId;
      if (postalCodeId != null) ids[count++] = postalCodeId;
      if (countryId != null) ids[count++] = countryId;
      if (cardholderNameId != null) ids[count++] = cardholderNameId;
      if (cardNumberId != null) ids[count++] = cardNumberId;
      if (cardExpiryDateId != null) ids[count++] = cardExpiryDateId;
      if (cardExpiryMonthId != null) ids[count++] = cardExpiryMonthId;
      if (cardExpiryYearId != null) ids[count++] = cardExpiryYearId;
      if (cardSecurityCodeId != null) ids[count++] = cardSecurityCodeId;
      AutofillId[] compact = new AutofillId[count];
      System.arraycopy(ids, 0, compact, 0, count);
      return compact;
    }
  }
}
