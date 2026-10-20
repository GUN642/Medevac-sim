// Kleine Hilfsfunktionen
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const deg = (r) => (r * 180) / Math.PI;
export const rad = (d) => (d * Math.PI) / 180;

// Deterministischer Zufallsgenerator (mulberry32)
export function makeRng(seed) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + (b - a) * rng();
  rng.int = (a, b) => Math.floor(a + (b - a + 1) * rng());
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  return rng;
}

export const rand = makeRng((Date.now() ^ 0x5eed) >>> 0);

// Kompasskurs von (x1,z1) nach (x2,z2); Norden = -Z, Osten = +X
export function bearing(x1, z1, x2, z2) {
  const b = deg(Math.atan2(x2 - x1, -(z2 - z1)));
  return (b + 360) % 360;
}

// Steuerkurs aus Gier-Winkel (rotation.y)
export const headingFromYaw = (yaw) => ((deg(-yaw) % 360) + 360) % 360;

const DIRS = ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'];
const DIRS_SHORT = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
export const dirName = (b) => DIRS[Math.round(b / 45) % 8];
export const dirShort = (b) => DIRS_SHORT[Math.round(b / 45) % 8];

export function fmtDist(m) {
  if (m >= 1000) return (m / 1000).toFixed(1).replace('.', ',') + ' km';
  return Math.round(m / 10) * 10 + ' m';
}
export const fmtBearing = (b) => String(Math.round(b) % 360).padStart(3, '0') + '°';

export function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
