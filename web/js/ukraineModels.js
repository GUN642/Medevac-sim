// Modelle für die Ukraine-Karte: Dorfhäuser (heil oder zerstört), Plattenbauten mit Treffern, Schutt,
// ausgebrannte Panzer und Schützenpanzer, Panzersperren, Birken und Pappeln, Granattrichter
import * as THREE from './lib/three.module.min.js';
import { P } from './models.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const HALFPI = Math.PI / 2;
const BURNT = 0x232220, SOOT = 0x34322e;

// Satteldach als Prisma (First entlang z), Dreiecke nach außen
function gable(w, rh, d) {
  const x = w / 2, z = d / 2;
  const v = [
    -x, 0, -z, x, 0, -z, 0, rh, -z,
    x, 0, z, -x, 0, z, 0, rh, z,
    -x, 0, -z, 0, rh, -z, 0, rh, z, -x, 0, -z, 0, rh, z, -x, 0, z,
    x, 0, -z, x, 0, z, 0, rh, z, x, 0, -z, 0, rh, z, 0, rh, -z,
  ];
  for (let i = 0; i < v.length; i += 9) for (let k = 0; k < 3; k++) { const t = v[i + 3 + k]; v[i + 3 + k] = v[i + 6 + k]; v[i + 6 + k] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

const WALLS = [0xe8e6dc, 0xdfe4e6, 0xc9d8e2, 0xe6dcae, 0xd9cdb8, 0xb8c4b0];
const ROOFS = [0x5f6a70, 0x3f6a4a, 0x2f5a8a, 0x7a3a2c, 0x8a8f90];

// Schutthaufen aus Ziegeln und Betonbrocken
export function rubbleParts(rng, r = 3, col = 0x9a8f80) {
  const p = [];
  const n = 6 + Math.floor(rng() * 6);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, d = rng() * r, s = 0.5 + rng() * 1.4;
    p.push(P(box(s, s * 0.5, s * 0.8), rng() < 0.3 ? SOOT : col, [Math.cos(a) * d, s * 0.2, Math.sin(a) * d], [rng(), rng() * 3, rng()]));
  }
  return p;
}

// Ukrainisches Dorfhaus: eingeschossig, weiß/blau/gelb gestrichen, Blechdach. damage 0..1
export function uaHouse(rng, damage = 0) {
  const w = 7 + rng() * 2.5, d = 9 + rng() * 3, h = 3.0 + rng() * 0.5;
  const wall = WALLS[Math.floor(rng() * WALLS.length)], roof = ROOFS[Math.floor(rng() * ROOFS.length)];
  const p = [];
  const rh = w * 0.38;
  if (damage < 0.35) {
    p.push(P(box(w, h, d), wall, [0, h / 2, 0]));
    p.push(P(gable(w + 0.6, rh, d + 0.6), roof, [0, h, 0]));
    for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) p.push(P(box(0.06, 1.1, 1.0), 0x2e3438, [sx * (w / 2 + 0.03), 1.6, -d / 2 + 1.6 + i * ((d - 3.2) / 2)]));
    p.push(P(box(1.0, 2.0, 0.06), 0x5a3f2a, [-w * 0.2, 1.0, -d / 2 - 0.03]));
    p.push(P(box(0.5, 1.2, 0.5), 0x8a5a48, [w * 0.2, h + rh * 0.7, d * 0.2]));
    // Treffer: verrußte Fenster, Loch im Dach
    if (damage > 0.15) { p.push(P(box(w * 0.4, 0.06, d * 0.3), BURNT, [w * 0.15, h + rh * 0.55, -d * 0.1], [0, 0, 0.42])); p.push(P(box(0.08, 1.4, 1.4), SOOT, [w / 2 + 0.05, 1.7, 0])); }
  } else {
    // Ruine: Dach weg, Außenwände unterschiedlich hoch abgebrochen, innen verbrannt, Schutt
    const segs = [[0, -d / 2, w, true], [0, d / 2, w, true], [-w / 2, 0, d, false], [w / 2, 0, d, false]];
    const gone = Math.floor(rng() * 4);
    segs.forEach(([x, z, len, alongX], i) => {
      if (i === gone && damage > 0.6) return;
      const n = 3;
      for (let k = 0; k < n; k++) {
        const hh = h * (0.25 + rng() * 0.8) * (damage > 0.8 ? 0.6 : 1);
        const off = -len / 2 + (k + 0.5) * (len / n);
        p.push(P(box(alongX ? len / n : 0.35, hh, alongX ? 0.35 : len / n), rng() < 0.4 ? SOOT : wall, alongX ? [x + off, hh / 2, z] : [x, hh / 2, z + off]));
      }
    });
    p.push(P(box(w - 0.4, 0.15, d - 0.4), BURNT, [0, 0.08, 0]));
    // verkohlte Dachbalken, Blechreste
    for (let k = 0; k < 3; k++) p.push(P(box(0.18, 0.18, d * 0.7), 0x1c1a17, [-w * 0.3 + k * w * 0.3, 0.6 + rng() * 1.5, (rng() - 0.5) * 2], [rng() * 0.6, 0, rng() * 0.5]));
    p.push(P(box(w * 0.5, 0.05, d * 0.4), roof, [w * 0.3, 0.4, d * 0.3], [0.3, 0.4, 0.5]));
    p.push(...rubbleParts(rng, Math.min(w, d) * 0.45, 0xb0a490));
  }
  // Gartenzaun
  if (rng() < 0.6) for (const sx of [-1, 1]) p.push(P(box(0.05, 1.1, d + 6), 0x6a5a40, [sx * (w / 2 + 3), 0.55, 1.5]));
  return { parts: p, w, d };
}

