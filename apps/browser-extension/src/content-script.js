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

function detectLoginForms() {
  const seenForms = new Set();
  return [...document.querySelectorAll("input[type=password]")]
    .filter(isCurrentPasswordInput)
    .flatMap((passwordInput) => {
      const form = passwordInput.closest("form") || document;
      if (seenForms.has(form)) return [];
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
    sendResponse({ count: detectLoginForms().length, url: location.href, host: location.hostname });
    return true;
  }
  return false;
});

chrome.runtime.sendMessage({ type: "GV_FORMS_DETECTED", count: detectLoginForms().length, url: location.href, host: location.hostname });
