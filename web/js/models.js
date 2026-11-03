// Prozedurale Low-Poly-Modelle (UH-1D, Figuren, Fahrzeuge, Gebäude, Wracks)
import * as THREE from './lib/three.module.min.js';
import { loft, grainTexture } from './loft.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

// Erzeugt ein transformiertes, eingefärbtes (nicht indiziertes) Geometrieteil
export function P(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  _e.set(rot[0], rot[1], rot[2], 'YXZ');
  _q.setFromEuler(_e);
  _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(scl[0], scl[1], scl[2]));
  g.applyMatrix4(_m);
  _c.set(color);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo !== g && geo.dispose && !geo.__keep && geo.dispose();
  return g;
}

// Verschmilzt Teile (position, normal, color) zu einer Geometrie
export function merge(parts) {
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    else col.fill(1, o * 3, (o + c) * 3);
    o += c;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// Verschiebt/rotiert eine Liste von Teilen (für Platzierung von Bauten in der Welt)
export function placeParts(parts, x, y, z, rotY = 0) {
  _e.set(0, rotY, 0);
  _q.setFromEuler(_e);
  _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1));
  for (const g of parts) g.applyMatrix4(_m);
  return parts;
}

export const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
export const vcMatDouble = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
// Bauten mit feiner Putz-/Sandstruktur (UV aus Weltkoordinaten, siehe worldUV)
export const vcGrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: grainTexture() });

// UV-Koordinaten aus der Position je nach Flächenausrichtung (für Mauern, Wälle, Dächer)
export function worldUV(geo, scale = 0.35) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, ws = 10, hs = 8, ts = 0, tl = Math.PI) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, ts, tl);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
const tor = (r, t, s = 12) => new THREE.TorusGeometry(r, t, 6, s);
const HALFPI = Math.PI / 2;

// ---------------------------------------------------------------- Farben
export const COL = {
  od: 0x4b5330, odDark: 0x3a4126, odLight: 0x5d6640,
  black: 0x1b1c1c, gun: 0x232425, metal: 0x6b6e70, rotor: 0x2a2b2b,
  tan: 0xb39a6c, sand: 0xa38a5c, canvas: 0x5b5f3c, white: 0xe8e6de, red: 0xb8221c,
  wood: 0x6e5134, thatch: 0xa88f55, bamboo: 0x8c7a4a,
};

// ---------------------------------------------------------------- Figuren
const FIG_TYPES = {
  us:      { uni: 0x4f5c37, skin: 0xd2a07a, hat: 'm1', hatCol: 0x58623b, pack: 0x3f4a2b, gun: 0x1d1d1d },
  us2:     { uni: 0x4f5c37, skin: 0x6b4630, hat: 'm1', hatCol: 0x58623b, pack: 0x3f4a2b, gun: 0x1d1d1d },
  wounded: { uni: 0x4f5c37, skin: 0xd2a07a, hat: 'band', hatCol: 0xeeeeee, pack: null, gun: null, blood: true },
  pilot:   { uni: 0x66705e, skin: 0xd8a882, hat: 'flight', hatCol: 0xcfd0c8, pack: 0x55604a, gun: null },
  player:  { uni: 0x4f5c37, skin: 0xd2a07a, hat: 'm1', hatCol: 0x58623b, pack: 0x3f4a2b, gun: null, armsAim: true },
  crew:    { uni: 0x535d3d, skin: 0xd2a07a, hat: 'flight', hatCol: 0x3d4630, pack: null, gun: null },
  vc:      { uni: 0x1c1c22, skin: 0xc9956a, hat: 'conical', hatCol: 0xc9b27a, pack: null, gun: 0x3b2a1b },
  nva:     { uni: 0x6f6b45, skin: 0xc9956a, hat: 'pith', hatCol: 0x7d7749, pack: 0x5a5638, gun: 0x3b2a1b },
  // Afghanistan
  isaf:     { uni: 0x857d5e, skin: 0xd2a07a, hat: 'helmet', hatCol: 0x7a7055, pack: 0x6b6247, gun: 0x1d1d1d, vest: 0x6f6649, rifle: 'm4' },
  isaf2:    { uni: 0x857d5e, skin: 0x6b4630, hat: 'helmet', hatCol: 0x7a7055, pack: 0x6b6247, gun: 0x1d1d1d, vest: 0x6f6649, rifle: 'm4' },
  bw:       { uni: 0x9a8c66, skin: 0xd8a882, hat: 'helmet', hatCol: 0x8a7d5a, pack: 0x6e6446, gun: 0x222222, vest: 0x7d7252, rifle: 'm4' },
  woundedA: { uni: 0x857d5e, skin: 0xd2a07a, hat: 'band', hatCol: 0xeeeeee, pack: null, gun: null, blood: true },
  crewA:    { uni: 0x6b6d55, skin: 0xd2a07a, hat: 'flight', hatCol: 0x4a4c3c, pack: null, gun: null },
  pilotA:   { uni: 0x6b6d55, skin: 0xd8a882, hat: 'flight', hatCol: 0x3f4133, pack: 0x55604a, gun: null },
  playerA:  { uni: 0x857d5e, skin: 0xd2a07a, hat: 'helmet', hatCol: 0x7a7055, pack: 0x6b6247, gun: null, vest: 0x6f6649, armsAim: true },
  sof:      { uni: 0x7b7458, skin: 0xc99a70, hat: 'cap', hatCol: 0x5b5745, pack: 0x5a5440, gun: 0x1d1d1d, vest: 0x5e5a46, rifle: 'm4', beard: 0x3a2a1e },
  lrrp:     { uni: 0x3d4a2a, skin: 0xd2a07a, hat: 'boonie', hatCol: 0x3d4a2a, pack: 0x3f4a2b, gun: 0x1d1d1d },
  vipA:     { uni: 0xdcd6c6, skin: 0xb98560, hat: 'karakul', hatCol: 0x3a3028, pack: null, gun: null, robe: true, vest: 0x4a4a52, beard: 0x2a2a2a },
  vipV:     { uni: 0x5a6340, skin: 0xd2a07a, hat: 'cap', hatCol: 0x4a5236, pack: null, gun: null },
  tal:      { uni: 0x8d887c, skin: 0xb98560, hat: 'turban', hatCol: 0x1f1f1f, pack: null, gun: 0x3b2a1b, robe: true, beard: 0x1b1612 },
  tal2:     { uni: 0x6e5f4a, skin: 0xb07a55, hat: 'turban', hatCol: 0xd8d2c0, pack: 0x3d3a30, gun: 0x3b2a1b, robe: true, beard: 0x1b1612 },
};

