// Hubschraubermodelle für Afghanistan: UH-60 Black Hawk, CH-47 Chinook, CH-53GS
// Gleiche Schnittstelle wie buildHuey(): group, body, glass, Rotoren (spin), guns, pilots, seats, eyePilot, exhaust
import * as THREE from './lib/three.module.min.js';
import { P, merge, vcMat, vcMatDouble, Figure, COL, textTexture, m60Geo, buildHuey } from './models.js';
import { T } from './theme.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs);
const HALFPI = Math.PI / 2;
// Obere Hälfte einer liegenden Röhre (Rumpfdach), Achse entlang Z
const roof = (r, len) => new THREE.CylinderGeometry(r, r, len, 12, 1, true, HALFPI, Math.PI);

const glassMat = new THREE.MeshPhongMaterial({
  color: 0x5d7480, transparent: true, opacity: 0.24, shininess: 90, specular: 0xffffff, side: THREE.DoubleSide, depthWrite: false,
});
const discMatProto = new THREE.MeshBasicMaterial({ color: 0x202020, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });

export function buildHeliModel(spec, opts = {}) {
  if (spec.model === 'blackhawk') return buildBlackhawk(opts);
  if (spec.model === 'chinook') return buildChinook(opts);
  if (spec.model === 'ch53') return buildCH53(opts);
  const m = buildHuey(opts);
  m.spin = [[m.mainRotor, 'y', 22], [m.tailRotor, 'x', 70]];
  m.exhaust = new THREE.Vector3(0, 1.62, 3.5);
  return m;
}

// Rotor mit n Blättern um die Y-Achse
function rotorGeo(n, r, chord, tip = 0x1e1f1f, hub = COL.gun, droop = 0) {
  const parts = [P(cyl(0.35, 0.4, 0.35, 10), hub, [0, 0, 0])];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push(P(box(r - 0.3, 0.06, chord), COL.rotor, [Math.cos(a) * (r / 2 + 0.15), -droop, -Math.sin(a) * (r / 2 + 0.15)], [0, a, 0]));
    parts.push(P(box(0.3, 0.065, chord), tip, [Math.cos(a) * (r - 0.15), -droop, -Math.sin(a) * (r - 0.15)], [0, a, 0]));
  }
  return merge(parts);
}

// Heckrotor in der YZ-Ebene (dreht um X)
function tailRotorGeo(n, r) {
  const parts = [P(cyl(0.12, 0.12, 0.2, 8), COL.gun, [0, 0, 0], [0, 0, HALFPI])];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push(P(box(0.04, r, 0.22), COL.rotor, [0, Math.cos(a) * r / 2, Math.sin(a) * r / 2], [a, 0, 0]));
  }
  return merge(parts);
}

function decal(group, text, w, h, pos, side, color = '#151511', font = 'bold 72px Arial') {
  const tex = textTexture(text, 512, 128, font, color);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  pl.position.set(pos[0] * side, pos[1], pos[2]);
  pl.rotation.y = side * HALFPI;
  group.add(pl);
}

function crossDecal(group, size, pos, side, white = true) {
  const parts = [];
  if (white) parts.push(P(box(0.02, size, size), 0xe8e6de, [0, 0, 0]));
  parts.push(P(box(0.03, size * 0.75, size * 0.24), COL.red, [0, 0, 0]));
  parts.push(P(box(0.03, size * 0.24, size * 0.75), COL.red, [0, 0, 0]));
  const m = new THREE.Mesh(merge(parts), vcMat);
  m.position.set(pos[0] * side, pos[1], pos[2]);
  group.add(m);
}

function ironCross(group, size, pos, side) {
  const parts = [
    P(box(0.03, size * 0.34, size), 0xe8e6de, [0, 0, 0]), P(box(0.03, size, size * 0.34), 0xe8e6de, [0, 0, 0]),
    P(box(0.04, size * 0.2, size * 0.86), 0x111111, [0, 0, 0]), P(box(0.04, size * 0.86, size * 0.2), 0x111111, [0, 0, 0]),
  ];
  const m = new THREE.Mesh(merge(parts), vcMat);
  m.position.set(pos[0] * side, pos[1], pos[2]);
  group.add(m);
}

