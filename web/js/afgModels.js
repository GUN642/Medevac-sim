// Bauten und Vegetation für Afghanistan: Lehmgehöfte (Qalats), Moschee, HESCO-Wälle, Container, Pappeln
import { bmpParts } from './ukraineModels.js';
import * as THREE from './lib/three.module.min.js';
import { P, COL, D, tentParts } from './models.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, ws = 10, hs = 6, ts = 0, tl = Math.PI) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, ts, tl);
const HALFPI = Math.PI / 2;

const darker = (c, k) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k); };
export const MUD = [0xa88b64, 0x9c8059, 0xb09470, 0x94785a];
const mud = (rng) => MUD[Math.floor(rng() * MUD.length)];

// Lehmhaus mit Flachdach (oder Kuppeln)
export function houseParts(rng, w, l, h, col) {
  const p = [P(box(w, h, l), col, [0, h / 2, 0]), P(box(w + 0.3, 0.25, l + 0.3), col, [0, h + 0.1, 0])];
  // Sockel (Spritzwasser), Brüstung mit abgebröckelter Kante
  p.push(P(box(w + 0.06, 0.5, l + 0.06), darker(col, 0.78), [0, 0.25, 0]));
  for (const sz of [-1, 1]) p.push(P(box(w + 0.3, 0.32, 0.25), darker(col, 0.95), [0, h + 0.36, sz * (l / 2 + 0.02)]));
  for (const sx of [-1, 1]) p.push(P(box(0.25, 0.32, l + 0.3), darker(col, 0.95), [sx * (w / 2 + 0.02), h + 0.36, 0]));
  if (rng() < 0.35) {
    const n = Math.max(1, Math.floor(l / 3.2));
    for (let i = 0; i < n; i++) p.push(P(sph(Math.min(w, 3.2) * 0.42, 8, 4, 0, HALFPI), col, [0, h + 0.15, -l / 2 + (i + 0.5) * (l / n)]));
  } else {
    // Dachbalken (Vigas) schauen aus der Wand, hölzerne Wasserspeier
    const n = Math.max(2, Math.floor(w / 0.9));
    for (let i = 0; i < n; i++) p.push(P(cyl(0.08, 0.08, 0.35, 6), 0x4e3c28, [-w / 2 + (i + 0.5) * (w / n), h - 0.12, -l / 2 - 0.12], [HALFPI, 0, 0]));
    for (const sx of [-0.3, 0.3]) p.push(P(box(0.14, 0.1, 0.7), 0x4e3c28, [sx * w, h + 0.25, -l / 2 - 0.3]));
  }
  // Tür mit Holzsturz, Fenster mit Gitter, Putzflicken
  const dx = rng() * (w - 2) - (w - 2) / 2;
  p.push(P(box(0.9, 1.7, 0.08), 0x3a2c1e, [dx, 0.85, -l / 2 - 0.03]));
  p.push(P(box(1.3, 0.16, 0.2), 0x4e3c28, [dx, 1.78, -l / 2 - 0.06]));
  for (let k = 0; k < 3; k++) p.push(P(box(0.04, 1.6, 0.03), 0x2a2016, [dx - 0.25 + k * 0.25, 0.85, -l / 2 - 0.08]));
  if (rng() < 0.7) {
    const wx = dx > 0 ? -w * 0.25 : w * 0.25;
    p.push(P(box(0.75, 0.6, 0.1), 0x4e3c28, [wx, h * 0.62, -l / 2 - 0.03]));
    p.push(P(box(0.6, 0.48, 0.1), 0x18140e, [wx, h * 0.62, -l / 2 - 0.05]));
    for (let k = 0; k < 3; k++) p.push(P(box(0.03, 0.48, 0.03), 0x2a2a28, [wx - 0.15 + k * 0.15, h * 0.62, -l / 2 - 0.09]));
  }
  for (let k = 0; k < 3; k++) {
    const side = Math.floor(rng() * 2), pw = 0.6 + rng() * 1.2, ph = 0.4 + rng() * 0.8;
    const py = 0.6 + rng() * (h - 1.2), pc = rng() < 0.5 ? darker(col, 0.88) : darker(col, 1.08 > 1 ? 1 : 1);
    if (side) p.push(P(box(0.03, ph, pw), pc, [w / 2 + 0.015, py, (rng() - 0.5) * (l - pw)]));
    else p.push(P(box(pw, ph, 0.03), pc, [(rng() - 0.5) * (w - pw), py, l / 2 + 0.015]));
  }
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
      p.push(P(box(len + 0.04, 0.55, t + 0.06), darker(col, 0.78), [x, 0.27, z], [0, rot, 0]));
      // abgewitterte Mauerkrone: Buckel unterschiedlicher Höhe
      const nb = Math.max(1, Math.floor(len / 2.4));
      for (let b = 0; b < nb; b++) {
        const bl = len / nb, bo = -len / 2 + (b + 0.5) * bl, bh = 0.12 + ((b * 37 + side * 11) % 7) * 0.04;
        const bx = (lx + bo) * c + lz * sn, bz = -(lx + bo) * sn + lz * c;
        p.push(P(box(bl * 0.86, bh, t * 0.9), darker(col, 1.0), [bx, wallH + bh / 2, bz], [0, rot, 0]));
      }
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
  // Drahtgitter: senkrechte Stöße, waagerechte Drähte, Füllung oben eingesackt
  for (let i = 0; i <= n; i++) p.push(P(box(0.06, h + 0.04, 1.24), 0x6f6f66, [-len / 2 + (i * len) / n, h / 2, 0]));
  if (len <= 24) for (const sz of [-1, 1]) for (let k = 1; k < 4; k++) p.push(P(box(len, 0.025, 0.02), 0x77776e, [0, (k * h) / 4, sz * 0.61]));
  for (const sz of [-1, 1]) p.push(P(box(len, 0.05, 0.05), 0x6f6f66, [0, h, sz * 0.6]));
  p.push(P(box(len - 0.1, 0.06, 1.1), 0x9c8462, [0, h - 0.06, 0]));
  p.push(P(box(len + 0.04, 0.35, 1.24), 0x8a7656, [0, 0.17, 0]));
  return p;
}

