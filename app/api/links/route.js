import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const leagueName = searchParams.get('league');
  const gameIndex = parseInt(searchParams.get('game'));
  const source = searchParams.get('source');

  try {
    if (isNaN(gameIndex)) {
      return NextResponse.json({ error: 'Missing game parameter' }, { status: 400 });
    }

    // Fetch schedule data
    const scheduleResponse = await fetch('https://onhockey.tv/schedule_table.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://onhockey.tv/',
      },
      cache: 'no-store',
    });

    if (!scheduleResponse.ok) {
      return NextResponse.json({ error: `Schedule fetch failed: ${scheduleResponse.status}` }, { status: 500 });
    }

    const scheduleHtml = await scheduleResponse.text();
    const cleanedHtml = scheduleHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

    const $ = cheerio.load(cleanedHtml, { xmlMode: false, decodeEntities: true });

    // Find the league by name
    let targetLeague = null;
    let foundLeagueName = null;
    
    if (leagueName) {
      // Find league by name
      $('#gametable tbody').each(function () {
        const tbody = $(this);
        const firstTr = tbody.find('tr').first();
        const name = firstTr.find('td:nth-child(2) b').text().trim();
        if (name === leagueName) {
          targetLeague = tbody;
          foundLeagueName = name;
          return false; // break
        }
      });
    } else {
      // Fallback: use first league
      targetLeague = $('#gametable tbody').first();
    }

    if (!targetLeague) {
      return NextResponse.json({ error: 'League not found', links: [] }, { status: 404 });
    }

    const gameRow = targetLeague.find('tr.game').eq(gameIndex);

    if (gameRow.length === 0) {
      return NextResponse.json({ error: 'Game not found', links: [] }, { status: 404 });
    }

    const links = gameRow.find('.gamelinks a').map(function () {
      return {
        name: $(this).text().trim(),
        url: $(this).attr('href'),
        title: $(this).attr('title') || '',
      };
    }).toArray();

    // If specific source requested, get embed URL
    if (source && links.length > 0) {
      const sourceLink = links.find(l => l.name.toLowerCase() === source.toLowerCase());
      if (sourceLink && sourceLink.url) {
        const playerResponse = await fetch('https://onhockey.tv/' + sourceLink.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          cache: 'no-store',
        });

        if (playerResponse.ok) {
          const playerHtml = await playerResponse.text();
          const player$ = cheerio.load(playerHtml);
          const iframe = player$('iframe').first();
          const embedUrl = iframe.attr('src');
          const title = player$('title').text().trim();
          return NextResponse.json({ embedUrl, title });
        }
      }
    }

    return NextResponse.json({ links, league: foundLeagueName });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
