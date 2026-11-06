import { getChannels } from '@/lib/channels';
import { fetchChannelStreams } from '@/lib/youtube';

// Channels come from the list edited on /admin (lib/channels.js).

export async function GET() {
  const list = await getChannels();
  const channels = await Promise.all(
    list.map(async (c) => {
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
