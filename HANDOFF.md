# OnHockey Live: handoff

An ad-free viewer for the onhockey.tv hockey schedule and streams, built with Next.js and hosted on Vercel.

## Deploy your own copy on Vercel

1. Get the code into a GitHub repo you control: fork `paichanut/onhockey`, or push a copy of it.
2. Go to <https://vercel.com/new>, import that repo, and click **Deploy**. Vercel detects Next.js on its own. No environment variables are needed.
3. Open the new `https://<your-project>.vercel.app` address. The setup screen offers the bookmark and the extension download.

Both the bookmark and the extension work on any `*.vercel.app` address. The bookmark is built for whatever address serves the page, and the extension matches `https://*.vercel.app/*`.

**Custom domain** (not `*.vercel.app`): the bookmark keeps working, but the extension needs the domain added to `content_scripts.matches` in `extension/manifest.json`. Then rebuild the download:

```bash
cd extension && zip -qr ../public/onhockey-extension.zip .
```

## How viewers use it

Pick one, once:

- **Extension** (Chrome or Edge on a computer): download from the setup screen, unzip, go to `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and pick the folder. After that, just open the site.
- **Bookmark** (nothing to install, works on phones): save the **OnHockey Clean** bookmark from the setup screen. Then open onhockey.tv and click it, and the site opens with the schedule.

## Why it works this way

- onhockey.tv's Cloudflare shows Vercel's servers a bot challenge (`403`, `cf-mitigated: challenge`), so the server can't fetch the schedule. Other data-center hosts are likely to be treated the same way.
- Browsers don't let a page read onhockey.tv (no CORS headers), and the schedule endpoint also needs an onhockey.tv `Referer`.
- So the schedule is fetched with the viewer's own access to onhockey.tv. The extension or the bookmark does the fetch and hands the HTML to the page.

## Code map

| Path | What it does |
|---|---|
| `app/page.js` | The whole UI. Gets the schedule from the extension, then the bookmark's tab, then `/api/schedule`. Shows the setup screen when none of those work. |
| `lib/onhockey.js` | Parses the schedule HTML, shifts times to the chosen timezone, builds player URLs from `np_*.php` links, and holds the postMessage helpers and the bookmarklet. |
| `extension/` | Manifest V3 extension: a background worker fetches `schedule_table.php`, `rules.json` adds the Referer, and a content script relays to the page. |
| `public/onhockey-extension.zip` | Download of `extension/`. Rebuild it after any change to that folder. |
| `app/api/schedule/route.js` | Server relay. It only works where onhockey.tv isn't blocked, or through the optional home proxy (`PROXY_URL`). |
| `proxy/` | Optional home-PC relay (Express) exposed with ngrok. |
| `vercel.json` | Pins the Next.js framework and the `sin1` region. |

## Commands

```bash
npm install
npm run dev     # http://localhost:3000 (the extension also works on localhost)
npm run build
```

## Known limits

- The extension only works in desktop Chrome or Edge, and needs Developer mode.
- With the bookmark, keep the onhockey.tv tab open for Refresh to work.
- If onhockey.tv changes its schedule HTML or player page names (`np_stream400.php`, `np_youtube.php`, and so on), update `parseSchedule` and `resolveStream` in `lib/onhockey.js`.
