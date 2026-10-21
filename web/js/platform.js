// Einstellungen, Statistik, Versionsinfo und Android-Brücke
const SKEY = 'dustoff.settings.v1';
const STKEY = 'dustoff.stats.v1';

export const isApp = typeof window.AndroidApp !== 'undefined';
export const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
}
function write(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch (_) { /* privater Modus */ }
}

export function loadSettings() {
  const d = { quality: isMobile ? 'low' : 'high', volume: 0.8, sensitivity: 1, invertY: false, difficulty: 1, showFps: false, mouseFly: true, mouseFlyInvert: false, footView: 'third' };
  return Object.assign(d, read(SKEY) || {});
}
export const saveSettings = (s) => write(SKEY, s);

export function loadStats() {
  const d = { score: 0, missions: 0, rescued: 0, transported: 0, kills: 0, losses: 0, flightTime: 0 };
  return Object.assign(d, read(STKEY) || {});
}
export const saveStats = (s) => write(STKEY, s);

const RANKS = [
  [0, 'Warrant Officer 1'], [1500, 'Chief Warrant Officer 2'], [4000, 'Chief Warrant Officer 3'],
  [8000, 'Chief Warrant Officer 4'], [14000, 'Captain'], [22000, 'Major'],
];
export function rankFor(score) {
  let r = RANKS[0][1];
  for (const [s, n] of RANKS) if (score >= s) r = n;
  return r;
}

export async function fetchVersion() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}

export function appVersion() {
  try { return isApp ? window.AndroidApp.getVersionName() : null; } catch (_) { return null; }
}
export function appCheckUpdate() {
  try { if (isApp) window.AndroidApp.checkForUpdates(); } catch (_) { /* ignorieren */ }
}

export function enterFullscreen() {
  if (isApp) return;
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen && isMobile) {
      el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      }).catch(() => {});
    }
  } catch (_) { /* nicht unterstützt */ }
}
