// Thin relay: browsers can't read onhockey.tv directly (no CORS headers, and
// the schedule endpoint requires an onhockey.tv Referer), so this route only
// passes the raw schedule HTML through. All parsing happens in the browser.

const SCHEDULE_URL = 'https://onhockey.tv/schedule_table.php';

// Optional fallback (e.g. the home-PC proxy in proxy/) if onhockey.tv blocks this server.
const PROXY_URL = process.env.PROXY_URL || process.env.NEXT_PUBLIC_PROXY_URL;

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.5',
  'X-Requested-With': 'XMLHttpRequest',
  Referer: 'https://onhockey.tv/',
};

async function fetchDirect() {
  const response = await fetch(SCHEDULE_URL, { headers: HEADERS, cache: 'no-store' });
  if (!response.ok) {
    // Include a snippet so a block (Cloudflare page vs. the site's own refusal) is visible.
    const snippet = (await response.text()).replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(
      `onhockey.tv responded ${response.status} (server: ${response.headers.get('server')}, ` +
        `cf-mitigated: ${response.headers.get('cf-mitigated')}): ${snippet}`
    );
  }
  // onhockey.tv serves windows-1251; decode it so the browser gets clean UTF-8.
  return new TextDecoder('windows-1251').decode(await response.arrayBuffer());
}

async function fetchViaProxy() {
  const response = await fetch(`${PROXY_URL}/api/schedule_raw`, {
    headers: { 'ngrok-skip-browser-warning': '1' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`proxy responded ${response.status}`);
  return response.text();
}

export async function GET() {
  let html;
  try {
    html = await fetchDirect();
  } catch (directError) {
    if (!PROXY_URL) {
      return new Response(directError.message, { status: 502 });
    }
    try {
      html = await fetchViaProxy();
    } catch (proxyError) {
      return new Response(`${directError.message}; ${proxyError.message}`, { status: 502 });
    }
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Let Vercel's CDN absorb repeat requests so onhockey.tv sees few hits.
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60',
    },
  });
}
