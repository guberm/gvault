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

function paymentCardFieldKind(input) {
  if (!isUsableInput(input)) return "";
  if (descriptorIncludes(input, ["cc-name", "cardholder", "card holder", "name on card"])) return "cardholderName";
  if (descriptorIncludes(input, ["cc-number", "cardnumber", "card number", "credit card number"])) return "cardNumber";
  if (descriptorIncludes(input, ["cc-exp-month", "expmonth", "exp month", "expiration month"])) return "cardExpiryMonth";
  if (descriptorIncludes(input, ["cc-exp-year", "expyear", "exp year", "expiration year"])) return "cardExpiryYear";
  if (descriptorIncludes(input, ["cc-exp", "expiry", "expiration"])) return "cardExpiry";
  if (descriptorIncludes(input, ["cc-csc", "cc-cvv", "cvv", "cvc", "security code"])) return "cardSecurityCode";
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

function detectPaymentCardForms() {
  return [...document.querySelectorAll("form")].flatMap((form) => {
    if (hasPasswordField(form)) return [];
    const cardKinds = new Set([...form.querySelectorAll("input")].map(paymentCardFieldKind).filter(Boolean));
    if (!cardKinds.has("cardNumber")) return [];
    const hasExpiry = cardKinds.has("cardExpiry") || cardKinds.has("cardExpiryMonth") || cardKinds.has("cardExpiryYear");
    const hasSupportingCardField = cardKinds.has("cardholderName") || cardKinds.has("cardSecurityCode");
    if (hasExpiry && hasSupportingCardField) return [{ form, type: "paymentCard", fields: [...cardKinds] }];
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

let explicitlyAuthorizedPasswordInput = null;
let directPointerSnapshot = null;
const passwordTypeMutationVersions = new WeakMap();

function recordPasswordTypeMutations(records) {
  for (const record of records) {
    const target = record.target;
    passwordTypeMutationVersions.set(target, (passwordTypeMutationVersions.get(target) || 0) + 1);
  }
}

const passwordTypeObserver = new MutationObserver(recordPasswordTypeMutations);
passwordTypeObserver.observe(document, { attributes: true, attributeFilter: ["type"], subtree: true });

function flushPasswordTypeMutations() {
  recordPasswordTypeMutations(passwordTypeObserver.takeRecords());
}

// A page can synthesize focus events or call focus() itself. Only a genuine user
// pointer gesture whose original target is the input may authorize a generated
// secret target. Chrome's trusted click forwarded by a label has no qualifying
// pointerdown on the input and therefore cannot authorize it.
window.addEventListener("pointerdown", (event) => {
  if (!event.isTrusted) return;
  flushPasswordTypeMutations();
  const target = event.target;
  directPointerSnapshot = Object.freeze({
    target,
    wasConnectedPasswordInput: Boolean(target?.isConnected && target?.matches?.("input[type=password]")),
    typeMutationVersion: passwordTypeMutationVersions.get(target) || 0,
    pointerId: event.pointerId,
    button: event.button
  });
  explicitlyAuthorizedPasswordInput = null;
}, true);

window.addEventListener("pointerup", (event) => {
  if (!event.isTrusted) return;
  flushPasswordTypeMutations();
  const target = event.target;
  const snapshot = directPointerSnapshot;
  explicitlyAuthorizedPasswordInput = snapshot?.wasConnectedPasswordInput
    && target === snapshot.target
    && event.pointerId === snapshot.pointerId
    && event.button === snapshot.button
    && (passwordTypeMutationVersions.get(target) || 0) === snapshot.typeMutationVersion
    && isSafeExplicitPasswordInput(target)
    ? target
    : null;
  directPointerSnapshot = null;
}, true);

window.addEventListener("pointercancel", () => {
  directPointerSnapshot = null;
  explicitlyAuthorizedPasswordInput = null;
}, true);

function rectangleIntersection(first, second) {
  const left = Math.max(first.left, second.left);
  const top = Math.max(first.top, second.top);
  const right = Math.min(first.right, second.right);
  const bottom = Math.min(first.bottom, second.bottom);
  return right > left && bottom > top ? { left, top, right, bottom } : null;
}

function visibleViewportRect(input) {
  const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  for (const clientRect of input.getClientRects()) {
    if (clientRect.width <= 0 || clientRect.height <= 0) continue;
    let visibleRect = rectangleIntersection(clientRect, viewport);
    if (!visibleRect) continue;
    for (let ancestor = input.parentElement; ancestor && visibleRect; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (![style.overflow, style.overflowX, style.overflowY].some((value) => ["hidden", "clip", "scroll", "auto"].includes(value))) continue;
      visibleRect = rectangleIntersection(visibleRect, ancestor.getBoundingClientRect());
    }
    if (visibleRect) return visibleRect;
  }
  return null;
}

function isTopmostAtInteriorPoint(input, visibleRect) {
  const x = visibleRect.left + ((visibleRect.right - visibleRect.left) / 2);
  const y = visibleRect.top + ((visibleRect.bottom - visibleRect.top) / 2);
  const hit = document.elementFromPoint(x, y);
  return hit === input || input.contains(hit);
}

const MINIMUM_EFFECTIVE_OPACITY = 0.5;

function isSafeExplicitPasswordInput(input) {
  if (!input?.matches?.("input[type=password]") || !input.isConnected || input.disabled || input.readOnly) return false;
  let effectiveOpacity = 1;
  for (let element = input; element; element = element.parentElement) {
    if (element.hidden || element.hasAttribute("hidden") || element.inert || element.hasAttribute("inert") || element.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || ["hidden", "collapse"].includes(style.visibility) || style.contentVisibility === "hidden") return false;
    effectiveOpacity *= Number(style.opacity);
    // Opacity composes multiplicatively across ancestors. Require a substantial
    // visible result rather than relying on an exact zero comparison, which lets
    // practically invisible click targets authorize secret injection.
    if (!Number.isFinite(effectiveOpacity) || effectiveOpacity < MINIMUM_EFFECTIVE_OPACITY) return false;
    if (style.clipPath && style.clipPath !== "none") return false;
    if (style.clip && style.clip !== "auto" && /rect\(\s*(?:0(?:px)?[ ,]+){3}0(?:px)?\s*\)/i.test(style.clip)) return false;
  }
  const visibleRect = visibleViewportRect(input);
  return document.activeElement === input && Boolean(visibleRect) && isTopmostAtInteriorPoint(input, visibleRect);
}

function fillGeneratedPassword(password) {
  if (!password) return 0;
  const target = explicitlyAuthorizedPasswordInput;
  if (!isSafeExplicitPasswordInput(target)) return 0;
  setInputValue(target, password);
  return 1;
}

function installSaveLoginPromptListeners() {
  for (const loginForm of detectLoginForms()) {
    const form = loginForm.passwordInput.closest("form");
    if (!form || form.dataset.gvSavePromptBound === "true") continue;
    form.dataset.gvSavePromptBound = "true";
    form.addEventListener("submit", () => {
      const username = loginForm.usernameInput.value || "";
      const password = loginForm.passwordInput.value || "";
      if (!username || !password) return;
      chrome.runtime.sendMessage({
        type: "GV_LOGIN_SUBMITTED",
        username,
        password,
        url: location.href,
        host: location.hostname
      });
    }, true);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GV_FILL_LOGIN") {
    sendResponse({ filled: fillLogin(message.username, message.password) });
    return true;
  }
  if (message?.type === "GV_FILL_GENERATED_PASSWORD") {
    sendResponse({ filled: fillGeneratedPassword(message.password) });
    return true;
  }
  if (message?.type === "GV_FORM_CONTEXT") {
    const identityAddressForms = detectIdentityAddressForms();
    const paymentCardForms = detectPaymentCardForms();
    sendResponse({
      count: detectLoginForms().length,
      identityAddressCount: identityAddressForms.length,
      identityAddressTypes: identityAddressForms.map((form) => form.type),
      paymentCardCount: paymentCardForms.length,
      paymentCardTypes: paymentCardForms.map((form) => form.type),
      url: location.href,
      host: location.hostname
    });
    return true;
  }
  return false;
});

function initializeDocumentDependentFeatures() {
  installSaveLoginPromptListeners();
  const identityAddressForms = detectIdentityAddressForms();
  const paymentCardForms = detectPaymentCardForms();
  chrome.runtime.sendMessage({
    type: "GV_FORMS_DETECTED",
    count: detectLoginForms().length,
    identityAddressCount: identityAddressForms.length,
    identityAddressTypes: identityAddressForms.map((form) => form.type),
    paymentCardCount: paymentCardForms.length,
    paymentCardTypes: paymentCardForms.map((form) => form.type),
    url: location.href,
    host: location.hostname
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeDocumentDependentFeatures, { once: true });
} else {
  initializeDocumentDependentFeatures();
}
