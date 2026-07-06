const LOGIN_IDENTIFIER_SELECTOR = [
  'input[autocomplete="username" i]',
  'input[autocomplete="email" i]',
  'input[type="email"]',
  'input[name*="user" i]',
  'input[id*="user" i]',
  'input[name*="login" i]',
  'input[id*="login" i]',
  'input[name*="email" i]',
  'input[id*="email" i]'
].join(", ");

function isUsableInput(input) {
  return input && !input.disabled && !input.readOnly && input.type !== "hidden";
}

function inputDescriptor(input) {
  const labels = [...(input.labels || [])].map((label) => label.textContent || "").join(" ");
  return [
    input.getAttribute("autocomplete") || "",
    input.getAttribute("aria-label") || "",
    input.getAttribute("placeholder") || "",
    input.name || "",
    input.id || "",
    labels
  ].join(" ").toLowerCase();
}

function isCurrentPasswordInput(input) {
  const descriptor = inputDescriptor(input);
  return isUsableInput(input)
    && !descriptor.includes("new-password")
    && !descriptor.includes("new password")
    && !descriptor.includes("confirm");
}

function findLoginIdentifier(root, passwordInput) {
  const candidates = [...root.querySelectorAll(LOGIN_IDENTIFIER_SELECTOR)]
    .filter((input) => isUsableInput(input) && input !== passwordInput);
  return candidates.find((input) => input.compareDocumentPosition(passwordInput) & Node.DOCUMENT_POSITION_FOLLOWING)
    || candidates[0]
    || null;
}

function hasSinglePasswordField(root) {
  return [...root.querySelectorAll("input[type=password]")].filter(isUsableInput).length === 1;
}

function hasPasswordField(root) {
  return [...root.querySelectorAll("input[type=password]")].some(isUsableInput);
}

function descriptorIncludes(input, terms) {
  const descriptor = inputDescriptor(input);
  return terms.some((term) => descriptor.includes(term));
}

function identityFieldKind(input) {
  if (!isUsableInput(input)) return "";
  if (descriptorIncludes(input, ["given-name", "firstname", "first name", "first_name", "givenname"])) return "givenName";
  if (descriptorIncludes(input, ["family-name", "lastname", "last name", "last_name", "familyname", "surname"])) return "familyName";
  if (descriptorIncludes(input, ["name", "full name", "fullname", "full_name"])) return "fullName";
  if (descriptorIncludes(input, ["email"]) || input.type === "email") return "email";
  if (descriptorIncludes(input, ["tel", "phone", "mobile"]) || input.type === "tel") return "phone";
  return "";
}

function addressFieldKind(input) {
  if (!isUsableInput(input)) return "";
  if (descriptorIncludes(input, ["street-address", "address-line", "address1", "address 1", "street"])) return "street";
  if (descriptorIncludes(input, ["address-level2", "city", "locality"])) return "city";
  if (descriptorIncludes(input, ["address-level1", "state", "province", "region"])) return "region";
  if (descriptorIncludes(input, ["postal-code", "postcode", "postal", "zip"])) return "postalCode";
  if (descriptorIncludes(input, ["country-name", "country"])) return "country";
  return "";
}

function detectIdentityAddressForms() {
  return [...document.querySelectorAll("form")].flatMap((form) => {
    if (hasPasswordField(form)) return [];
    const inputs = [...form.querySelectorAll("input")];
    const identityKinds = new Set(inputs.map(identityFieldKind).filter(Boolean));
    const addressKinds = new Set(inputs.map(addressFieldKind).filter(Boolean));
    if (addressKinds.size >= 3) return [{ form, type: "address", fields: [...addressKinds] }];
    if (identityKinds.size >= 2 && (identityKinds.has("fullName") || identityKinds.has("givenName") || identityKinds.has("familyName"))) {
      return [{ form, type: "identity", fields: [...identityKinds] }];
    }
    return [];
  });
}

function detectLoginForms() {
  const seenForms = new Set();
  return [...document.querySelectorAll("input[type=password]")]
    .filter(isCurrentPasswordInput)
    .flatMap((passwordInput) => {
      const form = passwordInput.closest("form") || document;
      if (seenForms.has(form) || !hasSinglePasswordField(form)) return [];
      const usernameInput = findLoginIdentifier(form, passwordInput);
      if (!usernameInput) return [];
      seenForms.add(form);
      return [{ usernameInput, passwordInput }];
    });
}

function setInputValue(input, value) {
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value || "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillLogin(username, password) {
  for (const form of detectLoginForms()) {
    setInputValue(form.usernameInput, username);
    setInputValue(form.passwordInput, password);
  }
  return detectLoginForms().length;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GV_FILL_LOGIN") {
    sendResponse({ filled: fillLogin(message.username, message.password) });
    return true;
  }
  if (message?.type === "GV_FORM_CONTEXT") {
    const identityAddressForms = detectIdentityAddressForms();
    sendResponse({
      count: detectLoginForms().length,
      identityAddressCount: identityAddressForms.length,
      identityAddressTypes: identityAddressForms.map((form) => form.type),
      url: location.href,
      host: location.hostname
    });
    return true;
  }
  return false;
});

{
  const identityAddressForms = detectIdentityAddressForms();
  chrome.runtime.sendMessage({
    type: "GV_FORMS_DETECTED",
    count: detectLoginForms().length,
    identityAddressCount: identityAddressForms.length,
    identityAddressTypes: identityAddressForms.map((form) => form.type),
    url: location.href,
    host: location.hostname
  });
}
