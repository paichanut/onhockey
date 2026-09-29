"use client";

import { useState, useEffect, useRef } from 'react';
import { parseSchedule, resolveStream, shiftHour } from '@/lib/onhockey';

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
  { value: '07', label: 'Novosibirsk (GMT+7)' },
  { value: '08', label: 'Shanghai (GMT+8)' },
  { value: '09', label: 'Tokyo (GMT+9)' },
  { value: '10', label: 'Sydney (GMT+10)' },
  { value: '11', label: 'Magadan (GMT+11)' },
  { value: '12', label: 'Auckland (GMT+12)' },
];

const LEAGUE_FILTERS = [
  { value: 'NA', label: 'North America' },
  { value: 'RU', label: 'RU/KZ/BY' },
  { value: 'FI', label: 'Finland' },
  { value: 'SE', label: 'Sweden' },
  { value: 'CZ', label: 'Czechia/Slovakia' },
  { value: 'DK', label: 'DK/NO/IS' },
  { value: 'CH', label: 'CH/DE/FR/NL/BE/LU' },
  { value: 'AT', label: 'AT/IT/HU/RO/SI/HR/RS' },
  { value: 'LV', label: 'Baltic/Poland/Ukraine' },
  { value: 'OTH', label: 'UK and others' },
  { value: 'INT', label: 'International' },
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

  return <video ref={videoRef} style={styles.iframe} controls autoPlay />;
}

