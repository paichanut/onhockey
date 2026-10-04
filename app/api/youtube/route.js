import { fetchChannelStreams } from '@/lib/youtube';

// YouTube channels shown alongside the onhockey.tv schedule.
const CHANNELS = [
  { handle: '@icehockeyfamily', region: 'Thailand' },
  { handle: '@ICEAGETHAILANDCHANNEL', region: 'Thailand' },
];

export async function GET() {
  const channels = await Promise.all(
    CHANNELS.map(async (c) => {
      try {
        return { ...(await fetchChannelStreams(c.handle)), region: c.region };
      } catch (err) {
        return { name: c.handle, url: `https://www.youtube.com/${c.handle}`, region: c.region, videos: [], error: err.message };
      }
    })
  );
  return Response.json(
    { channels },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } }
  );
}
