// Detaillierte Hubschraubermodelle: UH-1D, UH-60 Black Hawk, CH-47 Chinook, CH-53GS
// Rumpf als glatte Querschnittsform mit Lackierungstextur, echte Tür- und Fensteröffnungen mit Verglasung,
// Innenraum mit Cockpit, Sitzen und Instrumenten. Schnittstelle: group, body, glass, spin, guns, pilots, seats, eyePilot, exhaust
import * as THREE from './lib/three.module.min.js';
import { P, merge, Figure, COL, textTexture, m60Geo } from './models.js';
import { loft, mergeUV, plate, paintTexture, paintMaterial, sectionAt } from './loft.js';
import { T } from './theme.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const tor = (r, t, s = 12) => new THREE.TorusGeometry(r, t, 6, s);
const HALFPI = Math.PI / 2, PI = Math.PI;

export const detailMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 18, specular: 0x1c1c1c, side: THREE.DoubleSide });
const glassMat = new THREE.MeshPhongMaterial({
  color: 0x6f8794, transparent: true, opacity: 0.22, shininess: 120, specular: 0xffffff, side: THREE.DoubleSide, depthWrite: false,
});
const discMatProto = new THREE.MeshBasicMaterial({ color: 0x202020, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });

// ---------------------------------------------------------------- Instrumententafel
let panelTex = null;
function instrumentTexture() {
  if (panelTex) return panelTex;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#1f2220'; x.fillRect(0, 0, 512, 128);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const gauge = (cx, cy, r) => {
    x.fillStyle = '#0b0c0c'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    x.strokeStyle = '#9a9a90'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
    x.strokeStyle = '#d8d8cc'; x.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75); x.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); x.stroke(); }
    const a = rnd() * 6.28;
    x.strokeStyle = '#f0f0e0'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); x.stroke();
  };
  for (let i = 0; i < 7; i++) { gauge(40 + i * 72, 40, 26); gauge(40 + i * 72, 98, 22); }
  x.fillStyle = '#3a6d9a'; x.beginPath(); x.arc(256, 40, 24, PI, 0); x.fill();
  x.fillStyle = '#5b3e22'; x.beginPath(); x.arc(256, 40, 24, 0, PI); x.fill();
  for (let i = 0; i < 10; i++) { x.fillStyle = ['#7a5a10', '#5a1a14', '#1f4a20'][i % 3]; x.fillRect(150 + i * 22, 120, 14, 6); }
  panelTex = new THREE.CanvasTexture(c);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  return panelTex;
}

// Cockpit: Instrumententafel mit Blendschutz, Mittelkonsole, Pilotensitze mit Panzerung, Steuerknüppel
function cockpit(parts, group, { z, w, y, seatX, seatZ, seatY }) {
  parts.push(P(box(w, 0.08, 0.5), 0x1a1c1b, [0, y + 0.3, z - 0.15], [0.15, 0, 0]));
  parts.push(P(box(w * 0.9, 0.55, 0.12), 0x24272a, [0, y, z], [-0.35, 0, 0]));
  parts.push(P(box(0.35, 0.5, 0.9), 0x24272a, [0, y - 0.45, z + 0.5]));
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.55, 0.12, 0.55), 0x2f302b, [sx * seatX, seatY, seatZ]));
    parts.push(P(box(0.55, 0.85, 0.12), 0x2f302b, [sx * seatX, seatY + 0.45, seatZ + 0.3], [-0.12, 0, 0]));
    parts.push(P(box(0.08, 0.6, 0.5), 0x3a3b33, [sx * (seatX + 0.3), seatY + 0.3, seatZ + 0.1]));
    parts.push(P(cyl(0.025, 0.025, 0.6, 6), 0x111111, [sx * seatX, seatY + 0.25, seatZ - 0.45], [0.35, 0, 0]));
  }
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, 0.48), new THREE.MeshBasicMaterial({ map: instrumentTexture() }));
  pl.position.set(0, y, z - 0.065);
  pl.rotation.set(0.35, PI, 0);
  group.add(pl);
}

// Rotorkopf mit verjüngten, profilierten Blättern, Blatthaltern, Steuerstangen und Taumelscheibe
function rotorGeo(n, r, chord, { tip = 0xc8a42a, hub = 0x2b2c2b, hubR = 0.35 } = {}) {
  const parts = [
    P(cyl(hubR, hubR * 1.1, 0.32, 16), hub, [0, 0, 0]),
    P(cyl(hubR * 0.9, hubR * 0.9, 0.08, 16), 0x55585a, [0, -0.28, 0]),
    P(cyl(0.1, 0.12, 0.45, 10), 0x3a3b3b, [0, 0.3, 0]),
  ];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    const ca = Math.cos(a), sa = -Math.sin(a);
    parts.push(P(box(0.6, 0.16, chord * 0.55), hub, [ca * (hubR + 0.3), 0, sa * (hubR + 0.3)], [0, a, 0]));
    parts.push(P(cyl(0.03, 0.03, 0.35, 6), 0x777a7a, [ca * (hubR + 0.15), -0.18, sa * (hubR + 0.15)]));
    const L = r - hubR - 0.6;
    const blade = new THREE.BoxGeometry(L, 0.07, chord, 6, 1, 2);
    const p = blade.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const t = (p.getX(k) + L / 2) / L;
      const zz = p.getZ(k);
      p.setZ(k, zz * (1 - 0.18 * t));
      p.setY(k, p.getY(k) * (1 - 0.4 * t) * (Math.abs(zz) > chord * 0.3 ? 0.4 : 1));
    }
    blade.computeVertexNormals();
    parts.push(P(blade, COL.rotor, [ca * (hubR + 0.6 + L / 2), 0, sa * (hubR + 0.6 + L / 2)], [0, a, 0]));
    parts.push(P(box(0.35, 0.05, chord * 0.82), tip, [ca * (r - 0.18), 0, sa * (r - 0.18)], [0, a, 0]));
  }
  return merge(parts);
}

