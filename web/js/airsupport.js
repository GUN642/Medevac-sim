// Luftunterstützung auf Anforderung: AH-64E (kreist und wirkt mit Kanone/Raketen), F-16C (GBU-12),
// A-10C (Tiefflugangriffe mit der GAU-8), in Vietnam F-4 Phantom (Napalm).
// Der Host simuliert Flugbahnen und Wirkung; Mitspieler erhalten Positionen und Effekte übers Netz.
import * as THREE from './lib/three.module.min.js';
import { buildJet, buildHeliModel } from './heliModels.js';
import { HELI_TYPES, T } from './theme.js';
import { rand, dist2, clamp, bearing, dirName } from './util.js';

export const SUPPORT = {
  ah64: { name: 'AH-64E Apache', call: 'Ugly 2-2', cooldown: 150, desc: 'kreist 75 s über Ihrer Position, Kanone und Raketen' },
  f16: { name: 'F-16C Fighting Falcon', call: 'Viper 1-1', cooldown: 120, desc: 'lasergelenkte 250-kg-Bombe (GBU-12)' },
  a10: { name: 'A-10C Thunderbolt II', call: 'Hog 2-1', cooldown: 120, desc: 'zwei Tiefflug-Angriffe mit der 30-mm-Kanone' },
  f4: { name: 'F-4 Phantom', call: 'Gunfighter 4', cooldown: 120, desc: 'Napalm-Abwurf entlang der Feindstellung' },
};
const KINDS = ['ah64', 'f16', 'a10', 'f4'];
export function supportKinds() { return T.peaceful ? [] : T.id === 'afghanistan' ? ['ah64', 'f16', 'a10'] : ['f4']; }

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

export class AirSupport {
  constructor(game) {
    this.g = game;
    this.list = [];
    this.bombs = [];
    this.cd = {};          // Zeitpunkt der letzten Anforderung je Typ (Host)
    this.cdLeft = {};      // Restzeit (Client, vom Host)
    this.uid = 1;
    this.mirror = new Map();
  }

  remaining(kind) {
    if (this.g.role === 'client') return this.cdLeft[kind] || 0;
    const last = this.cd[kind];
    return last === undefined ? 0 : Math.max(0, SUPPORT[kind].cooldown - (this.g.time - last));
  }

  // ------------------------------------------------------------ Anforderung (Host / Einzelspieler)
  request(kind, pos, pid) {
    const g = this.g, S = SUPPORT[kind];
    if (!S || !supportKinds().includes(kind)) return;
    const reply = (x, from = 'TOC') => { if (pid === g.myId) g.radio(x, from, false, true); else g.net.sendTo(pid, { t: 'radio', x, f: from }); };
    const left = this.remaining(kind);
    if (left > 0) { reply(`${S.name} ist noch nicht wieder verfügbar – in ${Math.ceil(left)} s.`); return; }
    if (this.list.some((a) => a.kind === kind)) { reply(`${S.call} ist bereits im Einsatz.`); return; }
    const tgt = this.pickTarget(pos, kind === 'ah64' ? 900 : 700);
    if (!tgt) { reply(`${S.call}: Keine Feindkräfte in Ihrer Nähe aufgeklärt – Anforderung abgebrochen.`, S.call); return; }
    this.cd[kind] = g.time;
    const d = Math.round(dist2(pos.x, pos.z, tgt.x, tgt.z));
    const dir = dirName(bearing(pos.x, pos.z, tgt.x, tgt.z));
    const close = d < 80 ? ' DANGER CLOSE – in Deckung gehen!' : '';
    const who = pid === g.myId ? g.callsign : g.playerName(pid);
    const what = kind === 'ah64' ? 'übernehme Ihren Sektor' : kind === 'a10' ? 'Kanonenangriff' : kind === 'f4' ? 'Napalm' : 'eine GBU-12';
    g.radio(`${S.call}: ${who}, verstanden – ${what}. Ziel ${d} m ${dir} von Ihnen, Eintreffen in ca. 15 Sekunden.${close}`, S.call, !!close);
    this.spawn(kind, pos, tgt);
  }