export function containerParts(col = 0x7a6a4c) {
  const dk = darker(col, 0.8), p = [P(box(2.45, 2.6, 6.1), col, [0, 1.3, 0])];
  // Sicken an den Längsseiten und auf dem Dach, Eckbeschläge, Türverschlüsse, Rahmen
  for (let i = 0; i < 19; i++) for (const sx of [-1, 1]) p.push(P(box(0.06, 2.3, 0.14), dk, [sx * 1.24, 1.3, -2.8 + i * 0.31]));
  for (let i = 0; i < 9; i++) p.push(P(box(2.3, 0.04, 0.2), dk, [0, 2.61, -2.6 + i * 0.65]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0.08, 2.52]) p.push(P(box(0.2, 0.17, 0.2), 0x3a3a36, [sx * 1.15, y, sz * 2.97]));
  for (const sx of [-1, 1]) for (const y of [0.06, 2.55]) p.push(P(box(0.12, 0.12, 6.1), dk, [sx * 1.17, y, 0]));
  p.push(P(box(2.3, 2.4, 0.06), darker(col, 0.9), [0, 1.3, -3.07]));
  p.push(P(box(0.03, 2.4, 0.08), 0x2a2a28, [0, 1.3, -3.1]));
  for (const x of [-0.85, -0.35, 0.35, 0.85]) {
    p.push(P(cyl(0.025, 0.025, 2.45, 5), 0x3a3a36, [x, 1.3, -3.13]));
    p.push(P(box(0.12, 0.18, 0.05), 0x3a3a36, [x + 0.08, 1.2, -3.15]));
  }
  return p;
}

export function tentAfg(w, l, h, col = 0xb09c74) {
  return tentParts(w, l, h, col);
}