function wheel(r, w, pos) { return P(cyl(r, r, w, 12), 0x161616, pos, [0, 0, HALFPI]); }

// Bordschützen, Piloten, Rotorscheiben und Beacon anbauen
function finish(group, cfg) {
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
    pitch.add(new THREE.Mesh(gunGeo, vcMat));
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.01, -0.9);
    pitch.add(muzzle);
    const eye = new THREE.Object3D();
    eye.position.set(0, 0.3, 0.5);
    pitch.add(eye);
    group.add(mount);
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
    const d = new THREE.Mesh(new THREE.CircleGeometry(r.r, 40), discMat);
    d.rotation.x = -HALFPI;
    d.position.copy(r.obj.position);
    group.add(d);
    discs.push(d);
  }
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), beaconMat);
  beacon.position.set(...cfg.beacon);
  group.add(beacon);
  return { guns, pilots, discMat, rotorDisc: discs[0], beacon, beaconMat };
}

function seatsGrid(list) {
  return list.map(([x, z, r, kind]) => ({ p: [x, z], r, sit: kind === 'bench' ? [1.2, -0.25] : [0.35, -0.67] }));
}

// ---------------------------------------------------------------- UH-60 Black Hawk
function buildBlackhawk({ static: isStatic = false, number = '08-20112' } = {}) {
  const c = 0x3d4135, dk = 0x2e3129, lt = 0x474b3e;
  const parts = [
    // Kabine (Boden bei y = -0.95, Bodenfreiheit 0,6 m)
    P(box(2.35, 0.35, 5.4), c, [0, -1.0, -0.2]),
    P(box(2.25, 0.06, 5.2), 0x26281f, [0, -0.8, -0.2]),
    P(box(2.4, 0.18, 5.6), c, [0, 1.0, -0.3]),
    P(box(2.3, 1.9, 0.5), c, [0, 0.05, 2.35]),
    P(box(0.12, 1.9, 0.18), c, [-1.15, 0.05, -2.7]), P(box(0.12, 1.9, 0.18), c, [1.15, 0.05, -2.7]),
    P(box(0.1, 1.7, 0.15), c, [-1.17, 0.05, -1.25]), P(box(0.1, 1.7, 0.15), c, [1.17, 0.05, -1.25]),
    // Schiebetüren (offen, nach hinten geschoben)
    P(box(0.08, 1.6, 1.6), lt, [-1.24, 0.0, 1.5]), P(box(0.08, 1.6, 1.6), lt, [1.24, 0.0, 1.5]),
    // Cockpit / Bug
    P(box(2.2, 0.55, 2.0), c, [0, -0.85, -3.7]),
    P(box(1.9, 0.5, 1.0), c, [0, -0.75, -5.0], [0.25, 0, 0]),
    P(box(2.2, 0.12, 1.5), c, [0, 0.95, -3.55]),
    P(box(0.1, 1.2, 0.1), dk, [-0.95, 0.3, -4.35], [-0.55, 0, 0]), P(box(0.1, 1.2, 0.1), dk, [0.95, 0.3, -4.35], [-0.55, 0, 0]),
    P(box(1.9, 0.4, 0.12), 0x22241f, [0, -0.35, -4.3], [-0.3, 0, 0]),
    P(box(0.5, 0.1, 0.5), 0x33332c, [-0.55, -0.4, -3.3]), P(box(0.5, 0.1, 0.5), 0x33332c, [0.55, -0.4, -3.3]),
    P(box(0.5, 0.8, 0.12), 0x33332c, [-0.55, 0.0, -3.0]), P(box(0.5, 0.8, 0.12), 0x33332c, [0.55, 0.0, -3.0]),
    // Triebwerke und Getriebe auf dem Dach
    P(box(1.3, 0.6, 2.4), c, [0, 1.38, -0.4]),
    P(cyl(0.38, 0.4, 2.6, 10), lt, [-0.85, 1.35, 0.4], [HALFPI, 0, 0]),
    P(cyl(0.38, 0.4, 2.6, 10), lt, [0.85, 1.35, 0.4], [HALFPI, 0, 0]),
    P(cyl(0.3, 0.26, 0.5, 8), 0x1e1e1b, [-0.95, 1.4, 1.85], [HALFPI, 0, -0.5]),
    P(cyl(0.3, 0.26, 0.5, 8), 0x1e1e1b, [0.95, 1.4, 1.85], [HALFPI, 0, 0.5]),
    P(cyl(0.16, 0.2, 0.7, 8), COL.metal, [0, 2.0, -0.35]),
    // Heckausleger, Leitwerk
    P(cyl(0.95, 0.4, 3.0, 10), c, [0, 0.45, 4.0], [HALFPI, 0, 0], [1, 1, 0.9]),
    P(cyl(0.4, 0.26, 4.6, 10), c, [0, 0.7, 7.7], [HALFPI - 0.04, 0, 0]),
    P(box(0.22, 2.4, 1.3), c, [0, 1.9, 10.0], [0.4, 0, 0]),
    P(box(4.4, 0.08, 0.9), c, [0, 0.55, 9.3]),
    P(cyl(0.15, 0.15, 0.4, 6), COL.gun, [0.2, 2.6, 10.3], [0, 0, HALFPI]),
    // Fahrwerk
    P(box(0.12, 0.7, 0.12), COL.metal, [-1.3, -1.0, -3.3], [0, 0, 0.3]), P(box(0.12, 0.7, 0.12), COL.metal, [1.3, -1.0, -3.3], [0, 0, -0.3]),
    P(box(0.9, 0.12, 0.12), COL.metal, [-0.9, -0.9, -3.3]), P(box(0.9, 0.12, 0.12), COL.metal, [0.9, -0.9, -3.3]),
    wheel(0.33, 0.24, [-1.45, -1.22, -3.3]), wheel(0.33, 0.24, [1.45, -1.22, -3.3]),
    P(box(0.12, 0.9, 0.12), COL.metal, [0, -0.3, 9.0], [0.3, 0, 0]), wheel(0.2, 0.15, [0, -1.35, 8.85]),
    // Antennen, Stummelflügel-Ansatz
    P(box(0.05, 0.4, 0.05), 0x111111, [0, 1.25, 1.6]),
    // Sitze hinten
    P(box(2.1, 0.08, 0.45), 0x4a4a3c, [0, -0.45, 1.85]),
  ];
  const group = new THREE.Group();
  const body = new THREE.Mesh(merge(parts), vcMatDouble);
  group.add(body);
  // Verglasung
  const glass = new THREE.Mesh(merge([
    P(box(1.95, 1.3, 0.06), 0xffffff, [0, 0.25, -4.38], [-0.55, 0, 0]),
    P(box(0.06, 0.9, 1.5), 0xffffff, [-1.08, -0.15, -3.5]), P(box(0.06, 0.9, 1.5), 0xffffff, [1.08, -0.15, -3.5]),
    P(box(0.06, 0.6, 0.7), 0xffffff, [-1.1, -0.65, -4.4], [0.3, 0, 0]), P(box(0.06, 0.6, 0.7), 0xffffff, [1.1, -0.65, -4.4], [0.3, 0, 0]),
  ]), glassMat);
  glass.renderOrder = 2;
  group.add(glass);
  // Markierungen: Rote Kreuze (MEDEVAC), Kennung
  for (const s of [-1, 1]) {
    crossDecal(group, 0.9, [1.29, 0.35, 0.0], s);
    crossDecal(group, 0.7, [0.42, 0.75, 4.6], s);
    decal(group, 'U.S. ARMY', 2.0, 0.4, [0.38, 0.85, 6.6], s);
    decal(group, number, 0.95, 0.24, [0.13, 1.7, 9.9], s);
  }
  crossDecal({ add: (m) => { m.rotation.y = HALFPI; m.position.set(0, -0.62, -5.52); group.add(m); } }, 0.6, [0, 0, 0], 1);

  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.4, -0.35);
  mainRotor.add(new THREE.Mesh(rotorGeo(4, 8.2, 0.53), vcMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.38, 2.6, 10.3);
  tailRotor.rotation.z = -0.35;
  tailRotor.add(new THREE.Mesh(tailRotorGeo(4, 1.75), vcMat));
  group.add(tailRotor);

  const f = finish(group, {
    guns: { x: 1.17, y: 0.2, z: -1.9, figX: 0.7, sitY: -0.2 },
    pilots: { x: 0.55, z: -3.35, sitY: -0.3 },
    discs: [{ obj: mainRotor, r: 8.2 }],
    beacon: [0, 1.15, 3.6],
  });
  const seats = seatsGrid([
    [-0.8, 1.85, 0, 'bench'], [-0.25, 1.85, 0, 'bench'], [0.3, 1.85, 0, 'bench'], [0.85, 1.85, 0, 'bench'],
    [-0.5, 0.9, 0, 'bench'], [0.0, 0.9, 0, 'bench'], [0.5, 0.9, 0, 'bench'],
    [-0.5, -0.1, Math.PI, 'bench'], [0.0, -0.1, Math.PI, 'bench'], [0.5, -0.1, Math.PI, 'bench'], [0.0, 0.4, 0, 'floor'],
  ]);
  return {
    group, body, glass, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats, isStatic,
    eyePilot: new THREE.Vector3(0.55, 0.38, -3.5),
    spin: [[mainRotor, 'y', 26], [tailRotor, 'x', 75]],
    exhaust: new THREE.Vector3(0, 1.4, 2.0),
  };
}

