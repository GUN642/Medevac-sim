// Prozedurale Low-Poly-Modelle (UH-1D, Figuren, Fahrzeuge, Gebäude, Wracks)
import * as THREE from './lib/three.module.min.js';

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

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, ws = 10, hs = 8, ts = 0, tl = Math.PI) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, ts, tl);
const cone = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s);
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
  crew:    { uni: 0x535d3d, skin: 0xd2a07a, hat: 'flight', hatCol: 0x3d4630, pack: null, gun: null },
  vc:      { uni: 0x1c1c22, skin: 0xc9956a, hat: 'conical', hatCol: 0xc9b27a, pack: null, gun: 0x3b2a1b },
  nva:     { uni: 0x6f6b45, skin: 0xc9956a, hat: 'pith', hatCol: 0x7d7749, pack: 0x5a5638, gun: 0x3b2a1b },
};

const figGeoCache = {};
function figureGeos(type) {
  if (figGeoCache[type]) return figGeoCache[type];
  const t = FIG_TYPES[type];
  const parts = [
    P(box(0.42, 0.56, 0.26), t.uni, [0, 1.16, 0]),
    P(box(0.44, 0.07, 0.28), 0x2a2a20, [0, 0.9, 0]),
    P(box(0.4, 0.1, 0.24), t.uni, [0, 0.86, 0]),
    P(sph(0.12, 8, 6), t.skin, [0, 1.58, 0]),
    P(box(0.11, 0.5, 0.12), t.uni, [-0.27, 1.2, -0.1], [0.6, 0, 0.1]),
    P(box(0.11, 0.5, 0.12), t.uni, [0.27, 1.18, -0.08], [0.75, 0, -0.1]),
  ];
  if (t.hat === 'm1') parts.push(P(sph(0.16, 10, 5, 0, HALFPI), t.hatCol, [0, 1.6, 0], [0, 0, 0], [1, 0.85, 1.08]));
  if (t.hat === 'band') parts.push(P(cyl(0.13, 0.13, 0.07, 10), t.hatCol, [0, 1.62, 0]));
  if (t.hat === 'flight') parts.push(P(sph(0.16, 10, 6, 0, Math.PI * 0.6), t.hatCol, [0, 1.6, 0], [0, 0, 0], [1, 1, 1.05]));
  if (t.hat === 'conical') parts.push(P(cone(0.33, 0.2, 12), t.hatCol, [0, 1.76, 0]));
  if (t.hat === 'pith') {
    parts.push(P(sph(0.16, 10, 5, 0, HALFPI), t.hatCol, [0, 1.62, 0], [0, 0, 0], [1.1, 0.8, 1.2]));
    parts.push(P(cyl(0.25, 0.25, 0.02, 12), t.hatCol, [0, 1.63, 0]));
  }
  if (t.pack) parts.push(P(box(0.34, 0.4, 0.17), t.pack, [0, 1.2, 0.21]));
  if (t.gun) parts.push(P(box(0.05, 0.08, 0.9), t.gun, [0.06, 1.1, -0.36], [0.2, 0, 0]));
  if (t.blood) parts.push(P(box(0.3, 0.2, 0.27), 0x7a1612, [0.04, 1.1, 0]));
  const body = merge(parts);
  const leg = merge([
    P(box(0.16, 0.74, 0.19), t.uni, [0, -0.37, 0]),
    P(box(0.17, 0.12, 0.26), 0x1a1a18, [0, -0.8, -0.03]),
  ]);
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
function textTexture(text, w, h, font, color) {
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

function m60Geo() {
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

export function buildHuey({ static: isStatic = false, number = '66-16024' } = {}) {
  const od = COL.od, dk = COL.odDark;
  const parts = [
    // Rumpfunterteil, Boden, Dach
    P(box(2.3, 0.45, 4.6), od, [0, -0.93, 0.3]),
    P(box(2.36, 0.08, 4.2), 0x2d3022, [0, -0.69, 0.25]),
    P(box(2.42, 0.1, 4.6), od, [0, 1.2, 0.4]),
    // Heckteil hinter dem Schützenstand
    P(box(2.3, 1.9, 0.8), od, [0, 0.25, 2.3]),
    P(box(1.6, 1.4, 0.06), 0x2d3022, [0, 0.3, 1.88]),
    // Säulen
    P(box(0.08, 1.9, 0.12), od, [-1.18, 0.25, -0.95]),
    P(box(0.08, 1.9, 0.12), od, [1.18, 0.25, -0.95]),
    // Bug (untere Hälfte des Ellipsoids)
    P(new THREE.SphereGeometry(1, 16, 8, Math.PI * 1.78, Math.PI * 1.44, HALFPI, HALFPI), od, [0, 0.1, -1.7], [0, 0, 0], [1.2, 1.15, 1.55]),
    P(new THREE.SphereGeometry(1, 8, 4, Math.PI * 1.22, Math.PI * 0.56, HALFPI * 1.55, HALFPI * 0.45), od, [0, 0.1, -1.7], [0, 0, 0], [1.2, 1.15, 1.55]),
    // Instrumentenbrett
    P(box(1.9, 0.42, 0.12), 0x2a2d2a, [0, -0.2, -2.5], [-0.25, 0, 0]),
    P(box(1.95, 0.05, 0.3), 0x1c1f1d, [0, 0.03, -2.42]),
    P(box(0.25, 0.45, 0.5), 0x2a2d2a, [0, -0.55, -2.1]),
    // Sitze Cockpit
    P(box(0.55, 0.1, 0.55), 0x3a3a32, [-0.55, -0.38, -1.65]),
    P(box(0.55, 0.7, 0.12), 0x3a3a32, [-0.55, 0.0, -1.32]),
    P(box(0.55, 0.1, 0.55), 0x3a3a32, [0.55, -0.38, -1.65]),
    P(box(0.55, 0.7, 0.12), 0x3a3a32, [0.55, 0.0, -1.32]),
    // Sitzbank hinten, Schützensitze
    P(box(0.9, 0.08, 0.45), 0x5a5a3c, [0, -0.27, 1.62]),
    P(box(0.4, 0.08, 0.4), 0x5a5a3c, [-0.6, -0.25, 1.4]),
    P(box(0.4, 0.08, 0.4), 0x5a5a3c, [0.6, -0.25, 1.4]),
    // Heckkonus und Leitwerksträger
    P(cyl(0.62, 1.0, 1.1, 10), od, [0, 0.55, 3.25], [HALFPI, 0, 0]),
    P(cyl(0.24, 0.6, 5.6, 10), od, [0, 0.75, 6.5], [HALFPI + 0.04, 0, 0]),
    P(box(0.16, 1.9, 0.95), od, [0, 1.55, 9.15], [0.45, 0, 0]),
    P(box(0.12, 0.4, 0.5), dk, [0, 0.55, 9.3], [0.3, 0, 0]),
    P(box(2.6, 0.06, 0.55), od, [0, 0.72, 6.6]),
    P(cyl(0.06, 0.06, 0.25, 6), COL.gun, [-0.12, 2.15, 9.45], [0, 0, HALFPI]),
    // Triebwerksverkleidung, Abgasrohr, Mast
    P(box(1.4, 0.75, 3.2), od, [0, 1.62, 1.2]),
    P(box(1.0, 0.35, 0.5), dk, [0, 1.6, -0.55]),
    P(cyl(0.32, 0.28, 0.7, 10), 0x2b2a27, [0, 1.62, 3.05], [HALFPI, 0, 0]),
    P(cyl(0.13, 0.15, 0.7, 8), COL.metal, [0, 2.25, 0.25]),
    // Kufen
    P(cyl(0.055, 0.055, 4.6, 6), COL.metal, [-1.25, -1.55, 0.2], [HALFPI, 0, 0]),
    P(cyl(0.055, 0.055, 4.6, 6), COL.metal, [1.25, -1.55, 0.2], [HALFPI, 0, 0]),
    P(cyl(0.055, 0.055, 0.6, 6), COL.metal, [-1.25, -1.43, -2.3], [HALFPI + 0.8, 0, 0]),
    P(cyl(0.055, 0.055, 0.6, 6), COL.metal, [1.25, -1.43, -2.3], [HALFPI + 0.8, 0, 0]),
  ];
  for (const z of [-0.8, 1.1]) {
    parts.push(P(cyl(0.06, 0.06, 2.0, 6), COL.metal, [0, -1.2, z], [0, 0, HALFPI]));
    parts.push(P(cyl(0.06, 0.06, 0.45, 6), COL.metal, [1.125, -1.375, z], [0, 0, 0.62]));
    parts.push(P(cyl(0.06, 0.06, 0.45, 6), COL.metal, [-1.125, -1.375, z], [0, 0, -0.62]));
  }
  // Instrumente
  for (let i = 0; i < 6; i++) for (let r = 0; r < 2; r++) {
    const x = -0.8 + i * 0.32 + (i > 2 ? 0.02 : 0), y = -0.1 - r * 0.17;
    parts.push(P(cyl(0.065, 0.065, 0.02, 10), 0xd8d8cc, [x, y, -2.43 - r * 0.045], [HALFPI - 0.25, 0, 0]));
    parts.push(P(cyl(0.055, 0.055, 0.022, 10), 0x111111, [x, y, -2.428 - r * 0.045], [HALFPI - 0.25, 0, 0]));
  }
  // MG-Lafetten
  for (const sx of [-1, 1]) parts.push(P(cyl(0.03, 0.03, 0.85, 6), COL.gun, [sx * 1.2, -0.25, 1.2]));
  const group = new THREE.Group();
  const body = new THREE.Mesh(merge(parts), vcMatDouble);
  group.add(body);

  const glassMat = new THREE.MeshPhongMaterial({
    color: 0x6f8a90, transparent: true, opacity: 0.32, shininess: 90, specular: 0xffffff,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const glassGeo = merge([
    P(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, HALFPI), 0xffffff),
    P(new THREE.SphereGeometry(1, 8, 4, Math.PI * 1.22, Math.PI * 0.56, HALFPI, HALFPI * 0.55), 0xffffff),
  ]);
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, 0.1, -1.7);
  glass.scale.set(1.2, 1.15, 1.55);
  glass.renderOrder = 2;
  group.add(glass);

  // Beschriftung
  const txt = textTexture('U.S. ARMY', 512, 96, 'bold 72px Arial', '#151511');
  const txtMat = new THREE.MeshBasicMaterial({ map: txt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const sx of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), txtMat);
    pl.position.set(sx * 0.47, 0.82, 5.6);
    pl.rotation.y = sx * HALFPI;
    pl.rotation.x = 0;
    group.add(pl);
  }
  const numTex = textTexture(number, 512, 128, 'bold 80px Arial', '#151511');
  const numMat = new THREE.MeshBasicMaterial({ map: numTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const sx of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), numMat);
    pl.position.set(sx * 0.09, 1.25, 9.0);
    pl.rotation.y = sx * HALFPI;
    group.add(pl);
  }

  // Hauptrotor
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.62, 0.25);
  const rotorGeo = merge([
    P(box(7.15, 0.05, 0.53), COL.rotor, [3.72, 0, 0]),
    P(box(7.15, 0.05, 0.53), COL.rotor, [-3.72, 0, 0]),
    P(box(0.35, 0.052, 0.53), 0xd4b020, [7.12, 0.001, 0]),
    P(box(0.35, 0.052, 0.53), 0xd4b020, [-7.12, 0.001, 0]),
    P(box(0.7, 0.25, 0.4), COL.gun, [0, 0, 0]),
    P(box(0.06, 0.06, 2.4), COL.gun, [0, 0.18, 0]),
    P(cyl(0.07, 0.07, 0.3, 6), COL.gun, [0, 0.18, 1.25], [HALFPI, 0, 0]),
    P(cyl(0.07, 0.07, 0.3, 6), COL.gun, [0, 0.18, -1.25], [HALFPI, 0, 0]),
  ]);
  const rotorMesh = new THREE.Mesh(rotorGeo, vcMat);
  mainRotor.add(rotorMesh);
  group.add(mainRotor);
  const discMat = new THREE.MeshBasicMaterial({ color: 0x202020, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });
  const rotorDisc = new THREE.Mesh(new THREE.CircleGeometry(7.3, 40), discMat);
  rotorDisc.rotation.x = -HALFPI;
  rotorDisc.position.copy(mainRotor.position);
  group.add(rotorDisc);

  // Heckrotor (links)
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-0.27, 2.15, 9.45);
  tailRotor.add(new THREE.Mesh(merge([
    P(box(0.04, 2.6, 0.2), COL.rotor, [0, 0, 0]),
    P(box(0.045, 0.3, 0.205), 0xd4b020, [0, 1.15, 0]),
    P(box(0.045, 0.3, 0.205), 0xd4b020, [0, -1.15, 0]),
  ]), vcMat));
  group.add(tailRotor);
  const tailDisc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), discMat);
  tailDisc.rotation.y = HALFPI;
  tailDisc.position.copy(tailRotor.position);
  group.add(tailDisc);

  // Positionslicht / Antikollisionslicht
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), beaconMat);
  beacon.position.set(0, 2.05, 2.5);
  group.add(beacon);

  // Bordschützen + M60
  const gunGeo = m60Geo();
  const guns = {};
  for (const side of ['left', 'right']) {
    const sx = side === 'left' ? -1 : 1;
    const mount = new THREE.Group();
    mount.position.set(sx * 1.2, 0.2, 1.2);
    mount.userData.baseYaw = side === 'left' ? HALFPI : -HALFPI;
    mount.rotation.y = mount.userData.baseYaw;
    const pitch = new THREE.Group();
    mount.add(pitch);
    const gun = new THREE.Mesh(gunGeo, vcMat);
    pitch.add(gun);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.01, -0.9);
    pitch.add(muzzle);
    const eye = new THREE.Object3D();
    eye.position.set(0, 0.3, 0.5);
    pitch.add(eye);
    group.add(mount);
    const gunner = new Figure('crew');
    gunner.group.position.set(sx * 0.6, 0, 1.4);
    gunner.group.rotation.y = mount.userData.baseYaw;
    gunner.sit(1.0, -0.23);
    group.add(gunner.group);
    guns[side] = { mount, pitch, muzzle, eye, gunner };
  }
  // Piloten
  const pilots = [];
  for (const sx of [-1, 1]) {
    const f = new Figure('crew');
    f.group.position.set(sx * 0.55, 0, -1.68);
    f.sit(1.35, -0.33);
    group.add(f.group);
    pilots.push(f);
  }
  // Passagiersitze
  const seats = [
    { p: [-0.35, 1.6], r: 0, sit: [1.2, -0.25] },
    { p: [0.0, 1.6], r: 0, sit: [1.2, -0.25] },
    { p: [0.35, 1.6], r: 0, sit: [1.2, -0.25] },
    { p: [-1.1, -0.65], r: HALFPI, sit: [0.35, -0.67] },
    { p: [1.1, -0.65], r: -HALFPI, sit: [0.35, -0.67] },
    { p: [-1.1, -0.05], r: HALFPI, sit: [0.35, -0.67] },
    { p: [1.1, -0.05], r: -HALFPI, sit: [0.35, -0.67] },
    { p: [-1.1, 0.55], r: HALFPI, sit: [0.35, -0.67] },
    { p: [1.1, 0.55], r: -HALFPI, sit: [0.35, -0.67] },
    { p: [0.0, 0.5], r: 0, sit: [1.5, -0.67] },
  ];

  return {
    group, body, glass, mainRotor, tailRotor, rotorDisc, tailDisc, discMat, beacon, beaconMat,
    guns, pilots, seats, isStatic,
    eyePilot: new THREE.Vector3(0.55, 0.47, -1.78),
  };
}

// ---------------------------------------------------------------- FOB-Objekte (Teilelisten)
export function tentParts(w, l, h, color = COL.canvas) {
  return [
    P(box(w, h * 0.55, l), color, [0, h * 0.275, 0]),
    P(cyl(w * 0.62, w * 0.62, l, 3), color, [0, h * 0.55 + w * 0.17, 0], [-HALFPI, 0, 0], [1, 1, 0.55]),
  ];
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