function tailRotorGeo(n, r, chord = 0.24) {
  const parts = [P(cyl(0.14, 0.14, 0.25, 12), 0x2b2c2b, [0, 0, 0], [0, 0, HALFPI])];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    parts.push(P(box(0.05, r - 0.12, chord), COL.rotor, [0, Math.cos(a) * (r / 2 + 0.06), Math.sin(a) * (r / 2 + 0.06)], [a, 0, 0]));
    parts.push(P(box(0.055, 0.2, chord), 0xc8a42a, [0, Math.cos(a) * (r - 0.1), Math.sin(a) * (r - 0.1)], [a, 0, 0]));
  }
  return merge(parts);
}

function decal(group, text, w, h, pos, side, color = '#151511', font = 'bold 72px Arial', ry = 0) {
  const tex = textTexture(text, 512, 128, font, color);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  pl.position.set(pos[0] * side, pos[1], pos[2]);
  pl.rotation.y = side * HALFPI + ry * side;
  group.add(pl);
}

function crossDecal(group, size, pos, side, rotY = null) {
  const parts = [
    P(box(0.02, size, size), 0xe8e6de, [0, 0, 0]),
    P(box(0.03, size * 0.75, size * 0.24), COL.red, [0, 0, 0]),
    P(box(0.03, size * 0.24, size * 0.75), COL.red, [0, 0, 0]),
  ];
  const m = new THREE.Mesh(merge(parts), detailMat);
  m.position.set(pos[0] * side, pos[1], pos[2]);
  if (rotY !== null) m.rotation.y = rotY;
  group.add(m);
}

function ironCross(group, size, pos, side) {
  const parts = [
    P(box(0.03, size * 0.34, size), 0xe8e6de, [0, 0, 0]), P(box(0.03, size, size * 0.34), 0xe8e6de, [0, 0, 0]),
    P(box(0.04, size * 0.2, size * 0.86), 0x111111, [0, 0, 0]), P(box(0.04, size * 0.86, size * 0.2), 0x111111, [0, 0, 0]),
  ];
  const m = new THREE.Mesh(merge(parts), detailMat);
  m.position.set(pos[0] * side, pos[1], pos[2]);
  group.add(m);
}

// Rad mit Reifen und Felge (Achse entlang x)
function wheel(parts, r, w, pos) {
  parts.push(P(cyl(r, r, w, 18), 0x151515, pos, [0, 0, HALFPI]));
  parts.push(P(cyl(r * 0.55, r * 0.55, w + 0.02, 12), 0x55585a, pos, [0, 0, HALFPI]));
}

// Rohr entlang einer Punktliste (Kufen, Bügel)
function tube(pts, r, color, seg = 24) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return P(new THREE.TubeGeometry(curve, seg, r, 8, false), color);
}

// Bord-MGs mit Lafette und Munitionskasten, Schützen, Piloten, Rotorscheiben, Beacon; fasst Anbauteile zusammen
function finish(group, parts, cfg) {
  const crewType = T.crew || 'crew';
  const gunGeo = m60Geo();
  const guns = {};
  for (const side of ['left', 'right']) {
    const sx = side === 'left' ? -1 : 1;
    const g = cfg.guns;
    const mount = new THREE.Group();
    mount.position.set(sx * g.x, g.y, g.z);
    mount.userData.baseYaw = side === 'left' ? HALFPI : -HALFPI;
    mount.rotation.y = mount.userData.baseYaw;
    const pitch = new THREE.Group();
    mount.add(pitch);
    pitch.add(new THREE.Mesh(gunGeo, detailMat));
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.01, -0.9);
    pitch.add(muzzle);
    const eye = new THREE.Object3D();
    eye.position.set(0, 0.3, 0.5);
    pitch.add(eye);
    group.add(mount);
    parts.push(P(cyl(0.035, 0.035, g.y - cfg.floor - 0.1, 8), 0x2a2b2b, [sx * g.x, (g.y + cfg.floor) / 2 - 0.05, g.z]));
    parts.push(P(box(0.3, 0.25, 0.4), 0x4a5030, [sx * (g.x - 0.35), cfg.floor + 0.15, g.z + 0.35]));
    const gunner = new Figure(crewType);
    gunner.group.position.set(sx * g.figX, g.figY || 0, g.z + 0.25);
    gunner.group.rotation.y = mount.userData.baseYaw;
    gunner.sit(1.0, g.sitY);
    group.add(gunner.group);
    guns[side] = { mount, pitch, muzzle, eye, gunner };
  }
  const pilots = [];
  for (const sx of [-1, 1]) {
    const f = new Figure(crewType);
    f.group.position.set(sx * cfg.pilots.x, cfg.pilots.y || 0, cfg.pilots.z);
    f.sit(1.35, cfg.pilots.sitY);
    group.add(f.group);
    pilots.push(f);
  }
  const discMat = discMatProto.clone();
  const discs = [];
  for (const r of cfg.discs) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(r.r, 48), discMat);
    d.rotation.x = -HALFPI;
    d.position.copy(r.obj.position);
    group.add(d);
    discs.push(d);
  }
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), beaconMat);
  beacon.position.set(...cfg.beacon);
  group.add(beacon);
  const detail = new THREE.Mesh(merge(parts), detailMat);
  group.add(detail);
  return { guns, pilots, discMat, rotorDisc: discs[0], beacon, beaconMat, detail };
}

function seatsGrid(list, sit) {
  return list.map(([x, z, r, kind]) => ({ p: [x, z], r, sit: sit || (kind === 'bench' ? [1.2, -0.25] : [0.35, -0.67]) }));
}

// Rumpfhaut (eine lackierte Geometrie) und Verglasung aus Querschnittsformen
function hull(group, key, list, paint, extraSkin = []) {
  const skinGeos = [], glassGeos = [];
  let main = null;
  for (const k of list) {
    const o = { radial: k.radial || 36, dz: k.dz || 0.3 };
    skinGeos.push(loft(k.keys, { ...o, holes: k.holes || [], capEnd: k.capEnd, capStart: k.capStart }));
    if (!main) main = skinGeos[0];
    if (k.glass) glassGeos.push(loft(k.keys, { ...o, only: k.glass, grow: 0.004 }));
  }
  const tex = paintTexture(key, paint);
  tex.wrapS = THREE.RepeatWrapping;
  const skin = new THREE.Mesh(mergeUV(skinGeos.concat(extraSkin)), paintMaterial(tex));
  group.add(skin);
  const glass = new THREE.Mesh(glassGeos.length ? mergeUV(glassGeos) : new THREE.BufferGeometry(), glassMat);
  glass.renderOrder = 2;
  group.add(glass);
  // Außenkante des Hauptrumpfs bei z (für Beschriftungen auf der Haut)
  const X = (z) => sectionAt(main, z).w / 2 + 0.025;
  return { skin, glass, X };
}

