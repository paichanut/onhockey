"use client";

import { useEffect, useState } from 'react';
import Script from 'next/script';

// PDPA: Google Analytics sets cookies, so it only loads after the visitor accepts.
// Vercel Analytics is cookieless and keeps running either way.
const STORAGE_KEY = 'onhockey-consent';

function readChoice() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function saveChoice(value) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch {}
}

function clearGaCookies() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (name !== '_ga' && !name.startsWith('_ga_')) continue;
    const host = location.hostname;
    for (const domain of ['', host, `.${host}`]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ''}`;
    }
  }
}

export default function Consent({ gaId }) {
  // undefined until mounted, so the server render never shows the banner.
  const [choice, setChoice] = useState(undefined);

  useEffect(() => { setChoice(readChoice()); }, []);

  const decide = (value) => {
    const wasGranted = readChoice() === 'granted';
    saveChoice(value);
    if (value === 'denied') {
      clearGaCookies();
      // Stop a GA instance that was already running on this page.
      if (wasGranted) location.reload();
    }
    setChoice(value);
  };

  return (
    <>
      {choice === 'granted' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
          </Script>
        </>
      )}

      {choice !== undefined && (
        <footer className="wrap site-foot">
          <button type="button" className="link-btn" onClick={() => setChoice(null)}>
            Cookie settings · ตั้งค่าคุกกี้
          </button>
        </footer>
      )}

      {choice === null && (
        <div className="consent" role="dialog" aria-live="polite" aria-label="Cookie consent">
          <div className="consent-text">
            <b>We use cookies for visitor statistics</b>
            <p>
              With your OK we use Google Analytics to count visits and which streams get watched. No ads, nothing sold.
              <br />
              เว็บนี้ขอใช้คุกกี้ของ Google Analytics เพื่อนับสถิติผู้เข้าชมและสตรีมที่ถูกเปิดดู ไม่มีโฆษณา และไม่ขายข้อมูล
              คุณเปลี่ยนใจได้ทุกเมื่อที่ &quot;ตั้งค่าคุกกี้&quot; ท้ายหน้า
            </p>
          </div>
          <div className="consent-actions">
            <button type="button" className="btn-ghost" onClick={() => decide('denied')}>Decline · ปฏิเสธ</button>
            <button type="button" className="btn-primary" onClick={() => decide('granted')}>Accept · ยอมรับ</button>
          </div>
        </div>
      )}
    </>
  );
}
