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

Almost everything runs in the browser:

- `/api/schedule` is a thin relay that passes onhockey.tv's raw schedule HTML through. It exists only because browsers can't read onhockey.tv directly (the site sends no CORS headers and requires an onhockey.tv `Referer`). Responses are cached on Vercel's CDN for 60 seconds.
- The browser parses the schedule, shifts game times to your timezone, and builds each stream's player URL straight from the link (`lib/onhockey.js`). Playing a stream makes no request to onhockey.tv.

Cloudflare shows Vercel's servers a bot challenge, so on Vercel the relay gets the schedule through the home-PC proxy in `proxy/`, exposed with ngrok. Keep it running:

```bash
cd proxy && npm install && npm start          # listens on port 3001
ngrok http --url=labouringly-pseudonational-yvonne.ngrok-free.dev 3001
```

Set `PROXY_URL` in Vercel to use a different proxy address.

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
