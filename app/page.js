"use client";

import { useState, useEffect, useRef } from 'react';
import {
  parseSchedule,
  resolveStream,
  shiftHour,
  hasExtension,
  fetchScheduleViaExtension,
  openedByBookmarklet,
  fetchScheduleViaBookmarklet,
  bookmarklet,
} from '@/lib/onhockey';

const TIMEZONES = [
  { value: '-08', label: 'Anchorage (AKDT/GMT-8)' },
  { value: '-07', label: 'Los Angeles (PDT/GMT-7)' },
  { value: '-06', label: 'Denver (MDT/GMT-6)' },
  { value: '-05', label: 'Chicago (CDT/GMT-5)' },
  { value: '-04', label: 'New York (EDT/GMT-4)' },
  { value: '-03', label: 'Halifax (ADT/GMT-3)' },
  { value: '00', label: 'Reykjavik (GMT0)' },
  { value: '01', label: 'London (GMT+1)' },
  { value: '02', label: 'Stockholm (GMT+2)' },
  { value: '03', label: 'Helsinki (GMT+3)' },
  { value: '04', label: 'Togliatti (GMT+4)' },
  { value: '05', label: 'Astana (GMT+5)' },
  { value: '06', label: 'Omsk (GMT+6)' },
  { value: '07', label: 'Bangkok (GMT+7)' },
  { value: '08', label: 'Shanghai (GMT+8)' },
  { value: '09', label: 'Tokyo (GMT+9)' },
  { value: '10', label: 'Sydney (GMT+10)' },
  { value: '11', label: 'Magadan (GMT+11)' },
  { value: '12', label: 'Auckland (GMT+12)' },
];

const LEAGUE_FILTERS = [
  { value: 'NA', label: 'North America' },
  { value: 'RU', label: 'Russia/KZ/BY' },
  { value: 'FI', label: 'Finland' },
  { value: 'SE', label: 'Sweden' },
  { value: 'CZ', label: 'Czech/Slovakia' },
  { value: 'DK', label: 'Nordics' },
  { value: 'CH', label: 'Swiss/Germany' },
  { value: 'AT', label: 'Austria/Central' },
  { value: 'LV', label: 'Baltic/Poland' },
  { value: 'OTH', label: 'UK & others' },
  { value: 'INT', label: 'International' },
  { value: 'TH', label: 'Thailand' },
];

// Plays .m3u8 streams: natively in Safari, via hls.js everywhere else.
function HlsVideo({ src }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }
    let hls;
    import('hls.js').then(({ default: Hls }) => {
      if (!Hls.isSupported()) return;
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    });
    return () => hls?.destroy();
  }, [src]);

  return <video ref={videoRef} controls autoPlay />;
}

function Player({ stream }) {
  return (
    <div className="player">
      {!stream ? (
        <div className="player-empty">
          <div className="play-dot">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#06101f" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </div>
          Pick a game, then a stream
        </div>
      ) : stream.type === 'hls' ? (
        <HlsVideo src={stream.url} />
      ) : (
        <iframe src={stream.url} title="Stream player" allowFullScreen allow="autoplay; encrypted-media; fullscreen" />
      )}
    </div>
  );
}

const Chevron = () => (
  <svg className="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);

const ExternalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="opens in a new tab"><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);

// Below this width the player opens inside the game's drop-down instead of beside the list.
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}