// ---------------------------------------------------------------- CH-47 Chinook
function buildChinook({ static: isStatic = false, number = '10-08046' } = {}) {
  const c = 0x474a3a, dk = 0x363929, lt = 0x52553f;
  const parts = [
    // Rumpf (Boden y = -1.15, rund überdacht)
    P(box(3.4, 1.9, 11.2), c, [0, -0.15, 1.2]),
    P(box(3.4, 0.75, 1.8), c, [0, -0.725, -5.3]),
    P(box(3.4, 1.9, 0.12), c, [0, -0.15, -6.15]),
    P(roof(1.7, 13.0), c, [0, 0.8, 0.3], [HALFPI, 0, 0], [1, 1, 0.5]),
    P(box(2.9, 0.12, 1.8), c, [0, 0.85, -7.1]),
    P(box(3.3, 0.06, 12.6), 0x25271e, [0, -1.08, 0.3]),
    // Seitliche Tanks (Sponsons)
    P(box(0.7, 0.9, 9.5), dk, [-1.95, -0.75, 0.6]), P(box(0.7, 0.9, 9.5), dk, [1.95, -0.75, 0.6]),
    // Cockpit
    P(box(3.0, 1.2, 2.2), c, [0, -0.45, -7.0]),
    P(box(2.8, 0.9, 1.0), c, [0, -0.6, -8.4], [0.35, 0, 0]),
    P(box(2.6, 0.5, 0.15), 0x22241f, [0, -0.2, -7.9], [-0.3, 0, 0]),
    P(box(0.55, 0.1, 0.55), 0x33332c, [-0.65, -0.45, -7.2]), P(box(0.55, 0.1, 0.55), 0x33332c, [0.65, -0.45, -7.2]),
    // Vorderer Pylon (niedrig) und hinterer Pylon (hoch) mit Triebwerken
    P(box(1.4, 0.9, 2.4), c, [0, 1.95, -6.0]),
    P(box(1.6, 2.3, 4.0), c, [0, 2.0, 5.6], [-0.08, 0, 0]),
    P(box(3.4, 0.7, 7.0), lt, [0, 1.9, 0.5]),
    P(cyl(0.48, 0.5, 2.8, 10), lt, [-2.0, 1.55, 5.8], [HALFPI, 0, 0]), P(cyl(0.48, 0.5, 2.8, 10), lt, [2.0, 1.55, 5.8], [HALFPI, 0, 0]),
    P(cyl(0.36, 0.3, 0.4, 8), 0x1d1d1a, [-2.0, 1.55, 7.35], [HALFPI, 0, 0]), P(cyl(0.36, 0.3, 0.4, 8), 0x1d1d1a, [2.0, 1.55, 7.35], [HALFPI, 0, 0]),
    P(cyl(0.18, 0.2, 0.6, 8), COL.metal, [0, 2.6, -6.0]), P(cyl(0.18, 0.2, 0.6, 8), COL.metal, [0, 3.3, 6.8]),
    // Heckrampe (offen, schräg)
    P(box(2.6, 0.12, 2.0), dk, [0, -1.35, 7.95], [-0.32, 0, 0]),
    P(box(0.15, 1.6, 0.5), c, [-1.5, -0.3, 7.0]), P(box(0.15, 1.6, 0.5), c, [1.5, -0.3, 7.0]),
    // Fahrwerk (4 Räder)
    wheel(0.45, 0.3, [-1.55, -1.3, -4.6]), wheel(0.45, 0.3, [1.55, -1.3, -4.6]),
    wheel(0.45, 0.3, [-1.55, -1.3, 4.6]), wheel(0.45, 0.3, [1.55, -1.3, 4.6]),
    P(box(0.15, 0.6, 0.15), COL.metal, [-1.55, -0.95, -4.6]), P(box(0.15, 0.6, 0.15), COL.metal, [1.55, -0.95, -4.6]),
    P(box(0.15, 0.6, 0.15), COL.metal, [-1.55, -0.95, 4.6]), P(box(0.15, 0.6, 0.15), COL.metal, [1.55, -0.95, 4.6]),
    // Bänke an den Seitenwänden
    P(box(0.45, 0.08, 9.5), 0x55553f, [-1.35, -0.6, 0.6]), P(box(0.45, 0.08, 9.5), 0x55553f, [1.35, -0.6, 0.6]),
    // Fenster (dunkle Bullaugen)
  ];
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) parts.push(P(box(0.03, 0.45, 0.45), 0x1c1f20, [s * 1.71, 0.2, -3.6 + i * 1.8]));
  const group = new THREE.Group();
  const body = new THREE.Mesh(merge(parts), vcMatDouble);
  group.add(body);
  const glass = new THREE.Mesh(merge([
    P(box(2.7, 1.5, 0.06), 0xffffff, [0, 0.3, -8.15], [-0.5, 0, 0]),
    P(box(0.06, 0.9, 1.8), 0xffffff, [-1.52, 0.15, -7.3]), P(box(0.06, 0.9, 1.8), 0xffffff, [1.52, 0.15, -7.3]),
    P(box(0.06, 0.6, 0.6), 0xffffff, [-1.45, -0.55, -8.5], [0.3, 0, 0]), P(box(0.06, 0.6, 0.6), 0xffffff, [1.45, -0.55, -8.5], [0.3, 0, 0]),
  ]), glassMat);
  glass.renderOrder = 2;
  group.add(glass);
  for (const s of [-1, 1]) {
    decal(group, 'U.S. ARMY', 3.0, 0.6, [1.72, 0.8, 1.5], s);
    decal(group, number, 1.2, 0.3, [0.81, 2.6, 6.0], s);
  }
  const front = new THREE.Group();
  front.position.set(0, 2.95, -6.0);
  front.add(new THREE.Mesh(rotorGeo(3, 9.1, 0.8), vcMat));
  group.add(front);
  const rear = new THREE.Group();
  rear.position.set(0, 3.65, 6.8);
  rear.add(new THREE.Mesh(rotorGeo(3, 9.1, 0.8), vcMat));
  group.add(rear);
  const f = finish(group, {
    guns: { x: 1.78, y: 0.15, z: -5.0, figX: 1.2, sitY: -0.35 },
    pilots: { x: 0.65, z: -7.25, sitY: -0.35 },
    discs: [{ obj: front, r: 9.1 }, { obj: rear, r: 9.1 }],
    beacon: [0, 3.2, 4.6],
  });
  const seatList = [];
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) seatList.push([s * 1.25, -3.6 + i * 0.85, s < 0 ? HALFPI : -HALFPI, 'floor']);
  for (let i = 0; i < 9; i++) seatList.push([(i % 3 - 1) * 0.55, -1.5 + Math.floor(i / 3) * 2.2, 0, 'floor']);
  return {
    group, body, glass, mainRotor: front, tailRotor: rear, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats: seatsGrid(seatList).map((s) => Object.assign(s, { sit: [0.35, -0.5] })), isStatic,
    eyePilot: new THREE.Vector3(0.65, 0.4, -7.45),
    spin: [[front, 'y', 18], [rear, 'y', -18]],
    exhaust: new THREE.Vector3(2.0, 1.55, 7.5),
  };
}

