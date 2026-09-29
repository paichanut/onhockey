import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Cache for cookies (cf_clearance)
let cachedCookies = '';
let cookieExpiry = 0;
const COOKIE_TTL = 25 * 60 * 1000; // 25 minutes (Cloudflare cookies last ~30 min)

async function getCookies() {
  const now = Date.now();
  if (cachedCookies && now < cookieExpiry) {
    return cachedCookies;
  }

  try {
    const response = await axios.get('https://onhockey.tv/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const setCookieHeaders = response.headers['set-cookie'] || [];
    cachedCookies = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
    cookieExpiry = now + COOKIE_TTL;
    return cachedCookies;
  } catch (error) {
    console.error('Failed to fetch cookies:', error.message);
    return cachedCookies; // Return stale cookies as fallback
  }
}

async function fetchScheduleHtml() {
  const cookies = await getCookies();
  
  const response = await axios.get('https://onhockey.tv/schedule_table.php', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://onhockey.tv/',
      'Cookie': cookies,
    },
    timeout: 15000,
  });

  return response.data;
}

// Parse schedule HTML into JSON
function parseSchedule(html) {
  const cleanedHtml = html
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

  return { leagues };
}

// Parse links from schedule HTML
function parseLinks(html, leagueName, gameIndex) {
  const cleanedHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  const $ = cheerio.load(cleanedHtml, { xmlMode: false, decodeEntities: true });

  // Find the league by name
  let targetLeague = null;
  let foundLeagueName = null;
  
  $('#gametable tbody').each(function () {
    const tbody = $(this);
    const firstTr = tbody.find('tr').first();
    const name = firstTr.find('td:nth-child(2) b').text().trim();
    if (name === leagueName) {
      targetLeague = tbody;
      foundLeagueName = name;
      return false;
    }
  });

  if (!targetLeague) {
    return { error: 'League not found', links: [] };
  }

  const gameRow = targetLeague.find('tr.game').eq(gameIndex);

  if (gameRow.length === 0) {
    return { error: 'Game not found', links: [] };
  }

  const links = gameRow.find('.gamelinks a').map(function () {
    return {
      name: $(this).text().trim(),
      url: $(this).attr('href'),
      title: $(this).attr('title') || '',
    };
  }).toArray();

  return { links, league: foundLeagueName };
}

// Fetch player page and extract iframe
async function fetchPlayerEmbed(playerUrl) {
  const cookies = await getCookies();
  
  const response = await axios.get('https://onhockey.tv/' + playerUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': cookies,
    },
    timeout: 15000,
  });

  const player$ = cheerio.load(response.data);
  const iframe = player$('iframe').first();
  const embedUrl = iframe.attr('src');
  const title = player$('title').text().trim();

  return { embedUrl, title };
}

// Cache for schedule data (refresh every 5 minutes)
let scheduleCache = null;
let scheduleCacheExpiry = 0;
const SCHEDULE_TTL = 5 * 60 * 1000;

app.get('/api/schedule', async (req, res) => {
  const now = Date.now();
  if (scheduleCache && now < scheduleCacheExpiry) {
    return res.json(scheduleCache);
  }

  try {
    const html = await fetchScheduleHtml();
    const parsed = parseSchedule(html);
    scheduleCache = parsed;
    scheduleCacheExpiry = now + SCHEDULE_TTL;
    res.json(parsed);
  } catch (error) {
    console.error('Schedule fetch error:', error.message);
    res.status(500).json({ error: error.message, leagues: [] });
  }
});

app.get('/api/links', async (req, res) => {
  const { league, game, source } = req.query;

  if (!game || isNaN(parseInt(game))) {
    return res.status(400).json({ error: 'Missing game parameter' });
  }

  try {
    const html = await fetchScheduleHtml();
    const parsed = parseLinks(html, league, parseInt(game));

    if (parsed.error) {
      return res.status(parsed.error === 'League not found' || parsed.error === 'Game not found' ? 404 : 500).json(parsed);
    }

    // If specific source requested, get embed URL
    if (source && parsed.links.length > 0) {
      const sourceLink = parsed.links.find(l => l.name.toLowerCase() === source.toLowerCase());
      if (sourceLink && sourceLink.url) {
        const embed = await fetchPlayerEmbed(sourceLink.url);
        return res.json(embed);
      }
    }

    res.json(parsed);
  } catch (error) {
    console.error('Links fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Player endpoint - fetch player page HTML for client-side iframe extraction
app.get('/api/player', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const cookies = await getCookies();
    const response = await axios.get('https://onhockey.tv/' + url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookies,
      },
      timeout: 15000,
    });

    // Return full HTML for client to extract iframe
    res.type('text/html').send(response.data);
  } catch (error) {
    console.error('Player fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy server running on port ${PORT}`);
});