export default function Home() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [stream, setStream] = useState(null);
  const [timezone, setTimezone] = useState('07');
  const [filters, setFilters] = useState([]);
  const [showAll, setShowAll] = useState(true);

  const fetchSchedule = async () => {
    setLoading(true);
    setError(null);

    try {
      // The relay only passes onhockey.tv's HTML through; parsing happens here.
      const response = await fetch('/api/schedule', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Schedule unavailable (${response.status})`);
      }
      setLeagues(parseSchedule(await response.text()));
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

  const handleStreamClick = (link) => {
    const resolved = resolveStream(link.url);
    if (resolved.type === 'external') {
      window.open(resolved.url, '_blank', 'noopener');
    } else {
      setStream(resolved);
    }
  };

  const toggleFilter = (value) => {
    if (value === 'showAll') {
      setShowAll(!showAll);
      setFilters([]);
    } else {
      setShowAll(false);
      if (filters.includes(value)) {
        setFilters(filters.filter((f) => f !== value));
      } else {
        setFilters([...filters, value]);
      }
    }
  };

  const filteredLeagues = leagues.filter((league) => {
    if (showAll) return true;
    if (filters.length === 0) return true;
    return filters.includes(league.class);
  });

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🏒 OnHockey Live</h1>
        <p style={styles.subtitle}>Ice hockey streams - No ads</p>
      </header>

      <div style={styles.controls}>
        <div style={styles.controlGroup}>
          <label style={styles.label}>Timezone:</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={styles.select}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <button onClick={fetchSchedule} style={styles.refreshBtn} disabled={loading}>
          {loading ? 'Loading...' : '🔄 Refresh Schedule'}
        </button>
      </div>

      <div style={styles.filters}>
        <label style={styles.filterLabel}>
          <input
            type="checkbox"
            checked={showAll}
            onChange={() => toggleFilter('showAll')}
          />
          {' '}ALL
        </label>
        {LEAGUE_FILTERS.map((filter) => (
          <label key={filter.value} style={styles.filterLabel}>
            <input
              type="checkbox"
              checked={filters.includes(filter.value)}
              onChange={() => toggleFilter(filter.value)}
            />
            {' '}{filter.label}
          </label>
        ))}
      </div>

      <div style={styles.main}>
        {stream && (
          <div style={styles.player}>
            <div style={styles.playerHeader}>
              <h3 style={styles.playerTitle}>{selectedGame?.teams}</h3>
              <button onClick={() => setStream(null)} style={styles.closeBtn}>
                ✕
              </button>
            </div>
            {stream.type === 'hls' ? (
              <HlsVideo src={stream.url} />
            ) : (
              <iframe
                src={stream.url}
                style={styles.iframe}
                allowFullScreen
                allow="autoplay; encrypted-media; fullscreen"
              />
            )}
          </div>
        )}

        {selectedGame && (
          <div style={styles.linksPanel}>
            <h3 style={styles.linksTitle}>Available Streams for: {selectedGame.teams}</h3>
            {selectedGame.links.length === 0 ? (
              <span style={styles.noLinks}>Stream available closer to game time</span>
            ) : (
              <div style={styles.linksGrid}>
                {selectedGame.links.map((link, index) => (
                  <button
                    key={index}
                    onClick={() => handleStreamClick(link)}
                    style={styles.linkBtn}
                  >
                    {link.name}
                    {(link.language || link.title) && (
                      <span style={styles.linkTitle}>
                        {[link.language, link.title].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={styles.schedule}>
          {loading && !leagues.length ? (
            <div style={styles.loading}>Loading schedule...</div>
          ) : error && !leagues.length ? (
            <div style={styles.loading}>Could not load schedule: {error}</div>
          ) : filteredLeagues.length === 0 ? (
            <div style={styles.loading}>No games found for selected filters</div>
          ) : (
            filteredLeagues.map((league, leagueIndex) => (
              <div key={leagueIndex} style={styles.league}>
                <div style={styles.leagueHeader}>
                  <h2 style={styles.leagueName}>{league.name}</h2>
                </div>
                {league.games.map((game, gameIndex) => {
                  const isSelected = selectedGame === game;

                  return (
                    <div
                      key={gameIndex}
                      onClick={() => {
                        setSelectedGame(game);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        ...styles.gameRow,
                        ...(isSelected ? styles.gameRowSelected : {}),
                      }}
                    >
                      <div style={styles.gameTime}>
                        {shiftHour(game.hour, timezone)}:{game.minutes}
                      </div>
                      <div style={styles.gameTeams}>
                        {game.teams}
                        {game.isLive && (
                          <span style={styles.liveBadge}>
                            🔴 {game.liveCount} LIVE
                          </span>
                        )}
                      </div>
                      <div style={styles.gameStatus}>
                        {game.links.length > 0 ? (
                          <span style={styles.hasLinks}>📺 Click for links</span>
                        ) : (
                          <span style={styles.noLinks}>
                            Stream available closer to game time
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    padding: '20px 30px',
    borderBottom: '1px solid #333',
    backgroundColor: '#111',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 'bold',
  },
  subtitle: {
    margin: '5px 0 0',
    fontSize: '14px',
    color: '#888',
  },
  controls: {
    display: 'flex',
    gap: '15px',
    padding: '15px 30px',
    backgroundColor: '#161616',
    borderBottom: '1px solid #222',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  label: {
    fontSize: '14px',
    color: '#aaa',
  },
  select: {
    padding: '8px 12px',
    backgroundColor: '#222',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  refreshBtn: {
    padding: '8px 16px',
    backgroundColor: '#0066cc',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  filters: {
    display: 'flex',
    gap: '15px',
    padding: '12px 30px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #222',
    flexWrap: 'wrap',
  },
  filterLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '13px',
    color: '#aaa',
    cursor: 'pointer',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    gap: '20px',
  },
  player: {
    backgroundColor: '#111',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #333',
  },
  playerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 20px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #333',
  },
  playerTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
  },
  closeBtn: {
    padding: '6px 12px',
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  iframe: {
    width: '100%',
    height: '500px',
    border: 'none',
  },
  schedule: {
    flex: 1,
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#888',
    fontSize: '16px',
  },
  league: {
    marginBottom: '20px',
  },
  leagueHeader: {
    backgroundColor: '#8B0000',
    padding: '10px 15px',
    borderRadius: '6px 6px 0 0',
  },
  leagueName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
  },
  gameRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 15px',
    borderBottom: '1px solid #222',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    backgroundColor: '#0a0a0a',
  },
  gameRowSelected: {
    backgroundColor: '#1a2a3a',
    borderLeft: '3px solid #0066cc',
  },
  gameTime: {
    width: '60px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#ff9800',
  },
  gameTeams: {
    flex: 1,
    fontSize: '14px',
    fontWeight: '500',
  },
  gameStatus: {
    fontSize: '12px',
    color: '#888',
  },
  hasLinks: {
    color: '#4caf50',
    fontWeight: '500',
  },
  noLinks: {
    color: '#666',
    fontStyle: 'italic',
  },
  liveBadge: {
    display: 'inline-block',
    marginLeft: '8px',
    padding: '2px 8px',
    backgroundColor: '#cc0000',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  linksPanel: {
    backgroundColor: '#111',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #333',
  },
  linksTitle: {
    margin: '0 0 15px',
    fontSize: '16px',
    fontWeight: '600',
  },
  linksGrid: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  linkBtn: {
    padding: '10px 20px',
    backgroundColor: '#0066cc',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.2s',
  },
  linkTitle: {
    fontSize: '11px',
    opacity: 0.8,
  },
};