// Öffnung auf der rechten Seite (Winkel a0..a1) und gespiegelt links
const both = (z0, z1, a0, a1) => [{ z0, z1, a0, a1 }, { z0, z1, a0: PI - a1, a1: PI - a0 }];

export function buildHeliModel(spec, opts = {}) {
  if (spec.model === 'blackhawk') return buildBlackhawk(opts);
  if (spec.model === 'chinook') return buildChinook(opts);
  if (spec.model === 'ch53') return buildCH53(opts);
  return buildHuey(opts);
}

// ================================================================= UH-1D „Huey“
function buildHuey({ static: isStatic = false, number = '66-16024' } = {}) {
  const group = new THREE.Group();
  const cockpitWin = [
    { z0: -3.12, z1: -1.75, a0: 0.42, a1: PI - 0.42 },
    { z0: -3.05, z1: -2.45, a0: PI + 0.65, a1: 2 * PI - 0.65 },
    ...both(-2.55, -1.05, 0.02, 0.42),
  ];
  const doors = both(-0.95, 1.85, -0.95, 0.95);
  const fus = [
    { z: -3.35, w: 0.4, top: -0.25, bot: -0.65 },
    { z: -3.05, w: 1.7, top: 0.45, bot: -0.98, nt: 2.1, nb: 2.4 },
    { z: -2.5, w: 2.25, top: 0.95, bot: -1.1, nt: 2.4, nb: 3.2 },
    { z: -1.75, w: 2.42, top: 1.2, bot: -1.15, nt: 3.2, nb: 4.5 },
    { z: 1.9, w: 2.42, top: 1.25, bot: -1.15, nt: 3.4, nb: 4.5 },
    { z: 2.65, w: 2.2, top: 1.22, bot: -0.55, nt: 3, nb: 3 },
    { z: 3.4, w: 1.25, top: 1.15, bot: 0.15, nt: 2.4, nb: 2.4 },
    { z: 4.6, w: 0.74, top: 1.05, bot: 0.45, nt: 2.2, nb: 2.2 },
    { z: 9.1, w: 0.42, top: 1.0, bot: 0.66, nt: 2.2, nb: 2.2 },
    { z: 9.45, w: 0.3, top: 0.96, bot: 0.74 },
  ];
  const engine = [
    { z: -0.75, w: 0.7, top: 1.32, bot: 1.18 },
    { z: -0.35, w: 1.3, top: 1.92, bot: 1.15, nt: 3, nb: 4 },
    { z: 2.5, w: 1.42, top: 1.98, bot: 1.15, nt: 3, nb: 4 },
    { z: 3.05, w: 1.0, top: 1.82, bot: 1.25, nt: 2.5, nb: 3 },
    { z: 3.15, w: 0.75, top: 1.75, bot: 1.4 },
  ];
  const fin = plate([[8.55, 0.85], [9.0, 0.85], [9.85, 2.55], [9.5, 2.6], [9.1, 1.6]], 0.12, 'zy');
  const stab = plate([[-1.3, 6.4], [1.3, 6.4], [1.3, 6.85], [-1.3, 6.85]], 0.06, 'xz');
  stab.translate(0, 0.74, 0);
  const h = hull(group, 'huey', [
    { keys: fus, holes: [...cockpitWin, ...doors], glass: cockpitWin, capEnd: true },
    { keys: engine, capEnd: true, capStart: true, radial: 24 },
  ], { base: '#4a5033', frames: 16, stringers: 8, soot: [[0.55, 0.9, 0.15, 0.35]] }, [fin, stab]);

  const parts = [];
  parts.push(P(box(2.32, 0.06, 4.9), 0x2b2d24, [0, -0.72, -0.3]));
  parts.push(P(box(2.3, 1.85, 0.06), 0x3b3f2b, [0, 0.25, 1.88]));
  parts.push(P(box(0.95, 0.08, 0.48), 0x5a5a3c, [0, -0.27, 1.6]), P(box(0.95, 0.5, 0.06), 0x5a5a3c, [0, 0.0, 1.84]));
  for (const sx of [-1, 1]) parts.push(P(box(0.42, 0.08, 0.42), 0x5a5a3c, [sx * 0.62, -0.25, 1.4]));
  cockpit(parts, group, { z: -2.55, w: 1.9, y: -0.15, seatX: 0.55, seatZ: -1.65, seatY: -0.38 });
  for (const sx of [-1, 1]) {
    parts.push(tube([[sx * 1.25, -1.55, 2.4], [sx * 1.25, -1.55, -1.9], [sx * 1.25, -1.45, -2.45], [sx * 1.25, -1.15, -2.7]], 0.055, COL.metal));
    for (const z of [-0.8, 1.1]) parts.push(tube([[sx * 1.25, -1.52, z], [sx * 1.2, -1.3, z], [sx * 0.95, -1.12, z], [0, -1.1, z]], 0.055, COL.metal, 10));
    parts.push(P(box(0.25, 0.04, 0.35), 0x2a2b2b, [sx * 1.25, -1.0, -1.6]));
  }
  parts.push(P(cyl(0.13, 0.15, 0.7, 12), COL.metal, [0, 2.25, 0.25]));
  parts.push(P(cyl(0.3, 0.27, 0.6, 14), 0x232221, [0, 1.6, 3.35], [HALFPI - 0.15, 0, 0]));
  parts.push(P(box(0.9, 0.3, 0.06), 0x1d1d1b, [0, 1.6, -0.62]));
  parts.push(P(box(0.04, 0.5, 0.15), 0x111111, [0, 1.35, 4.6], [0.4, 0, 0]));
  parts.push(P(cyl(0.012, 0.012, 1.4, 4), 0x111111, [0.3, 0.6, -2.9], [0.5, 0, 0.2]));
  parts.push(P(box(0.06, 0.38, 0.5), 0x353a24, [0, 0.52, 9.3], [0.3, 0, 0]));
  parts.push(P(cyl(0.06, 0.06, 0.25, 8), COL.gun, [-0.12, 2.15, 9.45], [0, 0, HALFPI]));
  for (const s of [-1, 1]) {
    decal(group, 'U.S. ARMY', 2.2, 0.4, [h.X(6.0), 0.8, 6.0], s);
    decal(group, number, 0.95, 0.24, [0.08, 1.95, 9.35], s);
  }
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.62, 0.25);
  mainRotor.add(new THREE.Mesh(rotorGeo(2, 7.3, 0.53, { hubR: 0.3 }), detailMat));
  mainRotor.add(new THREE.Mesh(merge([P(box(0.06, 0.06, 2.4), COL.gun, [0, 0.36, 0]), P(sph(0.07, 6, 4), COL.gun, [0, 0.36, 1.2]), P(sph(0.07, 6, 4), COL.gun, [0, 0.36, -1.2])]), detailMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-0.27, 2.15, 9.45);
  tailRotor.add(new THREE.Mesh(tailRotorGeo(2, 1.3, 0.2), detailMat));
  group.add(tailRotor);
  const f = finish(group, parts, {
    guns: { x: 1.2, y: 0.2, z: 1.2, figX: 0.6, sitY: -0.23 }, floor: -0.72,
    pilots: { x: 0.55, z: -1.68, sitY: -0.33 },
    discs: [{ obj: mainRotor, r: 7.3 }],
    beacon: [0, 2.0, 2.5],
  });
  const seats = seatsGrid([
    [-0.35, 1.6, 0, 'bench'], [0.0, 1.6, 0, 'bench'], [0.35, 1.6, 0, 'bench'],
    [-1.1, -0.65, HALFPI, 'floor'], [1.1, -0.65, -HALFPI, 'floor'], [-1.1, -0.05, HALFPI, 'floor'],
    [1.1, -0.05, -HALFPI, 'floor'], [-1.1, 0.55, HALFPI, 'floor'], [1.1, 0.55, -HALFPI, 'floor'], [0.0, 0.5, 0, 'floor'],
  ]);
  seats[9].sit = [1.5, -0.67];
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats, isStatic,
    eyePilot: new THREE.Vector3(0.55, 0.47, -1.78),
    spin: [[mainRotor, 'y', 22], [tailRotor, 'x', 70]],
    exhaust: new THREE.Vector3(0, 1.62, 3.5),
  };
}