// Fünfgeschossiger Plattenbau („Chruschtschowka“). damage 0..1: Treffer, ausgebrannte Etagen, eingestürzter Teil
export function apartmentBlock(rng, damage = 0.5) {
  const W = 12, L = 34 + rng() * 14, F = 5, FH = 2.9, H = F * FH;
  const col = [0xd8d4c8, 0xc8c2b2, 0xbfc4c0][Math.floor(rng() * 3)];
  const p = [];
  // in drei Abschnitte geteilt, einer kann eingestürzt sein
  const secs = 3, sl = L / secs;
  const collapsed = damage > 0.55 ? Math.floor(rng() * secs) : -1;
  for (let s = 0; s < secs; s++) {
    const z0 = -L / 2 + s * sl + sl / 2;
    let hs = H;
    if (s === collapsed) hs = FH * (1 + Math.floor(rng() * 2));
    p.push(P(box(W, hs, sl - 0.05), col, [0, hs / 2, z0]));
    if (s === collapsed) {
      // offene Geschossdecken und Schutthang
      for (let f = 1; f < 4; f++) p.push(P(box(W * (0.3 + rng() * 0.4), 0.25, sl * 0.5), 0xa8a294, [(rng() - 0.5) * W * 0.5, hs + f * FH * 0.6, z0 + (rng() - 0.5) * sl * 0.4], [rng() * 0.6 - 0.3, 0, rng() * 0.6 - 0.3]));
      p.push(...rubbleParts(rng, sl * 0.55, 0xa8a294).map((g) => { g.translate(W * 0.6, 0, z0); return g; }));
      p.push(...rubbleParts(rng, sl * 0.5, 0x9a9488).map((g) => { g.translate(-W * 0.5, 0, z0); return g; }));
    }
    // Fensterreihen (dunkel, bei Treffern verrußt bis zum Dach)
    const floors = Math.round(hs / FH);
    for (let f = 0; f < floors; f++) for (let k = 0; k < 4; k++) for (const sx of [-1, 1]) {
      const burnt = damage > 0.2 && rng() < damage * 0.35;
      p.push(P(box(0.06, 1.3, 1.5), burnt ? 0x0d0c0b : 0x2a3036, [sx * (W / 2 + 0.03), f * FH + 1.6, z0 - sl / 2 + 1.6 + k * ((sl - 3.2) / 3)]));
      if (burnt) p.push(P(box(0.05, 1.6, 1.9), SOOT, [sx * (W / 2 + 0.05), f * FH + 2.6, z0 - sl / 2 + 1.6 + k * ((sl - 3.2) / 3)]));
    }
    // Einschusslöcher von Granaten (große dunkle Flecken)
    const holes = Math.floor(damage * 4 * rng());
    for (let k = 0; k < holes; k++) p.push(P(box(0.3, 2 + rng() * 2, 2 + rng() * 2.5), 0x121110, [(rng() < 0.5 ? -1 : 1) * W / 2, FH + rng() * (hs - FH * 1.5), z0 + (rng() - 0.5) * sl * 0.7]));
  }
  // Dachrand, Treppenhauseingänge
  p.push(P(box(W + 0.3, 0.3, L + 0.3), 0x6a6862, [0, H + 0.15, 0]).translate(0, collapsed >= 0 ? 0 : 0, 0));
  for (let s = 0; s < secs; s++) p.push(P(box(2, 2.4, 1.2), 0x8a8478, [-W / 2 - 0.6, 1.2, -L / 2 + s * sl + sl / 2]));
  return { parts: p, w: W, d: L, h: H };
}

