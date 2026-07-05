package com.gvault.app;

public final class MobileAutofillClassifier {
  private MobileAutofillClassifier() {}

  public static String classifyField(String hint, String id, String autofillHint) {
    String normalizedHint = normalize(hint);
    String normalizedId = normalize(id);
    String normalizedAutofillHint = normalize(autofillHint);

    String exact = exactHintCategory(normalizedAutofillHint);
    if (!exact.isEmpty()) return exact;

    String combined = normalizedHint + " " + normalizedId + " " + normalizedAutofillHint;

    if (containsAny(combined, "personfamilyname", "familyname", "lastname", "last_name", "surname")) return "familyName";
    if (containsAny(combined, "persongivenname", "givenname", "firstname", "first_name", "forename")) return "givenName";
    if (containsAny(combined, "personname", "full name", "fullname", "full_name", "contact name", "name")) return "fullName";
    if (containsAny(combined, "emailaddress", "email")) return "email";
    if (containsAny(combined, "phonenumber", "telephone", "tel", "phone")) return "phone";
    if (containsAny(combined, "postalcode", "zipcode", "zip code", "zip", "postcode")) return "postalCode";
    if (containsAny(combined, "addresslocality", "locality", "city", "town")) return "city";
    if (containsAny(combined, "addressregion", "province", "state", "region")) return "region";
    if (containsAny(combined, "addresscountry", "countryname", "country")) return "country";
    if (containsAny(combined, "postaladdress", "streetaddress", "street", "address line", "addressline", "address1", "address2", "line1", "line2", "address")) return "street";
    if (containsAny(combined, "username", "login", "user")) return "username";
    if (containsAny(combined, "newpassword", "passwordauto", "password", "pass")) return "password";
    return "";
  }

  private static String exactHintCategory(String autofillHint) {
    if (autofillHint.isEmpty()) return "";
    if ("username".equals(autofillHint) || "login".equals(autofillHint)) return "username";
    if ("password".equals(autofillHint) || "newpassword".equals(autofillHint) || "passwordauto".equals(autofillHint)) return "password";
    if ("emailaddress".equals(autofillHint) || "email".equals(autofillHint)) return "email";
    if ("phone".equals(autofillHint) || "phonenumber".equals(autofillHint) || "telephone".equals(autofillHint)) return "phone";
    if ("name".equals(autofillHint) || "personname".equals(autofillHint)) return "fullName";
    if ("persongivenname".equals(autofillHint) || "givenname".equals(autofillHint)) return "givenName";
    if ("personfamilyname".equals(autofillHint) || "familyname".equals(autofillHint)) return "familyName";
    if ("postaladdress".equals(autofillHint) || "streetaddress".equals(autofillHint) || "fullstreetaddress".equals(autofillHint) || "address".equals(autofillHint)) return "street";
    if ("addresslocality".equals(autofillHint) || "locality".equals(autofillHint) || "city".equals(autofillHint)) return "city";
    if ("addressregion".equals(autofillHint) || "state".equals(autofillHint) || "province".equals(autofillHint) || "region".equals(autofillHint)) return "region";
    if ("postalcode".equals(autofillHint) || "zipcode".equals(autofillHint) || "zip".equals(autofillHint) || "postcode".equals(autofillHint) || "extendedpostalcode".equals(autofillHint)) return "postalCode";
    if ("addresscountry".equals(autofillHint) || "country".equals(autofillHint) || "countryname".equals(autofillHint)) return "country";
    return "";
  }

  private static boolean containsAny(String haystack, String... needles) {
    for (String needle : needles) {
      if (haystack.contains(needle)) return true;
    }
    return false;
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(java.util.Locale.US);
  }
}
