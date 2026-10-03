# OnHockey Live

A clean, ad-free web interface for watching ice hockey live streams from onhockey.tv.

## Features

- 🏒 View live hockey schedules from multiple leagues (NHL, KHL, Liiga, SHL, etc.)
- 🔄 Manual refresh for schedule and stream links
- 🌍 Timezone support for global users
- 🎯 League filters to find games quickly
- 📺 Click-to-play streaming with no ads or redirects
- 🖥️ Clean, dark-themed interface

## How It Works

Everything runs in your browser. The schedule comes from code running with your own access to onhockey.tv: a bookmark (nothing to install) or the helper extension.

- onhockey.tv's Cloudflare blocks requests from Vercel's servers, and a normal web page isn't allowed to read another site. So the **OnHockey Live Helper** browser extension (`extension/`) fetches the schedule with your own browser and hands it to the page.
- The page parses the schedule, shifts game times to your timezone, and builds each stream's player URL straight from the link (`lib/onhockey.js`).

### Bookmark (nothing to install)

On onhockey.vercel.app's setup screen, drag **🏒 OnHockey Clean** to your bookmarks bar. Open onhockey.tv and click it: the clean site opens with the schedule, and Refresh keeps working while the onhockey.tv tab stays open.

### Install the extension (Chrome or Edge on a computer, one time)

1. Download [onhockey-extension.zip](https://onhockey.vercel.app/onhockey-extension.zip) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**, click **Load unpacked**, and pick the unzipped folder.
4. Refresh onhockey.vercel.app.

After changing `extension/`, rebuild the download with `cd extension && zip -qr ../public/onhockey-extension.zip .`

Without the extension, `/api/schedule` tries a server relay, which only works while the optional home-PC proxy in `proxy/` is running behind ngrok (`cd proxy && npm start`, then `ngrok http --url=labouringly-pseudonational-yvonne.ngrok-free.dev 3001`).

## Setup

### Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deploy to Vercel

1. Push this repository to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Click "Deploy"

That's it! Vercel will automatically detect it's a Next.js project and deploy it.

## Architecture

- **Next.js** - React framework
- **`lib/onhockey.js`** - Browser-side schedule parsing and stream URL resolution
- **`app/api/schedule`** - The only server route: relays the raw schedule HTML
- **hls.js** - Plays `.m3u8` streams in browsers without native HLS
- **`proxy/`** - Optional Express fallback relay for when the Vercel server is blocked

## License

ISC
