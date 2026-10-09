// Support for the OnHockey Android TV app (android-tv/), which shows this site in a WebView.
// The app exposes window.OnHockeyTV: a native fetch of onhockey.tv's schedule (no CORS, and it
// comes from the viewer's own home connection) plus remote-control (D-pad) navigation here.

import { useEffect, useRef } from 'react';

export const hasTvApp = () => typeof window !== 'undefined' && !!window.OnHockeyTV;

// TV layout: inside the app, or forced with ?tv=1 for testing in a desktop browser.
export const isTv = () =>
  hasTvApp() || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tv') === '1');

const pending = new Map();
let nextId = 0;

export const fetchScheduleViaTvApp = () =>
  new Promise((resolve, reject) => {
    // The app calls this back once its fetch finishes.
    window.__onhockeyTv = (id, html, error) => {
      const done = pending.get(id);
      if (!done) return;
      pending.delete(id);
      clearTimeout(done.timer);
      if (html) done.resolve(html);
      else done.reject(new Error(error || 'The TV app could not load the schedule.'));
    };
    const id = String(++nextId);
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('The TV app did not answer.'));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
    window.OnHockeyTV.fetchSchedule(id);
  });

const FOCUSABLE = 'button:not([disabled]), a[href], select, input, textarea, iframe, [tabindex]:not([tabindex="-1"])';
const DIRECTIONS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

const visible = (el) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
};

// Moves focus to the nearest focusable element in the pressed direction.
function moveFocus(dx, dy) {
  const all = [...document.querySelectorAll(FOCUSABLE)].filter(visible);
  const current = document.activeElement;
  if (!current || current === document.body || !all.includes(current)) {
    const first = all.find((el) => el.getBoundingClientRect().bottom > 0) || all[0];
    first?.focus({ preventScroll: true });
    first?.scrollIntoView({ block: 'nearest' });
    return;
  }
  const from = current.getBoundingClientRect();
  let best = null;
  let bestScore = Infinity;
  for (const el of all) {
    if (el === current) continue;
    const r = el.getBoundingClientRect();
    // Edge-to-edge distance along the pressed direction; across it, 0 when the two overlap
    // (so a stream button under a full-width game row counts as straight below it).
    const along = dx ? (dx > 0 ? r.left - from.right : from.left - r.right) : dy > 0 ? r.top - from.bottom : from.top - r.bottom;
    if (along < -2) continue;
    const across = dx
      ? Math.max(0, r.top - from.bottom, from.top - r.bottom)
      : Math.max(0, r.left - from.right, from.left - r.right);
    const score = Math.max(along, 0) + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } else if (dy) {
    window.scrollBy({ top: dy * 200 });
  }
}

// Wires the remote: arrows move focus between buttons and links; Back leaves a focused player
// first (the app asks window.__onhockeyTvBack before it goes back or exits).
export function useTvRemote(onBack) {
  const backRef = useRef(onBack);
  backRef.current = onBack;
  useEffect(() => {
    if (!isTv()) return undefined;
    document.documentElement.classList.add('tv');
    const onKey = (e) => {
      const dir = DIRECTIONS[e.key];
      if (!dir) return;
      // Leave arrows alone inside a form field that uses them.
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      moveFocus(...dir);
    };
    window.addEventListener('keydown', onKey);
    window.__onhockeyTvBack = () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        return true;
      }
      const tag = document.activeElement?.tagName;
      if (tag === 'IFRAME' || tag === 'VIDEO') {
        document.activeElement.blur();
        document.querySelector('.stream[aria-pressed="true"]')?.focus();
        return true;
      }
      return backRef.current ? backRef.current() : false;
    };
    return () => {
      window.removeEventListener('keydown', onKey);
      delete window.__onhockeyTvBack;
    };
  }, []);
}
