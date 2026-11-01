// Bauten und Vegetation für Afghanistan: Lehmgehöfte (Qalats), Moschee, HESCO-Wälle, Container, Pappeln
import * as THREE from './lib/three.module.min.js';
import { P, COL } from './models.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, ws = 10, hs = 6, ts = 0, tl = Math.PI) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, ts, tl);
const HALFPI = Math.PI / 2;

export const MUD = [0xa88b64, 0x9c8059, 0xb09470, 0x94785a];
const mud = (rng) => MUD[Math.floor(rng() * MUD.length)];

// Lehmhaus mit Flachdach (oder Kuppeln)
export function houseParts(rng, w, l, h, col) {
  const p = [P(box(w, h, l), col, [0, h / 2, 0]), P(box(w + 0.3, 0.25, l + 0.3), col, [0, h + 0.1, 0])];
  if (rng() < 0.35) {
    const n = Math.max(1, Math.floor(l / 3.2));
    for (let i = 0; i < n; i++) p.push(P(sph(Math.min(w, 3.2) * 0.42, 8, 4, 0, HALFPI), col, [0, h + 0.15, -l / 2 + (i + 0.5) * (l / n)]));
  }
  p.push(P(box(0.9, 1.7, 0.08), 0x3a2c1e, [rng() * (w - 2) - (w - 2) / 2, 0.85, -l / 2 - 0.03]));
  if (rng() < 0.7) p.push(P(box(0.6, 0.5, 0.08), 0x221c14, [0, h * 0.65, -l / 2 - 0.03]));
  return p;
}

// Qalat: quadratisches Gehöft mit 3 m hohen Lehmmauern, Tor, Häusern im Innenhof
export function qalatParts(rng, size) {
  const col = mud(rng), wallH = 2.6 + rng() * 0.8, t = 0.7, s = size / 2;
  const p = [];
  const gateSide = Math.floor(rng() * 4);
  for (let side = 0; side < 4; side++) {
    const rot = side * HALFPI;
    const c = Math.cos(rot), sn = Math.sin(rot);
    const place = (offset, len) => {
      // Mauersegment entlang der Seite: lokale x-Achse = Mauerlänge
      const lx = offset, lz = -s;
      const x = lx * c + lz * sn, z = -lx * sn + lz * c;
      p.push(P(box(len, wallH, t), col, [x, wallH / 2, z], [0, rot, 0]));
    };
    if (side === gateSide) {
      const g = 1.8;
      place(-(s + g) / 2 - g / 2 + g / 2, s - g);
      place((s + g) / 2 - g / 2 + g / 2, s - g);
      const gx = 0, gz = -s;
      p.push(P(box(g * 2, 0.4, t + 0.2), col, [gx * c + gz * sn, wallH + 0.1, -gx * sn + gz * c], [0, rot, 0]));
    } else place(0, size);
  }
  if (rng() < 0.45) {
    // Eckturm
    const cx = (rng() < 0.5 ? -1 : 1) * s, cz = (rng() < 0.5 ? -1 : 1) * s;
    p.push(P(cyl(1.3, 1.6, wallH + 2.4, 8), col, [cx, (wallH + 2.4) / 2, cz]));
  }
  // Häuser an der Innenseite der Mauern
  const n = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const w = 4 + rng() * 3, l = 6 + rng() * Math.min(8, size - 10), h = 2.4 + rng() * 0.8;
    const side = (gateSide + 1 + i) % 4, rot = side * HALFPI;
    const lx = (rng() - 0.5) * (size - l - 3), lz = -s + t + w / 2 + 0.2;
    const parts = houseParts(rng, l, w, h, col);
    const x = lx * Math.cos(rot) + lz * Math.sin(rot), z = -lx * Math.sin(rot) + lz * Math.cos(rot);
    placeLocal(parts, x, 0, z, rot + Math.PI); // Tür zum Innenhof
    p.push(...parts);
  }
  // Innenhof: etwas Grün
  if (rng() < 0.6) p.push(P(sph(1.8, 7, 5), 0x5f6e33, [(rng() - 0.5) * 6, 2.6, (rng() - 0.5) * 6], [0, 0, 0], [1, 0.8, 1]));
  return p;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
