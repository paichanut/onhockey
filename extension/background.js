// Fetches the schedule with the browser's own onhockey.tv access. rules.json adds
// the onhockey.tv Referer the endpoint requires (fetch can't set it directly).
const SCHEDULE_URL = 'https://onhockey.tv/schedule_table.php';

async function fetchSchedule() {
  const response = await fetch(SCHEDULE_URL, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(
      `onhockey.tv responded ${response.status}. Open onhockey.tv once in this browser, then refresh.`
    );
  }
  // onhockey.tv serves windows-1251.
  return new TextDecoder('windows-1251').decode(await response.arrayBuffer());
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'fetchSchedule') return false;
  fetchSchedule()
    .then((html) => sendResponse({ html }))
    .catch((err) => sendResponse({ error: err.message }));
  return true; // respond asynchronously
});
