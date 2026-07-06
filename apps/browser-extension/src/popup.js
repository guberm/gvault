const status = document.getElementById("status");
const serverUrl = document.getElementById("serverUrl");
const username = document.getElementById("username");
const password = document.getElementById("password");
const sessionAutofill = document.getElementById("sessionAutofill");
const themeButton = document.getElementById("themeButton");

function setStatus(message) {
  status.textContent = message;
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

themeButton.onclick = () => applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");

chrome.storage.sync.get(["gvServerUrl", "gvTheme"]).then(({ gvServerUrl, gvTheme }) => {
  if (gvServerUrl) serverUrl.value = gvServerUrl;
  applyTheme(gvTheme || "light");
});

chrome.storage.session.get("lastDetectedForms").then(({ lastDetectedForms }) => {
  if (!lastDetectedForms) {
    setStatus("No login or identity/address form detected yet. You can still fill manually.");
    return;
  }
  const count = lastDetectedForms.count || 0;
  const identityAddressCount = lastDetectedForms.identityAddressCount || 0;
  if (identityAddressCount > 0 && count === 0) {
    setStatus(`${identityAddressCount} identity/address form${identityAddressCount === 1 ? "" : "s"} detected on this page.`);
    return;
  }
  if (identityAddressCount > 0) {
    setStatus(`${count} login form${count === 1 ? "" : "s"} and ${identityAddressCount} identity/address form${identityAddressCount === 1 ? "" : "s"} detected on this page.`);
    return;
  }
  setStatus(`${count} login form${count === 1 ? "" : "s"} detected on this page.`);
});
