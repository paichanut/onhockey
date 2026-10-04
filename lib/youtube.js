// Reads a YouTube channel's Live tab (server side: YouTube sends no CORS headers)
// and returns its live, upcoming and recent streams.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function findAll(node, key, out = []) {
  if (Array.isArray(node)) node.forEach((n) => findAll(n, key, out));
  else if (node && typeof node === 'object') {
    if (key in node) out.push(node[key]);
    else Object.values(node).forEach((n) => findAll(n, key, out));
  }
  return out;
}

// "Scheduled for 10/5/26, 2:50 AM" (rendered in UTC, see the PREF cookie) -> ISO time.
function parseScheduled(text) {
  const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!m) return null;
  const [, mo, d, y, h, min, ap] = m;
  const hour = (Number(h) % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0);
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  return new Date(Date.UTC(year, Number(mo) - 1, Number(d), hour, Number(min))).toISOString();
}

export async function fetchChannelStreams(handle, limit = 8) {
  const url = `https://www.youtube.com/${handle}/streams`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'en-US,en;q=0.9',
      // Skip the EU cookie-consent interstitial; tz=UTC makes "Scheduled for" times UTC.
      Cookie: 'CONSENT=YES+1; SOCS=CAI; PREF=tz=UTC',
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`YouTube responded ${response.status}`);
  const html = await response.text();

  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!match) throw new Error('YouTube page format changed');
  const data = JSON.parse(match[1]);

  const name = findAll(data, 'channelMetadataRenderer')[0]?.title || handle;
  const videos = findAll(data, 'lockupViewModel').map((v) => {
    const meta = v.metadata?.lockupMetadataViewModel || {};
    const parts = (meta.metadata?.contentMetadataViewModel?.metadataRows || [])
      .flatMap((r) => r.metadataParts || [])
      .map((p) => p.text?.content || '');
    const badges = findAll(v.contentImage, 'thumbnailBadgeViewModel');
    const badgeText = badges.map((b) => `${b.text || ''} ${b.badgeStyle || ''}`).join(' ').toUpperCase();
    const status = badgeText.includes('LIVE')
      ? 'live'
      : badgeText.includes('UPCOMING') || parts.some((p) => /^Scheduled for/i.test(p))
        ? 'upcoming'
        : 'past';
    const when =
      parts.find((p) => /^Scheduled for|^Streamed|ago$|watching$/i.test(p)) || '';
    return {
      id: v.contentId,
      title: meta.title?.content || '',
      status,
      when: when.replace(/^Streamed\s+/i, ''),
      startsAt: status === 'upcoming' ? parseScheduled(when) : null,
      duration: status === 'past' ? badges[0]?.text || '' : '',
    };
  }).filter((v) => v.id);

  const order = { live: 0, upcoming: 1, past: 2 };
  videos.sort((a, b) => order[a.status] - order[b.status]);
  return { name, url: `https://www.youtube.com/${handle}`, videos: videos.slice(0, limit) };
}
