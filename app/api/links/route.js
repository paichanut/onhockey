import { NextResponse } from 'next/server';

// Proxy URL (home PC tunnel — Cloudflare blocks Vercel datacenter IPs)
const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || 'https://labouringly-pseudonational-yvonne.ngrok-free.dev';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const league = searchParams.get('league');
  const game = searchParams.get('game');
  const source = searchParams.get('source');

  try {
    if (!game || isNaN(parseInt(game))) {
      return NextResponse.json({ error: 'Missing game parameter' }, { status: 400 });
    }

    // Call local proxy instead of onhockey.tv directly (Cloudflare 403 on Vercel)
    const proxyUrl = `${PROXY_URL}/api/links?league=${encodeURIComponent(league)}&game=${game}&source=${encodeURIComponent(source || '')}`;
    const proxyResponse = await fetch(proxyUrl, {
      cache: 'no-store',
    });

    if (!proxyResponse.ok) {
      return NextResponse.json({ error: `Proxy fetch failed: ${proxyResponse.status}` }, { status: 500 });
    }

    const data = await proxyResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