const figGeoCache = {};
const _fq = new THREE.Quaternion(), _fm = new THREE.Matrix4(), _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), _fy = new THREE.Vector3(0, 1, 0);

// Gliedmaße als Zylinder zwischen zwei Punkten (mit Gelenkkugel am Ende)
function limb(parts, a, b, r0, r1, color, seg = 7) {
  _fa.set(...a); _fb.set(...b);
  const d = _fb.clone().sub(_fa), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1);
  _fq.setFromUnitVectors(_fy, d.normalize());
  _fm.compose(_fa.clone().add(_fb).multiplyScalar(0.5), _fq, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(_fm);
  parts.push(P(g, color));
  parts.push(P(sph(r1 * 1.02, seg, 5), color, b));
}

// Vorgefärbte Geometrie (z. B. Waffe) verschoben/gedreht übernehmen
function Pc(geo, pos, rot) {
  const g = geo.clone();
  _fq.setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ'));
  _fm.compose(new THREE.Vector3(...pos), _fq, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(_fm);
  return g;
}

// Rumpf als runde Form (Hüfte -> Schultern), Höhe entlang y
function torsoGeo(keys, seg) {
  const g = loft(keys, { radial: seg, steps: 2, dz: 0.2, capStart: true, capEnd: true });
  g.rotateX(-HALFPI);
  return g;
}

function figureGeos(type) {
  if (figGeoCache[type]) return figGeoCache[type];
  const t = FIG_TYPES[type];
  const parts = [];
  const seg = 10;
  // Oberkörper mit Gürtel
  parts.push(P(torsoGeo([
    { z: 0.84, w: 0.34, top: 0.1, bot: -0.11 }, { z: 1.0, w: 0.35, top: 0.11, bot: -0.12 },
    { z: 1.25, w: 0.4, top: 0.13, bot: -0.12 }, { z: 1.4, w: 0.44, top: 0.12, bot: -0.11 },
    { z: 1.47, w: 0.3, top: 0.08, bot: -0.08 },
  ], seg), t.uni));
  parts.push(P(cyl(0.18, 0.18, 0.06, 12), 0x2a2a20, [0, 0.92, 0], [0, 0, 0], [1, 1, 0.68]));
  // Hals, Kopf, Nase, Ohren
  parts.push(P(cyl(0.05, 0.055, 0.1, 8), t.skin, [0, 1.5, 0]));
  parts.push(P(sph(0.105, 12, 10), t.skin, [0, 1.6, -0.005], [0, 0, 0], [0.92, 1.08, 1]));
  parts.push(P(box(0.025, 0.04, 0.03), t.skin, [0, 1.585, -0.105]));
  for (const sx of [-1, 1]) parts.push(P(sph(0.025, 6, 4), t.skin, [sx * 0.097, 1.6, 0.0]));
  // Kopfbedeckung
  if (t.hat === 'm1') { parts.push(P(sph(0.15, 12, 6, 0, HALFPI), t.hatCol, [0, 1.62, 0], [0, 0, 0], [1, 0.9, 1.08])); parts.push(P(cyl(0.165, 0.165, 0.015, 14), t.hatCol, [0, 1.625, 0], [0, 0, 0], [1, 1, 1.1])); }
  if (t.hat === 'helmet') {
    parts.push(P(sph(0.135, 12, 6, 0, HALFPI * 1.1), t.hatCol, [0, 1.62, 0.005], [0, 0, 0], [1.02, 0.95, 1.1]));
    parts.push(P(box(0.05, 0.04, 0.04), 0x222222, [0, 1.72, -0.13]));                     // NVG-Halter
    parts.push(P(box(0.08, 0.05, 0.03), 0x3a3a30, [0, 1.68, 0.13]));                      // Batteriepack
  }
  if (t.hat === 'cap') { parts.push(P(sph(0.115, 12, 6, 0, HALFPI), t.hatCol, [0, 1.63, 0.0])); parts.push(P(box(0.16, 0.015, 0.1), t.hatCol, [0, 1.635, -0.13])); }
  if (t.hat === 'boonie') { parts.push(P(sph(0.115, 12, 6, 0, HALFPI), t.hatCol, [0, 1.64, 0])); parts.push(P(cyl(0.2, 0.21, 0.015, 14), t.hatCol, [0, 1.645, 0], [0.05, 0, 0])); }
  if (t.hat === 'karakul') parts.push(P(cyl(0.1, 0.11, 0.1, 12), t.hatCol, [0, 1.71, 0]));
  if (t.hat === 'band') parts.push(P(cyl(0.112, 0.112, 0.06, 12), t.hatCol, [0, 1.64, 0]));
  if (t.hat === 'flight') { parts.push(P(sph(0.135, 12, 7, 0, Math.PI * 0.62), t.hatCol, [0, 1.61, 0], [0, 0, 0], [1, 1, 1.08])); parts.push(P(box(0.18, 0.05, 0.03), 0x1a1d1f, [0, 1.66, -0.13])); }
  if (t.hat === 'conical') parts.push(P(cone(0.32, 0.2, 14), t.hatCol, [0, 1.77, 0]));
  if (t.hat === 'pith') {
    parts.push(P(sph(0.14, 12, 6, 0, HALFPI), t.hatCol, [0, 1.63, 0], [0, 0, 0], [1.1, 0.85, 1.2]));
    parts.push(P(cyl(0.23, 0.23, 0.02, 14), t.hatCol, [0, 1.64, 0]));
  }
  if (t.hat === 'turban') {
    parts.push(P(tor(0.095, 0.045, 12), t.hatCol, [0, 1.68, 0], [HALFPI + 0.15, 0, 0]));
    parts.push(P(sph(0.1, 10, 6, 0, HALFPI), t.hatCol, [0, 1.69, 0.01]));
    parts.push(P(box(0.3, 0.2, 0.04), t.hatCol, [0, 1.42, 0.13], [0.15, 0, 0]));
  }
  if (t.beard) parts.push(P(sph(0.075, 8, 6), t.beard, [0, 1.52, -0.06], [0, 0, 0], [1.1, 1.2, 0.8]));
  // Ausrüstung: Plattenträger mit Magazintaschen, Koppel, Rucksack
  if (t.vest) {
    parts.push(P(torsoGeo([
      { z: 1.02, w: 0.42, top: 0.15, bot: -0.15 }, { z: 1.2, w: 0.45, top: 0.16, bot: -0.15 }, { z: 1.4, w: 0.46, top: 0.14, bot: -0.13 },
    ], seg), t.vest));
    for (let i = 0; i < 3; i++) parts.push(P(box(0.08, 0.12, 0.05), t.vest, [-0.1 + i * 0.1, 1.1, -0.165]));
    parts.push(P(box(0.07, 0.09, 0.04), 0x222222, [0.14, 1.3, -0.15]));                    // Funkgerät
  } else if (t.gun) {
    for (const sx of [-1, 1]) parts.push(P(box(0.08, 0.1, 0.06), 0x3a3a2a, [sx * 0.1, 0.96, -0.12]));
  }
  if (t.robe) parts.push(P(torsoGeo([{ z: 0.55, w: 0.42, top: 0.16, bot: -0.16 }, { z: 0.75, w: 0.4, top: 0.14, bot: -0.14 }, { z: 0.92, w: 0.36, top: 0.12, bot: -0.12 }], seg), t.uni));
  if (t.pack) { parts.push(P(box(0.32, 0.4, 0.16), t.pack, [0, 1.2, 0.2])); parts.push(P(cyl(0.06, 0.06, 0.3, 8), t.pack, [0, 1.43, 0.2], [0, 0, HALFPI])); }
  if (t.blood) { parts.push(P(box(0.25, 0.16, 0.26), 0x7a1612, [0.04, 1.1, -0.01])); parts.push(P(box(0.3, 0.06, 0.27), 0xe8e6de, [0.02, 1.2, 0])); }
  // Arme: mit Waffe im Anschlag, ohne Waffe entspannt nach vorn
  const sh = 0.205, sy = 1.4;
  if (t.gun || t.armsAim) {
    // Spielerfigur: Waffe sitzt separat (schwenkbar) etwas höher und weiter vorn
    const oy = t.armsAim ? 0.13 : 0, oz = t.armsAim ? -0.1 : 0;
    limb(parts, [sh, sy, 0], [0.2, 1.16 + oy * 0.5, -0.1 + oz * 0.5], 0.055, 0.048, t.uni);
    limb(parts, [0.2, 1.16 + oy * 0.5, -0.1 + oz * 0.5], [0.11, 1.12 + oy, -0.2 + oz], 0.046, 0.04, t.uni);
    limb(parts, [-sh, sy, 0], [-0.2, 1.2 + oy * 0.5, -0.22 + oz * 0.5], 0.055, 0.048, t.uni);
    limb(parts, [-0.2, 1.2 + oy * 0.5, -0.22 + oz * 0.5], [-0.02, 1.15 + oy, -0.46 + oz], 0.046, 0.04, t.uni);
    parts.push(P(sph(0.04, 6, 5), t.skin, [0.11, 1.11 + oy, -0.22 + oz]), P(sph(0.04, 6, 5), t.skin, [-0.01, 1.14 + oy, -0.48 + oz]));
    const id = t.rifle || (t.gun === 0x3b2a1b ? 'ak' : 'm16');
    if (t.gun) parts.push(Pc(weaponGeo(id), [0.08, 1.13, -0.2], [0.12, 0.08, 0]));
  } else {
    for (const sx of [-1, 1]) {
      limb(parts, [sx * sh, sy, 0], [sx * 0.24, 1.15, -0.08], 0.055, 0.048, t.uni);
      limb(parts, [sx * 0.24, 1.15, -0.08], [sx * 0.2, 1.02, -0.3], 0.046, 0.04, t.uni);
      parts.push(P(sph(0.042, 6, 5), t.skin, [sx * 0.2, 1.0, -0.33]));
    }
  }
  const body = merge(parts);
  // Bein: Oberschenkel, Knie, Unterschenkel, Stiefel (Drehpunkt an der Hüfte)
  const lp = [];
  limb(lp, [0, 0.02, 0], [0, -0.42, -0.02], 0.085, 0.07, t.uni);
  limb(lp, [0, -0.42, -0.02], [0, -0.78, 0.01], 0.068, 0.055, t.uni);
  if (t.vest || t.hat === 'helmet') lp.push(P(box(0.11, 0.1, 0.05), 0x2a2a24, [0, -0.42, -0.08]));       // Knieschoner
  lp.push(P(box(0.13, 0.11, 0.26), t.robe ? 0x3a2c1e : 0x2a2420, [0, -0.81, -0.04]));
  const leg = merge(lp);
  figGeoCache[type] = { body, leg };
  return figGeoCache[type];
}

export class Figure {
  constructor(type) {
    const g = figureGeos(type);
    this.type = type;
    this.group = new THREE.Group();
    this.body = new THREE.Mesh(g.body, vcMat);
    this.legL = new THREE.Mesh(g.leg, vcMat);
    this.legR = new THREE.Mesh(g.leg, vcMat);
    this.legL.position.set(-0.11, 0.86, 0);
    this.legR.position.set(0.11, 0.86, 0);
    this.body.castShadow = this.legL.castShadow = this.legR.castShadow = true;
    this.group.add(this.body, this.legL, this.legR);
    this.phase = Math.random() * 6;
  }
  walk(dt, speed) {
    this.phase += dt * speed * 3.2;
    const s = Math.sin(this.phase) * Math.min(0.7, speed * 0.25);
    this.legL.rotation.x = s;
    this.legR.rotation.x = -s;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * Math.min(1, speed);
  }
  stand() { this.legL.rotation.x = this.legR.rotation.x = 0; this.body.position.y = 0; this.body.rotation.x = 0; }
  kneel() { this.legL.rotation.x = 1.4; this.legR.rotation.x = 0; this.body.position.y = -0.4; }
  sit(legAngle, hipY) {
    this.legL.rotation.x = legAngle; this.legR.rotation.x = legAngle * 0.92;
    this.group.position.y = hipY - 0.86;
  }
}

export function buildLitter() {
  return merge([
    P(box(0.58, 0.05, 1.9), 0x4e5235, [0, 0.62, 0]),
    P(box(0.04, 0.04, 2.3), COL.wood, [-0.3, 0.64, 0]),
    P(box(0.04, 0.04, 2.3), COL.wood, [0.3, 0.64, 0]),
  ]);
}

// ---------------------------------------------------------------- UH-1D
export function textTexture(text, w, h, font, color) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = color;
  x.font = font;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function m60Geo() {
  return merge([
    P(box(0.1, 0.13, 0.46), COL.gun, [0, 0, 0]),
    P(cyl(0.022, 0.022, 0.62, 6), COL.gun, [0, 0.01, -0.52], [HALFPI, 0, 0]),
    P(cyl(0.035, 0.035, 0.1, 6), COL.gun, [0, 0.01, -0.84], [HALFPI, 0, 0]),
    P(box(0.07, 0.11, 0.3), 0x3a2c1e, [0, -0.02, 0.36]),
    P(box(0.05, 0.12, 0.05), COL.gun, [0, -0.1, 0.12]),
    P(box(0.08, 0.08, 0.04), COL.gun, [0, 0.1, -0.05]),
    P(box(0.16, 0.16, 0.22), 0x45502c, [-0.14, -0.06, 0.02]),
  ]);
}

// ---------------------------------------------------------------- FOB-Objekte (Teilelisten)
export function tentParts(w, l, h, color = COL.canvas) {
  return [
    P(box(w, h * 0.55, l), color, [0, h * 0.275, 0]),
    P(cyl(w * 0.62, w * 0.62, l, 3), color, [0, h * 0.55 + w * 0.17, 0], [-HALFPI, 0, 0], [1, 1, 0.55]),
  ];
}

// Ablage mit Panzerfäusten (Kiste, darauf mehrere Rohre)
export function launcherRackParts(afg) {
  const tube = afg ? 0x6f6a4e : 0x4b5330;
  const p = [P(box(1.5, 0.5, 0.7), afg ? 0x6b5a3e : 0x4f4a2c, [0, 0.25, 0])];
  for (let k = 0; k < 4; k++) p.push(P(cyl(0.05, 0.05, 1.05, 10), tube, [0, 0.56 + (k % 2) * 0.09, -0.22 + k * 0.15], [0, 0, HALFPI]));
  p.push(P(box(0.4, 0.25, 0.03), 0xd8d0b0, [0, 0.3, -0.36]));
  return p;
}

export function hospitalParts() {
  const p = tentParts(9, 16, 4, 0x6a6e48);
  p.push(P(box(3.2, 0.05, 1.0), COL.white, [0, 4.25, 0], [0, 0, 0]));
  p.push(P(box(3.6, 3.6, 0.05), COL.white, [0, 2.0, -8.03]));
  p.push(P(box(2.6, 0.7, 0.06), COL.red, [0, 2.0, -8.06]));
  p.push(P(box(0.7, 2.6, 0.06), COL.red, [0, 2.0, -8.06]));
  return p;
}

export function fuelTruckParts() {
  const c = 0x4a5232;
  const p = [
    P(box(2.3, 0.4, 7.5), 0x2a2a24, [0, 0.95, 0]),
    P(box(2.3, 1.6, 1.7), c, [0, 1.95, -2.75]),
    P(box(2.0, 0.9, 1.3), c, [0, 1.5, -4.0]),
    P(box(2.2, 0.6, 0.05), 0x2b3a40, [0, 2.4, -3.62]),
    P(cyl(1.05, 1.05, 4.6, 14), 0x535b3a, [0, 2.25, 0.8], [HALFPI, 0, 0]),
    P(box(0.8, 0.3, 0.8), c, [0, 3.35, 0.2]),
    P(cyl(0.12, 0.12, 2.0, 6), 0x111111, [1.3, 1.2, 2.6], [0, 0, HALFPI]),
  ];
  for (const z of [-3.9, 1.4, 2.7]) for (const sx of [-1, 1])
    p.push(P(cyl(0.55, 0.55, 0.4, 12), 0x161616, [sx * 1.05, 0.55, z], [0, 0, HALFPI]));
  return p;
}

export function bladderParts() {
  return [P(sph(1, 12, 6), 0x161714, [0, 0.45, 0], [0, 0, 0], [3, 0.55, 5])];
}

export function towerParts() {
  const p = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(P(box(0.25, 8, 0.25), COL.wood, [sx * 1.6, 4, sz * 1.6]));
  p.push(P(box(4, 0.25, 4), COL.wood, [0, 7.0, 0]));
  p.push(P(box(4, 1.1, 0.15), COL.sand, [0, 7.6, 2]));
  p.push(P(box(4, 1.1, 0.15), COL.sand, [0, 7.6, -2]));
  p.push(P(box(0.15, 1.1, 4), COL.sand, [2, 7.6, 0]));
  p.push(P(box(0.15, 1.1, 4), COL.sand, [-2, 7.6, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(P(box(0.12, 1.8, 0.12), COL.wood, [sx * 1.9, 9.0, sz * 1.9]));
  p.push(P(cyl(0.1, 3.4, 1.0, 4), 0x3d3f2c, [0, 10.2, 0], [0, Math.PI / 4, 0]));
  return p;
}

export function sandbagWall(len, h = 1.2) {
  return [P(box(len, h, 1.0), COL.sand, [0, h / 2, 0])];
}

export function bunkerParts() {
  return [
    P(box(6, 1.8, 5), COL.sand, [0, 0.9, 0]),
    P(box(6.6, 0.5, 5.6), 0x7a6a48, [0, 2.05, 0]),
    P(box(3, 0.4, 0.1), 0x111111, [0, 1.3, -2.52]),
  ];
}

export function padParts(kind) {
  const p = [P(box(22, 0.12, 22), 0x4c4f44, [0, 0.06, 0])];
  if (kind === 'med') {
    p.push(P(box(10, 0.02, 10), COL.white, [0, 0.13, 0]));
    p.push(P(box(8, 0.03, 2.4), COL.red, [0, 0.145, 0]));
    p.push(P(box(2.4, 0.03, 8), COL.red, [0, 0.145, 0]));
  } else {
    p.push(P(box(1.2, 0.03, 8), COL.white, [-2.4, 0.135, 0]));
    p.push(P(box(1.2, 0.03, 8), COL.white, [2.4, 0.135, 0]));
    p.push(P(box(3.6, 0.03, 1.2), COL.white, [0, 0.135, 0]));
  }
  if (kind === 'pol') {
    // gelber Rand für Tankstelle
    p.push(P(box(22, 0.03, 0.6), 0xc8a420, [0, 0.135, 10.7]));
    p.push(P(box(22, 0.03, 0.6), 0xc8a420, [0, 0.135, -10.7]));
    p.push(P(box(0.6, 0.03, 22), 0xc8a420, [10.7, 0.135, 0]));
    p.push(P(box(0.6, 0.03, 22), 0xc8a420, [-10.7, 0.135, 0]));
  }
  return p;
}

export function howitzerParts() {
  return [
    P(cyl(0.12, 0.14, 3.6, 8), 0x3c4228, [0, 1.15, -1.6], [HALFPI - 0.25, 0, 0]),
    P(box(1.2, 0.8, 1.2), 0x3c4228, [0, 0.9, 0]),
    P(box(1.8, 0.9, 0.08), 0x3c4228, [0, 1.0, -0.5]),
    P(cyl(0.45, 0.45, 0.25, 12), 0x161616, [-0.9, 0.45, 0], [0, 0, HALFPI]),
    P(cyl(0.45, 0.45, 0.25, 12), 0x161616, [0.9, 0.45, 0], [0, 0, HALFPI]),
    P(box(0.15, 0.15, 3), 0x3c4228, [-0.4, 0.3, 1.6], [0, 0.2, 0]),
    P(box(0.15, 0.15, 3), 0x3c4228, [0.4, 0.3, 1.6], [0, -0.2, 0]),
  ];
}

export function jeepParts() {
  return [
    P(box(1.6, 0.7, 3.4), 0x4a5232, [0, 0.85, 0]),
    P(box(1.5, 0.05, 0.8), 0x2b3a40, [0, 1.5, -0.6], [-0.3, 0, 0]),
    ...[[-0.8, -1.1], [0.8, -1.1], [-0.8, 1.1], [0.8, 1.1]].map(([x, z]) =>
      P(cyl(0.38, 0.38, 0.25, 10), 0x161616, [x, 0.38, z], [0, 0, HALFPI])),
  ];
}

export function crateParts() {
  return [P(box(1.2, 0.8, 0.8), 0x4f4a2c, [0, 0.4, 0])];
}

export function hutParts(rng) {
  const w = 4 + rng() * 2.5, l = 5 + rng() * 3;
  return [
    P(box(w, 2.2, l), COL.bamboo, [0, 1.1, 0]),
    P(cone(Math.max(w, l) * 0.78, 2.4, 4), COL.thatch, [0, 3.4, 0], [0, Math.PI / 4, 0], [w / Math.max(w, l), 1, l / Math.max(w, l)]),
    P(box(1.0, 1.6, 0.05), 0x2a2015, [0, 0.8, -l / 2 - 0.02]),
  ];
}

export function palmParts() {
  // für Dorfpalmen (statisch zusammengefügt)
  const p = [P(cyl(0.18, 0.28, 9, 6), 0x6a5a3e, [0, 4.5, 0], [0.08, 0, 0])];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    p.push(P(box(0.9, 0.06, 4.2), 0x3f6a2a, [Math.sin(a) * 1.8, 9.0, Math.cos(a) * 1.8], [0.35, a, 0]));
  }
  return p;
}

// ---------------------------------------------------------------- Wracks
export function wreckParts(kind) {
  const p = [];
  const burnt = 0x24221e;
  p.push(P(new THREE.CircleGeometry(14, 16), 0x2a2620, [0, 0.08, 0], [-HALFPI, 0, 0]));
  if (kind === 'f4') {
    const tan = 0x9c8a5c, grn = 0x4d5a33, dg = 0x2f3a25;
    p.push(P(cyl(0.95, 0.75, 8, 10), grn, [0, 0.8, -1], [HALFPI, 0.1, 0.2]));
    p.push(P(cone(0.75, 3.2, 10), tan, [0.3, 0.7, -6.4], [-HALFPI, 0.1, 0.3]));
    p.push(P(box(5.2, 0.18, 4.2), dg, [-3.5, 0.5, 0], [0, 0.4, 0.15]));
    p.push(P(box(4.5, 0.18, 3.6), tan, [3.3, 1.2, 0.6], [0, -0.5, -0.45]));
    p.push(P(cyl(0.8, 0.6, 4, 10), burnt, [4, 0.7, 7.5], [HALFPI, 0.8, 0]));
    p.push(P(box(0.18, 2.6, 2.2), grn, [4.2, 2.0, 8.8], [0.5, 0.8, 0.4]));
    p.push(P(box(3.4, 0.14, 1.5), tan, [3.6, 0.9, 9.0], [0, 0.8, 0.4]));
    p.push(P(box(1.8, 0.8, 0.6), burnt, [-6, 0.3, 4], [0.3, 1, 0]));
  } else if (kind === 'huey') {
    p.push(P(box(2.3, 2.0, 5.0), 0x353a24, [0, 1.0, 0], [0, 0.4, 1.1]));
    p.push(P(cyl(0.3, 0.55, 5.0, 8), 0x3b4127, [3.5, 0.5, 5], [HALFPI, 1.0, 0.2]));
    p.push(P(box(7, 0.06, 0.5), COL.rotor, [-4, 0.3, -3], [0.2, 0.7, 0.1]));
    p.push(P(box(5, 0.06, 0.5), COL.rotor, [5, 0.2, -2], [-0.1, -0.5, 0.2]));
    p.push(P(cyl(0.06, 0.06, 4.5, 6), COL.metal, [-2, 0.6, 1], [HALFPI, 0.4, 1.1]));
  } else if (kind === 'o1') {
    p.push(P(box(1.0, 1.1, 5.5), 0x8a8e88, [0, 0.6, 0], [0.1, 0.3, 0.25]));
    p.push(P(box(10.5, 0.12, 1.6), 0x9a9e98, [0.4, 1.4, -0.6], [0, 0.3, 0.3]));
    p.push(P(box(3.2, 0.1, 1.0), 0x8a8e88, [1.2, 0.5, 2.9], [0, 0.3, 0.2]));
    p.push(P(box(0.1, 1.2, 1.0), 0x8a8e88, [1.2, 1.0, 3.0], [0, 0.3, 0.2]));
  } else {
    // A-1 Skyraider
    p.push(P(cyl(0.8, 0.5, 9, 10), 0x5b6044, [0, 0.8, 0], [HALFPI, 0.6, 0.3]));
    p.push(P(cyl(0.9, 0.9, 1.2, 12), burnt, [2.5, 0.9, -3.8], [HALFPI, 0.6, 0]));
    p.push(P(box(7, 0.18, 2.6), 0x4b5236, [-2.2, 0.4, 0.8], [0, 0.6, 0.12]));
    p.push(P(box(6, 0.18, 2.6), burnt, [3.4, 1.0, -0.5], [0, 0.6, -0.4]));
    p.push(P(box(0.18, 2.2, 1.8), 0x5b6044, [-2.4, 1.6, 3.8], [0.3, 0.6, 0.6]));
  }
  return p;
}

// ---------------------------------------------------------------- Handwaffen (Ursprung = Griff, Lauf zeigt nach -Z)
// Afghanistan-Waffen nutzen die Grundformen der Vietnam-Waffen mit Kunststoff statt Holz
const WEAPON_ALIAS = { m4: 'm16', m249: 'm60', m320: 'm79', m590: 'ithaca', m9: 'm1911' };
// Holografisches Visier (EOTech 552): Fenster mittig auf der Visierlinie H, Mitte bei z = zc
export const OPTICS = { m4: { H: 0.165, zc: -0.07, base: 0.075 }, m249: { H: 0.155, zc: -0.05, base: 0.06 } };
export function eotechParts(H, zc, base) {
  const c = 0x1d1e1d;
  return [
    P(box(0.04, H - 0.03 - base, 0.11), c, [0, (base + H - 0.03) / 2, zc]),
    P(box(0.052, 0.012, 0.13), c, [0, H - 0.034, zc]),
    P(box(0.006, 0.058, 0.085), c, [0.026, H - 0.002, zc - 0.005]),
    P(box(0.006, 0.058, 0.085), c, [-0.026, H - 0.002, zc - 0.005]),
    P(box(0.058, 0.007, 0.085), c, [0, H + 0.03, zc - 0.005]),
    P(box(0.044, 0.03, 0.04), c, [0, H - 0.05, zc + 0.065]),
    P(box(0.01, 0.01, 0.012), 0x3a3a3a, [0.018, H - 0.03, zc + 0.088]),
  ];
}

export function weaponGeo(id) {
  const optic = OPTICS[id];
  const flatTop = id === 'm4';
  const modern = !!WEAPON_ALIAS[id];
  if (modern) id = WEAPON_ALIAS[id];
  const blk = 0x1b1c1c, wood = modern ? 0x2c2c2a : 0x6e4a2a, od = modern ? 0x6b6450 : 0x4b5330;
  let parts;
  if (id === 'at4' || id === 'law') {
    // Einweg-Panzerfaust: Rohr mit Griff, Kimme/Korn sitzen oben auf dem Rohr
    const c = id === 'at4' ? 0x6f6a4e : 0x4b5330, r = id === 'at4' ? 0.045 : 0.035;
    return merge([
      P(cyl(r, r, 1.0, 12), c, [0, 0.04, -0.15], [HALFPI, 0, 0]),
      P(cyl(r + 0.012, r + 0.012, 0.08, 12), 0x2a2a28, [0, 0.04, -0.66], [HALFPI, 0, 0]),
      P(cyl(r + 0.01, r + 0.01, 0.06, 12), 0x2a2a28, [0, 0.04, 0.36], [HALFPI, 0, 0]),
      P(box(0.035, 0.1, 0.05), 0x222222, [0, -0.04, 0.02], [-0.3, 0, 0]),
      P(box(0.035, 0.08, 0.04), 0x222222, [0, -0.02, -0.22]),
    ]);
  }
  if (id === 'ak') parts = [
    P(box(0.055, 0.09, 0.4), 0x2a2a28, [0, 0, -0.08]),
    P(cyl(0.013, 0.013, 0.42, 6), 0x2a2a28, [0, 0.02, -0.5], [HALFPI, 0, 0]),
    P(box(0.06, 0.07, 0.24), 0x7a4a26, [0, -0.005, -0.38]),
    P(box(0.03, 0.03, 0.26), 0x2a2a28, [0, 0.05, -0.38]),
    P(box(0.045, 0.1, 0.32), 0x7a4a26, [0, -0.04, 0.28], [-0.12, 0, 0]),
    P(box(0.035, 0.09, 0.045), 0x5a3a1e, [0, -0.08, 0.04], [-0.3, 0, 0]),
    P(box(0.04, 0.14, 0.07), 0x2a2a28, [0, -0.11, -0.16], [0.25, 0, 0]),
    P(box(0.04, 0.1, 0.07), 0x2a2a28, [0, -0.21, -0.12], [0.55, 0, 0]),
    P(box(0.012, 0.05, 0.012), 0x2a2a28, [0, 0.055, -0.68]),
  ];
  else if (id === 'm16') parts = [
    P(box(0.06, 0.1, 0.5), blk, [0, 0, -0.1]),
    P(cyl(0.014, 0.014, 0.45, 6), blk, [0, 0.02, -0.55], [HALFPI, 0, 0]),
    P(box(0.05, 0.06, 0.3), blk, [0, -0.02, 0.28]),
    flatTop ? P(box(0.034, 0.025, 0.34), blk, [0, 0.062, -0.14]) : P(box(0.04, 0.12, 0.05), blk, [0, 0.09, -0.22]),
    P(box(0.05, 0.13, 0.05), blk, [0, -0.09, -0.12], [0.2, 0, 0]),
    P(box(0.035, 0.08, 0.05), blk, [0, -0.07, 0.02], [-0.3, 0, 0]),
  ];
  else if (id === 'm60') parts = [
    P(box(0.09, 0.12, 0.55), blk, [0, 0, -0.1]),
    P(cyl(0.02, 0.02, 0.6, 6), blk, [0, 0.01, -0.65], [HALFPI, 0, 0]),
    P(box(0.07, 0.1, 0.3), wood, [0, -0.02, 0.3]),
    P(box(0.15, 0.12, 0.2), od, [-0.11, -0.04, -0.12]),
    P(box(0.02, 0.25, 0.02), blk, [0.05, -0.12, -0.75], [0.4, 0, 0.3]),
    P(box(0.02, 0.25, 0.02), blk, [-0.05, -0.12, -0.75], [0.4, 0, -0.3]),
  ];
  else if (id === 'm79') parts = [
    P(cyl(0.035, 0.035, 0.36, 10), 0x2a2b2a, [0, 0.03, -0.3], [HALFPI, 0, 0]),
    P(box(0.07, 0.09, 0.18), blk, [0, 0, -0.05]),
    P(box(0.06, 0.11, 0.32), wood, [0, -0.03, 0.2]),
  ];
  else if (id === 'ithaca') parts = [
    P(cyl(0.016, 0.016, 0.55, 6), blk, [0, 0.02, -0.45], [HALFPI, 0, 0]),
    P(cyl(0.02, 0.02, 0.3, 6), wood, [0, -0.02, -0.38], [HALFPI, 0, 0]),
    P(box(0.06, 0.09, 0.25), blk, [0, 0, -0.08]),
    P(box(0.06, 0.1, 0.32), wood, [0, -0.03, 0.2]),
  ];
  else parts = [
    P(box(0.035, 0.05, 0.2), blk, [0, 0.02, -0.08]),
    P(box(0.03, 0.11, 0.05), wood, [0, -0.05, 0.0], [-0.2, 0, 0]),
  ];
  if (optic) parts.push(...eotechParts(optic.H, optic.zc, optic.base));
  return merge(parts);
}
