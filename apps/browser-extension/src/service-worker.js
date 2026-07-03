chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "GV_FORMS_DETECTED") {
    chrome.storage.session.set({ lastDetectedForms: { ...message, tabId: sender.tab?.id, at: new Date().toISOString() } });
  }
});