  // Ziel: Feindansammlung mit den meisten Nachbarn in 45 m
  pickTarget(pos, range) {
    const en = this.g.units.enemies.filter((e) => e.alive && dist2(e.x, e.z, pos.x, pos.z) < range);
    if (!en.length) return null;
    let best = null, bn = -1;
    for (const e of en) {
      let n = e.vehicle ? 3 : 0;
      for (const o of en) if (dist2(o.x, o.z, e.x, e.z) < 45) n++;
      if (n > bn) { bn = n; best = e; }
    }
    let sx = 0, sz = 0, c = 0;
    for (const o of en) if (dist2(o.x, o.z, best.x, best.z) < 45) { sx += o.x; sz += o.z; c++; }
    return { x: sx / c, z: sz / c };
  }

  spawn(kind, pos, tgt) {
    const g = this.g, w = g.world;
    const a = rand() * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    const gy = w.groundHeight(tgt.x, tgt.z);
    const o = { id: this.uid++, kind, tgt: { x: tgt.x, y: gy, z: tgt.z }, center: { x: pos.x, z: pos.z }, t: 0, pass: 0, dir: { x: -dx, z: -dz } };
    if (kind === 'ah64') {
      // kommt von der FOB
      const f = w.fob;
      o.pos = new THREE.Vector3(f.x, f.y + 120, f.z);
      o.state = 'inbound';
      o.station = 75;
      o.fireT = 2;
    } else {
      const L = kind === 'a10' ? 3600 : 4500;
      o.alt = kind === 'f16' ? 520 : kind === 'a10' ? 320 : 220;
      o.speed = kind === 'a10' ? 165 : kind === 'f16' ? 230 : 200;
      o.pos = new THREE.Vector3(tgt.x + dx * L, gy + o.alt, tgt.z + dz * L);
    }
    o.vel = new THREE.Vector3();
    o.model = this.makeModel(kind);
    this.list.push(o);
  }

  makeModel(kind) {
    const m = kind === 'ah64' ? buildHeliModel(HELI_TYPES.ah64, { number: '09-05603' }) : null;
    const grp = m ? m.group : buildJet(kind);
    if (m) {
      for (const p of m.pilots) p.group.visible = true;
      grp.userData.spin = m.spin;
      grp.userData.mount = m.guns.left.mount;
      m.discMat.opacity = 0.12;
    }
    this.g.scene.add(grp);
    return grp;
  }

