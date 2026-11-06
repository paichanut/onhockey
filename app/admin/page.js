"use client";

import { useEffect, useState } from 'react';

// /admin: add or remove the YouTube channels shown on the site. Password: ADMIN_PASSWORD.
export default function AdminPage() {
  const [auth, setAuth] = useState(null); // { enabled, loggedIn }
  const [password, setPassword] = useState('');
  const [channels, setChannels] = useState([]);
  const [regions, setRegions] = useState([]);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState('Thailand');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  const call = async (path, options = {}) => {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, cache: 'no-store', ...options });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  };

  const loadChannels = async () => {
    const data = await call('/api/admin/channels');
    setChannels(data.channels);
    setRegions(data.regions);
  };

  useEffect(() => {
    call('/api/admin/login').then((a) => {
      setAuth(a);
      if (a.loggedIn) loadChannels().catch((e) => setMessage({ ok: false, text: e.message }));
    });
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await call('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword('');
      setAuth({ enabled: true, loggedIn: true });
      await loadChannels();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await call('/api/admin/login', { method: 'DELETE' });
    setAuth({ enabled: true, loggedIn: false });
    setChannels([]);
  };

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const data = await call('/api/admin/channels', { method: 'POST', body: JSON.stringify({ url, name, region }) });
      setChannels(data.channels);
      setUrl('');
      setName('');
      setMessage({ ok: true, text: `Added ${data.added.name}. It shows on the site within about 2 minutes.` });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (channel) => {
    if (!window.confirm(`Remove ${channel.name || channel.handle}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await call(`/api/admin/channels?handle=${encodeURIComponent(channel.handle)}`, { method: 'DELETE' });
      setChannels(data.channels);
      setMessage({ ok: true, text: `Removed ${channel.name || channel.handle}.` });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="wrap admin">
      <header className="admin-head">
        <h1>YouTube channels</h1>
        <a href="/" className="link-btn">← Back to the site</a>
      </header>

      {message && <p className={message.ok ? 'admin-msg ok' : 'admin-msg err'}>{message.text}</p>}

      {!auth ? (
        <p className="note">Loading…</p>
      ) : !auth.enabled ? (
        <p className="note">The dashboard is not set up: add an ADMIN_PASSWORD environment variable in Vercel.</p>
      ) : !auth.loggedIn ? (
        <form className="admin-card" onSubmit={login}>
          <label className="admin-field">
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>Log in</button>
        </form>
      ) : (
        <>
          <form className="admin-card" onSubmit={add}>
            <h2>Add a channel</h2>
            <label className="admin-field">
              <span>YouTube channel link or @handle</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/@channel" required />
            </label>
            <div className="admin-row">
              <label className="admin-field">
                <span>Name (optional)</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="From YouTube if empty" />
              </label>
              <label className="admin-field">
                <span>Region</span>
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            </div>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Checking…' : 'Add channel'}</button>
          </form>

          <section className="admin-card">
            <h2>On the site ({channels.length})</h2>
            <ul className="admin-list">
              {channels.map((c) => (
                <li key={c.handle}>
                  <div>
                    <b>{c.name || c.handle}</b>
                    <a href={`https://www.youtube.com/${c.handle}`} target="_blank" rel="noopener noreferrer">{c.handle}</a>
                    <span className="pill">{c.region}</span>
                  </div>
                  <button type="button" className="btn-ghost" onClick={() => remove(c)} disabled={busy}>Remove</button>
                </li>
              ))}
            </ul>
          </section>

          <button type="button" className="link-btn" onClick={logout}>Log out</button>
        </>
      )}
    </main>
  );
}
