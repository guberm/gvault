const themeButton = document.getElementById("themeButton");

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeButton.textContent = theme === "dark" ? "Light mode" : "Dark mode";
  chrome.storage.sync.set({ gvTheme: theme });
}

chrome.storage.sync.get(["gvServerUrl", "gvTheme", "gvAutosaveEnabled"]).then(({ gvServerUrl, gvTheme, gvAutosaveEnabled }) => {
  const serverUrl = gvServerUrl;
  if (serverUrl) document.getElementById("serverUrl").value = serverUrl;
  document.getElementById("autosaveEnabled").checked = gvAutosaveEnabled !== false;
  applyTheme(gvTheme || "light");
});

document.getElementById("save").onclick = () => chrome.storage.sync.set({
  gvServerUrl: document.getElementById("serverUrl").value,
  gvAutosaveEnabled: document.getElementById("autosaveEnabled").checked
});

themeButton.onclick = () => applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
