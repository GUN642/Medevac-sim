// Norwegen: Arktis-Übung mit Fjorden, Schnee, Steilküsten, Schären und einer Fregatte mit schwankendem Flugdeck
import * as THREE from './lib/three.module.min.js';
import { HALF, CELL, FOB_POS } from './config.js';
import { World } from './world.js';
import { T } from './theme.js';
import { smoothstep, lerp, dist2, clamp } from './util.js';
import * as M from './models.js';
import * as A from './afgModels.js';
import * as F from './floodModels.js';

const SITE_NAMES = [
  'Hytte Fjellheim', 'Fjellstue Tindvik', 'Seter Skardalen', 'Gård Elvenes', 'Kai Hamnvik', 'Schießplatz Mauken', 'Pass Skardalsfjellet',
  'Seeufer Storvatnet', 'Brücke Lyngelva', 'Fjellstue Grøtnes', 'Kapelle Sørvik', 'Hafen Nesbygd', 'Hochebene Vidda Nord', 'Talstation Lift',
  'Felsrücken Kvassnes', 'Leuchtturm Tindvik', 'Fischfarm Skarvik', 'Moor Bjørnmyra', 'Seter Lyngvær', 'Bucht Indre Fjord',
];
const VILLAGE_NAMES = ['Sørvik', 'Hamnvik', 'Nesbygd', 'Skarvik', 'Lyngvær', 'Elvenes', 'Tindvik', 'Grøtnes'];
const WALLS_NO = [0x8c2a22, 0x9a3328, 0xc9a23a, 0xe8e2d6, 0x7a2a22, 0xd9d2c0];
const ROOFS_NO = [0x2e2e30, 0x3a3a3c, 0x3d4a2c];

export class NorwayWorld extends World {
  get rockColor() { return 0x63686e; }
  get outerColor() { return 0xdde4ea; }
  get waterColor() { return 0x2f4756; }
  get villageClear() { return 60; }
  get outerHeight() { return 240; }

  // ------------------------------------------------------------ Höhen
  // Hauptfjord von der Küste (Westen) nach Osten, ein Seitental von der FOB nach Süden zum Fjord
  fjordZ(x) { return -380 + 520 * Math.sin(x * 0.0007 + 0.6) + 180 * this.n.noise(x * 0.0006, 4.4); }
  dalX(z) { return FOB_POS.x + 180 * Math.sin(z * 0.0011 + 0.2); }

  rawHeight(x, z, out) {
    const n = this.n;
    // Hochgebirge: zerklüftete Gipfel, Grate
    const hills = n.fbm(x * 0.0008 + 3, z * 0.0008 - 2, 4);
    let ridge = 1 - Math.abs(n.fbm(x * 0.0006 + 17, z * 0.0006 + 5, 4));
    ridge = ridge * ridge * ridge;
    let h = 260 + hills * 160 + ridge * 520;
    // Fjord: tief eingeschnitten, steile Wände
    const fz = this.fjordZ(x);
    const fd = Math.abs(z - fz);
    const fw = 300 + 90 * n.noise(x * 0.001, 8.1);
    const ft = smoothstep(fw, fw + 520, fd);
    h = lerp(-35, h, Math.pow(ft, 0.65));
    // Tal von der FOB hinunter zum Fjord: breiter, flacher Talboden
    const dd = Math.abs(x - this.dalX(z));
    const inDal = z > fz + fw * 0.5 ? 1 : 0;
    const dt = smoothstep(380, 820, dd);
    const floor = 18 + Math.max(0, (z - fz) * 0.012) + n.noise(x * 0.004, z * 0.004) * 2;
    if (inDal) h = Math.min(h, lerp(floor, h, Math.pow(dt, 0.8)));
    // Küste und Schären im Westen
    const sea = smoothstep(-1700, -2500, x + 120 * n.noise(z * 0.001, 2.2));
    const isl = Math.max(0, n.noise(x * 0.004 + 3, z * 0.004 - 7) - 0.25) * 90;
    h = lerp(h, -30 + isl, sea);
    // Kartenrand
    const e = smoothstep(HALF - 500, HALF - 40, Math.max(Math.abs(x), Math.abs(z)));
    h = lerp(h, Math.max(h, 240) * (1 - sea) + -30 * sea, e * (ft > 0.5 ? 1 : 0));
    if (out) { out.paddy = 0; out.mountain = smoothstep(300, 700, h); out.river = Math.min(fd - fw, sea > 0.5 ? -1 : 1e9); out.slope = ft; }
    return h;
  }

