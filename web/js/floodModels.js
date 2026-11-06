// Modelle für die Hochwasser-Karte: deutsche Häuser, Kirche, Brücken, Wald, Hochspannungsmasten, Fahrzeuge
import * as THREE from './lib/three.module.min.js';
import { P } from './models.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const HALFPI = Math.PI / 2;

// Satteldach als Prisma (First entlang z)
function gable(w, rh, d) {
  const x = w / 2, z = d / 2;
  const v = [
    // Giebeldreiecke
    -x, 0, -z, x, 0, -z, 0, rh, -z,
    x, 0, z, -x, 0, z, 0, rh, z,
    // Dachflächen
    -x, 0, -z, 0, rh, -z, 0, rh, z, -x, 0, -z, 0, rh, z, -x, 0, z,
    x, 0, -z, x, 0, z, 0, rh, z, x, 0, -z, 0, rh, z, 0, rh, -z,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

const WALLS = [0xe9e3d3, 0xddd2bb, 0xcfc2a6, 0xe4dccd, 0xd8c9b0, 0xb9a689, 0xefe8da];
const ROOFS = [0x5b2f24, 0x6e3a2a, 0x3a3a3c, 0x4a4a4e, 0x7a4430];

// Wohnhaus mit Satteldach, Fenstern und Schornstein. Liefert auch die Firsthöhe.
export function germanHouse(rng, big = false) {
  const w = (big ? 10 : 7.5) + rng() * 3, d = (big ? 12 : 9) + rng() * 3, h = (rng() < 0.7 ? 5.8 : 3.2) + rng() * 0.8;
  const rh = w * (0.42 + rng() * 0.12);
  const wall = WALLS[Math.floor(rng() * WALLS.length)], roof = ROOFS[Math.floor(rng() * ROOFS.length)];
  const p = [P(box(w, h, d), wall, [0, h / 2, 0])];
  p.push(P(gable(w + 0.7, rh, d + 0.7), roof, [0, h, 0]));
  // Fenster (2 Reihen) an Längsseiten
  const rows = h > 5 ? [1.6, 4.2] : [1.6];
  for (const y of rows) for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) {
    p.push(P(box(0.06, 1.1, 0.9), 0x2e3438, [sx * (w / 2 + 0.03), y, -d / 2 + 1.6 + i * ((d - 3.2) / 2)]));
  }
  for (const y of rows) p.push(P(box(0.9, 1.1, 0.06), 0x2e3438, [w * 0.2, y, -d / 2 - 0.03]));
  p.push(P(box(1.0, 2.1, 0.06), 0x5a3f2a, [-w * 0.2, 1.05, -d / 2 - 0.03]));
  p.push(P(box(0.6, 1.6, 0.6), 0x7a3f30, [w * 0.18, h + rh * 0.75, d * 0.2]));
  return { parts: p, w, d, ridge: h + rh, eave: h };
}

// Kirche mit Turm
export function churchParts() {
  const p = [P(box(11, 9, 22), 0xe6ddc9, [0, 4.5, 0]), P(gable(11.8, 6, 22.6), 0x3d3d40, [0, 9, 0])];
  p.push(P(box(6, 22, 6), 0xe6ddc9, [0, 11, -13]));
  p.push(P(cyl(0.01, 4.3, 9, 4), 0x3d3d40, [0, 26.5, -13], [0, Math.PI / 4, 0]));
  p.push(P(box(0.15, 1.6, 0.15), 0xc9a240, [0, 31.6, -13]), P(box(0.9, 0.15, 0.15), 0xc9a240, [0, 31.8, -13]));
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) p.push(P(box(0.06, 3.2, 1.4), 0x3a4048, [sx * 5.53, 5, -7 + i * 4.6]));
  p.push(P(cyl(1.0, 1.0, 0.08, 16), 0xf2efe6, [0, 17, -16.04], [HALFPI, 0, 0]));
  return { parts: p, ridge: 15, eave: 9, w: 11, d: 22 };
}

// Steinbogenbrücke (eine Hälfte weggerissen, wenn broken)
export function bridgeParts(len, broken) {
  const p = [];
  const seg = 4, sl = len / seg;
  for (let i = 0; i < seg; i++) {
    if (broken && (i === 1 || i === 2)) continue;
    const z = -len / 2 + sl * (i + 0.5);
    p.push(P(box(6, 0.8, sl), 0x8a8478, [0, 5.4, z]));
    for (const sx of [-1, 1]) p.push(P(box(0.3, 0.9, sl), 0x9a9488, [sx * 2.9, 6.2, z]));
  }
  for (let i = 1; i < seg; i++) if (!broken || i !== 2) p.push(P(box(5, 6, 1.8), 0x7d776b, [0, 2.0, -len / 2 + sl * i]));
  return p;
}

// Fichte (Nahbereich mit mehr Ästen)
export function spruceParts(detail = false) {
  const p = [P(cyl(0.18, 0.32, detail ? 16 : 14, detail ? 6 : 5), 0x4a3a2a, [0, 7, 0])];
  const n = detail ? 6 : 4;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    p.push(P(new THREE.ConeGeometry(3.2 * (1 - t * 0.75), 5.5 - t * 1.5, detail ? 9 : 6), [0x1f3a26, 0x24432b, 0x1c3523][i % 3], [0, 3.5 + t * 13, 0]));
  }
  return p;
}

