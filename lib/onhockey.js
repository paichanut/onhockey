// Browser-side helpers: parse onhockey.tv's schedule HTML and resolve stream
// links to embeddable player URLs. Nothing here makes a network request.

const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

// Schedule hours on onhockey.tv are in GMT0; shift them by the chosen offset.
export function shiftHour(hour, offset) {
  const h = (((parseInt(hour, 10) + parseInt(offset, 10)) % 24) + 24) % 24;
  return String(h).padStart(2, '0');
}

export function parseSchedule(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const leagues = [];

  doc.querySelectorAll('#gametable tbody').forEach((tbody) => {
    const name = text(tbody.querySelector('tr td:nth-child(2) b'));
    if (!name) return;

    const games = [...tbody.querySelectorAll('tr.game')].map((row) => {
      const hour = text(row.querySelector('.game_hour'));
      const minutes = text(row.querySelector('td')).replace(hour, '').replace(':', '').trim();
      const teamsCell = row.querySelector('td:nth-child(2)');
      const linksDiv = teamsCell?.querySelector('.gamelinks');

      // Links are grouped by commentary language, e.g. "czech: <a> <a> <br> russian: <a>".
      const links = [];
      let language = '';
      linksDiv?.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const label = node.textContent.trim().replace(/:$/, '');
          if (label) language = label;
        } else if (node.nodeName === 'A') {
          links.push({
            name: text(node),
            url: node.getAttribute('href') || '',
            title: node.getAttribute('title') || '',
            language,
          });
        }
      });
      linksDiv?.remove();

      const liveText = text(row.querySelector('.liveon'));
      return {
        hour,
        minutes,
        teams: text(teamsCell),
        isLive: liveText !== '',
        liveCount: liveText.match(/\d+/)?.[0] || '',
        links,
      };
    });

    leagues.push({ name, class: tbody.getAttribute('class') || '', games });
  });

  return leagues;
}

const withProtocol = (url) => (url.startsWith('//') ? 'https:' + url : url);

// Turn a schedule link into { type: 'iframe' | 'hls' | 'external', url }.
// onhockey.tv's np_*.php pages only wrap the channel in a player, so the
// embed URL can be built directly from the link without fetching the page.
export function resolveStream(href) {
  if (!href.startsWith('np_')) {
    return { type: 'external', url: withProtocol(href) };
  }

  // Split on the first "?" only: the channel itself may contain one (e.g. "ch?id=46").
  const q = href.indexOf('?');
  const page = q === -1 ? href : href.slice(0, q);
  const channel = q === -1 ? '' : decodeURIComponent(href.slice(q + 1).replace(/^channel=/, ''));

  switch (page) {
    case 'np_stream400.php':
      return { type: 'iframe', url: withProtocol(channel) };
    case 'np_youtube.php':
      return { type: 'iframe', url: `https://www.youtube.com/embed/${channel}?autoplay=1` };
    case 'np_vk.php': {
      const [oid, rest] = channel.split('&id=');
      return { type: 'iframe', url: `https://vkvideo.ru/video_ext.php?oid=${oid}&id=${rest}&autoplay=1` };
    }
    case 'np_webcaster.php':
      return {
        type: 'iframe',
        url: `https://webcaster.pro/iframe/feed/start/${channel}?width=710&height=400&iframe_width=710&iframe_height=400&lang=en&autostart=1`,
      };
    case 'np_fluidtv.php':
      return { type: 'hls', url: withProtocol(channel) };
    default:
      return { type: 'external', url: 'https://onhockey.tv/' + href };
  }
}

// The helper extension (extension/) fetches onhockey.tv with the viewer's own
// browser, since Cloudflare challenges Vercel's servers. It marks <html> when present.
export const hasExtension = () =>
  typeof document !== 'undefined' && !!document.documentElement.dataset.onhockeyExtension;

export function fetchScheduleViaExtension(timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('The OnHockey helper extension did not respond.'));
    }, timeoutMs);

    function onMessage(event) {
      if (event.source !== window || event.data?.source !== 'onhockey-extension' || event.data.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.html);
    }

    window.addEventListener('message', onMessage);
    window.postMessage({ source: 'onhockey-app', type: 'fetchSchedule', id }, window.location.origin);
  });
}
