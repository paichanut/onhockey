import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Proxy URL (home PC tunnel — Cloudflare blocks Vercel datacenter IPs)
const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || 'https://labouringly-pseudonational-yvonne.ngrok-free.dev';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const timezone = searchParams.get('timezone') || '07';

  try {
    // Call local proxy instead of onhockey.tv directly (Cloudflare 403 on Vercel)
    const proxyResponse = await fetch(`${PROXY_URL}/api/schedule`, {
      cache: 'no-store',
    });

    if (!proxyResponse.ok) {
      return NextResponse.json({ error: `Proxy fetch failed: ${proxyResponse.status}` }, { status: 500 });
    }

    const data = await proxyResponse.json();
    return NextResponse.json({ leagues: data.leagues, timezone });
  } catch (error) {
    console.error('Schedule fetch error:', error);
    return NextResponse.json({ error: error.message, leagues: [], timezone }, { status: 500 });
  }
}
