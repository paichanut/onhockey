import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const timezone = searchParams.get('timezone') || '07';

  try {
    const response = await fetch('https://onhockey.tv/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const leagues = [];
    let currentLeague = null;

    $('tbody').each(function () {
      const leagueRow = $(this).find('tr').first();
      const leagueName = leagueRow.find('td:nth-child(2) b').text().trim();
      const leagueClass = $(this).attr('class');

      if (leagueName) {
        currentLeague = {
          name: leagueName,
          class: leagueClass,
          games: [],
        };
        leagues.push(currentLeague);
      }

      if (currentLeague) {
        $(this).find('tr.game').each(function () {
          const time = $(this).find('.game_hour').text().trim();
          const minutes = $(this).find('td:nth-child(1)')
            .text()
            .replace(time, '')
            .replace(':', '')
            .trim();
          const gameTime = time + ':' + minutes;
          const teams = $(this).find('td:nth-child(2)').text().trim();
          const hasLinks = $(this).find('.gamelinks a').length > 0;
          const isLive = $(this).find('.liveon b').text().trim() !== '';
          const liveCount = $(this).find('.liveon b').text().match(/\d+/)?.[0] || '';

          currentLeague.games.push({
            time: gameTime,
            teams: teams,
            hasLinks: hasLinks,
            isLive: isLive,
            liveCount: liveCount,
          });
        });
      }
    });

    return NextResponse.json({ leagues, timezone });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