// Ausgebrannter Kampfpanzer (T-72) oder Schützenpanzer (BMP), Turm teils weggesprengt
export function tankWreck(rng, kind = 'tank') {
  const p = [];
  const c = rng() < 0.5 ? 0x3a3a2c : BURNT;
  if (kind === 'tank') {
    p.push(P(box(3.4, 1.1, 6.6), c, [0, 0.95, 0]));
    p.push(P(box(3.6, 0.5, 6.4), 0x1a1a18, [0, 0.45, 0]));                  // Ketten
    p.push(P(box(3.2, 0.3, 1.2), c, [0, 1.4, -3.2], [0.4, 0, 0]));
    const tossed = rng() < 0.6;
    const tx = tossed ? (rng() - 0.5) * 10 : 0, tz = tossed ? (rng() - 0.5) * 10 : -0.3;
    const ty = tossed ? 0.6 : 1.85;
    p.push(P(cyl(1.35, 1.6, 0.85, 12), c, [tx, ty, tz], tossed ? [rng() * 1.2, rng() * 3, rng() * 0.8] : [0, 0, 0]));
    p.push(P(cyl(0.08, 0.1, 5.5, 8), c, [tx, ty + 0.1, tz - 3.2], tossed ? [HALFPI + rng(), rng(), 0] : [HALFPI - 0.05, 0, 0]));
  } else {
    p.push(P(box(3.0, 1.2, 6.5), c, [0, 1.1, 0]));
    p.push(P(box(3.1, 0.5, 6.0), 0x1a1a18, [0, 0.45, 0]));
    p.push(P(box(3.0, 0.4, 1.4), c, [0, 1.25, -3.3], [-0.5, 0, 0]));
    p.push(P(cyl(0.7, 0.85, 0.6, 10), c, [0.2, 2.0, -0.3]));
    p.push(P(cyl(0.05, 0.05, 2.8, 6), c, [0.2, 2.1, -2.0], [HALFPI - 0.15, 0, 0]));
  }
  p.push(P(new THREE.CircleGeometry(6, 14), 0x2a2724, [0, 0.06, 0], [-HALFPI, 0, 0]));
  return p;
}