// ================================================================= UH-60 Black Hawk
function buildBlackhawk({ static: isStatic = false, number = '08-20112' } = {}) {
  const group = new THREE.Group();
  const cockpitWin = [
    { z0: -4.95, z1: -3.35, a0: 0.45, a1: PI - 0.45 },
    { z0: -5.15, z1: -4.45, a0: PI + 0.7, a1: 2 * PI - 0.7 },
    ...both(-4.55, -3.05, -0.22, 0.45),
  ];
  const gunWin = both(-2.35, -1.4, 0.0, 0.85);
  const doors = both(-0.95, 1.65, -0.85, 0.82);
  const cabWin = both(1.85, 2.35, 0.15, 0.6);
  const fus = [
    { z: -5.65, w: 0.45, top: -0.5, bot: -0.85 },
    { z: -5.25, w: 1.35, top: -0.08, bot: -1.0, nt: 2.1, nb: 2.4 },
    { z: -4.6, w: 1.98, top: 0.45, bot: -1.05, nt: 2.3, nb: 3 },
    { z: -3.9, w: 2.26, top: 0.92, bot: -1.06, nt: 2.8, nb: 4.5 },
    { z: -3.1, w: 2.36, top: 1.05, bot: -1.06, nt: 3.2, nb: 5 },
    { z: 2.35, w: 2.36, top: 1.05, bot: -1.06, nt: 3.2, nb: 5 },
    { z: 3.05, w: 2.1, top: 1.0, bot: -0.6, nt: 3, nb: 3 },
    { z: 4.1, w: 1.3, top: 0.96, bot: 0.0, nt: 2.5, nb: 2.5 },
    { z: 5.6, w: 0.8, top: 0.95, bot: 0.45, nt: 2.2, nb: 2.2 },
    { z: 9.3, w: 0.5, top: 0.98, bot: 0.52, nt: 2.2, nb: 2.2 },
    { z: 9.95, w: 0.34, top: 1.02, bot: 0.62 },
  ];
  const dog = [
    { z: -2.4, w: 0.8, top: 1.12, bot: 1.0 },
    { z: -1.7, w: 1.55, top: 1.72, bot: 1.0, nt: 3, nb: 4 },
    { z: 1.2, w: 1.8, top: 1.72, bot: 1.0, nt: 3, nb: 4 },
    { z: 2.7, w: 1.0, top: 1.25, bot: 1.0, nt: 2.4, nb: 3 },
  ];
  const nacelle = (sx) => [
    { z: -0.9, w: 0.55, top: 1.62, bot: 1.08, x: sx * 0.9 },
    { z: -0.6, w: 0.8, top: 1.75, bot: 0.98, x: sx * 0.92, nt: 2.2, nb: 2.2 },
    { z: 1.6, w: 0.8, top: 1.75, bot: 0.98, x: sx * 0.95, nt: 2.2, nb: 2.2 },
    { z: 2.2, w: 0.55, top: 1.62, bot: 1.1, x: sx * 1.0 },
  ];
  const fin = plate([[8.9, 0.6], [9.6, 0.6], [10.75, 3.0], [10.25, 3.05], [9.3, 1.5]], 0.2, 'zy');
  const stab = plate([[-2.2, 9.0], [2.2, 9.0], [2.2, 9.75], [-2.2, 9.75]], 0.07, 'xz');
  stab.translate(0, 0.42, 0);
  const h = hull(group, 'uh60', [
    { keys: fus, holes: [...cockpitWin, ...gunWin, ...doors, ...cabWin], glass: [...cockpitWin, ...cabWin], capEnd: true },
    { keys: dog, capStart: true, capEnd: true, radial: 24 },
    { keys: nacelle(-1), capStart: true, capEnd: true, radial: 20 },
    { keys: nacelle(1), capStart: true, capEnd: true, radial: 20 },
  ], { base: '#3b4033', frames: 18, stringers: 9, soot: [[0.45, 0.8, 0.05, 0.4]] }, [fin, stab]);

  const parts = [];
  parts.push(P(box(2.3, 0.06, 5.6), 0x26281f, [0, -0.82, -0.4]));
  parts.push(P(box(2.3, 1.8, 0.06), 0x34372c, [0, 0.1, 2.36]));
  parts.push(P(box(2.1, 0.08, 0.45), 0x4a4a3c, [0, -0.45, 1.95]), P(box(2.1, 0.55, 0.06), 0x4a4a3c, [0, -0.15, 2.3]));
  cockpit(parts, group, { z: -4.25, w: 2.0, y: -0.3, seatX: 0.55, seatZ: -3.3, seatY: -0.4 });
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.06, 1.75, 1.8), 0x393d31, [sx * 1.26, 0.0, 2.4]));
    parts.push(P(box(0.04, 0.5, 0.6), 0x1b2023, [sx * 1.3, 0.35, 2.4]));
    parts.push(P(box(0.12, 0.75, 0.14), COL.metal, [sx * 1.32, -1.0, -3.3], [0, 0, sx * -0.35]));
    parts.push(P(box(0.95, 0.1, 0.14), 0x3b3d38, [sx * 0.85, -0.92, -3.3]));
    parts.push(P(cyl(0.06, 0.06, 0.8, 8), 0x555555, [sx * 1.05, -0.8, -3.0], [0.7, 0, sx * 0.4]));
    wheel(parts, 0.34, 0.24, [sx * 1.45, -1.21, -3.3]);
    parts.push(P(cyl(0.26, 0.3, 0.6, 14), 0x1d1d1b, [sx * 1.1, 1.4, 2.4], [HALFPI, 0, sx * -0.55]));
    parts.push(P(tor(0.27, 0.05, 14), 0x2a2a2a, [sx * 0.92, 1.37, -0.92]));
    parts.push(P(box(0.3, 0.04, 0.2), 0x2a2b2b, [sx * 1.25, -0.9, -2.6]));
  }
  wheel(parts, 0.2, 0.14, [0, -1.35, 8.85]);
  parts.push(P(box(0.12, 1.9, 0.14), COL.metal, [0, -0.4, 9.05], [0.15, 0, 0]));
  parts.push(P(cyl(0.16, 0.2, 0.7, 12), COL.metal, [0, 2.0, -0.35]));
  parts.push(P(box(0.05, 0.9, 0.08), 0x777777, [0, 1.35, -3.9], [-0.35, 0, 0]));
  parts.push(P(box(0.05, 0.6, 0.08), 0x777777, [0, -1.25, -4.2], [0.4, 0, 0]));
  parts.push(P(box(0.04, 0.45, 0.25), 0x111111, [0, 1.2, 4.6], [0.35, 0, 0]));
  parts.push(P(cyl(0.15, 0.15, 0.45, 8), COL.gun, [0.25, 2.6, 10.3], [0, 0, HALFPI]));
  for (const s of [-1, 1]) {
    crossDecal(group, 0.8, [h.X(2.85), 0.35, 2.85], s);
    decal(group, 'U.S. ARMY', 2.0, 0.36, [h.X(7.0), 0.72, 7.0], s);
    decal(group, number, 0.95, 0.24, [0.14, 1.75, 9.95], s, '#151511', 'bold 72px Arial', -0.06);
  }
  crossDecal(group, 0.55, [0, -0.52, -5.33], 1, HALFPI);

  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.4, -0.35);
  mainRotor.add(new THREE.Mesh(rotorGeo(4, 8.2, 0.53), detailMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.4, 2.6, 10.3);
  tailRotor.rotation.z = -0.35;
  tailRotor.add(new THREE.Mesh(tailRotorGeo(4, 1.7), detailMat));
  group.add(tailRotor);
  const f = finish(group, parts, {
    guns: { x: 1.17, y: 0.2, z: -1.9, figX: 0.7, sitY: -0.2 }, floor: -0.82,
    pilots: { x: 0.55, z: -3.35, sitY: -0.3 },
    discs: [{ obj: mainRotor, r: 8.2 }],
    beacon: [0, 1.1, 3.8],
  });
  const seats = seatsGrid([
    [-0.8, 1.85, 0, 'bench'], [-0.25, 1.85, 0, 'bench'], [0.3, 1.85, 0, 'bench'], [0.85, 1.85, 0, 'bench'],
    [-0.5, 0.9, 0, 'bench'], [0.0, 0.9, 0, 'bench'], [0.5, 0.9, 0, 'bench'],
    [-0.5, -0.1, PI, 'bench'], [0.0, -0.1, PI, 'bench'], [0.5, -0.1, PI, 'bench'], [0.0, 0.4, 0, 'floor'],
  ]);
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats, isStatic,
    eyePilot: new THREE.Vector3(0.55, 0.42, -3.5),
    spin: [[mainRotor, 'y', 26], [tailRotor, 'x', 75]],
    exhaust: new THREE.Vector3(1.1, 1.4, 2.5),
  };
}

