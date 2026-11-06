// The YouTube channels shown on the site. The list lives in Vercel Blob (channels.json), edited
// from /admin; until the first save, or if Blob is unreachable, DEFAULT_CHANNELS is used.
import { list, put } from '@vercel/blob';

const BLOB_PATH = 'channels.json';

// Regions the admin can pick; each maps to a filter chip on the site (see app/page.js).
export const REGIONS = ['Thailand', 'Korea', 'Taiwan', 'Asia', 'USA', 'Other'];

export const DEFAULT_CHANNELS = [
  { handle: '@icehockeyfamily', region: 'Thailand' },
  { handle: '@ICEAGETHAILANDCHANNEL', region: 'Thailand' },
  { handle: '@Thatritorn', region: 'Thailand' },
  { handle: '@bkkicehockeychannel', region: 'Thailand', name: 'BKK Ice Hockey' },
  { handle: '@subzeroiceskateclub', region: 'Thailand', name: 'Sub-Zero Ice Skate Club' },
  { handle: '@ljfilmsports', region: 'Korea', name: 'LJ Film Sports' },
  { handle: '@unproanchor', region: 'Taiwan', name: 'Unpro Hockey Live' },
  { handle: '@powerplayse', region: 'Asia', name: 'PowerplaySE' },
  { handle: '@hockeytvkorea', region: 'Korea', name: 'Hockey TV Korea' },
  { handle: '@seoulicehockey', region: 'Korea', name: 'Seoul Ice Hockey Association' },
  { handle: '@ThunderHockey-L3tsgo', region: 'USA', name: 'Thunder Hockey' },
];

const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function getChannels() {
  if (!hasBlob()) return DEFAULT_CHANNELS;
  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    const blob = blobs.find((b) => b.pathname === BLOB_PATH);
    if (!blob) return DEFAULT_CHANNELS;
    // The upload time in the query skips any CDN copy of an older version.
    const res = await fetch(`${blob.url}?v=${new Date(blob.uploadedAt).getTime()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Blob responded ${res.status}`);
    const channels = await res.json();
    return Array.isArray(channels) ? channels : DEFAULT_CHANNELS;
  } catch (err) {
    console.error('Reading channels from Blob failed, using defaults:', err);
    return DEFAULT_CHANNELS;
  }
}

export async function saveChannels(channels) {
  if (!hasBlob()) throw new Error('Channel storage is not set up (BLOB_READ_WRITE_TOKEN missing).');
  await put(BLOB_PATH, JSON.stringify(channels, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}

// Accepts a channel link (youtube.com/@name, /channel/UC…, /c/name, /user/name, with or
// without https://, ?si=… or a trailing tab like /streams) or a bare @handle.
export function parseChannelInput(input) {
  const text = String(input || '').trim();
  if (/^@[\w.-]+$/.test(text)) return text;
  const m = text.match(/(?:youtube\.com|youtu\.be)\/(@[\w.-]+|channel\/UC[\w-]+|c\/[\w.-]+|user\/[\w.-]+)/i);
  return m ? m[1] : null;
}