  generateHeights() {
    const N = this.N, o = {};
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
        const i = iz * N + ix;
        this.h[i] = this.rawHeight(x, z, o);
        this.paddy[i] = 0;
        // Wald nur in Tallagen (Baumgrenze ca. 300 m)
        const patch = smoothstep(-0.1, 0.35, this.n.noise(x * 0.002 + 40, z * 0.002));
        this.forest[i] = patch * 0.75 * smoothstep(3, 10, this.h[i]) * (1 - smoothstep(220, 330, this.h[i]));
      }
    }
    const fobH = Math.max(15, this.rawHeight(FOB_POS.x, FOB_POS.z));
    this.fob = { name: T.fobName, x: FOB_POS.x, z: FOB_POS.z, y: fobH, r: 230 };
    this.flatten(FOB_POS.x, FOB_POS.z, 240, 180, fobH, 'fob');
    const rng = this.rng, names = SITE_NAMES.slice();
    let tries = 0;
    while (this.sites.length < 20 && tries++ < 9000) {
      const x = rng.range(-HALF + 380, HALF - 380), z = rng.range(-HALF + 380, HALF - 380);
      const df = dist2(x, z, FOB_POS.x, FOB_POS.z);
      if (df < 3000 || df > 5800) continue;
      const h = this.rawHeight(x, z);
      if (h < 4 || h > 900) continue;
      let maxd = 0;
      for (const [dx, dz] of [[45, 0], [-45, 0], [0, 45], [0, -45]]) maxd = Math.max(maxd, Math.abs(this.rawHeight(x + dx, z + dz) - h));
      if (maxd > 26) continue;
      if (this.sites.some((s) => dist2(s.x, s.z, x, z) < 520)) continue;
      this.sites.push({ name: names.splice(Math.floor(rng() * names.length), 1)[0], x, z, y: h, r: 42 });
      this.flatten(x, z, 44, 60, h, 'site');
    }
    this.addHardSites(['Gipfel Store Tind', 'Gipfel Kvasstind', 'Gipfel Isfjellet', 'Gipfel Bjørntind'], ['Fjordufer Indre Vik', 'Steilufer Skarvik'], 420);
    this.addRidgeSites(['Gletscherkante Isbreen', 'Felsband Trollveggen', 'Schneefeld Fonna', 'Hangschulter Nordtind'], [], 260);
    // Fischerdörfer an Fjord und Küste
    const vn = VILLAGE_NAMES.slice();
    tries = 0;
    while (this.villages.length < 7 && tries++ < 6000) {
      const x = rng.range(-HALF + 400, HALF - 400), z = rng.range(-HALF + 400, HALF - 400);
      const h = this.rawHeight(x, z);
      if (h < 3 || h > 22) continue;
      if (dist2(x, z, FOB_POS.x, FOB_POS.z) < 800 || this.sites.some((s) => dist2(s.x, s.z, x, z) < 300) || this.villages.some((v) => dist2(v.x, v.z, x, z) < 800)) continue;
      this.villages.push({ name: vn.shift(), x, z, y: h });
    }
    this.placeShip();
  }

  // ------------------------------------------------------------ Fregatte im Fjord
  placeShip() {
    const F0 = FOB_POS;
    let best = null;
    for (let x = -2600; x < 2600; x += 40) {
      const z = this.fjordZ(x);
      const d = dist2(x, z, F0.x, F0.z);
      if (d < 3000 || d > 4600) continue;
      if (this.rawHeight(x, z) > -20 || this.rawHeight(x + 70, this.fjordZ(x + 70)) > -15 || this.rawHeight(x - 70, this.fjordZ(x - 70)) > -15) continue;
      if (!best || Math.abs(d - 3600) < Math.abs(best.d - 3600)) best = { x, z, d };
    }
    if (!best) best = { x: -1200, z: this.fjordZ(-1200) };
    const yaw = Math.atan2(20, this.fjordZ(best.x + 10) - this.fjordZ(best.x - 10));
    this.ship = { x: best.x, z: best.z, yaw, deck: 7.0, pitch: 0, roll: 0, heave: 0, len: 124, beam: 16 };
    // Flugdeck am Heck (lokal +z)
    this.ship.pad = { name: 'Fregatte „Sachsen“, Flugdeck', x: best.x + Math.sin(yaw) * 50, z: best.z + Math.cos(yaw) * 50 };
  }

  // Deckshöhe an einem Punkt (null = nicht über dem Schiff)
  shipDeck(x, z) {
    const s = this.ship;
    if (!s) return null;
    const dx = x - s.x, dz = z - s.z;
    if (Math.abs(dx) > 70 && Math.abs(dz) > 70) return null;
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    const halfB = s.beam / 2 * (lz < -40 ? clamp(1 - (-40 - lz) / 25, 0.15, 1) : 1);
    if (Math.abs(lx) > halfB || lz < -s.len / 2 || lz > s.len / 2) return null;
    return s.deck + s.heave - s.pitch * lz + s.roll * lx;
  }

  height(x, z) {
    const h = super.height(x, z);
    if (!this.ship) return h;
    const d = this.shipDeck(x, z);
    return d !== null ? Math.max(h, d) : h;
  }

  buildShip() {
    const s = this.ship;
    const gray = 0x8a9198, dark = 0x5e656c;
    const p = [];
    // Rumpf (Bug zugespitzt)
    p.push(M.P(new THREE.BoxGeometry(s.beam, 9, s.len - 24), gray, [0, s.deck - 4.5, 12]));
    const bow = new THREE.CylinderGeometry(0.01, s.beam / 2, 24, 4, 1);
    p.push(M.P(bow, gray, [0, s.deck - 4.5, -s.len / 2 + 12], [Math.PI / 2, Math.PI / 4, 0], [1, 1, 0.7]));
    p.push(M.P(new THREE.BoxGeometry(s.beam + 0.2, 0.4, s.len - 24), 0x2e3236, [0, -0.2, 12]));
    // Aufbauten, Brücke, Mast, Schornstein, Hangar
    p.push(M.P(new THREE.BoxGeometry(12, 7, 42), gray, [0, s.deck + 3.5, -8]));
    p.push(M.P(new THREE.BoxGeometry(10, 4, 10), gray, [0, s.deck + 9, -24]));
    p.push(M.P(new THREE.BoxGeometry(9.8, 1.2, 0.2), 0x2b3a44, [0, s.deck + 9.6, -29.05]));
    p.push(M.P(new THREE.CylinderGeometry(0.8, 1.4, 16, 6), dark, [0, s.deck + 18, -20]));
    p.push(M.P(new THREE.BoxGeometry(5, 6, 7), dark, [0, s.deck + 9, 2]));
    p.push(M.P(new THREE.BoxGeometry(13, 7.5, 14), gray, [0, s.deck + 3.75, 22]));
    p.push(M.P(new THREE.BoxGeometry(2.5, 1.6, 6), dark, [0, s.deck + 1.2, -50], [0, 0, 0]));
    p.push(M.P(new THREE.CylinderGeometry(0.25, 0.25, 6, 8), dark, [0, s.deck + 2.4, -53], [Math.PI / 2 - 0.2, 0, 0]));
    // Flugdeck mit Markierungen
    p.push(M.P(new THREE.BoxGeometry(s.beam - 0.4, 0.1, 30), 0x3e4246, [0, s.deck + 0.05, 46]));
    p.push(M.P(new THREE.TorusGeometry(4.5, 0.18, 4, 32), 0xe8e4d8, [0, s.deck + 0.12, 48], [Math.PI / 2, 0, 0]));
    p.push(M.P(new THREE.BoxGeometry(0.25, 0.03, 26), 0xe8e4d8, [0, s.deck + 0.12, 46]));
    p.push(M.P(new THREE.BoxGeometry(s.beam - 1, 0.03, 0.3), 0xc8a420, [0, s.deck + 0.12, 33.5]));
    for (const sx of [-1, 1]) p.push(M.P(new THREE.BoxGeometry(0.1, 0.9, 30), 0x2e3236, [sx * (s.beam / 2 - 0.1), s.deck + 0.45, 46]));
    // Schiffskennung
    const g = new THREE.Group();
    g.add(new THREE.Mesh(M.merge(p), M.vcMat));
    g.children[0].castShadow = g.children[0].receiveShadow = true;
    g.rotation.order = 'YXZ';
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.yaw;
    this.scene.add(g);
    s.group = g;
  }

  // ------------------------------------------------------------ Farben (Schnee, Fels, Wald)
  vertexColor(i, x, z, nY) {
    const h = this.h[i];
    const n = this.n.noise(x * 0.01, z * 0.01) * 0.5 + this.n.noise(x * 0.05, z * 0.05) * 0.5;
    let r = 0.9 + n * 0.04, g = 0.93 + n * 0.04, b = 0.97 + n * 0.02;
    // schattige Mulden leicht bläulich
    r -= smoothstep(0.95, 0.75, nY) * 0.08; g -= smoothstep(0.95, 0.75, nY) * 0.05;
    const f = this.forest[i];
    r = lerp(r, 0.55 + n * 0.05, f * 0.7); g = lerp(g, 0.62 + n * 0.05, f * 0.7); b = lerp(b, 0.62, f * 0.7);
    // steile Wände: dunkler Fels mit Schneebändern
    const steep = smoothstep(0.78, 0.5, nY);
    r = lerp(r, 0.36 + n * 0.05, steep); g = lerp(g, 0.37 + n * 0.05, steep); b = lerp(b, 0.4 + n * 0.04, steep);
    // Ufer: dunkle Steine, Tang
    const shore = smoothstep(4, 0, h);
    r = lerp(r, 0.3, shore); g = lerp(g, 0.31, shore); b = lerp(b, 0.3, shore);
    for (const fl of this.flats) {
      const d = Math.hypot(x - fl.x, z - fl.z);
      if (d > fl.r + 40) continue;
      const t = 1 - smoothstep(fl.r * 0.85, fl.r + 30, d);
      if (fl.kind === 'fob') { r = lerp(r, 0.82 + n * 0.04, t); g = lerp(g, 0.85 + n * 0.03, t); b = lerp(b, 0.88, t); }
      else { r = lerp(r, 0.94, t); g = lerp(g, 0.96, t); b = lerp(b, 0.99, t); }
    }
    return [r, g, b];
  }

  buildWater() {
    super.buildWater();
    this.water.material.opacity = 0.95;
    this.water.material.specular.set(0x99a6b0);
    this.water.material.shininess = 80;
  }

  // ------------------------------------------------------------ Flugplatz (Übungsbasis)
  buildFOB() {
    const f = this.fob;
    const parts = [];
    const add = (list, lx, lz, rot = 0) => { M.placeParts(list, f.x + lx, f.y, f.z + lz, rot); parts.push(...list); };
    f.pads = {
      troop: { x: f.x + 0, z: f.z + 40, name: 'H1' },
      med: { x: f.x - 64, z: f.z - 22, name: 'MED' },
      pol: { x: f.x + 64, z: f.z - 22, name: 'POL' },
      h2: { x: f.x - 46, z: f.z + 100, name: 'H2' },
    };
    add(A.padAfg('troop'), 0, 40);
    add(A.padAfg('med'), -64, -22);
    add(A.padAfg('pol'), 64, -22);
    add(A.padAfg('troop'), -46, 100);
    add(A.padAfg('troop'), 46, 100);
    add(M.hospitalParts(), -64, -66, Math.PI);
    f.hospitalDoor = { x: f.x - 64, z: f.z - 56 };
    add(A.fuelTruckAfg(), 88, -18, 0.1);
    f.truck = { x: f.x + 88, z: f.z - 18 };
    add(M.bladderParts(), 108, -48, 0.2);
    for (let i = 0; i < 3; i++) add(A.containerParts(0x6a7058), -14 + i * 3, -16, 0);
    // Hangars und Zeltlager im Schnee
    for (let i = 0; i < 2; i++) add([M.P(new THREE.CylinderGeometry(9, 9, 30, 12, 1, false, 0, Math.PI), 0x6d7464, [0, 0, 0], [0, 0, Math.PI / 2])], 130, -100 + i * 34, 0);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) add(A.tentAfg(6, 10, 3.2, 0xe8e8e2), -160 + c * 14, 28 + r * 20, 0);
    for (let i = 0; i < 6; i++) add(A.dingoParts(), 100 + (i % 3) * 6, 40 + Math.floor(i / 3) * 12, 0);
    // Startbahn-Andeutung
    add([M.P(new THREE.BoxGeometry(30, 0.08, 420), 0x5a5e62, [0, 0.04, 0])], 175, 120, 0.1);
    this.fobMesh = new THREE.Mesh(M.worldUV(M.merge(parts)), M.vcGrainMat);
    this.fobMesh.castShadow = this.fobMesh.receiveShadow = true;
    this.scene.add(this.fobMesh);
    this.buildFlag(f.x + 12, f.z - 5, (x) => { x.fillStyle = '#ba0c2f'; x.fillRect(0, 0, 190, 100); x.fillStyle = '#fff'; x.fillRect(50, 0, 32, 100); x.fillRect(0, 34, 190, 32); x.fillStyle = '#00205b'; x.fillRect(58, 0, 16, 100); x.fillRect(0, 42, 190, 16); });
    this.buildFlag(f.x + 18, f.z - 5, (x) => { x.fillStyle = '#000'; x.fillRect(0, 0, 190, 34); x.fillStyle = '#dd0000'; x.fillRect(0, 33, 190, 34); x.fillStyle = '#ffce00'; x.fillRect(0, 66, 190, 34); });
    this.buildParked([[-46, 100, 0.3], [46, 100, -0.2]]);
    this.fobFigures = [];
    for (const [x, z] of [[5, -8], [-25, -5], [-30, 2], [48, -40], [-55, -46], [110, 30], [-5, 30], [20, 15]]) {
      const fig = new M.Figure(T.friend());
      fig.group.position.set(f.x + x, f.y, f.z + z);
      fig.group.rotation.y = this.rng() * Math.PI * 2;
      this.scene.add(fig.group);
      this.fobFigures.push(fig);
    }
  }

  buildVillages() {
    const parts = [], rng = this.rng;
    for (const v of this.villages) {
      for (let i = 0; i < 8 + Math.floor(rng() * 6); i++) {
        const a = rng() * Math.PI * 2, d = 10 + rng() * 55;
        const x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d;
        const g = this.height(x, z);
        if (g < 1 || g > v.y + 25) continue;
        const hs = F.germanHouse(rng, false, WALLS_NO, ROOFS_NO);
        parts.push(...M.placeParts(hs.parts, x, g - 0.2, z, rng() * Math.PI));
        // Schnee auf dem Dach
        parts.push(...M.placeParts([M.P(new THREE.BoxGeometry(hs.w + 0.6, 0.15, hs.d + 0.6), 0xf2f5f8, [0, hs.ridge - 0.05, 0])], x, g - 0.2, z, 0));
      }
      // Bootshaus und Steg
      parts.push(...M.placeParts([M.P(new THREE.BoxGeometry(3, 0.3, 24), 0x5a4632, [0, 0.4, 0])], v.x + 20, 0, v.z + 20, rng() * Math.PI));
    }
    this.buildShip();
    if (parts.length) {
      this.villageMesh = new THREE.Mesh(M.worldUV(M.merge(parts)), M.vcGrainMat);
      this.villageMesh.castShadow = this.villageMesh.receiveShadow = true;
      this.scene.add(this.villageMesh);
    }
  }

  // ------------------------------------------------------------ Vegetation: verschneite Fichten und Birken
  get treeDefs() {
    const snowSpruce = (detail) => {
      const p = F.spruceParts(detail);
      const n = detail ? 6 : 4;
      for (let i = 0; i < n; i++) { const t = i / n; p.push(M.P(new THREE.ConeGeometry(2.6 * (1 - t * 0.75), 2.2, detail ? 9 : 6), 0xeef2f5, [0, 4.8 + t * 13, 0])); }
      return p;
    };
    const birch = (detail) => [
      M.P(new THREE.CylinderGeometry(0.14, 0.22, 7, detail ? 7 : 5), 0xd8d4c8, [0, 3.5, 0]),
      M.P(new THREE.IcosahedronGeometry(1, 0), 0x7a6a58, [0, 7.5, 0], [0, 0, 0], [2.4, 2.6, 2.4]),
      M.P(new THREE.IcosahedronGeometry(1, 0), 0xe8ecef, [0, 8.6, 0], [0, 0, 0], [1.8, 1.0, 1.8]),
    ];
    return [
      { geo: M.merge(snowSpruce(false)), near: M.merge(snowSpruce(true)), top: 19, r: 3.0, w: 0.65 },
      { geo: M.merge(birch(false)), near: M.merge(birch(true)), top: 9, r: 2.6, w: 0.35 },
      { geo: M.merge(birch(false)), top: 9, r: 2.6, w: 0 },
    ];
  }

  // Schnee wird überall aufgewirbelt (Whiteout), nur nicht auf dem Flugdeck oder über Wasser
  dustAt(x, z) { return this.shipDeck(x, z) !== null || super.height(x, z) < 0.5 ? 0 : 1; }
  coverAt() { return 0.1; }
  ambushSpot() { return false; }

  // ------------------------------------------------------------ Seegang und kurze Tage
  update(dt, t, camera) {
    super.update(dt, t, camera);
    const s = this.ship;
    if (s && s.group) {
      s.pitch = 0.03 * Math.sin(t * 0.55) + 0.012 * Math.sin(t * 1.3);
      s.roll = 0.05 * Math.sin(t * 0.42 + 1) + 0.015 * Math.sin(t * 1.1);
      s.heave = 0.6 * Math.sin(t * 0.7);
      s.group.position.y = s.heave;
      s.group.rotation.x = s.pitch;
      s.group.rotation.z = s.roll;
    }
  }

  // Tageslicht 0..1: kurze Tage – 7 Minuten Tag, Dämmerung, 5 Minuten Nacht
  daylight(t) {
    const P = 900, ph = ((t % P) + P) % P;
    return 1 - smoothstep(420, 510, ph) + smoothstep(810, 895, ph);
  }
}
