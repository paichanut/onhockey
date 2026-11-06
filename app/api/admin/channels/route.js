import { isAdmin } from '@/lib/admin-auth';
import { getChannels, parseChannelInput, REGIONS, saveChannels } from '@/lib/channels';
import { fetchChannelStreams } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

const denied = () => Response.json({ error: 'Log in first.' }, { status: 401 });
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

export async function GET(request) {
  if (!isAdmin(request)) return denied();
  return Response.json({ channels: await getChannels(), regions: REGIONS });
}

// POST {url, name?, region}: checks the channel exists on YouTube, then adds it.
export async function POST(request) {
  if (!isAdmin(request)) return denied();
  const { url, name, region } = await request.json().catch(() => ({}));
  const handle = parseChannelInput(url);
  if (!handle) return Response.json({ error: 'Paste a YouTube channel link or @handle.' }, { status: 400 });
  const channels = await getChannels();
  if (channels.some((c) => same(c.handle, handle))) {
    return Response.json({ error: `${handle} is already on the list.` }, { status: 409 });
  }
  let found;
  try {
    found = await fetchChannelStreams(handle, 5);
  } catch (err) {
    return Response.json({ error: `Could not find that channel on YouTube (${err.message}).` }, { status: 400 });
  }
  const channel = {
    handle,
    region: REGIONS.includes(region) ? region : 'Other',
    name: String(name || '').trim().slice(0, 80) || found.name || handle,
  };
  const next = [...channels, channel];
  try {
    await saveChannels(next);
  } catch (err) {
    return Response.json({ error: `Could not save: ${err.message}` }, { status: 503 });
  }
  return Response.json({ channels: next, added: channel });
}

// DELETE ?handle=@name: removes the channel.
export async function DELETE(request) {
  if (!isAdmin(request)) return denied();
  const handle = new URL(request.url).searchParams.get('handle') || '';
  const channels = await getChannels();
  const next = channels.filter((c) => !same(c.handle, handle));
  if (next.length === channels.length) return Response.json({ error: 'Not on the list.' }, { status: 404 });
  try {
    await saveChannels(next);
  } catch (err) {
    return Response.json({ error: `Could not save: ${err.message}` }, { status: 503 });
  }
  return Response.json({ channels: next });
}