// ================================================================= CH-47 Chinook
function buildChinook({ static: isStatic = false, number = '10-08046' } = {}) {
  const group = new THREE.Group();
  const cockpitWin = [
    { z0: -8.45, z1: -7.15, a0: 0.42, a1: PI - 0.42 },
    { z0: -8.4, z1: -7.6, a0: PI + 0.75, a1: 2 * PI - 0.75 },
    ...both(-8.1, -6.65, -0.25, 0.42),
  ];
  const gunWin = [{ z0: -5.85, z1: -4.55, a0: -0.75, a1: 0.6 }, { z0: -5.6, z1: -4.6, a0: PI - 0.6, a1: PI + 0.25 }];
  const cabWin = [];
  for (let i = 0; i < 6; i++) cabWin.push(...both(-3.4 + i * 1.75, -3.0 + i * 1.75, 0.05, 0.35));
  const fus = [
    { z: -8.75, w: 0.6, top: -0.35, bot: -0.8 },
    { z: -8.35, w: 2.25, top: 0.4, bot: -1.05, nt: 2.1, nb: 2.4 },
    { z: -7.6, w: 3.0, top: 1.0, bot: -1.12, nt: 2.4, nb: 3.5 },
    { z: -6.6, w: 3.38, top: 1.52, bot: -1.15, nt: 2.6, nb: 6 },
    { z: 5.6, w: 3.4, top: 1.56, bot: -1.15, nt: 2.6, nb: 6 },
    { z: 6.6, w: 3.32, top: 1.56, bot: -0.95, nt: 2.6, nb: 5 },
    { z: 7.45, w: 3.1, top: 1.5, bot: -0.3, nt: 2.6, nb: 4 },
  ];
  const rearPylon = [
    { z: 3.4, w: 0.9, top: 1.6, bot: 1.45 },
    { z: 4.6, w: 1.55, top: 2.85, bot: 1.4, nt: 2.8, nb: 4 },
    { z: 7.25, w: 1.5, top: 3.25, bot: 1.4, nt: 2.8, nb: 4 },
    { z: 7.95, w: 0.9, top: 2.6, bot: 1.55, nt: 2.4, nb: 3 },
  ];
  const frontPylon = [
    { z: -7.25, w: 0.7, top: 1.25, bot: 1.1 },
    { z: -6.6, w: 1.4, top: 2.3, bot: 1.15, nt: 2.6, nb: 4 },
    { z: -5.0, w: 1.3, top: 2.25, bot: 1.2, nt: 2.6, nb: 4 },
    { z: -4.2, w: 0.7, top: 1.75, bot: 1.4 },
  ];
  const spine = [{ z: -4.6, w: 0.55, top: 1.8, bot: 1.4 }, { z: -4.2, w: 0.65, top: 1.95, bot: 1.4 }, { z: 3.8, w: 0.65, top: 1.95, bot: 1.4 }, { z: 4.2, w: 0.55, top: 1.85, bot: 1.4 }];
  const sponson = (sx) => [
    { z: -4.7, w: 0.3, top: -0.4, bot: -0.9, x: sx * 1.8 },
    { z: -4.2, w: 0.85, top: -0.2, bot: -1.12, x: sx * 1.98, nt: 3, nb: 3 },
    { z: 3.9, w: 0.85, top: -0.2, bot: -1.12, x: sx * 1.98, nt: 3, nb: 3 },
    { z: 4.5, w: 0.3, top: -0.4, bot: -0.9, x: sx * 1.8 },
  ];
  const engineNac = (sx) => [
    { z: 4.3, w: 0.6, top: 1.85, bot: 1.25, x: sx * 1.95 },
    { z: 4.6, w: 0.95, top: 2.05, bot: 1.05, x: sx * 1.98, nt: 2.2, nb: 2.2 },
    { z: 7.0, w: 0.95, top: 2.05, bot: 1.05, x: sx * 2.0, nt: 2.2, nb: 2.2 },
    { z: 7.5, w: 0.65, top: 1.88, bot: 1.22, x: sx * 2.0 },
  ];
  const h = hull(group, 'ch47', [
    { keys: fus, holes: [...cockpitWin, ...gunWin, ...cabWin], glass: [...cockpitWin, ...cabWin], radial: 40 },
    { keys: rearPylon, capStart: true, capEnd: true, radial: 24 },
    { keys: frontPylon, capStart: true, capEnd: true, radial: 24 },
    { keys: spine, capStart: true, capEnd: true, radial: 16 },
    { keys: sponson(-1), capStart: true, capEnd: true, radial: 20 },
    { keys: sponson(1), capStart: true, capEnd: true, radial: 20 },
    { keys: engineNac(-1), capStart: true, radial: 20 },
    { keys: engineNac(1), capStart: true, radial: 20 },
  ], { base: '#464a39', frames: 30, stringers: 10, soot: [[0.82, 1.0, 0.1, 0.45]] });

  const parts = [];
  parts.push(P(box(3.2, 0.06, 13.8), 0x25271e, [0, -1.08, -0.3]));
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.45, 0.08, 9.8), 0x55553f, [sx * 1.35, -0.6, 0.6]));
    parts.push(P(box(0.06, 0.55, 9.8), 0x4c4c38, [sx * 1.6, -0.3, 0.6]));
    for (const z of [-4.6, 4.6]) {
      wheel(parts, 0.45, 0.3, [sx * 1.6, -1.3, z]);
      if (z > 0) wheel(parts, 0.45, 0.3, [sx * 1.6, -1.3, z + 0.95]);
      parts.push(P(box(0.16, 0.65, 0.16), COL.metal, [sx * 1.6, -0.95, z]));
    }
    parts.push(P(cyl(0.36, 0.32, 0.25, 14), 0x1b1b19, [sx * 2.0, 1.55, 7.55], [HALFPI, 0, 0]));
    parts.push(P(tor(0.4, 0.06, 14), 0x2a2a2a, [sx * 1.95, 1.55, 4.32]));
    parts.push(P(box(0.3, 0.04, 0.3), 0x2a2b2b, [sx * 1.7, -1.0, -5.3]));
  }
  // Heckrampe: Scharnier am Kabinenboden, abgesenkt bis zum Boden
  parts.push(P(box(2.6, 0.12, 2.4), 0x34372a, [0, -1.42, 7.05], [-0.28, 0, 0]));
  parts.push(P(box(2.6, 0.05, 0.4), 0x2a2b24, [0, -1.72, 8.3], [-0.05, 0, 0]));
  parts.push(P(box(3.0, 1.9, 0.06), 0x34372c, [0, 0.0, -6.55]));
  cockpit(parts, group, { z: -8.0, w: 2.5, y: -0.25, seatX: 0.65, seatZ: -7.15, seatY: -0.45 });
  parts.push(P(cyl(0.2, 0.24, 0.65, 12), COL.metal, [0, 2.6, -6.0]), P(cyl(0.2, 0.24, 0.65, 12), COL.metal, [0, 3.35, 6.8]));
  parts.push(P(box(0.04, 0.5, 0.25), 0x111111, [0, 1.9, -2.0], [0.35, 0, 0]));
  parts.push(P(cyl(0.03, 0.03, 1.6, 6), 0x111111, [0.4, -1.0, -8.0], [1.2, 0, 0]));
  for (const s of [-1, 1]) {
    decal(group, 'U.S. ARMY', 3.0, 0.6, [h.X(1.6), 0.95, 1.6], s);
    decal(group, number, 1.2, 0.3, [0.79, 2.65, 6.1], s);
  }
  const front = new THREE.Group();
  front.position.set(0, 2.95, -6.0);
  front.add(new THREE.Mesh(rotorGeo(3, 9.1, 0.8, { hubR: 0.45 }), detailMat));
  group.add(front);
  const rear = new THREE.Group();
  rear.position.set(0, 3.7, 6.8);
  rear.add(new THREE.Mesh(rotorGeo(3, 9.1, 0.8, { hubR: 0.45 }), detailMat));
  group.add(rear);
  const f = finish(group, parts, {
    guns: { x: 1.62, y: 0.15, z: -5.1, figX: 1.15, sitY: -0.35 }, floor: -1.08,
    pilots: { x: 0.65, z: -7.25, sitY: -0.35 },
    discs: [{ obj: front, r: 9.1 }, { obj: rear, r: 9.1 }],
    beacon: [0, 3.3, 4.6],
  });
  const seatList = [];
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) seatList.push([s * 1.25, -3.6 + i * 0.85, s < 0 ? HALFPI : -HALFPI, 'floor']);
  for (let i = 0; i < 9; i++) seatList.push([(i % 3 - 1) * 0.55, -1.5 + Math.floor(i / 3) * 2.2, 0, 'floor']);
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor: front, tailRotor: rear, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats: seatsGrid(seatList, [0.35, -0.5]), isStatic,
    eyePilot: new THREE.Vector3(0.65, 0.42, -7.45),
    spin: [[front, 'y', 18], [rear, 'y', -18]],
    exhaust: new THREE.Vector3(2.0, 1.55, 7.6),
  };
}

