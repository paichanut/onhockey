import { fetchChannelStreams } from '@/lib/youtube';

// YouTube channels shown alongside the onhockey.tv schedule.
const CHANNELS = [
  { handle: '@icehockeyfamily', region: 'Thailand' },
  { handle: '@ICEAGETHAILANDCHANNEL', region: 'Thailand' },
  { handle: '@Thatritorn', region: 'Thailand' },
  { handle: '@ljfilmsports', region: 'Korea', name: 'LJ Film Sports' },
  { handle: '@unproanchor', region: 'Taiwan', name: 'Unpro Hockey Live' },
  { handle: '@powerplayse', region: 'Asia', name: 'PowerplaySE' },
];

export async function GET() {
  const channels = await Promise.all(
    CHANNELS.map(async (c) => {
      try {
        const result = await fetchChannelStreams(c.handle);
        return { ...result, name: c.name || result.name, region: c.region };
      } catch (err) {
        return { name: c.name || c.handle, url: `https://www.youtube.com/${c.handle}`, region: c.region, videos: [], error: err.message };
      }
    })
  );
  return Response.json(
    { channels },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
  );
}