export function guardTowerAfg() {
  const p = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(P(box(0.3, 7, 0.3), 0x6b5a3e, [sx * 1.7, 3.5, sz * 1.7]));
  for (const [a, b] of [[[-1.7, 0.4, -1.7], [1.7, 6.2, -1.7]], [[1.7, 0.4, -1.7], [-1.7, 6.2, -1.7]], [[-1.7, 0.4, 1.7], [1.7, 6.2, 1.7]], [[1.7, 0.4, 1.7], [-1.7, 6.2, 1.7]]]) D.rod(p, a, b, 0.07, 0x5a4a32);
  p.push(P(box(4.2, 0.3, 4.2), 0x6b5a3e, [0, 6.6, 0]));
  // Brüstung aus HESCO-Körben mit Gitter
  for (const [x, z, w, d] of [[0, 2, 4.2, 0.9], [0, -2, 4.2, 0.9], [2, 0, 0.9, 4.2], [-2, 0, 0.9, 4.2]]) {
    p.push(P(box(w, 1.2, d), 0xb39c74, [x, 7.4, z]));
    const n = Math.round(Math.max(w, d) / 1.05);
    for (let i = 0; i <= n; i++) p.push(w > d ? P(box(0.05, 1.22, d + 0.02), 0x6f6f66, [x - w / 2 + (i * w) / n, 7.4, z]) : P(box(w + 0.02, 1.22, 0.05), 0x6f6f66, [x, 7.4, z - d / 2 + (i * d) / n]));
  }
  p.push(P(box(4.6, 0.15, 4.6), 0x8a7a5a, [0, 9.4, 0]));
  for (let i = 0; i < 8; i++) p.push(P(box(4.6, 0.05, 0.08), 0x6e6250, [0, 9.49, -2.1 + i * 0.6]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(P(box(0.12, 1.6, 0.12), 0x6b5a3e, [sx * 2, 8.6, sz * 2]));
  // Tarnnetz-Schürze, Leiter, Scheinwerfer
  p.push(P(box(4.4, 0.6, 0.04), 0x5a5a3e, [0, 9.0, -2.25], [0.15, 0, 0]));
  D.rod(p, [-0.35, 0, 2.9], [-0.35, 6.7, 2.2], 0.04, 0x4a4a42); D.rod(p, [0.35, 0, 2.9], [0.35, 6.7, 2.2], 0.04, 0x4a4a42);
  for (let k = 1; k < 17; k++) { const t = k / 17; p.push(P(box(0.7, 0.05, 0.05), 0x4a4a42, [0, 6.7 * t, 2.9 - 0.7 * t])); }
  D.light(p, 1.8, 8.4, -2.1, 0.16);
  return p;
}

export function mrapParts() {
  const c = 0x9c8a62, dk = 0x7e6f4e, gl = 0x26323a;
  const p = [
    P(box(2.5, 1.6, 6.2), c, [0, 1.75, 0]),
    P(box(2.4, 0.9, 1.6), c, [0, 1.4, -3.6]),
    P(box(0.9, 0.6, 0.9), c, [0, 2.85, 0.3]),
    P(box(1.9, 0.5, 5.4), 0x2a2a26, [0, 0.95, 0]),
    P(box(2.0, 0.35, 3.6), 0x3a3a34, [0, 0.72, 0.3], [0, 0, 0], [1, 1, 1]),
  ];
  // V-Rumpf, Panzerglas vorn (zweigeteilt) und seitlich, Türen, Stufen, Gepäckkörbe
  for (const sx of [-1, 1]) {
    p.push(P(box(1.3, 0.12, 5.6), dk, [sx * 0.55, 0.78, 0.2], [0, 0, sx * 0.55]));
    D.win(p, 'z', sx * 0.55, 2.3, -3.14, 0.95, 0.62, 0x3a3a34, gl, 0.08);
    for (const z of [-2.2, -0.6, 1.0]) D.win(p, 'x', sx * 1.26, 2.15, z, 0.7, 0.55, 0x3a3a34, gl, 0.08);
    for (const z of [-1.4, 0.2]) { p.push(P(box(0.03, 1.4, 0.03), 0x5a4e36, [sx * 1.255, 1.75, z])); p.push(P(box(0.05, 0.08, 0.2), 0x2a2a28, [sx * 1.28, 1.7, z - 0.5])); }
    p.push(P(box(0.25, 0.08, 0.6), 0x2a2a28, [sx * 1.32, 0.95, -1.2]));
    p.push(P(box(0.35, 0.35, 1.6), 0x4a4632, [sx * 1.3, 2.15, 2.1]));
    D.mirror(p, sx * 1.25, 2.5, -2.85);
    D.light(p, sx * 0.85, 1.5, -4.42);
    D.tail(p, sx * 1.0, 1.6, 3.12);
    p.push(P(box(0.7, 0.55, 0.1), dk, [sx * 0.85, 1.3, -4.35]));
  }
  D.grille(p, 0, 1.45, -4.43, 1.1, 0.6, 0x2a2a26, 8);
  p.push(P(box(2.5, 0.25, 0.25), 0x2a2a28, [0, 0.9, -4.5]));
  p.push(P(box(1.0, 1.5, 0.06), dk, [0, 1.75, 3.12]));
  D.wheel(p, 0, 2.0, 3.45, 0.55, 0.4); // Ersatzrad hinten (liegt quer)
  D.antenna(p, -0.9, 2.55, 2.6, 2.6); D.antenna(p, 0.9, 2.55, 2.6, 2.0);
  for (const [x, z] of [[-1.1, -2.6], [1.1, -2.6], [-1.1, 0.8], [1.1, 0.8], [-1.1, 2.2], [1.1, 2.2]]) D.wheel(p, x, 0.6, z, 0.6, 0.45);
  return p;
}

export function dingoParts() {
  const c = 0x8e8360, dk = 0x6f6648, gl = 0x26323a;
  const p = [
    P(box(2.3, 1.5, 5.4), c, [0, 1.6, 0]),
    P(box(2.2, 0.5, 0.08), gl, [0, 2.0, -2.72], [-0.25, 0, 0]),
    P(box(0.7, 0.4, 0.7), c, [0, 2.55, 0.2]),
    P(box(2.1, 0.7, 1.0), c, [0, 1.2, -3.0]),
    P(box(1.8, 0.4, 4.6), 0x2a2a26, [0, 0.75, 0]),
  ];
  for (const sx of [-1, 1]) {
    for (const z of [-1.6, -0.3, 1.0]) D.win(p, 'x', sx * 1.16, 2.0, z, 0.65, 0.45, 0x3a3a34, gl, 0.07);
    p.push(P(box(0.03, 1.3, 0.03), 0x5a5440, [sx * 1.155, 1.6, -1.0]));
    p.push(P(box(0.05, 0.08, 0.2), 0x2a2a28, [sx * 1.18, 1.55, -1.4]));
    p.push(P(box(0.6, 0.5, 2.4), 0x2a2a26, [sx * 1.0, 0.95, 0.0], [0, 0, 0], [0.6, 1, 1]));
    D.mirror(p, sx * 1.15, 2.2, -2.5);
    D.light(p, sx * 0.75, 1.3, -3.52);
    D.tail(p, sx * 0.95, 1.4, 2.72);
    p.push(P(box(0.35, 0.3, 1.2), 0x4a4632, [sx * 1.2, 1.9, 1.9]));
  }
  D.grille(p, 0, 1.25, -3.52, 0.9, 0.45, 0x2a2a26, 7);
  p.push(P(box(2.2, 0.22, 0.25), 0x2a2a28, [0, 0.85, -3.6]));
  p.push(P(box(0.9, 1.3, 0.06), dk, [0, 1.6, 2.72]));
  D.antenna(p, -0.8, 2.35, 2.2, 2.4);
  for (const [x, z] of [[-1.0, -1.7], [1.0, -1.7], [-1.0, 1.7], [1.0, 1.7]]) D.wheel(p, x, 0.55, z, 0.55, 0.4);
  return p;
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
    P(box(2.2, 0.4, 8), 0x2a2a24, [0, 0.95, 0]),
    P(box(2.4, 1.7, 1.9), c, [0, 2.0, -3.0]),
    P(cyl(1.1, 1.1, 5, 18), 0xa79a74, [0, 2.3, 1.0], [HALFPI, 0, 0]),
    P(cyl(0.12, 0.12, 2.0, 8), 0x111111, [1.35, 1.2, 2.8], [0, 0, HALFPI]),
    P(box(2.5, 0.24, 0.22), 0x2a2a28, [0, 0.95, -4.05]),
  ];
  for (const z of [-1.0, 1.0, 3.0]) p.push(P(cyl(1.13, 1.13, 0.12, 18), 0x8a7c5c, [0, 2.3, z], [HALFPI, 0, 0]));
  p.push(P(box(0.6, 0.12, 4.4), 0x6a6050, [0, 3.45, 1.0]));
  D.win(p, 'z', 0, 2.45, -3.96, 2.1, 0.6);
  D.grille(p, 0, 1.45, -3.97, 1.2, 0.6);
  for (const sx of [-1, 1]) { D.win(p, 'x', sx * 1.21, 2.4, -2.8, 0.9, 0.55); D.mirror(p, sx * 1.2, 2.55, -3.6); D.light(p, sx * 0.85, 1.35, -3.98); D.tail(p, sx * 1.0, 1.0, 4.02); p.push(P(box(0.08, 0.6, 1.0), 0x2a2a28, [sx * 1.15, 1.0, 1.6])); }
  for (const z of [-3.2, 1.6, 3.0]) for (const sx of [-1, 1]) D.wheel(p, sx * 1.1, 0.58, z, 0.58, 0.45);
  return p;
}

// ---------------------------------------------------------------- Vegetation und Gelände
export function poplarParts(detail = false) {
  if (detail) return [
    P(cyl(0.16, 0.3, 7, 7), 0x6e6250, [0, 3.5, 0]),
    P(new THREE.ConeGeometry(1.35, 7, 9), 0x5d7a34, [0, 11.2, 0]),
    P(new THREE.IcosahedronGeometry(1, 1), 0x58742f, [0, 7.6, 0], [0, 0, 0], [1.55, 2.6, 1.55]),
    P(new THREE.IcosahedronGeometry(1, 0), 0x4f6c2a, [0.4, 5.4, 0.2], [0.3, 0.2, 0], [1.4, 1.6, 1.4]),
    P(new THREE.IcosahedronGeometry(1, 0), 0x66843a, [-0.3, 9.6, -0.2], [0.6, 0.8, 0], [1.2, 1.8, 1.2]),
  ];
  return [
    P(cyl(0.18, 0.3, 6, 5), 0x6e6250, [0, 3, 0]),
    P(new THREE.ConeGeometry(1.5, 11, 7), 0x5d7a34, [0, 9.5, 0]),
    P(sph(1.45, 7, 5), 0x58742f, [0, 5.6, 0], [0, 0, 0], [1, 1.2, 1]),
  ];
}
export function fruitTreeParts(detail = false) {
  if (detail) return [
    P(cyl(0.16, 0.3, 2.8, 7), 0x5a4a35, [0, 1.4, 0], [0.1, 0, 0.05]),
    P(cyl(0.07, 0.12, 1.8, 5), 0x5a4a35, [0.6, 2.9, 0], [0, 0, -0.7]),
    P(cyl(0.07, 0.12, 1.8, 5), 0x5a4a35, [-0.5, 3.0, 0.3], [0.4, 0, 0.6]),
    P(new THREE.IcosahedronGeometry(1, 1), 0x4f6e2a, [0, 4.3, 0], [0, 0, 0], [2.6, 1.8, 2.6]),
    P(new THREE.IcosahedronGeometry(1, 0), 0x5a7a30, [1.3, 3.9, 0.6], [0.3, 0.5, 0], [1.6, 1.2, 1.6]),
    P(new THREE.IcosahedronGeometry(1, 0), 0x46632a, [-1.2, 4.1, -0.7], [0.1, 1.1, 0], [1.7, 1.3, 1.6]),
  ];
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

// ---------------------------------------------------------------- Feindfahrzeuge
// 'technical': Pickup mit schwerem MG (DShK) auf der Ladefläche; 'truck': Lkw (Vietnam) mit MG über dem Fahrerhaus
export function vehicleParts(kind) {
  const p = [];
  const wheelAt = (x, z, r = 0.42, w = 0.3) => D.wheel(p, x, r, z, r, w, 0x6a6a66, true);
  if (kind === 'bmp') return bmpParts();
  if (kind === 'truck') {
    const c = 0x3e4a2c, d = 0x2c3420;
    p.push(P(box(2.3, 0.35, 6.4), 0x222222, [0, 0.9, 0.2]));
    p.push(P(box(2.3, 1.5, 1.9), c, [0, 1.85, -2.2]));
    p.push(P(box(2.1, 0.7, 1.1), c, [0, 1.35, -3.6]));
    p.push(P(box(2.0, 0.55, 0.05), 0x2b3a40, [0, 2.2, -3.17]));
    p.push(P(box(2.4, 0.6, 3.9), d, [0, 1.4, 1.2]));
    p.push(P(new THREE.CylinderGeometry(1.2, 1.2, 3.9, 10, 1, false, 0, Math.PI), 0x5a5a3a, [0, 1.7, 1.2], [HALFPI, 0, 0], [1, 1, 0.75]));
    for (const z of [-3.2, 0.6, 2.2]) for (const sx of [-1, 1]) wheelAt(sx * 1.05, z, 0.5, 0.34);
    D.grille(p, 0, 1.3, -4.17, 1.2, 0.5, 0x22261a);
    for (const sx of [-1, 1]) { D.light(p, sx * 0.85, 1.3, -4.17); D.mirror(p, sx * 1.15, 2.3, -2.9); D.win(p, 'x', sx * 1.16, 2.2, -2.2, 0.9, 0.55); p.push(P(box(0.6, 0.06, 0.9), d, [sx * 1.0, 1.2, -3.2])); }
    // DShK auf dem Fahrerhaus
    p.push(P(cyl(0.04, 0.05, 0.5, 6), 0x2a2a28, [0, 2.85, -2.2]));
    p.push(P(box(0.14, 0.16, 0.6), 0x2a2a28, [0, 3.15, -2.2]));
    p.push(P(cyl(0.035, 0.035, 1.3, 8), 0x2a2a28, [0, 3.18, -3.0], [HALFPI, 0, 0]));
  } else {
    const c = [0xd8d4c4, 0xb8a988, 0x8c8c86][Math.floor(Math.random() * 3)], d = 0x2a2a28;
    p.push(P(box(1.8, 0.3, 5.0), 0x222222, [0, 0.62, 0]));
    p.push(P(box(1.85, 0.65, 1.7), c, [0, 1.05, -1.75]));                      // Motorhaube
    p.push(P(box(1.85, 0.9, 1.5), c, [0, 1.55, -0.35]));                       // Kabine
    p.push(P(box(1.7, 0.6, 0.05), 0x2b3a40, [0, 1.72, -1.12], [-0.35, 0, 0]));
    p.push(P(box(1.9, 0.12, 2.3), c, [0, 0.85, 1.4]));                         // Ladefläche
    for (const sx of [-1, 1]) p.push(P(box(0.08, 0.55, 2.3), c, [sx * 0.92, 1.18, 1.4]));
    p.push(P(box(1.9, 0.55, 0.08), c, [0, 1.18, 2.52]));
    p.push(P(box(1.9, 0.18, 0.2), 0x333333, [0, 0.7, -2.6]));                  // Stoßstange
    for (const z of [-1.6, 1.5]) for (const sx of [-1, 1]) wheelAt(sx * 0.88, z);
    D.grille(p, 0, 0.98, -2.61, 1.1, 0.35, 0x2a2a28, 8);
    for (const sx of [-1, 1]) {
      D.light(p, sx * 0.72, 1.05, -2.62, 0.1); D.tail(p, sx * 0.85, 1.1, 2.57); D.mirror(p, sx * 0.93, 1.75, -0.95);
      D.win(p, 'x', sx * 0.935, 1.75, -0.35, 0.95, 0.42);
      p.push(P(box(0.18, 0.08, 0.95), c, [sx * 0.95, 0.98, -1.6])); p.push(P(box(0.18, 0.08, 0.95), c, [sx * 0.95, 0.98, 1.5]));
      p.push(P(box(0.02, 0.7, 0.02), 0x222222, [sx * 0.935, 1.3, 0.35]));
    }
    D.win(p, 'z', 0, 1.75, 0.41, 1.5, 0.4);
    // DShK auf Dreibein
    p.push(P(cyl(0.05, 0.06, 0.9, 6), d, [0, 1.35, 1.2]));
    p.push(P(box(0.14, 0.16, 0.6), d, [0, 1.85, 1.15]));
    p.push(P(cyl(0.035, 0.035, 1.3, 8), d, [0, 1.88, 0.35], [HALFPI, 0, 0]));
    p.push(P(cyl(0.06, 0.06, 0.25, 8), d, [0, 1.88, -0.32], [HALFPI, 0, 0]));
    p.push(P(box(0.4, 0.3, 0.05), d, [0, 1.9, 0.9]));                          // Schutzschild
  }
  return p;
}