function placeLocal(parts, x, y, z, rot) {
  _e.set(0, rot, 0); _q.setFromEuler(_e); _m.compose(_v.set(x, y, z), _q, _s);
  for (const g of parts) g.applyMatrix4(_m);
}

export function mosqueParts(rng) {
  const col = 0xb8a07a;
  return [
    P(box(10, 4.2, 12), col, [0, 2.1, 0]),
    P(box(10.4, 0.3, 12.4), col, [0, 4.3, 0]),
    P(sph(3.4, 12, 6, 0, HALFPI), 0x6f8f86, [0, 4.4, 0]),
    P(cyl(0.2, 0.2, 1.0, 6), 0xc8b070, [0, 8.2, 0]),
    P(cyl(0.7, 0.8, 13, 8), 0xc9b48c, [5.8, 6.5, 5.5]),
    P(cyl(1.0, 1.0, 0.6, 8), 0xc9b48c, [5.8, 11.5, 5.5]),
    P(new THREE.ConeGeometry(0.8, 1.8, 8), 0x6f8f86, [5.8, 13.9, 5.5]),
    P(box(2.4, 3.2, 0.1), 0x3a2c1e, [0, 1.6, -6.05]),
  ];
}

// Lehmhaus am Ortsrand / Marktstraße
export function shopRowParts(rng, n) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const col = mud(rng), w = 4 + rng() * 1.5, h = 2.8 + rng() * 1.2;
    p.push(P(box(w, h, 5), col, [i * 5.2, h / 2, 0]));
    p.push(P(box(w, 0.1, 2.0), [0x6b4f2e, 0x2f4f5f, 0x7b2a24][Math.floor(rng() * 3)], [i * 5.2, 2.4, -3.4], [-0.25, 0, 0]));
  }
  return p;
}

// ---------------------------------------------------------------- FOB
export function hescoWall(len, h = 2.2) {
  const p = [P(box(len, h, 1.2), 0xb39c74, [0, h / 2, 0])];
  const n = Math.max(1, Math.round(len / 1.2));
  for (let i = 1; i < n; i++) p.push(P(box(0.05, h + 0.02, 1.22), 0x6f6f66, [-len / 2 + (i * len) / n, h / 2, 0]));
  return p;
}

export function containerParts(col = 0x7a6a4c) {
  const p = [P(box(2.45, 2.6, 6.1), col, [0, 1.3, 0])];
  for (let i = -2; i <= 2; i++) p.push(P(box(2.5, 2.4, 0.08), col, [0, 1.3, i * 1.15], [0, 0, 0], [1, 1, 1]));
  p.push(P(box(2.3, 2.4, 0.06), 0x55493a, [0, 1.3, -3.07]));
  return p;
}

export function tentAfg(w, l, h, col = 0xb09c74) {
  return [
    P(box(w, h * 0.55, l), col, [0, h * 0.275, 0]),
    P(cyl(w * 0.62, w * 0.62, l, 3), col, [0, h * 0.55 + w * 0.17, 0], [-HALFPI, 0, 0], [1, 1, 0.55]),
  ];
}

