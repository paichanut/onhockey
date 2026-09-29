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

This app fetches the schedule from onhockey.tv server-side (bypassing ads and redirects) and displays it in a clean interface. Stream links are loaded on-demand when you click on a game.

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

- **Next.js** - React framework with server-side rendering
- **Cheerio** - HTML parsing for fetching schedule data
- **Server-side API routes** - Fetches data from onhockey.tv server-side to avoid ads

### API Routes

- `/api/schedule` - Fetches and parses the hockey schedule
- `/api/links` - Fetches stream links for a specific game
- `/api/player` - Fetches the embed URL for a stream

## License

ISC