// Buche / Laubbaum
export function beechParts(detail = false) {
  const ico = (d) => new THREE.IcosahedronGeometry(1, d);
  const p = [P(cyl(0.28, 0.45, 8, detail ? 7 : 5), 0x6b6458, [0, 4, 0])];
  p.push(P(ico(detail ? 1 : 0), 0x3f6a2c, [0, 10, 0], [0, 0, 0], [4.8, 4.0, 4.8]));
  if (detail) {
    p.push(P(ico(0), 0x4a7533, [2.2, 11.2, 1.0], [0.4, 0.2, 0], [2.8, 2.4, 2.8]));
    p.push(P(ico(0), 0x365f26, [-2.0, 10.6, -1.2], [0.1, 0.8, 0], [2.6, 2.2, 2.6]));
  }
  return p;
}

// Hochspannungsmast (Donaumast vereinfacht), Traversen auf Höhe 30 und 36 m
export const PYLON_ARMS = [[-7, 30], [7, 30], [-5, 36], [5, 36], [0, 41]];
export function pylonParts() {
  const p = [];
  const legs = [[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6]];
  for (const [x, z] of legs) {
    const g = cyl(0.12, 0.16, 42.5, 4);
    p.push(P(g, 0x8d9296, [x * 0.55, 21, z * 0.55], [z * -0.06, 0, x * 0.06]));
  }
  for (let y = 4; y < 40; y += 5) {
    const s = 2.6 * (1 - y / 46) * 1.1;
    p.push(P(box(s * 2, 0.12, 0.12), 0x8d9296, [0, y, s]), P(box(s * 2, 0.12, 0.12), 0x8d9296, [0, y, -s]));
    p.push(P(box(0.12, 0.12, s * 2), 0x8d9296, [s, y, 0]), P(box(0.12, 0.12, s * 2), 0x8d9296, [-s, y, 0]));
  }
  p.push(P(box(15, 0.4, 0.6), 0x8d9296, [0, 30, 0]), P(box(11, 0.4, 0.6), 0x8d9296, [0, 36, 0]), P(box(0.5, 2.2, 0.5), 0x8d9296, [0, 41, 0]));
  for (const [x, y] of PYLON_ARMS) p.push(P(cyl(0.12, 0.12, 1.4, 6), 0x5a5a52, [x, y - 0.7, 0]));
  // Warnanstrich oben
  p.push(P(box(1.6, 3, 1.6), 0xc23a2a, [0, 39.5, 0]));
  return p;
}

// THW-Lkw (blau) und Feuerwehrfahrzeug (rot)
export function truckParts(col = 0x1f3f8a, stripe = 0xe8e2d0) {
  const p = [
    P(box(2.5, 0.5, 8), 0x222222, [0, 0.9, 0]),
    P(box(2.5, 2.4, 2.2), col, [0, 2.2, -2.9]),
    P(box(2.3, 0.7, 0.06), 0x2b3a40, [0, 2.8, -4.02]),
    P(box(2.5, 2.6, 5.2), col, [0, 2.6, 1.2]),
    P(box(2.52, 0.25, 5.22), stripe, [0, 2.0, 1.2]),
  ];
  for (const z of [-2.9, 1.0, 2.6]) for (const sx of [-1, 1]) p.push(P(cyl(0.55, 0.55, 0.4, 12), 0x161616, [sx * 1.15, 0.55, z], [0, 0, HALFPI]));
  p.push(P(box(1.2, 0.2, 0.3), 0x3a7ae0, [0, 3.5, -3.3]));
  return p;
}

// Pkw (zum Teil im Wasser)
export function carParts(rng) {
  const col = [0xb8b8b8, 0x2a3a5a, 0x7a1e1e, 0x1e1e1e, 0xe8e4dc, 0x3a5a3a][Math.floor(rng() * 6)];
  const p = [P(box(1.8, 0.75, 4.3), col, [0, 0.65, 0]), P(box(1.6, 0.6, 2.2), col, [0, 1.3, 0.2]), P(box(1.62, 0.45, 2.0), 0x2b3a40, [0, 1.32, 0.2])];
  for (const z of [-1.4, 1.4]) for (const sx of [-1, 1]) p.push(P(cyl(0.33, 0.33, 0.25, 10), 0x161616, [sx * 0.85, 0.33, z], [0, 0, HALFPI]));
  return p;
}

// Treibgut: Baumstämme, Paletten
export function debrisParts(rng) {
  if (rng() < 0.5) return [P(cyl(0.3, 0.35, 5 + rng() * 4, 6), 0x5a4632, [0, 0.1, 0], [0, 0, HALFPI])];
  return [P(box(1.2, 0.15, 1.0), 0x9a8462, [0, 0.05, 0]), P(box(1.2, 0.12, 1.0), 0x8a7452, [0.1, 0.2, 0.05], [0, 0.3, 0])];
}
