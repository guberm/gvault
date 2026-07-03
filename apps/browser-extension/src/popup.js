document.getElementById("fill").onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.sendMessage(tab.id, {
    type: "GV_FILL_LOGIN",
    username: document.getElementById("username").value,
    password: document.getElementById("password").value
  });
  document.getElementById("status").textContent = "Fill command sent.";
};

chrome.storage.session.get("lastDetectedForms").then(({ lastDetectedForms }) => {
  if (lastDetectedForms) {
    document.getElementById("status").textContent = `${lastDetectedForms.count} login form(s) detected.`;
  }
});
