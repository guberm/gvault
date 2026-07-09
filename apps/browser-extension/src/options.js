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

function parseEquivalentDomainGroups(text) {
  return String(text || "")
    .split(/\n/)
    .map((line) => uniqueDomains(line.split(/,/)))
    .filter((group) => group.length > 1);
}

function formatEquivalentDomainGroups(groups) {
  if (!Array.isArray(groups)) return "";
  return groups
    .map((group) => uniqueDomains(Array.isArray(group) ? group : []))
    .filter((group) => group.length > 1)
    .map((group) => group.join(", "))
    .join("\n");
}

chrome.storage.sync.get(["gvServerUrl", "gvTheme", "gvAutofillEnabled", "gvFillPromptEnabled", "gvAutosaveEnabled", "gvSubdomainMatchingEnabled", "gvDisabledDomains", "gvEquivalentDomains"]).then(({ gvServerUrl, gvTheme, gvAutofillEnabled, gvFillPromptEnabled, gvAutosaveEnabled, gvSubdomainMatchingEnabled, gvDisabledDomains, gvEquivalentDomains }) => {
  const serverUrl = gvServerUrl;
  if (serverUrl) document.getElementById("serverUrl").value = serverUrl;
  document.getElementById("autofillEnabled").checked = gvAutofillEnabled !== false;
  document.getElementById("fillPromptEnabled").checked = gvFillPromptEnabled !== false;
  document.getElementById("autosaveEnabled").checked = gvAutosaveEnabled !== false;
  document.getElementById("subdomainMatchingEnabled").checked = gvSubdomainMatchingEnabled !== false;
  document.getElementById("disabledDomains").value = uniqueDomains(Array.isArray(gvDisabledDomains) ? gvDisabledDomains : []).join("\n");
  document.getElementById("equivalentDomains").value = formatEquivalentDomainGroups(gvEquivalentDomains);
  applyTheme(gvTheme || "light");
});

document.getElementById("save").onclick = () => chrome.storage.sync.set({
  gvServerUrl: document.getElementById("serverUrl").value,
  gvAutofillEnabled: document.getElementById("autofillEnabled").checked,
  gvFillPromptEnabled: document.getElementById("fillPromptEnabled").checked,
  gvAutosaveEnabled: document.getElementById("autosaveEnabled").checked,
  gvSubdomainMatchingEnabled: document.getElementById("subdomainMatchingEnabled").checked,
  gvDisabledDomains: uniqueDomains(document.getElementById("disabledDomains").value.split(/\n|,/)),
  gvEquivalentDomains: parseEquivalentDomainGroups(document.getElementById("equivalentDomains").value)
});

themeButton.onclick = () => applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