// ================================================================= CH-53GS (Heeresflieger)
function buildCH53({ static: isStatic = false, number = '84+05' } = {}) {
  const group = new THREE.Group();
  const cockpitWin = [
    { z0: -7.0, z1: -5.45, a0: 0.42, a1: PI - 0.42 },
    { z0: -7.0, z1: -6.2, a0: PI + 0.75, a1: 2 * PI - 0.75 },
    ...both(-6.6, -5.0, -0.22, 0.42),
  ];
  const gunWin = [{ z0: -4.55, z1: -3.3, a0: -0.7, a1: 0.65 }, { z0: -4.4, z1: -3.4, a0: PI - 0.65, a1: PI + 0.3 }];
  const cabWin = [];
  for (let i = 0; i < 4; i++) cabWin.push(...both(-2.4 + i * 1.6, -1.95 + i * 1.6, 0.1, 0.45));
  const fus = [
    { z: -7.45, w: 0.55, top: -0.3, bot: -0.75 },
    { z: -7.05, w: 1.95, top: 0.35, bot: -1.0, nt: 2.1, nb: 2.4 },
    { z: -6.25, w: 2.7, top: 1.0, bot: -1.1, nt: 2.4, nb: 3.5 },
    { z: -5.0, w: 3.0, top: 1.42, bot: -1.15, nt: 2.7, nb: 5 },
    { z: 4.4, w: 3.0, top: 1.48, bot: -1.15, nt: 2.7, nb: 5 },
    { z: 5.7, w: 2.75, top: 1.62, bot: -0.55, nt: 2.6, nb: 3 },
    { z: 7.3, w: 1.85, top: 1.82, bot: 0.45, nt: 2.4, nb: 2.4 },
    { z: 9.1, w: 1.1, top: 2.02, bot: 1.0, nt: 2.2, nb: 2.2 },
    { z: 11.7, w: 0.62, top: 2.45, bot: 1.62, nt: 2.2, nb: 2.2 },
    { z: 12.3, w: 0.4, top: 2.55, bot: 1.92 },
  ];
  const top = [
    { z: -2.7, w: 1.0, top: 1.6, bot: 1.35 },
    { z: -2.1, w: 2.0, top: 2.5, bot: 1.3, nt: 2.8, nb: 4 },
    { z: 2.0, w: 2.0, top: 2.5, bot: 1.35, nt: 2.8, nb: 4 },
    { z: 2.8, w: 1.1, top: 1.9, bot: 1.4 },
  ];
  const nac = (sx) => [
    { z: -2.1, w: 0.75, top: 2.35, bot: 1.6, x: sx * 1.35 },
    { z: -1.8, w: 1.0, top: 2.5, bot: 1.45, x: sx * 1.38, nt: 2.2, nb: 2.2 },
    { z: 1.3, w: 1.0, top: 2.5, bot: 1.45, x: sx * 1.4, nt: 2.2, nb: 2.2 },
    { z: 1.75, w: 0.75, top: 2.35, bot: 1.6, x: sx * 1.42 },
  ];
  const sponson = (sx) => [
    { z: -1.7, w: 0.4, top: -0.3, bot: -0.85, x: sx * 1.75 },
    { z: -1.2, w: 1.05, top: -0.05, bot: -1.05, x: sx * 1.95, nt: 3, nb: 3 },
    { z: 2.6, w: 1.05, top: -0.05, bot: -1.05, x: sx * 1.95, nt: 3, nb: 3 },
    { z: 3.2, w: 0.4, top: -0.3, bot: -0.85, x: sx * 1.75 },
  ];
  const tank = (sx) => [
    { z: -1.9, w: 0.1, top: -0.22, bot: -0.32, x: sx * 2.8 },
    { z: -1.5, w: 0.85, top: 0.2, bot: -0.7, x: sx * 2.8, nt: 2, nb: 2 },
    { z: 2.4, w: 0.85, top: 0.2, bot: -0.7, x: sx * 2.8, nt: 2, nb: 2 },
    { z: 3.1, w: 0.1, top: -0.2, bot: -0.3, x: sx * 2.8 },
  ];
  const fin = plate([[11.0, 1.7], [12.3, 1.9], [13.0, 5.6], [12.2, 5.7], [11.5, 3.3]], 0.3, 'zy');
  fin.rotateZ(-0.2);
  const stab = plate([[0, 12.0], [3.4, 12.25], [3.4, 13.0], [0, 12.95]], 0.09, 'xz');
  stab.translate(0.75, 5.2, 0);
  const h = hull(group, 'ch53', [
    { keys: fus, holes: [...cockpitWin, ...gunWin, ...cabWin, { z0: 4.5, z1: 6.9, a0: PI + 0.45, a1: 2 * PI - 0.45 }], glass: [...cockpitWin, ...cabWin], capEnd: true, radial: 40 },
    { keys: top, capStart: true, capEnd: true, radial: 24 },
    { keys: nac(-1), capStart: true, capEnd: true, radial: 20 },
    { keys: nac(1), capStart: true, capEnd: true, radial: 20 },
    { keys: sponson(-1), capStart: true, capEnd: true, radial: 20 },
    { keys: sponson(1), capStart: true, capEnd: true, radial: 20 },
    { keys: tank(-1), radial: 18 },
    { keys: tank(1), radial: 18 },
  ], { base: '#4b5141', camo: ['#3c4734', '#2c3029', '#5a5c45'], frames: 26, stringers: 10, soot: [[0.4, 0.6, 0.05, 0.3]] }, [fin, stab]);

  const parts = [];
  parts.push(P(box(2.8, 0.06, 9.6), 0x25271e, [0, -1.02, -0.2]));
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.45, 0.08, 7.5), 0x55553f, [sx * 1.15, -0.55, 0.3]));
    wheel(parts, 0.42, 0.32, [sx * 1.95, -1.23, 0.4]);
    parts.push(P(box(0.18, 0.5, 0.2), COL.metal, [sx * 1.95, -0.95, 0.4]));
    parts.push(P(tor(0.4, 0.07, 14), 0x2a2a2a, [sx * 1.36, 1.98, -2.1]));
    parts.push(P(cyl(0.4, 0.34, 0.45, 14), 0x1b1b19, [sx * 1.45, 1.98, 1.95], [HALFPI, 0, sx * -0.4]));
    parts.push(P(box(0.3, 0.04, 0.3), 0x2a2b2b, [sx * 1.55, -0.95, -4.0]));
  }
  wheel(parts, 0.32, 0.22, [-0.3, -1.33, -5.6]);
  wheel(parts, 0.32, 0.22, [0.3, -1.33, -5.6]);
  parts.push(P(box(0.15, 0.55, 0.15), COL.metal, [0, -1.0, -5.6]));
  parts.push(P(box(2.3, 0.12, 2.3), 0x353a2c, [0, -1.42, 5.7], [-0.3, 0, 0]));
  parts.push(P(box(2.9, 2.2, 0.06), 0x34372c, [0, 0.1, -4.75]));
  cockpit(parts, group, { z: -6.45, w: 2.3, y: -0.2, seatX: 0.6, seatZ: -5.45, seatY: -0.42 });
  parts.push(P(cyl(0.06, 0.06, 2.4, 8), 0x2a2a28, [0.75, 0.35, -7.6], [HALFPI + 0.25, 0, 0]));
  parts.push(P(cyl(0.24, 0.28, 0.85, 12), COL.metal, [0, 2.7, 0]));
  parts.push(P(box(0.04, 0.5, 0.28), 0x111111, [0, 2.6, 3.0], [0.35, 0, 0]));
  parts.push(P(cyl(0.2, 0.2, 0.5, 10), COL.gun, [-0.25, 3.9, 12.5], [0, 0, HALFPI]));
  for (const s of [-1, 1]) {
    decal(group, 'HEER', 1.6, 0.42, [h.X(1.8), 0.95, 1.8], s);
    ironCross(group, 0.9, [h.X(-1.4), 0.6, -1.4], s);
    decal(group, number, 1.3, 0.34, [h.X(7.6), 1.3, 7.6], s, '#151511', 'bold 72px Arial', -0.25);
    crossDecal(group, 0.8, [h.X(3.4), 0.6, 3.4], s);
  }
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 3.1, 0);
  mainRotor.add(new THREE.Mesh(rotorGeo(6, 11, 0.7, { hubR: 0.5 }), detailMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-0.45, 3.9, 12.6);
  tailRotor.rotation.z = 0.2;
  tailRotor.add(new THREE.Mesh(tailRotorGeo(4, 3.0, 0.32), detailMat));
  group.add(tailRotor);
  const f = finish(group, parts, {
    guns: { x: 1.42, y: 0.25, z: -3.9, figX: 0.95, sitY: -0.3 }, floor: -1.02,
    pilots: { x: 0.6, z: -5.5, sitY: -0.32 },
    discs: [{ obj: mainRotor, r: 11 }],
    beacon: [0, 2.6, 3.0],
  });
  const seatList = [];
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) seatList.push([s * 1.05, -2.8 + i * 0.8, s < 0 ? HALFPI : -HALFPI, 'floor']);
  for (let i = 0; i < 6; i++) seatList.push([(i % 2 - 0.5) * 0.7, -1.5 + Math.floor(i / 2) * 2.0, 0, 'floor']);
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats: seatsGrid(seatList, [0.35, -0.45]), isStatic,
    eyePilot: new THREE.Vector3(0.6, 0.45, -5.7),
    spin: [[mainRotor, 'y', 17], [tailRotor, 'x', 60]],
    exhaust: new THREE.Vector3(1.45, 2.0, 2.1),
  };
}
