function detectLoginForms() {
  const passwordInputs = [...document.querySelectorAll("input[type=password]")];
  return passwordInputs.map((passwordInput) => {
    const form = passwordInput.closest("form") || document;
    const usernameInput = form.querySelector("input[autocomplete=username], input[type=email], input[name*=user i], input[name*=email i], input[type=text]");
    return { usernameInput, passwordInput };
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