export function guardTowerAfg() {
  const p = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(P(box(0.3, 7, 0.3), 0x6b5a3e, [sx * 1.7, 3.5, sz * 1.7]));
  p.push(P(box(4.2, 0.3, 4.2), 0x6b5a3e, [0, 6.6, 0]));
  for (const [x, z, w, d] of [[0, 2, 4.2, 0.9], [0, -2, 4.2, 0.9], [2, 0, 0.9, 4.2], [-2, 0, 0.9, 4.2]]) p.push(P(box(w, 1.2, d), 0xb39c74, [x, 7.4, z]));
  p.push(P(box(4.6, 0.15, 4.6), 0x8a7a5a, [0, 9.4, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(P(box(0.12, 1.6, 0.12), 0x6b5a3e, [sx * 2, 8.6, sz * 2]));
  return p;
}

export function mrapParts() {
  const c = 0x9c8a62;
  return [
    P(box(2.5, 1.6, 6.2), c, [0, 1.75, 0]),
    P(box(2.4, 0.9, 1.6), c, [0, 1.4, -3.6]),
    P(box(2.2, 0.6, 0.08), 0x2b3a40, [0, 2.2, -2.9], [-0.3, 0, 0]),
    P(box(0.9, 0.6, 0.9), c, [0, 2.85, 0.3]),
    P(box(0.1, 0.1, 1.2), 0x222222, [0, 2.95, -0.5]),
    ...[[-1.1, -2.6], [1.1, -2.6], [-1.1, 0.8], [1.1, 0.8], [-1.1, 2.2], [1.1, 2.2]].map(([x, z]) =>
      P(cyl(0.6, 0.6, 0.45, 12), 0x161616, [x, 0.6, z], [0, 0, HALFPI])),
  ];
}

export function dingoParts() {
  const c = 0x8e8360;
  return [
    P(box(2.3, 1.5, 5.4), c, [0, 1.6, 0]),
    P(box(2.2, 0.5, 0.08), 0x2b3a40, [0, 2.0, -2.72], [-0.25, 0, 0]),
    P(box(0.7, 0.4, 0.7), c, [0, 2.55, 0.2]),
    ...[[-1.0, -1.7], [1.0, -1.7], [-1.0, 1.7], [1.0, 1.7]].map(([x, z]) =>
      P(cyl(0.55, 0.55, 0.4, 12), 0x161616, [x, 0.55, z], [0, 0, HALFPI])),
  ];
}

export function padAfg(kind, size = 30) {
  const p = [P(box(size, 0.12, size), 0x8e8170, [0, 0.06, 0])];
  if (kind === 'med') {
    p.push(P(box(12, 0.02, 12), COL.white, [0, 0.13, 0]));
    p.push(P(box(10, 0.03, 3), COL.red, [0, 0.145, 0]));
    p.push(P(box(3, 0.03, 10), COL.red, [0, 0.145, 0]));
  } else {
    p.push(P(box(1.4, 0.03, 10), COL.white, [-3, 0.135, 0]));
    p.push(P(box(1.4, 0.03, 10), COL.white, [3, 0.135, 0]));
    p.push(P(box(4.6, 0.03, 1.4), COL.white, [0, 0.135, 0]));
  }
  const e = size / 2 - 0.3;
  const edge = kind === 'pol' ? 0xc8a420 : 0xd8d0c0;
  p.push(P(box(size, 0.03, 0.6), edge, [0, 0.135, e]), P(box(size, 0.03, 0.6), edge, [0, 0.135, -e]));
  p.push(P(box(0.6, 0.03, size), edge, [e, 0.135, 0]), P(box(0.6, 0.03, size), edge, [-e, 0.135, 0]));
  return p;
}

export function fuelTruckAfg() {
  const c = 0x9a8a64;
  const p = [
    P(box(2.4, 0.4, 8), 0x2a2a24, [0, 0.95, 0]),
    P(box(2.4, 1.7, 1.9), c, [0, 2.0, -3.0]),
    P(box(2.2, 0.6, 0.06), 0x2b3a40, [0, 2.5, -3.97]),
    P(cyl(1.1, 1.1, 5, 14), 0xa79a74, [0, 2.3, 1.0], [HALFPI, 0, 0]),
    P(cyl(0.12, 0.12, 2.0, 6), 0x111111, [1.35, 1.2, 2.8], [0, 0, HALFPI]),
  ];
  for (const z of [-3.2, 1.6, 3.0]) for (const sx of [-1, 1]) p.push(P(cyl(0.58, 0.58, 0.45, 12), 0x161616, [sx * 1.1, 0.58, z], [0, 0, HALFPI]));
  return p;
}

// ---------------------------------------------------------------- Vegetation und Gelände
export function poplarParts() {
  return [
    P(cyl(0.18, 0.3, 6, 5), 0x6e6250, [0, 3, 0]),
    P(new THREE.ConeGeometry(1.5, 11, 7), 0x5d7a34, [0, 9.5, 0]),
    P(sph(1.45, 7, 5), 0x58742f, [0, 5.6, 0], [0, 0, 0], [1, 1.2, 1]),
  ];
}
export function fruitTreeParts() {
  return [
    P(cyl(0.2, 0.3, 2.8, 5), 0x5a4a35, [0, 1.4, 0]),
    P(new THREE.IcosahedronGeometry(1, 0), 0x4f6e2a, [0, 4.2, 0], [0, 0, 0], [3.0, 2.2, 3.0]),
  ];
}
export function shrubParts() {
  return [P(new THREE.IcosahedronGeometry(1, 0), 0x7a7a4a, [0, 0.45, 0], [0, 0, 0], [0.9, 0.55, 0.9])];
}

// ---------------------------------------------------------------- Wracks (CSAR)
export function wreckAfg(kind) {
  const p = [];
  const burnt = 0x24221e;
  p.push(P(new THREE.CircleGeometry(14, 16), 0x3a3428, [0, 0.08, 0], [-HALFPI, 0, 0]));
  if (kind === 'ah64') {
    const c = 0x2f3529;
    p.push(P(box(1.2, 1.6, 6), c, [0, 0.8, 0], [0, 0.5, 0.9]));
    p.push(P(cyl(0.3, 0.5, 6, 8), c, [2.8, 0.5, 4.5], [HALFPI, 0.5, 0.3]));
    p.push(P(box(3.2, 0.15, 0.9), c, [-1.4, 0.5, -0.5], [0, 0.5, 0.3]));
    p.push(P(box(7, 0.06, 0.6), COL.rotor, [-4, 0.3, -2.5], [0.2, 0.7, 0.1]));
    p.push(P(box(6, 0.06, 0.6), COL.rotor, [4, 0.2, -3], [-0.1, -0.4, 0.2]));
  } else if (kind === 'f15' || kind === 'tornado') {
    const c = kind === 'f15' ? 0x5f6669 : 0x5e6650;
    p.push(P(cyl(0.9, 0.7, 9, 10), c, [0, 0.8, -1], [HALFPI, 0.2, 0.3]));
    p.push(P(new THREE.ConeGeometry(0.7, 3, 10), c, [0.6, 0.7, -6.6], [-HALFPI, 0.2, 0.3]));
    p.push(P(box(5.5, 0.18, 4), c, [-3.6, 0.5, 0.4], [0, 0.5, 0.15]));
    p.push(P(box(4.5, 0.18, 3.4), burnt, [3.4, 1.1, 0.8], [0, -0.5, -0.45]));
    p.push(P(cyl(0.8, 0.6, 4, 10), burnt, [3.6, 0.7, 7.2], [HALFPI, 0.8, 0]));
    p.push(P(box(0.18, 2.6, 2.2), c, [3.8, 2.0, 8.4], [0.5, 0.8, 0.4]));
  } else {
    // UH-60
    const c = 0x3d4135;
    p.push(P(box(2.3, 1.8, 5.5), c, [0, 0.9, 0], [0, 0.4, 1.2]));
    p.push(P(cyl(0.3, 0.8, 5.5, 8), c, [3.4, 0.5, 5.2], [HALFPI, 1.0, 0.2]));
    p.push(P(box(8, 0.06, 0.55), COL.rotor, [-4, 0.3, -3], [0.2, 0.7, 0.1]));
    p.push(P(box(6, 0.06, 0.55), COL.rotor, [5, 0.2, -2], [-0.1, -0.5, 0.2]));
  }
  return p;
}
