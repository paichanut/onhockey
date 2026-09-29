import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const timezone = searchParams.get('timezone') || '07';

  try {
    // Step 1: Fetch main page to get cf_clearance cookie
    const mainResponse = await fetch('https://onhockey.tv/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      cache: 'no-store',
    });

    if (!mainResponse.ok) {
      return NextResponse.json({ error: `Main page fetch failed: ${mainResponse.status}` }, { status: 500 });
    }

    // Extract cookies from the response
    const setCookieHeaders = mainResponse.headers.getSetCookie?.() || [];
    const cookies = setCookieHeaders.map(c => c.split(';')[0]).join('; ');

    // Step 2: Fetch schedule data from the AJAX endpoint
    const scheduleResponse = await fetch('https://onhockey.tv/schedule_table.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://onhockey.tv/',
        'Cookie': cookies,
      },
      cache: 'no-store',
    });

    if (!scheduleResponse.ok) {
      return NextResponse.json({ error: `Schedule fetch failed: ${scheduleResponse.status}` }, { status: 500 });
    }

    const scheduleHtml = await scheduleResponse.text();
    
    // Remove script and style tags before parsing
    const cleanedHtml = scheduleHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    const $ = cheerio.load(cleanedHtml, { xmlMode: false, decodeEntities: true });

    const leagues = [];
    let currentLeague = null;

    $('#gametable tbody').each(function () {
      const tbody = $(this);
      const firstTr = tbody.find('tr').first();
      const leagueName = firstTr.find('td:nth-child(2) b').text().trim();
      const leagueClass = tbody.attr('class') || '';

      if (leagueName) {
        currentLeague = {
          name: leagueName,
          class: leagueClass,
          games: [],
        };
        leagues.push(currentLeague);
      }

      if (currentLeague) {
        tbody.find('tr.game').each(function () {
          const game = $(this);
          const gameHour = game.find('.game_hour').text().trim();
          const timeCell = game.find('td:first-child').html() || '';
          const timeMinutes = timeCell.replace(/<[^>]*>/g, '').replace(gameHour, '').replace(':', '').trim();
          const gameTime = gameHour + ':' + timeMinutes;
          const teams = game.find('td:nth-child(2)').text().trim();
          const linksDiv = game.find('.gamelinks');
          const links = linksDiv.find('a').map(function () {
            return {
              name: $(this).text().trim(),
              url: $(this).attr('href'),
              title: $(this).attr('title') || '',
            };
          }).toArray();
          const hasLinks = links.length > 0;
          const liveCell = game.find('.liveon');
          const liveText = liveCell.text().trim();
          const isLive = liveText !== '';
          const liveCount = liveText.match(/\d+/)?.[0] || '';

          if (hasLinks) {
            currentLeague.games.push({
              time: gameTime,
              teams: teams,
              hasLinks: true,
              isLive: isLive,
              liveCount: liveCount,
              links: links,
            });
          } else {
            currentLeague.games.push({
              time: gameTime,
              teams: teams,
              hasLinks: false,
              isLive: false,
              liveCount: '',
              links: [],
            });
          }
        });
      }
    });

    console.log(`Parsed ${leagues.length} leagues, ${leagues.reduce((s, l) => s + l.games.length, 0)} games`);

    return NextResponse.json({ leagues, timezone });
  } catch (error) {
    console.error('Schedule fetch error:', error);
    return NextResponse.json({ error: error.message, leagues: [], timezone }, { status: 500 });
  }
}