// ---------------------------------------------------------------- CH-53GS (Heeresflieger)
function buildCH53({ static: isStatic = false, number = '84+05' } = {}) {
  const c = 0x4b5040, dk = 0x3a3e31, lt = 0x565b49;
  const parts = [
    // Rumpf (Boden y = -1.05)
    P(box(3.0, 2.3, 7.9), c, [0, 0.05, 1.05]),
    P(box(3.0, 0.8, 1.7), c, [0, -0.7, -3.75]),
    P(box(3.0, 0.25, 1.7), c, [0, 1.07, -3.75]),
    P(box(3.0, 2.3, 0.12), c, [0, 0.05, -4.55]),
    P(roof(1.5, 9.6), c, [0, 1.15, 0.2], [HALFPI, 0, 0], [1, 1, 0.35]),
    P(box(2.7, 0.12, 1.6), c, [0, 0.95, -5.5]),
    P(box(2.9, 0.06, 9.4), 0x25271e, [0, -1.0, 0.2]),
    // Cockpit und Bug
    P(box(2.8, 1.4, 2.0), c, [0, -0.35, -5.4]),
    P(box(2.4, 1.0, 1.2), c, [0, -0.55, -6.8], [0.3, 0, 0]),
    P(box(2.4, 0.5, 0.15), 0x22241f, [0, -0.1, -6.2], [-0.3, 0, 0]),
    P(box(0.55, 0.1, 0.55), 0x33332c, [-0.6, -0.4, -5.5]), P(box(0.55, 0.1, 0.55), 0x33332c, [0.6, -0.4, -5.5]),
    P(cyl(0.06, 0.06, 2.2, 6), 0x2a2a28, [0.6, 0.4, -7.6], [HALFPI + 0.3, 0, 0]), // Tanksonde
    // Sponsons mit Zusatztanks (GS)
    P(box(1.1, 1.0, 4.0), dk, [-1.95, -0.55, 0.6]), P(box(1.1, 1.0, 4.0), dk, [1.95, -0.55, 0.6]),
    P(cyl(0.45, 0.45, 4.6, 10), lt, [-2.75, -0.3, 0.6], [HALFPI, 0, 0]), P(cyl(0.45, 0.45, 4.6, 10), lt, [2.75, -0.3, 0.6], [HALFPI, 0, 0]),
    // Triebwerke und Getriebe
    P(box(2.0, 0.8, 4.2), lt, [0, 2.0, -0.4]),
    P(cyl(0.5, 0.5, 3.2, 10), lt, [-1.3, 2.0, -0.3], [HALFPI, 0, 0]), P(cyl(0.5, 0.5, 3.2, 10), lt, [1.3, 2.0, -0.3], [HALFPI, 0, 0]),
    P(cyl(0.4, 0.34, 0.5, 8), 0x1d1d1a, [-1.4, 2.0, 1.45], [HALFPI, 0, -0.4]), P(cyl(0.4, 0.34, 0.5, 8), 0x1d1d1a, [1.4, 2.0, 1.45], [HALFPI, 0, 0.4]),
    P(cyl(0.22, 0.26, 0.8, 8), COL.metal, [0, 2.65, 0]),
    // Heck mit Rampe, Ausleger, Leitwerk
    P(box(2.8, 1.6, 3.0), c, [0, 0.45, 6.4], [-0.25, 0, 0]),
    P(box(2.2, 0.12, 2.2), dk, [0, -1.25, 6.0], [-0.3, 0, 0]),
    P(cyl(0.9, 0.45, 4.6, 10), c, [0, 1.5, 9.7], [HALFPI - 0.18, 0, 0]),
    P(box(0.3, 3.2, 1.6), c, [0, 3.2, 12.2], [0.25, 0, 0.2]),
    P(box(3.6, 0.1, 1.0), c, [1.6, 4.0, 12.6], [0, 0, 0.2]),
    // Fahrwerk
    wheel(0.42, 0.3, [-1.95, -1.23, 0.4]), wheel(0.42, 0.3, [1.95, -1.23, 0.4]),
    wheel(0.32, 0.22, [-0.3, -1.33, -5.6]), wheel(0.32, 0.22, [0.3, -1.33, -5.6]),
    P(box(0.15, 0.5, 0.15), COL.metal, [0, -1.0, -5.6]),
    // Bänke
    P(box(0.45, 0.08, 7.5), 0x55553f, [-1.15, -0.55, 0.3]), P(box(0.45, 0.08, 7.5), 0x55553f, [1.15, -0.55, 0.3]),
  ];
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) parts.push(P(box(0.03, 0.45, 0.5), 0x1c1f20, [s * 1.51, 0.4, -2.5 + i * 1.6]));
  const group = new THREE.Group();
  const body = new THREE.Mesh(merge(parts), vcMatDouble);
  group.add(body);
  const glass = new THREE.Mesh(merge([
    P(box(2.5, 1.45, 0.06), 0xffffff, [0, 0.35, -6.35], [-0.5, 0, 0]),
    P(box(0.06, 0.9, 1.6), 0xffffff, [-1.42, 0.15, -5.6]), P(box(0.06, 0.9, 1.6), 0xffffff, [1.42, 0.15, -5.6]),
    P(box(0.06, 0.55, 0.6), 0xffffff, [-1.3, -0.55, -6.8], [0.3, 0, 0]), P(box(0.06, 0.55, 0.6), 0xffffff, [1.3, -0.55, -6.8], [0.3, 0, 0]),
  ]), glassMat);
  glass.renderOrder = 2;
  group.add(glass);
  for (const s of [-1, 1]) {
    decal(group, 'HEER', 1.6, 0.42, [1.52, 0.9, 1.6], s);
    ironCross(group, 0.9, [1.52, 0.6, -1.4], s);
    decal(group, number, 1.3, 0.34, [0.9, 1.3, 7.2], s);
    crossDecal(group, 0.8, [1.52, 0.6, 3.6], s);
  }
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 3.05, 0);
  mainRotor.add(new THREE.Mesh(rotorGeo(6, 11, 0.7), vcMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-0.35, 3.9, 12.5);
  tailRotor.rotation.z = 0.2;
  tailRotor.add(new THREE.Mesh(tailRotorGeo(4, 3.0), vcMat));
  group.add(tailRotor);
  const f = finish(group, {
    guns: { x: 1.52, y: 0.25, z: -3.9, figX: 1.0, sitY: -0.3 },
    pilots: { x: 0.6, z: -5.5, sitY: -0.32 },
    discs: [{ obj: mainRotor, r: 11 }],
    beacon: [0, 2.5, 3.0],
  });
  const seatList = [];
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) seatList.push([s * 1.05, -2.8 + i * 0.8, s < 0 ? HALFPI : -HALFPI, 'floor']);
  for (let i = 0; i < 6; i++) seatList.push([(i % 2 - 0.5) * 0.7, -1.5 + Math.floor(i / 2) * 2.0, 0, 'floor']);
  return {
    group, body, glass, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats: seatsGrid(seatList).map((s) => Object.assign(s, { sit: [0.35, -0.45] })), isStatic,
    eyePilot: new THREE.Vector3(0.6, 0.45, -5.7),
    spin: [[mainRotor, 'y', 17], [tailRotor, 'x', 60]],
    exhaust: new THREE.Vector3(1.4, 2.0, 1.7),
  };
}
