// Bodeneinheiten: wartende Passagiere, Verteidiger, Krankenträger, Vietcong/NVA
import * as THREE from './lib/three.module.min.js';
import { Figure, buildLitter, vcMat } from './models.js';
import { HALF, HELI } from './config.js';
import { rand, clamp, dist2 } from './util.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const litterGeo = buildLitter();

let uid = 1;

export class Units {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.enemies = [];
    this.friendlies = [];
    this.pax = [];      // wartende/einsteigende Passagiere
    this.walkers = [];  // aussteigende Passagiere
    this.patrols = [];
  }

  // ------------------------------------------------------------ Erzeugung
  makeFigure(type) {
    const f = new Figure(type);
    this.scene.add(f.group);
    return f;
  }

  removeUnit(u) {
    if (u.obj) this.scene.remove(u.obj);
  }

  place(u, x, z) {
    u.x = x; u.z = z;
    u.y = Math.max(0.05, this.game.world.height(x, z));
    u.obj.position.set(x, u.y, z);
  }

  // Wartender Passagier (Soldat, Verwundeter auf Trage, Pilot)
  spawnPassenger(kind, x, z, missionId) {
    const u = { id: uid++, kind, missionId, state: 'wait', speed: 3.4, x, z, y: 0, figs: [] };
    if (kind === 'litter') {
      const g = new THREE.Group();
      const litter = new THREE.Mesh(litterGeo, vcMat);
      const pat = new Figure('wounded');
      pat.group.rotation.x = Math.PI / 2;
      pat.group.position.set(0, 0.8, -0.85);
      const b1 = new Figure(rand() < 0.3 ? 'us2' : 'us'), b2 = new Figure('us');
      b1.group.position.set(0, 0, -1.35);
      b2.group.position.set(0, 0, 1.35);
      g.add(litter, pat.group, b1.group, b2.group);
      u.figs = [b1, b2];
      u.patient = [litter, pat.group];
      u.obj = g;
      u.speed = 1.7;
      this.scene.add(g);
      // Trage steht zunächst am Boden, Träger knien
      litter.position.y = -0.5; pat.group.position.y = 0.3;
      b1.kneel(); b2.kneel();
      u.litter = litter; u.pat = pat;
    } else {
      const type = kind === 'walking' ? 'wounded' : kind === 'pilot' ? 'pilot' : rand() < 0.25 ? 'us2' : 'us';
      const f = this.makeFigure(type);
      u.figs = [f];
      u.obj = f.group;
      u.speed = kind === 'walking' ? 1.4 : kind === 'pilot' ? 3.0 : 3.6;
      if (kind === 'walking' || kind === 'pilot') f.stand(); else f.kneel();
    }
    u.paxType = kind === 'litter' || kind === 'walking' ? 'wounded' : kind === 'pilot' ? 'pilot' : 'us';
    this.place(u, x, z);
    u.obj.rotation.y = rand() * Math.PI * 2;
    this.pax.push(u);
    return u;
  }

  spawnDefenders(site, n, missionId) {
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.4;
      const r = 24 + rand() * 14;
      const f = this.makeFigure(rand() < 0.25 ? 'us2' : 'us');
      const u = { id: uid++, kind: 'defender', missionId, obj: f.group, figs: [f], fireT: rand() * 3, burst: 0, shotT: 0, x: 0, z: 0, y: 0, site };
      this.place(u, site.x + Math.cos(a) * r, site.z + Math.sin(a) * r);
      f.group.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); // nach außen schauen
      f.kneel();
      this.friendlies.push(u);
      list.push(u);
    }
    return list;
  }

  spawnEnemies(cx, cz, n, opts = {}) {
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
      if (dist2(x, z, w.fob.x, w.fob.z) < 700) continue;
      const heavy = opts.heavy && list.length === 0;
      const f = this.makeFigure(heavy || rand() < 0.4 ? 'nva' : 'vc');
      const e = {
        id: uid++, kind: 'enemy', obj: f.group, figs: [f], alive: true, heavy,
        fireT: 1 + rand() * 4, burst: 0, shotT: 0, reveal: 0, suppress: 0, deadT: 0,
        x: 0, z: 0, y: 0, missionId: opts.missionId, patrol: opts.patrol || null,
        range: heavy ? 1100 : 480,
      };
      this.place(e, x, z);
      e.cover = w.inForest(x, z) > 0.4 ? 0.45 : 0.1;
      f.group.rotation.y = Math.atan2(-(cx - x), -(cz - z));
      if (heavy) {
        // DShK-Stellung: schweres MG auf Dreibein
        const mg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.6), new THREE.MeshLambertMaterial({ color: 0x222222 }));
        mg.position.set(0, 1.0, -0.8);
        mg.rotation.x = 0.5;
        f.group.add(mg);
        f.kneel();
      } else if (rand() < 0.5) f.kneel();
      this.enemies.push(e);
      list.push(e);
    }
    return list;
  }

  // Verstreute Feindpatrouillen im Dschungel (Gefahr beim Tiefflug)
  spawnPatrols(count) {
    const w = this.game.world;
    let tries = 0;
    while (this.patrols.length < count && tries++ < 400) {
      const x = rand.range(-HALF + 300, HALF - 300), z = rand.range(-HALF + 300, HALF - 300);
      if (dist2(x, z, w.fob.x, w.fob.z) < 1100) continue;
      if (w.inForest(x, z) < 0.3) continue;
      if (w.sites.some((s) => dist2(s.x, s.z, x, z) < 350)) continue;
      const p = { x, z, members: [] };
      p.members = this.spawnEnemies(x, z, 2 + Math.floor(rand() * 3), { rMin: 0, rMax: 25, patrol: p, heavy: rand() < 0.15 });
      for (const e of p.members) e.range = e.heavy ? 900 : 420;
      this.patrols.push(p);
    }
  }

  refreshPatrols() {
    // vernichtete Patrouillen werden irgendwo anders neu aufgestellt
    const h = this.game.heli;
    this.patrols = this.patrols.filter((p) => p.members.some((e) => e.alive) || dist2(p.x, p.z, h.pos.x, h.pos.z) < 1500);
    this.spawnPatrols(12);
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
    this.pax = []; this.friendlies = []; this.enemies = []; this.walkers = []; this.patrols = [];
  }

  killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    e.deadT = 0;
    this.game.stats.kills++;
    this.game.onEnemyKilled(e);
  }

  // ------------------------------------------------------------ Aussteigen
  // Passagier verlässt den Hubschrauber und läuft zu einem Ziel
  spawnWalker(paxType, from, to, onArrive) {
    let u;
    if (paxType === 'wounded' && rand() < 0.6) {
      const g = new THREE.Group();
      const litter = new THREE.Mesh(litterGeo, vcMat);
      const pat = new Figure('wounded');
      pat.group.rotation.x = Math.PI / 2;
      pat.group.position.set(0, 0.8, -0.85);
      const b1 = new Figure('us'), b2 = new Figure('us2');
      b1.group.position.set(0, 0, -1.35);
      b2.group.position.set(0, 0, 1.35);
      g.add(litter, pat.group, b1.group, b2.group);
      this.scene.add(g);
      u = { obj: g, figs: [b1, b2], speed: 1.7 };
    } else {
      const type = paxType === 'wounded' ? 'wounded' : paxType === 'pilot' ? 'pilot' : 'us';
      const f = this.makeFigure(type);
      u = { obj: f.group, figs: [f], speed: paxType === 'wounded' ? 1.4 : 3.4 };
    }
    u.state = 'exit';
    u.target = to;
    u.onArrive = onArrive;
    this.place(u, from.x, from.z);
    this.walkers.push(u);
    return u;
  }

  // ------------------------------------------------------------ Update
  update(dt) {
    const g = this.game, h = g.heli, w = g.world;
    const cam = g.camera.position;
    const m = g.missions.current;
    const boardOk = g.missions.canBoard();

    // Passagiere
    for (let i = this.pax.length - 1; i >= 0; i--) {
      const u = this.pax[i];
      if (u.state === 'wait' || u.state === 'hold') {
        if (boardOk && u.missionId === m?.id && dist2(u.x, u.z, h.pos.x, h.pos.z) < g.missions.boardRadius() + 30) {
          if (u.state === 'wait' && u.litter) { u.litter.position.y = 0; u.pat.group.position.y = 0.8; for (const f of u.figs) f.stand(); }
          if (u.state === 'wait' && !u.litter && u.figs[0]) u.figs[0].stand();
          u.state = 'board';
        }
      }
      if (u.state === 'board') {
        if (!boardOk) { u.state = 'hold'; for (const f of u.figs) f.stand(); continue; }
        const lp = h.doorPoint('left', _a), rp = h.doorPoint('right', _b);
        const door = dist2(u.x, u.z, lp.x, lp.z) < dist2(u.x, u.z, rp.x, rp.z) ? lp : rp;
        const dx = door.x - u.x, dz = door.z - u.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.2) {
          this.removeUnit(u);
          this.pax.splice(i, 1);
          g.missions.onBoard(u);
          continue;
        }
        const sp = Math.min(u.speed, d / dt);
        u.x += (dx / d) * sp * dt; u.z += (dz / d) * sp * dt;
        u.y = Math.max(0.05, w.height(u.x, u.z));
        u.obj.position.set(u.x, u.y, u.z);
        u.obj.rotation.y = Math.atan2(-dx, -dz);
        for (const f of u.figs) f.walk(dt, u.speed);
      }
      u.obj.visible = dist2(u.x, u.z, cam.x, cam.z) < 1500;
    }

    // Aussteigende
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const u = this.walkers[i];
      const dx = u.target.x - u.x, dz = u.target.z - u.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.0) {
        this.walkers.splice(i, 1);
        if (u.onArrive) u.onArrive(u);
        else this.removeUnit(u);
        continue;
      }
      const sp = Math.min(u.speed, d / dt);
      u.x += (dx / d) * sp * dt; u.z += (dz / d) * sp * dt;
      u.y = Math.max(0.05, w.height(u.x, u.z));
      u.obj.position.set(u.x, u.y, u.z);
      u.obj.rotation.y = Math.atan2(-dx, -dz);
      for (const f of u.figs) f.walk(dt, u.speed);
    }

    // Verteidiger schießen auf Feinde
    for (const u of this.friendlies) {
      const near = dist2(u.x, u.z, cam.x, cam.z) < 1500;
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
          if (near) {
            g.combat.visualShot(_a, _b, 900, [1, 0.3, 0.18], u.burst % 2 === 0, null);
            g.effects.muzzle(_a.x, _a.y, _a.z);
            if (rand() < 0.5) g.audio.shot('ak', cam.distanceTo(_a) * 1.1);
          }
          if (u.burst === 0 && rand() < 0.05) this.killEnemy(t);
          t.suppress = Math.max(t.suppress, 1.2);
        }
      }
    }

    // Feinde
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const near = dist2(e.x, e.z, cam.x, cam.z) < 1500;
      e.obj.visible = near;
      if (!e.alive) {
        e.deadT += dt;
        const f = e.figs[0];
        f.group.rotation.x = Math.min(Math.PI / 2, e.deadT * 5) * -1;
        f.group.position.y = e.y + 0.15 * Math.min(1, e.deadT * 5);
        if (e.deadT > 30) { this.removeUnit(e); this.enemies.splice(i, 1); }
        continue;
      }
      e.reveal = Math.max(0, e.reveal - dt);
      e.suppress = Math.max(0, e.suppress - dt);
      const dh = Math.hypot(h.pos.x - e.x, h.pos.y - e.y, h.pos.z - e.z);
      if (dh > 2500 && !near) continue;
      e.fireT -= dt * (e.suppress > 0 ? 0.3 : 1);
      if (e.fireT <= 0 && e.burst <= 0) {
        e.fireT = e.heavy ? 2.5 + rand() * 3 : 2 + rand() * 3.5;
        e.tgt = null;
        if (!h.crashed && dh < e.range && (!e.patrol || h.agl < 450) && w.los(e.x, e.y + 1.5, e.z, h.pos.x, h.pos.y, h.pos.z)) e.tgt = 'heli';
        else if (m) {
          let best = 350;
          for (const f of this.friendlies) {
            const d = dist2(f.x, f.z, e.x, e.z);
            if (d < best) { best = d; e.tgt = f; }
          }
        }
        if (e.tgt) {
          e.burst = e.heavy ? 6 + Math.floor(rand() * 6) : 3 + Math.floor(rand() * 5);
          const tp = e.tgt === 'heli' ? h.pos : e.tgt;
          e.obj.rotation.y = Math.atan2(-(tp.x - e.x), -(tp.z - e.z));
        }
      }
      if (e.burst > 0) {
        e.shotT -= dt;
        if (e.shotT <= 0) {
          e.shotT = e.heavy ? 0.11 : 0.1;
          e.burst--;
          e.reveal = 7;
          this.enemyShot(e, dh, near);
        }
      }
    }
  }

  enemyShot(e, dh, near) {
    const g = this.game, h = g.heli;
    _a.set(e.x, e.y + (e.heavy ? 1.1 : 1.4), e.z);
    if (near || dh < 1600) {
      g.effects.muzzle(_a.x, _a.y, _a.z, e.heavy);
      g.audio.shot(e.heavy ? 'dshk' : 'ak', g.camera.position.distanceTo(_a));
    }
    const col = [0.45, 1.0, 0.35];
    if (e.tgt === 'heli') {
      const sp = h.speed;
      const dist = dh;
      let p = (e.heavy ? 0.13 : 0.11) * clamp(1.15 - dist / e.range, 0.12, 1);
      p *= sp < 6 ? 1.5 : sp < 20 ? 1.0 : sp < 40 ? 0.6 : 0.4;
      p *= h.onGround ? 1.15 : 1;
      p *= g.settings.difficulty;
      const hit = rand() < p;
      const speed = e.heavy ? 820 : 715;
      if (hit) {
        _b.set(h.pos.x + rand.range(-1.2, 1.2), h.pos.y + rand.range(-0.8, 1.0), h.pos.z + rand.range(-2, 3));
        const dmg = e.heavy ? 3.5 + rand() * 3 : 0.9 + rand() * 1.4;
        const hp = _b.clone();
        g.combat.visualShot(_a, _b, speed, col, true, () => {
          if (h.crashed) return;
          h.takeDamage(dmg, 'bullet');
          g.effects.sparks(hp.x, hp.y, hp.z);
          g.onHeliHit(dmg, e);
        });
      } else {
        // Fehlschuss: an der Maschine vorbei
        _b.set(rand.range(-1, 1), rand.range(-0.6, 1), rand.range(-1, 1)).normalize().multiplyScalar(5 + rand() * 18).add(h.pos);
        _b.sub(_a).normalize().multiplyScalar(dist + 120).add(_a);
        g.combat.visualShot(_a, _b, speed, col, rand() < 0.6, null);
      }
    } else if (e.tgt && near) {
      _b.set(e.tgt.x + rand.range(-5, 5), e.tgt.y + rand.range(0, 2), e.tgt.z + rand.range(-5, 5));
      g.combat.visualShot(_a, _b, 715, col, rand() < 0.5, null);
    }
  }
}