// Schützenpanzer (BMP-2) als Feindfahrzeug
export function bmpParts() {
  const p = [];
  const c = 0x4e553a, d = 0x2b2e24;
  p.push(P(box(3.0, 1.1, 6.6), c, [0, 1.15, 0]));
  p.push(P(box(3.0, 0.5, 1.6), c, [0, 1.35, -3.5], [-0.55, 0, 0]));
  p.push(P(box(3.2, 0.7, 6.2), 0x1a1a18, [0, 0.5, 0.1]));
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) p.push(P(cyl(0.38, 0.38, 0.25, 10), 0x2a2a28, [sx * 1.45, 0.42, -2.4 + i * 0.95], [0, 0, HALFPI]));
  p.push(P(cyl(0.8, 0.95, 0.65, 10), c, [0, 2.0, -0.4]));
  p.push(P(cyl(0.05, 0.06, 2.9, 6), d, [0, 2.15, -2.1], [HALFPI - 0.05, 0, 0]));
  p.push(P(box(0.9, 0.15, 0.6), 0xe8e8e8, [0, 2.36, -0.1]));                 // weiße Erkennungsmarkierung
  return p;
}

// Panzersperre („Igel“) aus drei Stahlträgern
export function hedgehogParts() {
  const c = 0x3a342c;
  return [
    P(box(0.2, 2.2, 0.2), c, [0, 0.75, 0], [0.6, 0, 0.5]),
    P(box(0.2, 2.2, 0.2), c, [0, 0.75, 0], [-0.6, 0.9, 0.3]),
    P(box(0.2, 2.2, 0.2), c, [0, 0.75, 0], [0.2, 2.0, -0.7]),
  ];
}

// Birke: schlanker weißer Stamm mit dunklen Flecken, lichte Krone
export function birchParts(detail = false) {
  const p = [P(cyl(0.12, 0.2, 11, detail ? 7 : 5), 0xe6e2d8, [0, 5.5, 0])];
  if (detail) for (let i = 0; i < 4; i++) p.push(P(box(0.26, 0.12, 0.26), 0x2a2a28, [0, 1.5 + i * 2.1, 0]));
  p.push(P(new THREE.IcosahedronGeometry(1, detail ? 1 : 0), 0x6a8a3a, [0, 11, 0], [0, 0, 0], [2.6, 3.4, 2.6]));
  if (detail) p.push(P(new THREE.IcosahedronGeometry(1, 0), 0x7a9a44, [0.9, 9.4, 0.4], [0.4, 0.3, 0], [1.8, 2.0, 1.8]));
  return p;
}

// Säulenpappel / Robinie für Waldstreifen
export function beltTreeParts(detail = false) {
  const p = [P(cyl(0.22, 0.34, 9, detail ? 7 : 5), 0x4e3f2e, [0, 4.5, 0])];
  p.push(P(new THREE.IcosahedronGeometry(1, detail ? 1 : 0), 0x3f5e28, [0, 10.5, 0], [0, 0, 0], [3.4, 4.6, 3.4]));
  if (detail) {
    p.push(P(new THREE.IcosahedronGeometry(1, 0), 0x4a6a2e, [1.6, 9.0, 0.6], [0.5, 0.2, 0], [2.2, 2.4, 2.2]));
    p.push(P(new THREE.IcosahedronGeometry(1, 0), 0x36532a, [-1.4, 11.5, -0.8], [0.2, 1.1, 0], [2.0, 2.2, 2.0]));
  }
  return p;
}

// Granattrichter: dunkle Mulde mit aufgeworfenem Rand (flache Scheibe, auf das Gelände gelegt)
export function craterGeo() {
  const p = [
    P(new THREE.CircleGeometry(1, 18), 0x2c2620, [0, 0.02, 0], [-HALFPI, 0, 0]),
    P(new THREE.RingGeometry(0.85, 1.45, 18), 0x5a4d3c, [0, 0.06, 0], [-HALFPI, 0, 0]),
  ];
  return p;
}

// Ukrainische Flagge
export function drawUkraineFlag(x) {
  x.fillStyle = '#0057b7'; x.fillRect(0, 0, 190, 50);
  x.fillStyle = '#ffd700'; x.fillRect(0, 50, 190, 50);
}
