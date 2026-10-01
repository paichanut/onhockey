// Bridges the page and the extension: the page posts a request, the background
// worker fetches onhockey.tv, and the result is posted back to the page.
document.documentElement.dataset.onhockeyExtension = chrome.runtime.getManifest().version;

window.addEventListener('message', (event) => {
  if (event.source !== window || event.data?.source !== 'onhockey-app') return;
  const { id, type } = event.data;
  if (type !== 'fetchSchedule') return;

  chrome.runtime.sendMessage({ type }, (response) => {
    const result = chrome.runtime.lastError
      ? { error: chrome.runtime.lastError.message }
      : response;
    window.postMessage({ source: 'onhockey-extension', id, ...result }, window.location.origin);
  });
});
