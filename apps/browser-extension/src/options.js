chrome.storage.local.get("serverUrl").then(({ serverUrl }) => {
  if (serverUrl) document.getElementById("serverUrl").value = serverUrl;
});

document.getElementById("save").onclick = () => chrome.storage.local.set({
  serverUrl: document.getElementById("serverUrl").value
});
