import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const gameKey = searchParams.get('game'); // league_index:game_index
  const source = searchParams.get('source'); // youtube, wcaster, etc.

  try {
    if (!gameKey || !source) {
      return NextResponse.json({ error: 'Missing game or source parameter' }, { status: 400 });
    }

    const [leagueIndex, gameIndex] = gameKey.split(':');

    // Fetch the main page to get the schedule
    const pageResponse = await fetch('https://onhockey.tv/', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      cache: 'no-store',
    });

    if (!pageResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 });
    }

    const html = await pageResponse.text();
    const $ = cheerio.load(html);

    // Find the specific game and get its stream links
    const league = $('tbody').eq(parseInt(leagueIndex));
    const gameRow = league.find('tr.game').eq(parseInt(gameIndex));

    const links = gameRow.find('.gamelinks a').map(function () {
      return {
        name: $(this).text().trim(),
        url: $(this).attr('href'),
        title: $(this).attr('title'),
      };
    });

    // If specific source requested, fetch the player page
    if (source) {
      const sourceLink = gameRow.find(`.gamelinks a:contains("${source}")`).first();
      const playerUrl = sourceLink.attr('href');

      if (playerUrl) {
        const playerResponse = await fetch('https://onhockey.tv/' + playerUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          cache: 'no-store',
        });

        if (playerResponse.ok) {
          const playerHtml = await playerResponse.text();
          const player$ = cheerio.load(playerHtml);

          const iframe = player$('iframe').first();
          const embedUrl = iframe.attr('src');

          return NextResponse.json({
            embedUrl: embedUrl,
            title: player$('title').text().trim(),
          });
        }
      }
    }

    return NextResponse.json({ links: links.toArray() });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
