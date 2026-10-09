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

## Home server (Ubuntu): links with no extension or bookmark

onhockey.tv doesn't block home internet connections. With the proxy in `proxy/` running on a home server and exposed through ngrok, the Vercel site gets the schedule through it. Viewers then just open the site, on any device.

1. Install the tools:
   ```bash
   sudo apt-get update && sudo apt-get install -y git curl
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs
   curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
   echo "deb https://ngrok-agent.s3.amazonaws.com bookworm main" | sudo tee /etc/apt/sources.list.d/ngrok.list
   sudo apt-get update && sudo apt-get install -y ngrok
   sudo npm install -g pm2
   ```
2. Log in to ngrok once. Get the token from dashboard.ngrok.com → **Your Authtoken**, and never commit it:
   ```bash
   ngrok config add-authtoken <your-token>
   ```
3. Get the code and start the proxy:
   ```bash
   git clone https://github.com/paichanut/onhockey.git ~/onhockey   # or: cd ~/onhockey && git pull
   cd ~/onhockey/proxy && npm install
   pm2 start proxy-server.js --name onhockey-proxy
   ```
4. Start the tunnel. Use the static domain from dashboard.ngrok.com → **Domains** (each free account gets one):
   ```bash
   pm2 start "ngrok http --url=<your-domain>.ngrok-free.dev 3001" --name onhockey-tunnel
   pm2 save && pm2 startup systemd   # then run the sudo command it prints
   ```
5. Point the site at your tunnel. The site's built-in default is `https://labouringly-pseudonational-yvonne.ngrok-free.dev`. If your domain is different, set `PROXY_URL=https://<your-domain>.ngrok-free.dev` in Vercel → Project → Settings → Environment Variables, then redeploy.
6. Check each step (every count should be above 0):
   ```bash
   pm2 status                                                           # both "online"
   curl -s localhost:3001/api/schedule_raw | grep -c "tr class='game'"  # proxy works
   curl -s -H "ngrok-skip-browser-warning: 1" https://<your-domain>.ngrok-free.dev/api/schedule_raw | grep -c "tr class='game'"  # tunnel works
   curl -s https://onhockey.vercel.app/api/schedule | grep -c "tr class='game'"   # live site works
   ```

**Troubleshooting**
- `ERR_NGROK_3200`: the tunnel is offline. Check `pm2 logs onhockey-tunnel --lines 30 --nostream`.
- "domain is not reserved" or similar: the domain belongs to a different ngrok account than the one logged in.
- A free ngrok account runs one tunnel at a time, so stop ngrok on any other computer.
- The proxy works but the live site doesn't: `PROXY_URL` (step 5) doesn't match your tunnel's address.

## Google TV / Android TV app

`android-tv/` is a sideload-only WebView app for TVs; viewers download it from
`https://onhockey.vercel.app/onhockey-tv.apk` (built copy in `public/`). It fetches the schedule
natively from the viewer's own connection, so it does not need the home server. Install and
build steps: `android-tv/README.md`. The site's TV support (remote navigation, native fetch)
lives in `lib/tv.js` and turns on inside the app or with `?tv=1`.

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
| `lib/tv.js` | TV app support: native schedule fetch through `window.OnHockeyTV` and D-pad (arrow key) focus navigation. |
| `android-tv/` | The Google TV / Android TV WebView app (sideload only). |
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
