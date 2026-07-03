const status = document.getElementById("status");
const serverUrl = document.getElementById("serverUrl");

function setStatus(message) {
  status.textContent = message;
}

document.getElementById("fill").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab available.");
    return;
  }
  await chrome.tabs.sendMessage(tab.id, {
    type: "GV_FILL_LOGIN",
    username: document.getElementById("username").value,
    password: document.getElementById("password").value,
  });
  setStatus("Fill command sent to the current page.");
};

document.getElementById("saveServer").onclick = async () => {
  await chrome.storage.sync.set({ gvServerUrl: serverUrl.value });
  setStatus("Server URL saved for this browser profile.");
};

document.getElementById("openOptions").onclick = () => {
  chrome.runtime.openOptionsPage();
};

chrome.storage.sync.get("gvServerUrl").then(({ gvServerUrl }) => {
  if (gvServerUrl) serverUrl.value = gvServerUrl;
});

chrome.storage.session.get("lastDetectedForms").then(({ lastDetectedForms }) => {
  if (!lastDetectedForms) {
    setStatus("No login form detected yet. You can still fill manually.");
    return;
  }
  const count = lastDetectedForms.count || 0;
  setStatus(`${count} login form${count === 1 ? "" : "s"} detected on this page.`);
});
