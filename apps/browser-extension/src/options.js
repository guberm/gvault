const themeButton = document.getElementById("themeButton");

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeButton.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  chrome.storage.sync.set({ gvTheme: theme });
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeDomainEntry(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  return hostFromUrl(text.includes("://") ? text : `https://${text}`);
}

function uniqueDomains(domains) {
  return [...new Set(domains.map(normalizeDomainEntry).filter(Boolean))];
}

chrome.storage.sync.get(["gvServerUrl", "gvTheme", "gvAutofillEnabled", "gvAutosaveEnabled", "gvDisabledDomains"]).then(({ gvServerUrl, gvTheme, gvAutofillEnabled, gvAutosaveEnabled, gvDisabledDomains }) => {
  const serverUrl = gvServerUrl;
  if (serverUrl) document.getElementById("serverUrl").value = serverUrl;
  document.getElementById("autofillEnabled").checked = gvAutofillEnabled !== false;
  document.getElementById("autosaveEnabled").checked = gvAutosaveEnabled !== false;
  document.getElementById("disabledDomains").value = uniqueDomains(Array.isArray(gvDisabledDomains) ? gvDisabledDomains : []).join("\n");
  applyTheme(gvTheme || "light");
});

document.getElementById("save").onclick = () => chrome.storage.sync.set({
  gvServerUrl: document.getElementById("serverUrl").value,
  gvAutofillEnabled: document.getElementById("autofillEnabled").checked,
  gvAutosaveEnabled: document.getElementById("autosaveEnabled").checked,
  gvDisabledDomains: uniqueDomains(document.getElementById("disabledDomains").value.split(/\n|,/))
});

themeButton.onclick = () => applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
