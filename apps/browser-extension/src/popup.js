const status = document.getElementById("status");
const serverUrl = document.getElementById("serverUrl");
const username = document.getElementById("username");
const password = document.getElementById("password");
const sessionAutofill = document.getElementById("sessionAutofill");
const themeButton = document.getElementById("themeButton");
const savePrompt = document.getElementById("savePrompt");
const savePromptTitle = document.getElementById("savePromptTitle");
const savePromptText = document.getElementById("savePromptText");
const dismissSaveLogin = document.getElementById("dismissSaveLogin");
const openWebVault = document.getElementById("openWebVault");
let savePromptKind = "save";

function setStatus(message) {
  status.textContent = message;
}

const NO_FORMS_STATUS = "No login, identity/address, or payment-card form detected yet. You can still fill manually.";

function showSavePrompt(pendingSaveLogin) {
  if (!pendingSaveLogin?.username || !pendingSaveLogin?.password) {
    savePrompt.hidden = true;
    return;
  }
  savePromptKind = "save";
  savePrompt.hidden = false;
  savePromptTitle.textContent = "Save new login?";
  openWebVault.textContent = "Open web vault to save";
  savePromptText.textContent = `Save login for ${pendingSaveLogin.host || "this site"}: ${pendingSaveLogin.username}`;
  username.value = pendingSaveLogin.username;
  password.value = pendingSaveLogin.password;
}

function showUpdatePrompt(pendingUpdateLogin) {
  if (!pendingUpdateLogin?.username || !pendingUpdateLogin?.password) {
    savePrompt.hidden = true;
    return;
  }
  savePromptKind = "update";
  savePrompt.hidden = false;
  savePromptTitle.textContent = "Update password?";
  openWebVault.textContent = "Open web vault to update";
  savePromptText.textContent = `Update password for ${pendingUpdateLogin.host || "this site"}: ${pendingUpdateLogin.username}`;
  username.value = pendingUpdateLogin.username;
  password.value = pendingUpdateLogin.password;
}

async function dismissPendingSaveLogin() {
  await chrome.runtime.sendMessage({ type: savePromptKind === "update" ? "GV_DISMISS_UPDATE_LOGIN" : "GV_DISMISS_SAVE_LOGIN" });
  savePrompt.hidden = true;
  setStatus(savePromptKind === "update" ? "Update prompt dismissed." : "Save prompt dismissed.");
}

async function openConfiguredWebVault() {
  await chrome.tabs.create({ url: serverUrl.value || "https://gvault.guber.dev" });
  setStatus("Opened web vault. Captured credentials remain only in this popup session.");
}

async function loadPendingSavePrompt() {
  const { pendingUpdateLogin } = await chrome.storage.session.get("pendingUpdateLogin");
  if (pendingUpdateLogin) {
    showUpdatePrompt(pendingUpdateLogin);
    return;
  }
  const { pendingSaveLogin } = await chrome.storage.session.get("pendingSaveLogin");
  showSavePrompt(pendingSaveLogin);
}

async function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeButton.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  await chrome.storage.sync.set({ gvTheme: theme });
}

document.getElementById("fill").onclick = async () => {
  const payload = { username: username.value, password: password.value };
  const filled = await chrome.runtime.sendMessage({ type: "GV_FILL_ACTIVE_TAB", ...payload });
  if (!filled?.ok) {
    setStatus(filled?.error || "Fill failed.");
    return;
  }
  if (sessionAutofill.checked) {
    await chrome.runtime.sendMessage({ type: "GV_SAVE_SESSION_LOGIN", ...payload });
    setStatus("Filled page and enabled session autofill for this site.");
    return;
  }
  setStatus("Fill command sent to the current page.");
};

document.getElementById("saveServer").onclick = async () => {
  await chrome.storage.sync.set({ gvServerUrl: serverUrl.value });
  setStatus("Server URL saved for this browser profile.");
};

document.getElementById("openOptions").onclick = () => {
  chrome.runtime.openOptionsPage();
};

dismissSaveLogin.onclick = dismissPendingSaveLogin;
openWebVault.onclick = openConfiguredWebVault;

themeButton.onclick = () => applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");

chrome.storage.sync.get(["gvServerUrl", "gvTheme"]).then(({ gvServerUrl, gvTheme }) => {
  if (gvServerUrl) serverUrl.value = gvServerUrl;
  applyTheme(gvTheme || "light");
});

loadPendingSavePrompt();

chrome.storage.onChanged?.addListener?.((changes, areaName) => {
  if (areaName !== "session") return;

  if (changes.pendingUpdateLogin) {
    if (changes.pendingUpdateLogin.newValue) {
      showUpdatePrompt(changes.pendingUpdateLogin.newValue);
      return;
    }
    if (savePromptKind === "update") savePrompt.hidden = true;
  }

  if (changes.pendingSaveLogin) {
    if (changes.pendingSaveLogin.newValue) {
      showSavePrompt(changes.pendingSaveLogin.newValue);
      return;
    }
    if (savePromptKind === "save") savePrompt.hidden = true;
  }
});

chrome.storage.session.get("lastDetectedForms").then(({ lastDetectedForms }) => {
  if (!lastDetectedForms) {
    setStatus(NO_FORMS_STATUS);
    return;
  }
  const count = lastDetectedForms.count || 0;
  const identityAddressCount = lastDetectedForms.identityAddressCount || 0;
  const paymentCardCount = lastDetectedForms.paymentCardCount || 0;
  if (paymentCardCount > 0 && count === 0 && identityAddressCount === 0) {
    setStatus(`${paymentCardCount} payment-card form${paymentCardCount === 1 ? "" : "s"} detected on this page.`);
    return;
  }
  if (identityAddressCount > 0 && count === 0 && paymentCardCount === 0) {
    setStatus(`${identityAddressCount} identity/address form${identityAddressCount === 1 ? "" : "s"} detected on this page.`);
    return;
  }
  const parts = [];
  if (count > 0) parts.push(`${count} login form${count === 1 ? "" : "s"}`);
  if (identityAddressCount > 0) parts.push(`${identityAddressCount} identity/address form${identityAddressCount === 1 ? "" : "s"}`);
  if (paymentCardCount > 0) parts.push(`${paymentCardCount} payment-card form${paymentCardCount === 1 ? "" : "s"}`);
  if (parts.length === 0) {
    setStatus(NO_FORMS_STATUS);
    return;
  }
  setStatus(`${parts.join(" and ")} detected on this page.`);
});