export default function Home() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsExtension, setNeedsExtension] = useState(false);
  const bookmarkletRef = useRef(null);
  const [openKey, setOpenKey] = useState(null);
  const [playing, setPlaying] = useState(null); // { key, linkUrl, linkName, stream }
  const [timezone, setTimezone] = useState('07');
  const [filters, setFilters] = useState([]);
  const [channels, setChannels] = useState([]);
  const narrow = useNarrow();

  // YouTube channels (e.g. Thai ice hockey) load independently of the onhockey.tv schedule.
  const fetchChannels = async () => {
    try {
      const response = await fetch('/api/youtube', { cache: 'no-store' });
      if (response.ok) setChannels((await response.json()).channels || []);
    } catch (err) {
      console.error('Failed to fetch YouTube channels:', err);
    }
  };

  const fetchSchedule = async () => {
    fetchChannels();
    setLoading(true);
    setError(null);

    try {
      let html;
      if (hasExtension()) {
        html = await fetchScheduleViaExtension();
      } else if (openedByBookmarklet()) {
        html = await fetchScheduleViaBookmarklet();
      } else {
        // Without the extension, the server relay works while the home proxy runs.
        const response = await fetch('/api/schedule', { cache: 'no-store' });
        if (!response.ok) {
          setNeedsExtension(true);
          throw new Error('Use the OnHockey bookmark or extension to load the schedule.');
        }
        html = await response.text();
      }
      setLeagues(parseSchedule(html));
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  // The bookmarklet points back at whichever deployment is serving this page.
  const [bookmarkletCode, setBookmarkletCode] = useState('');
  useEffect(() => {
    setBookmarkletCode(bookmarklet(window.location.origin));
  }, []);

  // React blocks javascript: URLs in href, so set the bookmarklet's address directly.
  useEffect(() => {
    if (bookmarkletCode) bookmarkletRef.current?.setAttribute('href', bookmarkletCode);
  }, [needsExtension, bookmarkletCode]);

  const playLink = (key, game, league, link) => {
    const stream = resolveStream(link.url);
    if (stream.type === 'external') {
      window.open(stream.url, '_blank', 'noopener');
      return;
    }
    setPlaying({ key, linkUrl: link.url, linkName: link.name, teams: game.teams, league: league.name, hour: game.hour, minutes: game.minutes, stream });
  };

  const playVideo = (key, channel, video) => {
    setPlaying({
      key,
      linkUrl: video.id,
      linkName: 'YouTube',
      teams: video.title,
      metaText: `${channel.name} · YouTube`,
      stream: { type: 'iframe', url: `https://www.youtube.com/embed/${video.id}?autoplay=1` },
    });
  };

  const toggleFilter = (value) => {
    setFilters(filters.includes(value) ? filters.filter((f) => f !== value) : [...filters, value]);
  };

  // Keys come from each game's position in the full schedule, so filtering keeps them stable.
  const keyed = leagues.map((league, li) => ({
    ...league,
    games: league.games.map((game, gi) => ({ ...game, key: `${li}-${gi}` })),
  }));
  const shown = filters.length ? keyed.filter((league) => filters.includes(league.class)) : keyed;
  // Only streams that are live right now; past and upcoming ones stay on YouTube.
  const shownChannels = (!filters.length || filters.includes('TH') ? channels : []).map((c) => ({
    ...c,
    videos: c.videos.filter((v) => v.status === 'live'),
  }));
  const liveCount = leagues.reduce((n, l) => n + l.games.filter((g) => g.isLive).length, 0);
  const time = (g) => `${shiftHour(g.hour, timezone)}:${g.minutes}`;

  return (
    <>
      <header className="bar">
        <div className="wrap bar-top">
          <div className="brand">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4l9 12" /><path d="M13 16h5" /><ellipse cx="18" cy="19" rx="3" ry="1.4" /></svg>
            <p className="logo">OnHockey <span>Live</span></p>
            {leagues.length > 0 && (
              <span className="pill">
                Ad-free · {leagues.length} leagues{liveCount ? ` · ${liveCount} live` : ''}
              </span>
            )}
          </div>
          <label className="tz">
            <span className="tz-label">Time zone</span>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-primary" onClick={fetchSchedule} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        <nav className="wrap chips" aria-label="Filter leagues by region">
          <button type="button" className="chip" aria-pressed={filters.length === 0} onClick={() => setFilters([])}>All</button>
          {LEAGUE_FILTERS.map((f) => (
            <button key={f.value} type="button" className="chip" aria-pressed={filters.includes(f.value)} onClick={() => toggleFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="wrap main">
        <section className="schedule" aria-label="Schedule">
          {shownChannels.map((channel, ci) => (
            <div key={channel.url} className="league">
              <div className="league-head">
                <h2>{channel.name}</h2>
                <span>{channel.region} · YouTube</span>
              </div>
              {channel.videos.length === 0 && (
                <p className="note channel-idle">
                  No live stream right now ·{' '}
                  <a href={channel.url} target="_blank" rel="noopener noreferrer">Open channel</a>
                </p>
              )}
              {channel.videos.map((video) => {
                const key = `yt-${ci}-${video.id}`;
                const isOpen = openKey === key;
                const on = playing?.key === key;
                return (
                  <div key={key} className={isOpen ? 'game is-open' : 'game'}>
                    <button
                      type="button"
                      className="game-row"
                      aria-expanded={isOpen}
                      aria-controls={`drop-${key}`}
                      onClick={() => setOpenKey(isOpen ? null : key)}
                    >
                      <span className="game-time yt"><span className="live">LIVE</span></span>
                      <span className="game-teams">{video.title}</span>
                      {video.when && <span className="game-links soon">{video.when}</span>}
                      <Chevron />
                    </button>
                    {isOpen && (
                      <div className="drop" id={`drop-${key}`}>
                        {narrow && on && <Player stream={playing.stream} />}
                        <div className="streams">
                          <button type="button" className="stream" aria-pressed={on} onClick={() => playVideo(key, channel, video)}>
                            <b>Watch here</b>
                            <small>YouTube</small>
                          </button>
                          <a className="stream" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">
                            <b>Open on YouTube<ExternalIcon /></b>
                            <small>{channel.name}</small>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {loading && !leagues.length ? (
            <div className="empty">Loading schedule…</div>
          ) : needsExtension && !leagues.length ? (
            <div className="setup">
              <h2>One-time setup</h2>
              <p style={{ margin: 0 }}>
                onhockey.tv only shares its schedule with its own pages, so this site gets it through your
                browser. Pick one:
              </p>
              <h3>Option 1: Bookmark (nothing to install)</h3>
              <ol>
                <li>
                  Drag this button to your bookmarks bar:{' '}
                  <a ref={bookmarkletRef} className="bookmarklet" onClick={(e) => e.preventDefault()}>🏒 OnHockey Clean</a>
                </li>
                <li>Open <b>onhockey.tv</b> and click the bookmark. This page opens with the schedule.</li>
                <li>Keep the onhockey.tv tab open in the background so Refresh keeps working.</li>
              </ol>
              <details>
                <summary>On a phone, or can&apos;t drag?</summary>
                Bookmark any page, edit the bookmark, and replace its address with this code:
                <textarea readOnly value={bookmarkletCode} className="code" onFocus={(e) => e.target.select()} />
                Then open onhockey.tv and pick the bookmark (on Android Chrome, type its name in the address
                bar and tap it).
              </details>
              <h3>Option 2: Extension (Chrome or Edge on a computer)</h3>
              <ol>
                <li><a href="/onhockey-extension.zip">Download the extension</a> and unzip it.</li>
                <li>Open <code>chrome://extensions</code> (or <code>edge://extensions</code>).</li>
                <li>Turn on <b>Developer mode</b>, click <b>Load unpacked</b>, and pick the unzipped folder.</li>
                <li>Refresh this page. From then on, just open this site.</li>
              </ol>
            </div>
          ) : error && !leagues.length ? (
            <div className="empty">Could not load the schedule: {error}</div>
          ) : shown.length === 0 && shownChannels.length === 0 ? (
            <div className="empty">No games for the selected regions.</div>
          ) : (
            shown.map((league) => (
              <div key={league.games[0]?.key ?? league.name} className="league">
                <div className="league-head">
                  <h2>{league.name}</h2>
                  <span>{league.games.length} {league.games.length === 1 ? 'game' : 'games'}</span>
                </div>
                {league.games.map((game) => {
                  const isOpen = openKey === game.key;
                  const dropId = `drop-${game.key}`;
                  return (
                    <div key={game.key} className={isOpen ? 'game is-open' : 'game'}>
                      <button
                        type="button"
                        className="game-row"
                        aria-expanded={isOpen}
                        aria-controls={dropId}
                        onClick={() => setOpenKey(isOpen ? null : game.key)}
                      >
                        <span className="game-time">{time(game)}</span>
                        <span className="game-teams">{game.teams}</span>
                        {game.isLive && <span className="live">LIVE{game.liveCount ? ` ${game.liveCount}` : ''}</span>}
                        <span className={game.links.length ? 'game-links' : 'game-links soon'}>
                          {game.links.length ? `${game.links.length} links` : 'Soon'}
                        </span>
                        <Chevron />
                      </button>
                      {isOpen && (
                        <div className="drop" id={dropId}>
                          {narrow && playing?.key === game.key && <Player stream={playing.stream} />}
                          {game.links.length ? (
                            <div className="streams">
                              {game.links.map((link, i) => {
                                const external = resolveStream(link.url).type === 'external';
                                const on = playing?.key === game.key && playing.linkUrl === link.url;
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    className="stream"
                                    aria-pressed={on}
                                    onClick={() => playLink(game.key, game, league, link)}
                                  >
                                    <b>{link.name}{external && <ExternalIcon />}</b>
                                    {(link.language || (link.title && !external)) && (
                                      <small>{[link.language, external ? '' : link.title].filter(Boolean).join(' · ')}</small>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="note">Stream links appear closer to game time. Press Refresh then.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </section>

        <aside className="watch" aria-label="Now watching">
          {!narrow && <Player stream={playing?.stream} />}
          <div className="now">
            <div>
              <div className="now-meta">
                {!playing
                  ? 'Nothing playing'
                  : playing.metaText ?? `${playing.league} · ${shiftHour(playing.hour, timezone)}:${playing.minutes}`}
              </div>
              <h1>{playing ? playing.teams : 'Pick a game'}</h1>
            </div>
            {playing && (
              <button type="button" className="btn-ghost" onClick={() => setPlaying(null)}>
                Stop · {playing.linkName}
              </button>
            )}
          </div>
          <p className="note">The player stays here while you browse. Clicking a game opens its links right under it.</p>
        </aside>
      </main>
    </>
  );
}
