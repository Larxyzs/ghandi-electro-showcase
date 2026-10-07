// Background script.
// Its only job: when you click the extension icon, open (or jump to) the
// control page. All the real work happens in app.js, because a normal page
// stays alive during a long run while a tiny popup would close by itself.

const APP_URL = chrome.runtime.getURL("app.html");

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: APP_URL });
  if (tabs.length > 0 && tabs[0].id !== undefined) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId !== undefined) {
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url: APP_URL });
});
