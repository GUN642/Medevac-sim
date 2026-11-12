// Bodeneinheiten: wartende Passagiere, Verteidiger, Krankenträger, Vietcong/NVA
import * as THREE from './lib/three.module.min.js';
import { Figure, buildLitter, vcMat, merge } from './models.js';
import { vehicleParts } from './afgModels.js';
import { HALF, HELI } from './config.js';
import { rand, clamp, dist2, bearing, dirName } from './util.js';

// Feinde eröffnen das Feuer erst innerhalb von 400 m (darüber trifft mit Handwaffen niemand)
const ENEMY_RANGE = 400;
import { T, figFor } from './theme.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const litterGeo = buildLitter();
const mgGeo = new THREE.BoxGeometry(0.15, 0.15, 1.6);
const mgMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
const vehGeo = {};
const crateGeo = new THREE.BoxGeometry(0.75, 0.5, 0.5);
const crateMat = new THREE.MeshLambertMaterial({ color: 0x55603a });

let uid = 1;

// Pose-Bits für die Netzwerk-Übertragung
const P_KNEEL = 1, P_MOVE = 2, P_DEAD = 4, P_DOWN = 8, P_REVEAL = 16;

export class Units {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.enemies = [];
    this.friendlies = [];
    this.pax = [];      // wartende/einsteigende Passagiere
    this.walkers = [];  // aussteigende Passagiere
    this.patrols = [];
    this.mirror = new Map(); // Client: id -> Einheit
  }

  // ------------------------------------------------------------ Darstellung
  // vis: 'L' Trage mit Trägern, 'F:typ' Soldat, 'E:typ' Feind, 'H:typ' Feind mit schwerem MG
  makeVisual(vis) {
    const u = { vis, figs: [] };
    if (vis[0] === 'V') {
      // Fahrzeug mit Fahrer und MG-Schütze (eigenes Material zum Abdunkeln nach Zerstörung)
      const kind = vis.slice(2);
      const g = new THREE.Group();
      const mat = vcMat.clone();
      const body = new THREE.Mesh(vehGeo[kind] || (vehGeo[kind] = merge(vehicleParts(kind))), mat);
      body.castShadow = true;
      g.add(body);
      const gunner = new Figure(T.enemy(true));
      if (kind === 'truck') { gunner.group.position.set(0, 2.15, -1.7); gunner.sit(0, 0.86); }
      else { gunner.group.position.set(0, 0.92, 1.5); }
      g.add(gunner.group);
      u.figs = [];
      u.crew = [gunner];
      u.mat = mat;
      u.obj = g;
      this.scene.add(g);
      return u;
    }
    if (vis === 'C') {
      // Soldat trägt eine Nachschubkiste
      const f = new Figure(T.friend());
      const crate = new THREE.Mesh(crateGeo, crateMat);
      crate.position.set(0, 1.15, -0.4);
      f.group.add(crate);
      u.figs = [f];
      u.obj = f.group;
      this.scene.add(u.obj);
      return u;
    }
    if (vis === 'L') {
      const g = new THREE.Group();
      const litter = new THREE.Mesh(litterGeo, vcMat);
      const pat = new Figure(T.wounded);
      pat.group.rotation.x = Math.PI / 2;
      pat.group.position.set(0, 0.8, -0.85);
      const b1 = new Figure(T.friend()), b2 = new Figure(T.friend());
      b1.group.position.set(0, 0, -1.35);
      b2.group.position.set(0, 0, 1.35);
      g.add(litter, pat.group, b1.group, b2.group);
      u.figs = [b1, b2];
      u.obj = g;
      u.litter = litter; u.pat = pat;
    } else {
      const [k, type] = vis.split(':');
      const f = new Figure(type);
      if (k === 'H') {
        const mg = new THREE.Mesh(mgGeo, mgMat);
        mg.position.set(0, 1.0, -0.8);
        mg.rotation.x = 0.5;
        f.group.add(mg);
      }
      u.figs = [f];
      u.obj = f.group;
    }
    this.scene.add(u.obj);
    return u;
  }

  setPose(u, flags) {
    u.pose = flags;
    if (u.litter) {
      const down = flags & P_DOWN;
      u.litter.position.y = down ? -0.5 : 0;
      u.pat.group.position.y = down ? 0.3 : 0.8;
      for (const f of u.figs) (down ? f.kneel() : f.stand());
    } else if (u.figs[0]) {
      if (flags & P_KNEEL) u.figs[0].kneel(); else u.figs[0].stand();
    }
  }

  removeUnit(u) {
    if (u.obj) this.scene.remove(u.obj);
    if (u.fire) { this.game.effects.removeEmitter(u.fire); u.fire = null; }
  }

  place(u, x, z) {
    u.x = x; u.z = z;
    u.y = Math.max(0.05, this.game.world.height(x, z));
    u.obj.position.set(x, u.y, z);
  }

  // Wartender Passagier (Soldat, Verwundeter auf Trage, Pilot)
  spawnPassenger(kind, x, z, missionId) {
    const type = kind === 'walking' ? T.wounded : kind === 'pilot' ? T.pilot : kind === 'sof' ? T.sof : kind === 'vip' ? T.vip : T.friend();
    const u = this.makeVisual(kind === 'litter' ? 'L' : kind === 'cargo' ? 'C' : 'F:' + type);
    Object.assign(u, { id: uid++, kind, missionId, state: 'wait', x, z, y: 0 });
    u.speed = kind === 'litter' ? 1.7 : kind === 'walking' ? 1.4 : kind === 'pilot' ? 3.0 : 3.6;
    this.setPose(u, kind === 'litter' ? P_DOWN : kind === 'troop' || kind === 'sof' ? P_KNEEL : 0);
    u.paxType = kind === 'litter' || kind === 'walking' ? 'wounded' : kind === 'pilot' ? 'pilot' : ['sof', 'cargo', 'vip'].includes(kind) ? kind : 'us';
    this.place(u, x, z);
    u.obj.rotation.y = rand() * Math.PI * 2;
    this.pax.push(u);
    return u;
  }

  spawnDefenders(site, n, missionId) {
    const list = [];
    for (let i = 0; i < n; i++) {
      let a = (i / n) * Math.PI * 2 + rand() * 0.4;
      let r = site.hard ? site.r + 3 + rand() * 6 : 24 + rand() * 14;
      // nicht im Wasser aufstellen
      for (let k = 0; k < 8 && this.game.world.height(site.x + Math.cos(a) * r, site.z + Math.sin(a) * r) < 0.4; k++) { a += 0.8; r *= 0.9; }
      const u = this.makeVisual('F:' + T.friend());
      Object.assign(u, { id: uid++, kind: 'defender', missionId, fireT: rand() * 3, burst: 0, shotT: 0, x: 0, z: 0, y: 0, site });
      this.place(u, site.x + Math.cos(a) * r, site.z + Math.sin(a) * r);
      u.obj.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); // nach außen schauen
      this.setPose(u, P_KNEEL);
      this.friendlies.push(u);
      list.push(u);
    }
    return list;
  }

  spawnEnemies(cx, cz, n, opts = {}) {
    if (T.peaceful) return [];   // Katastropheneinsatz: keine Feinde
    const w = this.game.world;
    const list = [];
    let tries = 0;
    while (list.length < n && tries++ < n * 20) {
      const a = rand() * Math.PI * 2;
      const rMin = opts.rMin ?? 110, rMax = opts.rMax ?? 260;
      const r = rMin + rand() * (rMax - rMin);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.abs(x) > HALF - 100 || Math.abs(z) > HALF - 100) continue;
      if (w.height(x, z) < 1) continue;
      if (!opts.nearFob && dist2(x, z, w.fob.x, w.fob.z) < 700) continue;
      const heavy = opts.heavy && list.length === 0;
      const type = T.enemy(heavy);
      const e = this.makeVisual((heavy ? 'H:' : 'E:') + type);
      Object.assign(e, {
        id: uid++, kind: 'enemy', alive: true, heavy,
        fireT: 1 + rand() * 4, burst: 0, shotT: 0, reveal: 0, suppress: 0, deadT: 0,
        x: 0, z: 0, y: 0, missionId: opts.missionId, patrol: opts.patrol || null,
        range: ENEMY_RANGE,
      });
      this.place(e, x, z);
      e.cover = w.coverAt(x, z);
      e.obj.rotation.y = Math.atan2(-(cx - x), -(cz - z));
      this.setPose(e, heavy || rand() < 0.5 ? P_KNEEL : 0);
      this.enemies.push(e);
      list.push(e);
    }
    return list;
  }

  // Feindfahrzeuge (Pickup mit DShK bzw. Lkw), fahren an und schießen mit schwerem MG
  spawnVehicles(cx, cz, n, opts = {}) {
    if (T.peaceful) return [];
    const w = this.game.world;
    const kind = T.id === 'afghanistan' || T.id === 'mali' ? 'technical' : T.id === 'ukraine' ? 'bmp' : 'truck';
    const list = [];
    let tries = 0;
    while (list.length < n && tries++ < n * 30) {
      const a = rand() * Math.PI * 2, r = (opts.rMin ?? 380) + rand() * ((opts.rMax ?? 650) - (opts.rMin ?? 380));
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.abs(x) > HALF - 150 || Math.abs(z) > HALF - 150 || w.height(x, z) < 1) continue;
      if (w.normal(x, z).y < 0.93 || w.inForest(x, z) > 0.3) continue;
      if (!opts.nearFob && dist2(x, z, w.fob.x, w.fob.z) < 600) continue;
      const e = this.makeVisual('V:' + kind);
      Object.assign(e, {
        id: uid++, kind: 'enemy', alive: true, heavy: true, vehicle: true, hp: 10,
        fireT: 2 + rand() * 3, burst: 0, shotT: 0, reveal: 0, suppress: 0, deadT: 0,
        x: 0, z: 0, y: 0, missionId: opts.missionId, range: ENEMY_RANGE, speed: 9, cover: 0,
      });
      this.place(e, x, z);
      // anfahren bis auf etwa 150–220 m an den Einsatzort
      const to = opts.to || { x: cx, z: cz };
      const aa = Math.atan2(z - to.z, x - to.x) + rand.range(-0.4, 0.4), rr = opts.stop ?? 150 + rand() * 70;
      e.dest = opts.roam ? null : { x: to.x + Math.cos(aa) * rr, z: to.z + Math.sin(aa) * rr };
      e.roam = !!opts.roam;
      e.obj.rotation.y = Math.atan2(-(cx - x), -(cz - z));
      this.enemies.push(e);
      list.push(e);
    }
    return list;
  }

  // Herumfahrende Fahrzeuge zwischen Dörfern und Landezonen
  spawnVehiclePatrols(n) {
    const w = this.game.world;
    for (let i = 0; i < n; i++) {
      const v = rand.pick(w.villages.length ? w.villages : w.sites);
      this.spawnVehicles(v.x, v.z, 1, { rMin: 60, rMax: 200, roam: true });
    }
  }

  damageEnemy(e, n) {
    if (!e.alive) return;
    e.hp = (e.hp ?? 1) - n;
    e.reveal = Math.max(e.reveal || 0, 5);
    if (e.hp <= 0) this.killEnemy(e);
  }

  // Verstreute Feindpatrouillen im Dschungel (Gefahr beim Tiefflug)
  spawnPatrols(count) {
    const w = this.game.world;
    let tries = 0;
    while (this.patrols.length < count && tries++ < 400) {
      const x = rand.range(-HALF + 300, HALF - 300), z = rand.range(-HALF + 300, HALF - 300);
      if (dist2(x, z, w.fob.x, w.fob.z) < 1100) continue;
      if (!w.ambushSpot(x, z)) continue;
      if (w.sites.some((s) => dist2(s.x, s.z, x, z) < 220)) continue;
      const p = { x, z, members: [] };
      p.members = this.spawnEnemies(x, z, 3 + Math.floor(rand() * 5), { rMin: 0, rMax: 35, patrol: p, heavy: rand() < 0.25 });
      for (const e of p.members) e.range = ENEMY_RANGE;
      this.patrols.push(p);
    }
  }

  // Wachposten am Sandsackwall der FOB
  spawnFobDefenders() {
    const f = this.game.world.fob;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.13;
      const u = this.makeVisual('F:' + T.friend());
      Object.assign(u, { id: uid++, kind: 'defender', missionId: 'fob', fireT: rand() * 3, burst: 0, shotT: 0, x: 0, z: 0, y: 0, engage: true });
      this.place(u, f.x + Math.cos(a) * 199, f.z + Math.sin(a) * 199);
      u.obj.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
      this.setPose(u, P_KNEEL);
      this.friendlies.push(u);
    }
  }

  // Angriffswellen des Vietcong auf die FOB (Host / Einzelspieler)
  updateFobAttack(dt) {
    const g = this.game;
    if (T.peaceful) return;
    if (this.attackT === undefined) this.attackT = 150 + rand() * 90;
    this.updateRaid(dt);
    if (!this.attack) {
      if (!g.started) return;
      this.attackT -= dt;
      if (this.attackT <= 0) this.startFobAttack();
      return;
    }
    const alive = this.attack.members.filter((e) => e.alive).length;
    if (alive === 0) {
      g.radio('TOC: Angriff abgewehrt! Gute Arbeit – die FOB ist sicher.', 'TOC');
      g.stats.score += 300;
      g.hud.showResult({ title: 'FOB VERTEIDIGT', lines: [['Angreifer ausgeschaltet', `${this.attack.members.length}`], ['Gesamt', '300 Punkte']] });
      this.attack = null;
      this.attackT = 240 + rand() * 200;
    } else if (alive <= 2 && !this.attack.fleeing) {
      this.attack.fleeing = true;
      g.radio('TOC: Der Feind zieht sich zurück – letzte Angreifer stellen!', 'TOC');
    }
  }

  // Fahrzeugangriffe: Technicals bzw. Lkw mit schweren MGs fahren auf die FOB zu
  // – Panzerfäuste an der Mauer und die MG-Stellungen sind die Antwort
  updateRaid(dt) {
    const g = this.game;
    if (this.raidT === undefined) this.raidT = 90 + rand() * 60;
    if (!this.raid) {
      if (!g.started || this.attack) return;
      this.raidT -= dt;
      if (this.raidT <= 0) this.startRaid();
      return;
    }
    if (this.raid.members.every((e) => !e.alive)) {
      g.radio('TOC: Alle Feindfahrzeuge vernichtet – Fahrzeugangriff abgewehrt!', 'TOC');
      g.stats.score += 200;
      g.hud.showResult({ title: 'FAHRZEUGANGRIFF ABGEWEHRT', lines: [['Fahrzeuge zerstört', `${this.raid.members.length}`], ['Gesamt', '200 Punkte']] });
      this.raid = null;
      this.raidT = 170 + rand() * 150;
    }
  }

  startRaid() {
    const g = this.game, f = g.world.fob;
    this.raids = (this.raids || 0) + 1;
    let cx = 0, cz = 0, members = [];
    const n = Math.min(5, 2 + Math.floor(rand() * 2) + Math.floor(this.raids / 2));
    // mehrere Richtungen versuchen (im Dschungel ist nicht überall Platz für Fahrzeuge)
    for (let k = 0; k < 12 && !members.length; k++) {
      const a = rand() * Math.PI * 2, d = 560 + rand() * 160;
      cx = f.x + Math.cos(a) * d; cz = f.z + Math.sin(a) * d;
      if (g.world.height(cx, cz) <= 1 || Math.abs(cx) > HALF - 150 || Math.abs(cz) > HALF - 150) continue;
      members = this.spawnVehicles(cx, cz, n, { rMin: 0, rMax: 160, nearFob: true, missionId: 'fob', stop: 215 + rand() * 40, to: f });
    }
    if (!members.length) { this.raidT = 60; return; }
    for (const e of members) { e.range = 520; e.fob = true; }
    this.raid = { members };
    const dir = dirName(bearing(f.x, f.z, cx, cz));
    g.radio(`TOC: ALARM! ${members.length} Feindfahrzeuge mit schweren MGs greifen die ${f.name} aus Richtung ${dir} an! Panzerfäuste an der Mauer aufnehmen, MG-Stellungen besetzen!`, 'TOC', true);
  }

  startFobAttack() {
    const g = this.game, f = g.world.fob;
    this.waves = (this.waves || 0) + 1;
    let a = 0, cx = 0, cz = 0;
    for (let k = 0; k < 20; k++) {
      a = rand() * Math.PI * 2;
      cx = f.x + Math.cos(a) * 440; cz = f.z + Math.sin(a) * 440;
      if (g.world.height(cx, cz) > 1 && Math.abs(cx) < HALF - 150 && Math.abs(cz) < HALF - 150) break;
    }
    const n = Math.min(32, 12 + Math.floor(rand() * 8) + this.waves * 2);
    const members = this.spawnEnemies(cx, cz, n, { rMin: 0, rMax: 70, nearFob: true, missionId: 'fob', heavy: this.waves > 1 });
    for (const e of members) {
      const aa = a + rand.range(-0.4, 0.4), rr = 228 + rand() * 40;
      e.advance = { x: f.x + Math.cos(aa) * rr, z: f.z + Math.sin(aa) * rr };
      e.range = ENEMY_RANGE;
      e.fireT = 6 + rand() * 6;
      this.setPose(e, 0);
    }
    members.push(...this.spawnVehicles(cx, cz, 1 + Math.floor(rand() * 2) + Math.min(2, Math.floor(this.waves / 2)), { rMin: 0, rMax: 80, nearFob: true, missionId: 'fob', stop: 240, to: f }));
    this.attack = { members, dir: dirName(bearing(f.x, f.z, cx, cz)) };
    g.radio(`TOC: ALARM! Feindangriff auf die ${f.name} aus Richtung ${this.attack.dir}! Etwa ${n} Mann – alle verfügbaren Kräfte zur Verteidigung!`, 'TOC', true);
  }

  refreshPatrols() {
    // vernichtete Patrouillen werden irgendwo anders neu aufgestellt
    const helis = this.game.helis;
    this.patrols = this.patrols.filter((p) => p.members.some((e) => e.alive) || helis.some((h) => dist2(p.x, p.z, h.pos.x, h.pos.z) < 1500));
    this.spawnPatrols(26);
  }

  // ------------------------------------------------------------ Aufräumen
  clearMission(missionId) {
    const keep = (u) => {
      if (u.missionId === missionId) { this.removeUnit(u); return false; }
      return true;
    };
    this.pax = this.pax.filter(keep);
    this.friendlies = this.friendlies.filter(keep);
    this.enemies = this.enemies.filter(keep);
  }

  clearAll() {
    for (const list of [this.pax, this.friendlies, this.enemies, this.walkers]) for (const u of list) this.removeUnit(u);
    for (const u of this.mirror.values()) this.removeUnit(u);
    this.mirror.clear();
    this.pax = []; this.friendlies = []; this.enemies = []; this.walkers = []; this.patrols = [];
  }

  killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    e.deadT = 0;
    if (e.vehicle) this.wreckVehicle(e);
    this.game.stats.kills++;
    this.game.onEnemyKilled(e);
    if (this.game.role === 'client') this.game.net.send({ t: 'kill', id: e.id });
  }

  // ------------------------------------------------------------ Aussteigen
  // Passagier verlässt den Hubschrauber und läuft zu einem Ziel
  spawnWalker(paxType, from, to, onArrive) {
    const type = figFor(paxType);
    const u = this.makeVisual(paxType === 'wounded' && rand() < 0.6 ? 'L' : paxType === 'cargo' ? 'C' : 'F:' + type);
    u.id = uid++;
    u.speed = u.vis === 'L' ? 1.7 : paxType === 'wounded' ? 1.4 : paxType === 'cargo' ? 2.4 : 3.4;
    this.setPose(u, 0);
    u.state = 'exit';
    u.target = to;
    u.onArrive = onArrive;
    this.place(u, from.x, from.z);
    this.walkers.push(u);
    return u;
  }

  // Einheit auf ein Ziel zubewegen; true wenn angekommen
  moveTo(u, tx, tz, dt, reach) {
    const dx = tx - u.x, dz = tz - u.z;
    const d = Math.hypot(dx, dz);
    if (d < reach) return true;
    const sp = Math.min(u.speed, d / dt);
    u.x += (dx / d) * sp * dt; u.z += (dz / d) * sp * dt;
    u.y = Math.max(0.05, this.game.world.height(u.x, u.z));
    u.obj.position.set(u.x, u.y, u.z);
    u.obj.rotation.y = Math.atan2(-dx, -dz);
    u.moving = true;
    for (const f of u.figs) f.walk(dt, u.speed);
    return false;
  }

  // ------------------------------------------------------------ Update (Host / Einzelspieler)
  update(dt) {
    const g = this.game, w = g.world, M = g.missions;
    const m = M.current;
    const helis = g.helis;

    // Passagiere
    for (let i = this.pax.length - 1; i >= 0; i--) {
      const u = this.pax[i];
      u.moving = false;
      if (u.state === 'wait' || u.state === 'hold') {
        if (u.missionId === m?.id) {
          const h = this.nearestBoardable(u, M);
          if (h) {
            u.heli = h;
            if (u.state === 'wait') this.setPose(u, 0);
            u.state = 'board';
          }
        }
      }
      if (u.state === 'board') {
        const h = u.heli;
        if (!M.canBoard(h)) { u.state = 'hold'; continue; }
        const lp = h.doorPoint('left', _a), rp = h.doorPoint('right', _b);
        const door = dist2(u.x, u.z, lp.x, lp.z) < dist2(u.x, u.z, rp.x, rp.z) ? lp : rp;
        if (this.moveTo(u, door.x, door.z, dt, 1.2)) {
          this.removeUnit(u);
          this.pax.splice(i, 1);
          M.onBoard(u, h);
          continue;
        }
      }
      u.obj.visible = g.isNearView(u.x, u.z);
    }

    // Aussteigende
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const u = this.walkers[i];
      u.moving = false;
      if (this.moveTo(u, u.target.x, u.target.z, dt, 1.0)) {
        this.walkers.splice(i, 1);
        if (u.onArrive) u.onArrive(u);
        else this.removeUnit(u);
      }
    }

    // Verteidiger schießen auf Feinde
    for (const u of this.friendlies) {
      const near = g.isNearView(u.x, u.z);
      u.obj.visible = near;
      if (!u.engage) continue;
      u.fireT -= dt;
      if (u.fireT <= 0 && u.burst <= 0) {
        u.fireT = 1.5 + rand() * 3;
        let tgt = null, best = 450;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const d = dist2(e.x, e.z, u.x, u.z);
          if (d < best && rand() < 0.7) { best = d; tgt = e; }
        }
        if (tgt) { u.tgt = tgt; u.burst = 3 + Math.floor(rand() * 4); u.obj.rotation.y = Math.atan2(-(tgt.x - u.x), -(tgt.z - u.z)); }
      }
      if (u.burst > 0) {
        u.shotT -= dt;
        if (u.shotT <= 0) {
          u.shotT = 0.11;
          u.burst--;
          const t = u.tgt;
          if (!t || !t.alive) { u.burst = 0; continue; }
          _a.set(u.x, u.y + 1.0, u.z);
          _b.set(t.x + rand.range(-4, 4), t.y + rand.range(0, 2.5), t.z + rand.range(-4, 4));
          if (g.isNearAny(u.x, u.z)) g.groundShot(_a, _b, 0, u.burst % 2 === 0, null);
          if (u.burst === 0 && rand() < 0.05) this.killEnemy(t);
          t.suppress = Math.max(t.suppress, 1.2);
        }
      }
    }

    // Feinde
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const near = g.isNearView(e.x, e.z);
      e.obj.visible = near;
      if (!e.alive) {
        this.animateDead(e, dt);
        if (e.deadT > 30) { this.removeUnit(e); this.enemies.splice(i, 1); }
        continue;
      }
      e.moving = false;
      if (e.vehicle) {
        // Fahrzeug: zum Ziel fahren, unterwegs feuern; Streifenwagen suchen sich neue Ziele
        if (!e.dest && e.roam) {
          e.wait = (e.wait ?? 10 + rand() * 20) - dt;
          if (e.wait <= 0) {
            e.wait = null;
            const c = rand.pick(w.villages.concat(w.sites).filter((v) => dist2(v.x, v.z, e.x, e.z) < 1800 && dist2(v.x, v.z, w.fob.x, w.fob.z) > 700));
            if (c) e.dest = { x: c.x + rand.range(-80, 80), z: c.z + rand.range(-80, 80) };
          }
        }
        if (e.dest) {
          const nx = e.x + Math.sign(e.dest.x - e.x) * 4, nz = e.z + Math.sign(e.dest.z - e.z) * 4;
          if (w.height(nx, nz) < 0.5) e.dest = null;   // nicht in den Fluss fahren
          else if (this.moveTo(e, e.dest.x, e.dest.z, dt, 6)) e.dest = null;
        }
      }
      if (e.advance && e.burst <= 0) {
        e.speed = 2.6;
        if (this.moveTo(e, e.advance.x, e.advance.z, dt, 1.5)) { e.advance = null; this.setPose(e, P_KNEEL); }
      }
      e.reveal = Math.max(0, e.reveal - dt);
      e.suppress = Math.max(0, e.suppress - dt);
      let dmin = 1e9;
      for (const h of helis) dmin = Math.min(dmin, Math.hypot(h.pos.x - e.x, h.pos.y - e.y, h.pos.z - e.z));
      if (dmin > 2500 && !near) continue;
      e.fireT -= dt * (e.suppress > 0 ? 0.3 : 1);
      if (e.fireT <= 0 && e.burst <= 0) {
        e.fireT = e.heavy ? 2.5 + rand() * 3 : 2 + rand() * 3.5;
        e.tgt = null;
        let bestD = e.range;
        for (const h of helis) {
          if (h.crashed) continue;
          const dh = Math.hypot(h.pos.x - e.x, h.pos.y - e.y, h.pos.z - e.z);
          if (dh < bestD && (!e.patrol || h.agl < 450) && w.los(e.x, e.y + 1.5, e.z, h.pos.x, h.pos.y, h.pos.z)) { bestD = dh; e.tgt = h; }
        }
        for (const ft of g.footTargets()) {
          const sp = ft.s.pos;
          const ds = Math.hypot(sp.x - e.x, sp.y - e.y, sp.z - e.z);
          if (ds < Math.min(bestD, ENEMY_RANGE) && w.los(e.x, e.y + 1.5, e.z, sp.x, sp.y + 1.4, sp.z)) { bestD = ds; e.tgt = ft; }
        }
        if (!e.tgt && (m || e.missionId === 'fob')) {
          let best = 350;
          for (const f of this.friendlies) {
            const d = dist2(f.x, f.z, e.x, e.z);
            if (d < best) { best = d; e.tgt = f; }
          }
        }
        if (e.tgt) {
          e.burst = e.heavy ? 6 + Math.floor(rand() * 6) : 3 + Math.floor(rand() * 5);
          const tp = e.tgt.pos || (e.tgt.s && e.tgt.s.pos) || e.tgt;
          e.obj.rotation.y = Math.atan2(-(tp.x - e.x), -(tp.z - e.z));
        }
      }
      if (e.burst > 0) {
        e.shotT -= dt;
        if (e.shotT <= 0) {
          e.shotT = e.heavy ? 0.11 : 0.1;
          e.burst--;
          e.reveal = 7;
          this.enemyShot(e, g.isNearAny(e.x, e.z));
        }
      }
    }
  }

  nearestBoardable(u, M) {
    let best = null, bd = 1e9;
    for (const h of this.game.helis) {
      if (!M.canBoard(h)) continue;
      const d = dist2(u.x, u.z, h.pos.x, h.pos.z);
      if (d < M.boardRadius() + 30 && d < bd) { bd = d; best = h; }
    }
    return best;
  }

  // Fahrzeug zerstört: Explosion, ausgebranntes Wrack, Feuer
  wreckVehicle(e) {
    if (e.wrecked) return;
    e.wrecked = true;
    const g = this.game;
    g.effects.explosion(e.x, e.y + 1.2, e.z, 1.3);
    g.audio.boom(g.camera.position.distanceTo(_a.set(e.x, e.y, e.z)));
    if (e.mat) e.mat.color.setRGB(0.22, 0.2, 0.18);
    for (const f of e.crew || []) f.group.visible = false;
    e.fire = g.effects.wreckFire(e.x, e.y, e.z);
  }

  animateDead(e, dt) {
    e.deadT += dt;
    if (e.vehicle) {
      this.wreckVehicle(e);
      if (e.deadT > 25 && e.fire) { this.game.effects.removeEmitter(e.fire); e.fire = null; }
      return;
    }
    const f = e.figs[0];
    f.group.rotation.x = -Math.min(Math.PI / 2, e.deadT * 5);
    f.group.position.y = e.y + 0.15 * Math.min(1, e.deadT * 5);
  }

  enemyShot(e, near) {
    const g = this.game;
    _a.set(e.x, e.y + (e.vehicle ? (e.vis === 'V:truck' ? 3.2 : 1.9) : e.heavy ? 1.1 : 1.4), e.z);
    const h = e.tgt && e.tgt.pos ? e.tgt : null;
    if (e.tgt && e.tgt.s) {
      // Spieler zu Fuß
      const S = e.tgt.s, sp = S.pos;
      const dist = Math.hypot(sp.x - e.x, sp.y - e.y, sp.z - e.z);
      let p = 0.06 * clamp(1.2 - dist / 380, 0.15, 1);
      p *= S.crouch ? 0.55 : 1;
      p *= S.moving ? 0.7 : 1;
      p *= g.settings.difficulty * (g.nightSys && g.nightSys.night ? 0.7 : 1);
      if (!S.alive) return;
      if (rand() < p) {
        _b.set(sp.x + rand.range(-0.2, 0.2), sp.y + 1.1, sp.z + rand.range(-0.2, 0.2));
        const dmg = (e.heavy ? 30 : 9) + rand() * 10;
        const pid = e.tgt.pid;
        g.groundShot(_a, _b, e.heavy ? 2 : 1, true, () => g.damageSoldier(pid, dmg));
      } else {
        _b.set(rand.range(-1, 1), rand.range(-0.3, 1), rand.range(-1, 1)).normalize().multiplyScalar(1.5 + rand() * 5).add(sp);
        _b.sub(_a).normalize().multiplyScalar(dist + 80).add(_a);
        g.groundShot(_a, _b, e.heavy ? 2 : 1, rand() < 0.5, null);
      }
      return;
    }
    if (h) {
      const dist = Math.hypot(h.pos.x - e.x, h.pos.y - e.y, h.pos.z - e.z);
      const sp = h.speed;
      let p = (e.heavy ? 0.13 : 0.11) * clamp(1.15 - dist / e.range, 0.12, 1);
      p *= sp < 6 ? 1.5 : sp < 20 ? 1.0 : sp < 40 ? 0.6 : 0.4;
      p *= h.onGround ? 1.15 : 1;
      p *= g.settings.difficulty * (g.nightSys && g.nightSys.night ? 0.7 : 1);
      const hit = rand() < p;
      if (hit) {
        _b.set(h.pos.x + rand.range(-1.2, 1.2), h.pos.y + rand.range(-0.8, 1.0), h.pos.z + rand.range(-2, 3));
        const dmg = e.heavy ? 3.5 + rand() * 3 : 0.9 + rand() * 1.4;
        const hp = _b.clone();
        g.groundShot(_a, _b, e.heavy ? 2 : 1, true, () => g.damageHeli(h, dmg, hp));
      } else {
        // Fehlschuss: an der Maschine vorbei
        _b.set(rand.range(-1, 1), rand.range(-0.6, 1), rand.range(-1, 1)).normalize().multiplyScalar(5 + rand() * 18).add(h.pos);
        _b.sub(_a).normalize().multiplyScalar(dist + 120).add(_a);
        g.groundShot(_a, _b, e.heavy ? 2 : 1, rand() < 0.6, null);
      }
    } else if (e.tgt && near) {
      _b.set(e.tgt.x + rand.range(-5, 5), e.tgt.y + rand.range(0, 2), e.tgt.z + rand.range(-5, 5));
      g.groundShot(_a, _b, 1, rand() < 0.5, null);
    }
  }

  // ------------------------------------------------------------ Netzwerk
  snapshot() {
    const out = [];
    const r = (v) => Math.round(v * 10) / 10;
    const add = (u, flags) => out.push(u.id, u.vis, r(u.x), r(u.z), Math.round(u.obj.rotation.y * 100) / 100, flags);
    for (const u of this.pax) add(u, (u.pose & (P_KNEEL | P_DOWN)) | (u.moving ? P_MOVE : 0));
    for (const u of this.walkers) add(u, u.moving ? P_MOVE : 0);
    for (const u of this.friendlies) add(u, u.pose & P_KNEEL);
    for (const e of this.enemies) add(e, (e.pose & P_KNEEL) | (e.alive ? 0 : P_DEAD) | (e.reveal > 0 ? P_REVEAL : 0) | (e.moving ? P_MOVE : 0));
    return out;
  }

  // Client: Einheiten nach den Daten des Hosts darstellen
  applySnapshot(arr) {
    const seen = new Set();
    for (let i = 0; i < arr.length; i += 6) {
      const id = arr[i], vis = arr[i + 1], x = arr[i + 2], z = arr[i + 3], ry = arr[i + 4], fl = arr[i + 5];
      seen.add(id);
      let u = this.mirror.get(id);
      if (!u || u.vis !== vis) {
        if (u) this.removeUnit(u);
        u = this.makeVisual(vis);
        u.id = id;
        u.speed = 3;
        u.isEnemy = vis[0] === 'E' || vis[0] === 'H' || vis[0] === 'V';
        u.vehicle = vis[0] === 'V';
        u.hp = 10;
        u.heavy = vis[0] === 'H';
        u.alive = true;
        u.deadT = 0;
        this.place(u, x, z);
        this.mirror.set(id, u);
        this.setPose(u, fl & (P_KNEEL | P_DOWN));
      }
      u.tx = x; u.tz = z; u.ry = ry;
      u.netMove = !!(fl & P_MOVE);
      if ((u.pose & (P_KNEEL | P_DOWN)) !== (fl & (P_KNEEL | P_DOWN)) && !(fl & P_DEAD)) this.setPose(u, fl & (P_KNEEL | P_DOWN));
      u.reveal = fl & P_REVEAL ? 1 : 0;
      if (fl & P_DEAD) u.alive = false;
    }
    for (const [id, u] of this.mirror) if (!seen.has(id)) { this.removeUnit(u); this.mirror.delete(id); }
    this.enemies = [...this.mirror.values()].filter((u) => u.isEnemy);
  }

  updateMirror(dt) {
    for (const u of this.mirror.values()) {
      if (u.tx === undefined) continue;
      const dx = u.tx - u.x, dz = u.tz - u.z;
      const d = Math.hypot(dx, dz);
      if (d > 30) { u.x = u.tx; u.z = u.tz; }
      else { const k = Math.min(1, dt * 6); u.x += dx * k; u.z += dz * k; }
      u.y = Math.max(0.05, this.game.world.height(u.x, u.z));
      u.obj.position.set(u.x, u.y, u.z);
      u.obj.rotation.y = u.ry;
      if (u.isEnemy && !u.alive) { this.animateDead(u, dt); continue; }
      if (u.netMove) for (const f of u.figs) f.walk(dt, 3);
      else if (u.wasMoving) this.setPose(u, u.pose);
      u.wasMoving = u.netMove;
      u.obj.visible = this.game.isNearView(u.x, u.z);
    }
  }
}
