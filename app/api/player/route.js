import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const playerUrl = searchParams.get('url');

  try {
    if (!playerUrl) {
      return NextResponse.json({ error: 'Missing player URL' }, { status: 400 });
    }

    const response = await fetch('https://onhockey.tv/' + playerUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const iframe = $('iframe').first();
    const embedUrl = iframe.attr('src');

    const title = $('title').text().trim();

    return NextResponse.json({
      embedUrl: embedUrl,
      title: title,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