  // ------------------------------------------------------------ Simulation (Host)
  update(dt) {
    const g = this.g, w = g.world;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      o.t += dt;
      const done = o.kind === 'ah64' ? this.updateApache(o, dt) : this.updateJet(o, dt);
      this.place(o, dt);
      if (done) { g.scene.remove(o.model); this.list.splice(i, 1); }
    }
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.t += dt;
      const k = Math.min(1, b.t / b.T);
      // Wurfparabel: waagerecht gleichmäßig, senkrecht beschleunigt
      b.mesh.position.set(b.a.x + (b.b.x - b.a.x) * k, b.a.y + (b.b.y - b.a.y) * k * k, b.a.z + (b.b.z - b.a.z) * k);
      b.mesh.lookAt(b.b.x, b.b.y, b.b.z);
      if (k >= 1) { g.scene.remove(b.mesh); this.bombs.splice(i, 1); b.onHit(); }
    }
    this.updateAudio();
  }

  // Flugrichtung, Lage und Modell setzen
  place(o, dt) {
    const m = o.model;
    m.position.copy(o.pos);
    if (o.vel.lengthSq() > 1) {
      const yaw = Math.atan2(-o.vel.x, -o.vel.z);
      const pitch = Math.atan2(o.vel.y, Math.hypot(o.vel.x, o.vel.z));
      o.yaw = yaw; o.pitch = pitch;
    }
    if (o.kind === 'ah64') { o.yaw = o.yawOverride ?? o.yaw; o.pitch = -Math.min(0.2, Math.hypot(o.vel.x, o.vel.z) * 0.004); }
    m.rotation.set(o.pitch || 0, o.yaw || 0, o.roll || 0, 'YXZ');
    if (m.userData.spin) for (const [obj, axis, rate] of m.userData.spin) obj.rotation[axis] += rate * dt;
  }

  updateJet(o, dt) {
    const g = this.g, w = g.world, S = SUPPORT[o.kind];
    const t = o.tgt;
    const toX = t.x - o.pos.x, toZ = t.z - o.pos.z;
    const along = toX * o.dir.x + toZ * o.dir.z;      // > 0: Ziel liegt noch voraus
    // Höhe: A-10 stürzt im Anflug auf 150 m, sonst Marschhöhe über dem Gelände
    let alt = o.alt;
    if (o.kind === 'a10' && along < 2400 && along > -400) alt = clamp(130 + (along - 500) * 0.12, 120, o.alt);
    if (o.kind === 'f4' && along < 1500 && along > -300) alt = 140;
    const gy = Math.max(w.groundHeight(o.pos.x, o.pos.z), t.y);
    const ty = gy + alt;
    o.vel.set(o.dir.x * o.speed, clamp((ty - o.pos.y) * 0.8, -40, 40), o.dir.z * o.speed);
    o.pos.addScaledVector(o.vel, dt);
    o.roll = 0;
    if (o.kind === 'f16' && !o.dropped && along < 1700) {
      o.dropped = true;
      g.radio(`${S.call}: Bombe ausgeklinkt – 10 Sekunden!`, S.call);
      this.dropBomb(o.pos, { x: t.x, y: t.y, z: t.z }, 8, () => {
        this.blast(t.x, t.y, t.z, 4.5);
        g.radio(`${S.call}: Einschlag! Gute Wirkung im Ziel.`, S.call);
      });
    }
    if (o.kind === 'f4' && !o.dropped && along < 380) {
      o.dropped = true;
      g.radio(`${S.call}: Napalm ausgeklinkt!`, S.call);
      const end = { x: t.x + o.dir.x * 20, y: t.y, z: t.z + o.dir.z * 20 };
      this.dropBomb(o.pos, end, 2.6, () => this.napalm(t, o.dir));
    }
    if (o.kind === 'a10') {
      if (along < 1500 && along > 650) {
        if (!o.firing) { o.firing = true; o.burst = 0; this.fx({ k: 'brrt', p: [o.pos.x, o.pos.y, o.pos.z] }); }
        o.burst -= dt;
        if (o.burst <= 0) {
          o.burst = 0.035;
          // Einschlagsstreifen von 40 m vor bis 40 m hinter das Ziel
          const s = clamp((1500 - along) / 850, 0, 1) * 80 - 40;
          const ix = t.x + o.dir.x * s + rand.range(-4, 4), iz = t.z + o.dir.z * s + rand.range(-4, 4);
          const iy = w.groundHeight(ix, iz);
          this.tracer(o.pos, { x: ix, y: iy, z: iz }, () => this.blast(ix, iy, iz, 0.55));
        }
      } else if (o.firing) {
        o.firing = false;
        o.pass++;
        g.radio(o.pass < 2 ? `${S.call}: Erster Anflug abgeschlossen, komme zurück für den zweiten.` : `${S.call}: Munition für diesen Einsatz verschossen. Hog verlässt das Gebiet.`, S.call);
      }
      // zweiter Anflug aus der Gegenrichtung (Wendekurve außer Sicht)
      if (along < -3200 && o.pass < 2) {
        o.dir = { x: -o.dir.x, z: -o.dir.z };
        o.pos.set(t.x - o.dir.x * 3600, t.y + o.alt, t.z - o.dir.z * 3600);
      }
      return o.pass >= 2 && along < -3000;
    }
    return along < -4200;
  }

  dropBomb(from, to, T, onHit) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 2.2, 8).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x77796c }));
    this.g.scene.add(mesh);
    this.bombs.push({ a: from.clone(), b: new THREE.Vector3(to.x, to.y, to.z), t: 0, T, mesh, onHit });
    this.fx({ k: 'bomb', a: [from.x, from.y, from.z], b: [to.x, to.y, to.z], T });
  }

  napalm(t, dir) {
    for (let k = -1; k <= 3; k++) {
      const x = t.x + dir.x * k * 18 + rand.range(-3, 3), z = t.z + dir.z * k * 18 + rand.range(-3, 3);
      this.blast(x, this.g.world.groundHeight(x, z), z, 1.8, true);
    }
  }

  updateApache(o, dt) {
    const g = this.g, w = g.world, S = SUPPORT.ah64, c = o.center;
    const gy = w.groundHeight(o.pos.x, o.pos.z);
    let goal, sp = 55;
    if (o.state === 'inbound') {
      const a = Math.atan2(o.pos.z - c.z, o.pos.x - c.x);
      goal = { x: c.x + Math.cos(a) * 300, z: c.z + Math.sin(a) * 300 };
      if (dist2(o.pos.x, o.pos.z, goal.x, goal.z) < 60) { o.state = 'station'; g.radio(`${S.call}: Auf Station. Halten Sie die Köpfe unten.`, S.call); }
    } else if (o.state === 'station') {
      o.station -= dt;
      const a = Math.atan2(o.pos.z - c.z, o.pos.x - c.x) + 0.35;
      goal = { x: c.x + Math.cos(a) * 300, z: c.z + Math.sin(a) * 300 };
      sp = 24;
      if (o.station <= 0) { o.state = 'rtb'; g.radio(`${S.call}: Treibstoff und Munition knapp – kehren zur FOB zurück.`, S.call); }
      this.apacheFire(o, dt);
    } else {
      goal = { x: w.fob.x, z: w.fob.z };
      if (dist2(o.pos.x, o.pos.z, goal.x, goal.z) < 150) return true;
    }
    const dx = goal.x - o.pos.x, dz = goal.z - o.pos.z, d = Math.hypot(dx, dz) || 1;
    const want = _v.set((dx / d) * sp, 0, (dz / d) * sp);
    o.vel.x += (want.x - o.vel.x) * Math.min(1, dt * 0.8);
    o.vel.z += (want.z - o.vel.z) * Math.min(1, dt * 0.8);
    let gmax = gy;
    for (const k of [0.4, 1]) gmax = Math.max(gmax, w.groundHeight(o.pos.x + o.vel.x * 5 * k, o.pos.z + o.vel.z * 5 * k));
    o.vel.y = clamp((gmax + 90 - o.pos.y) * 0.6, -12, 12);
    o.pos.addScaledVector(o.vel, dt);
    // Nase zum Ziel auf Station, sonst in Flugrichtung; leichte Querneigung
    const face = o.state === 'station' ? Math.atan2(-(c.x - o.pos.x), -(c.z - o.pos.z)) : Math.atan2(-o.vel.x, -o.vel.z);
    const e = Math.atan2(Math.sin(face - (o.hdg ?? face)), Math.cos(face - (o.hdg ?? face)));
    o.hdg = (o.hdg ?? face) + clamp(e, -dt * 0.8, dt * 0.8);
    o.yawOverride = o.hdg;
    return false;
  }

  apacheFire(o, dt) {
    const g = this.g, w = g.world;
    o.fireT -= dt;
    if (o.fireT > 0) return;
    const c = o.center;
    let best = null, bd = 1e9;
    for (const e of g.units.enemies) {
      if (!e.alive || dist2(e.x, e.z, c.x, c.z) > 650) continue;
      const d = Math.hypot(e.x - o.pos.x, e.y - o.pos.y, e.z - o.pos.z);
      if (d > 1400 || !w.los(o.pos.x, o.pos.y - 1, o.pos.z, e.x, e.y + 1, e.z)) continue;
      const score = d * (e.vehicle ? 0.4 : 1) * (e.heavy ? 0.7 : 1);
      if (score < bd) { bd = score; best = e; }
    }
    o.fireT = best ? 2.2 + rand() * 1.5 : 1;
    if (!best) return;
    const from = _w.set(0, -0.95, -5.5).applyAxisAngle(_v.set(0, 1, 0), o.yaw || 0).add(o.pos).clone();
    if (best.vehicle && rand() < 0.6) {
      // Raketensalve auf Fahrzeuge
      for (let k = 0; k < 2; k++) {
        const dir = new THREE.Vector3(best.x - from.x, best.y + 1 - from.y, best.z - from.z).normalize();
        dir.x += rand.range(-0.01, 0.01); dir.y += rand.range(-0.01, 0.01); dir.z += rand.range(-0.01, 0.01);
        const v = dir.normalize().multiplyScalar(300);
        setTimeout(() => { g.combat.rocket(from, v, false); if (g.net) g.net.rocketFire(from, v); }, k * 250);
      }
      return;
    }
    // 30-mm-Feuerstoß mit Sprenggeschossen
    for (let k = 0; k < 10; k++) {
      setTimeout(() => {
        if (!best.alive && rand() < 0.5) return;
        const dir = new THREE.Vector3(best.x - from.x, best.y + 0.8 - from.y, best.z - from.z).normalize();
        dir.x += rand.range(-0.008, 0.008); dir.y += rand.range(-0.008, 0.008); dir.z += rand.range(-0.008, 0.008);
        dir.normalize();
        g.combat.fire(from, dir, o.vel, k % 2 === 0, false, 805, true, true);
        if (g.net && k % 2 === 0) g.net.send({ t: 'asx', k: 'gun', a: [from.x, from.y, from.z], d: [dir.x, dir.y, dir.z] });
        g.effects.muzzle(from.x, from.y, from.z, true);
        g.audio.shot('dshk', g.camera.position.distanceTo(from));
      }, k * 100);
    }
  }

  // ------------------------------------------------------------ Wirkung (Host) und Effekte (alle)
  blast(x, y, z, scale, napalm = false) {
    const g = this.g;
    g.combat.explode(x, y, z, false, scale);
    if (scale >= 1.5) {
      // eigene Leute zu Fuß in der Nähe werden mitgetroffen
      for (const ft of g.footTargets()) {
        const d = Math.hypot(ft.s.pos.x - x, ft.s.pos.z - z);
        if (d < 6 * scale) g.damageSoldier(ft.pid, d < 3 * scale ? 120 : 40);
      }
    }
    this.fx({ k: 'boom', p: [x, y, z], s: scale, n: napalm ? 1 : 0 }, true);
    if (napalm || scale >= 4) this.burn(x, y, z, napalm ? 18 : 10);
  }

  burn(x, y, z, sec) {
    const e = this.g.effects.wreckFire(x, y, z);
    setTimeout(() => this.g.effects.removeEmitter(e), sec * 1000);
  }

  tracer(from, to, onEnd) {
    const g = this.g;
    g.combat.visualShot(from, _v.set(to.x, to.y, to.z), 1000, [1.0, 0.75, 0.3], true, onEnd);
    if (g.net && rand() < 0.4) g.net.send({ t: 'asx', k: 'tr', a: [from.x, from.y, from.z], b: [to.x, to.y, to.z] });
  }

  // Effekt lokal abspielen und an Mitspieler senden (localDone: lokal bereits erzeugt)
  fx(m, localDone = false) {
    if (!localDone) this.playFx(m);
    if (this.g.net && this.g.role === 'host') this.g.net.send({ t: 'asx', ...m });
  }

  playFx(m) {
    const g = this.g;
    if (m.k === 'boom') {
      if (g.role === 'client') g.combat.explode(m.p[0], m.p[1], m.p[2], true, m.s);
      if (m.s >= 4 && g.role === 'client') this.burn(m.p[0], m.p[1], m.p[2], 10);
      if (m.n && g.role === 'client') this.burn(m.p[0], m.p[1], m.p[2], 18);
      if (m.s >= 4) for (let k = 0; k < 3; k++) g.audio.boom(g.camera.position.distanceTo(_v.set(m.p[0], m.p[1], m.p[2])) * (0.6 + k * 0.1));
    } else if (m.k === 'brrt') {
      const d = g.camera.position.distanceTo(_v.set(m.p[0], m.p[1], m.p[2]));
      g.audio.play('brrt', { gain: Math.min(1, 900 / Math.max(200, d)), delay: Math.min(4, d / 343) });
    } else if (m.k === 'bomb' && g.role === 'client') {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 2.2, 8).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x77796c }));
      g.scene.add(mesh);
      this.bombs.push({ a: new THREE.Vector3(...m.a), b: new THREE.Vector3(...m.b), t: 0, T: m.T, mesh, onHit: () => {} });
    } else if (m.k === 'tr') {
      g.combat.visualShot(_w.set(...m.a), _v.set(...m.b), 1000, [1.0, 0.75, 0.3], true, null);
    } else if (m.k === 'gun') {
      g.combat.fire(_w.set(...m.a), _v.set(...m.d), new THREE.Vector3(), true, true, 805, false, true);
    }
  }

  updateAudio() {
    const g = this.g, cam = g.camera.position;
    let jet = 0, jetRate = 1, rotor = 0;
    for (const o of this.list.concat([...this.mirror.values()])) {
      const d = cam.distanceTo(o.pos || o.model.position);
      if (o.kind === 'ah64') rotor = Math.max(rotor, Math.min(0.7, 120 / Math.max(60, d)));
      else { const gn = Math.min(0.9, 500 / Math.max(150, d)); if (gn > jet) { jet = gn; jetRate = 0.8 + Math.min(0.6, 300 / Math.max(200, d)); } }
    }
    g.audio.setLoop('jet', jet * 0.6, jetRate, 700 + jet * 900);
    g.audio.setLoop('rotor2', rotor, 1.4, 1400);
  }

  // ------------------------------------------------------------ Netzwerk
  snapshot() {
    const r = (v) => Math.round(v * 10) / 10;
    const out = [];
    for (const o of this.list) out.push(o.id, KINDS.indexOf(o.kind), r(o.pos.x), r(o.pos.y), r(o.pos.z), r(o.yawOverride ?? o.yaw ?? 0), r(o.pitch || 0));
    return { L: out, C: supportKinds().map((k) => Math.ceil(this.remaining(k))) };
  }

  applyNet(X) {
    const seen = new Set();
    const L = X.L || [];
    for (let i = 0; i < L.length; i += 7) {
      const id = L[i];
      seen.add(id);
      let o = this.mirror.get(id);
      if (!o) { o = { kind: KINDS[L[i + 1]], pos: new THREE.Vector3(L[i + 2], L[i + 3], L[i + 4]), tp: new THREE.Vector3() }; o.model = this.makeModel(o.kind); this.mirror.set(id, o); }
      o.tp.set(L[i + 2], L[i + 3], L[i + 4]);
      o.yaw = L[i + 5]; o.pitch = L[i + 6];
    }
    for (const [id, o] of this.mirror) if (!seen.has(id)) { this.g.scene.remove(o.model); this.mirror.delete(id); }
    supportKinds().forEach((k, i) => { this.cdLeft[k] = (X.C || [])[i] || 0; });
  }

  updateMirror(dt) {
    for (const o of this.mirror.values()) {
      if (o.pos.distanceTo(o.tp) > 400) o.pos.copy(o.tp); else o.pos.lerp(o.tp, Math.min(1, dt * 8));
      o.model.position.copy(o.pos);
      o.model.rotation.set(o.pitch, o.yaw, 0, 'YXZ');
      if (o.model.userData.spin) for (const [obj, axis, rate] of o.model.userData.spin) obj.rotation[axis] += rate * dt;
    }
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.t += dt;
      const k = Math.min(1, b.t / b.T);
      b.mesh.position.set(b.a.x + (b.b.x - b.a.x) * k, b.a.y + (b.b.y - b.a.y) * k * k, b.a.z + (b.b.z - b.a.z) * k);
      if (k >= 1) { this.g.scene.remove(b.mesh); this.bombs.splice(i, 1); }
    }
    this.updateAudio();
  }
}
