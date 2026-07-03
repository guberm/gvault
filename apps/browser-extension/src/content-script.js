function detectLoginForms() {
  const passwordInputs = [...document.querySelectorAll("input[type=password]")];
  return passwordInputs.map((passwordInput) => {
    const form = passwordInput.closest("form") || document;
    const usernameInput = form.querySelector("input[type=email], input[type=text], input[autocomplete=username]");
    return { usernameInput, passwordInput };
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "GV_FILL_LOGIN") {
    for (const form of detectLoginForms()) {
      if (form.usernameInput) form.usernameInput.value = message.username || "";
      form.passwordInput.value = message.password || "";
      form.passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
});

chrome.runtime.sendMessage({ type: "GV_FORMS_DETECTED", count: detectLoginForms().length, url: location.href });
