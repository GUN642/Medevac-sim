// Ukraine: Landezonen geraten sehr schnell unter Beschuss. Steht ein Hubschrauber außerhalb der Basis am Boden,
// schlagen spätestens nach etwa 15 Sekunden Artilleriegranaten ein (erst Gabelschüsse, dann immer genauer)
// oder eine FPV-Kamikazedrohne fliegt an. Drohnen lassen sich mit den Bord-MGs abschießen; KI-Schützen versuchen es auch.
// Gerechnet wird auf dem Gerät, dem der Hubschrauber gehört.
import * as THREE from './lib/three.module.min.js';
import { T } from './theme.js';
import { rand, dist2, clamp } from './util.js';
import { P, merge, vcMat } from './models.js';

let droneGeo = null;
function droneMesh() {
  if (!droneGeo) {
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (r, h) => new THREE.CylinderGeometry(r, r, h, 10);
    const p = [
      P(box(0.16, 0.06, 0.16), 0x1c1d1e, [0, 0, 0]),
      P(box(0.5, 0.025, 0.04), 0x2a2b2c, [0, 0, 0], [0, Math.PI / 4, 0]), P(box(0.5, 0.025, 0.04), 0x2a2b2c, [0, 0, 0], [0, -Math.PI / 4, 0]),
      P(box(0.1, 0.07, 0.18), 0x3a4a2a, [0, -0.06, 0]),                 // Akku
      P(cyl(0.045, 0.28), 0x4a4d3e, [0, -0.02, -0.18], [Math.PI / 2, 0, 0]),   // Sprengladung (Panzergranate)
    ];
    for (const [x, z] of [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]]) p.push(P(cyl(0.1, 0.01), 0x555555, [x, 0.03, z]));
    droneGeo = merge(p);
  }
  const m = new THREE.Mesh(droneGeo, vcMat);
  m.scale.setScalar(1.6);   // etwas größer, damit man sie im Spiel überhaupt sieht
  return m;
}

export class Strikes {
  constructor(game) {
    this.g = game;
    this.state = new Map();
    this.drones = [];
    this.shells = [];
    this.missiles = [];
    this.flares = [];
    this.alt = new Map();
  }

  get on() { return !!T.lzStrikes; }

  update(dt) {
    if (!this.on) return;
    const g = this.g;
    for (const h of g.helis) if (g.owns(h.index)) { this.watch(h, dt); this.watchAltitude(h, dt); }
    this.updateDrones(dt);
    this.updateShells(dt);
    this.updateMissiles(dt);
    this.updateFlares(dt);
  }

  // ------------------------------------------------------------ Flugabwehr über 150 ft
  // Wer über 150 ft (46 m) über Grund fliegt, wird von Schultern aus mit Flugabwehrraketen (MANPADS) beschossen.
  // Der Hubschrauber stößt bei einem Raketenstart automatisch Flares aus – die lenken die Rakete meist ab.
  watchAltitude(h, dt) {
    const g = this.g, w = g.world;
    const c = g.crews[h.index];
    if (!c || c.pilot == null) return;          // nur von Spielern geflogene Hubschrauber
    let st = this.alt.get(h.index);
    if (!st) { st = { t: 0, warned: false, next: 5 + rand() * 2, flares: 60 }; this.alt.set(h.index, st); }
    const nearBase = dist2(h.pos.x, h.pos.z, w.fob.x, w.fob.z) < w.fob.r + 700;
    if (nearBase && h.contact && st.flares < 60) st.flares = 60;   // an der Basis aufmunitioniert
    const high = !h.crashed && !h.contact && h.agl > 45.7 && !nearBase;
    if (!high) { st.t = Math.max(0, st.t - dt * 2); if (st.t === 0) { st.warned = false; st.next = 5 + rand() * 2; } return; }
    st.t += dt;
    if (!st.warned && st.t > 0.6) {
      st.warned = true;
      if (g.heli === h) g.radio('TOC: Sie sind über 150 Fuß – der Gegner hat Flugabwehrraketen! Sofort tiefer fliegen!', 'TOC', true);
    }
    if (st.t >= st.next) {
      st.next = st.t + 8 + rand() * 6;
      this.launchMissile(h, st);
    }
  }

  launchMissile(h, st) {
    const g = this.g, w = g.world;
    // Schütze am Boden in 1,2–2,5 km Entfernung, bevorzugt vor oder seitlich des Hubschraubers
    let x = 0, z = 0;
    for (let k = 0; k < 20; k++) {
      const a = h.yaw + (rand() - 0.5) * 3.6, d = 1200 + rand() * 1300;
      x = h.pos.x - Math.sin(a) * d; z = h.pos.z - Math.cos(a) * d;
      if (w.height(x, z) > 0.5) break;
    }
    const y = Math.max(0, w.height(x, z)) + 1.6;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc8c8b0 }));
    mesh.position.set(x, y, z);
    g.scene.add(mesh);
    const dir = new THREE.Vector3(h.pos.x - x, h.pos.y - y + 30, h.pos.z - z).normalize();
    this.missiles.push({ mesh, pos: mesh.position, vel: dir.multiplyScalar(40), target: h, life: 0, decoy: null, rolled: false, st });
    g.effects.puff(x, y, z, 0.8, 0.8, 0.78, 8, 2.5, 3, 2.5);
    g.audio.shot('thump', g.camera.position.distanceTo(mesh.position));
    if (g.heli === h) {
      const rel = Math.atan2(x - h.pos.x, z - h.pos.z) - (h.yaw + Math.PI);
      const clock = ((Math.round(-rel / (Math.PI / 6)) % 12) + 12) % 12 || 12;
      g.radio(`Crew: RAKETENSTART auf ${clock} Uhr! Flares!`, 'Crew', true);
      g.audio.alarm(3);
    }
    this.dispenseFlares(h, st);
  }

  // Flares: helle, fallende Leuchtkörper hinter dem Hubschrauber
  dispenseFlares(h, st) {
    const g = this.g;
    if (st.flares <= 0) { if (g.heli === h) g.radio('Crew: Keine Flares mehr!', 'Crew', true); return; }
    const n = Math.min(8, st.flares);
    st.flares -= n;
    for (let k = 0; k < n; k++) {
      setTimeout(() => {
        if (h.crashed) return;
        for (const sx of [-1, 1]) {
          const p = new THREE.Vector3(sx * 1.4, -0.6, 2.5).applyQuaternion(h.quat).add(h.pos);
          const v = new THREE.Vector3(sx * (8 + rand() * 6), -2 - rand() * 4, 6 + rand() * 4).applyQuaternion(h.quat).add(h.vel.clone().multiplyScalar(0.6));
          this.flares.push({ p, v, life: 0 });
        }
      }, k * 220);
    }
    if (g.heli === h && st.flares < 16 && st.flares > 0) g.radio(`Crew: Noch ${st.flares} Flares.`, 'Crew');
  }

  updateFlares(dt) {
    const fx = this.g.effects;
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i];
      f.life += dt;
      f.v.y -= 6 * dt;
      f.v.multiplyScalar(1 - Math.min(0.5, dt * 1.2));
      f.p.addScaledVector(f.v, dt);
      fx.glow.spawn(f.p.x, f.p.y, f.p.z, 0, 0, 0, 0.12, 1.4, 0.6, 1.0, 0.85, 0.5, 0.95, 0, 0);
      if (Math.random() < dt * 20) fx.puff(f.p.x, f.p.y, f.p.z, 0.85, 0.85, 0.85, 1, 1.2, 0.3, 2.2);
      if (f.life > 4 || f.p.y < this.g.world.groundHeight(f.p.x, f.p.z)) this.flares.splice(i, 1);
    }
  }

  updateMissiles(dt) {
    const g = this.g, w = g.world, fx = g.effects;
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const M = this.missiles[i];
      M.life += dt;
      const h = M.target;
      // Ziel: Hubschrauber, oder nach erfolgreicher Täuschung die Flares
      let tgt = h && !h.crashed ? h.pos : null;
      const dH = tgt ? M.pos.distanceTo(tgt) : 1e9;
      if (!M.rolled && dH < 450) {
        M.rolled = true;
        // Täuschung gelingt meist, wenn Flares in der Luft sind (in großer Höhe schlechter)
        const near = this.flares.filter((f) => f.p.distanceTo(h.pos) < 250);
        const p = near.length ? (h.agl > 120 ? 0.55 : 0.78) : 0;
        if (rand() < p) M.decoy = near[Math.floor(rand() * near.length)].p.clone();
      }
      if (M.decoy) tgt = M.decoy;
      const speed = Math.min(420, 40 + M.life * 260);
      if (tgt) {
        // Proportionalnavigation light: Richtung zum (vorausberechneten) Ziel, begrenzte Wendigkeit
        const lead = tgt === h?.pos ? h.vel.clone().multiplyScalar(Math.min(1.5, dH / 420)) : new THREE.Vector3();
        const want = tgt.clone().add(lead).sub(M.pos).normalize().multiplyScalar(speed);
        M.vel.lerp(want, Math.min(1, dt * 3.2));
        M.vel.setLength(speed);
      }
      M.pos.addScaledVector(M.vel, dt);
      M.mesh.lookAt(M.pos.clone().add(M.vel));
      if (Math.random() < dt * 40) fx.puff(M.pos.x, M.pos.y, M.pos.z, 0.82, 0.82, 0.8, 1, 0.9, 0.3, 2.6);
      fx.glow.spawn(M.pos.x, M.pos.y, M.pos.z, 0, 0, 0, 0.06, 0.9, 0.4, 1.0, 0.7, 0.35, 0.9, 0, 0);
      const gy = w.groundHeight(M.pos.x, M.pos.z);
      let boom = M.life > 14 || M.pos.y < gy + 0.5;
      if (M.decoy && M.pos.distanceTo(M.decoy) < 8) boom = true;
      if (!M.decoy && h && !h.crashed && dH < 6) {
        boom = true;
        g.damageHeli(h, 50 + rand() * 15, M.pos);
        if (g.heli === h) g.radio('Crew: RAKETENTREFFER! Wir sind getroffen!', 'Crew', true);
      }
      if (boom) {
        fx.explosion(M.pos.x, M.pos.y, M.pos.z, 0.7);
        g.audio.boom(g.camera.position.distanceTo(M.pos));
        if (M.decoy && g.heli === h) g.radio('Crew: Rakete hat die Flares erwischt – das war knapp!', 'Crew');
        g.scene.remove(M.mesh);
        M.mesh.geometry.dispose();
        this.missiles.splice(i, 1);
      }
    }
  }

  // Bodenzeit außerhalb der Basis beobachten und Beschuss auslösen
  watch(h, dt) {
    const g = this.g, w = g.world;
    let st = this.state.get(h.index);
    if (!st) { st = { t: 0, plan: null, n: 0 }; this.state.set(h.index, st); }
    const inBase = dist2(h.pos.x, h.pos.z, w.fob.x, w.fob.z) < w.fob.r + 60;
    const down = !h.crashed && h.contact && !inBase && h.rpm > 0.3;
    if (!down) {
      if (st.t > 0 && (h.agl > 4 || inBase || h.crashed)) { st.t = 0; st.plan = null; st.n = 0; }
      return;
    }
    st.t += dt;
    if (!st.plan) {
      st.plan = rand() < 0.5 ? 'drone' : 'arty';
      st.at = st.plan === 'drone' ? 3 + rand() * 2 : 7 + rand() * 3;
      st.lz = { x: h.pos.x, z: h.pos.z };
    }
    if (st.plan === 'drone' && st.n === 0 && st.t >= st.at) {
      st.n = 1;
      this.launchDrone(h);
      if (g.heli === h) g.radio('Crew: FPV-DROHNE im Anflug! Abschießen oder sofort starten!', 'Crew', true);
      // falls der Hubschrauber trotzdem stehen bleibt, folgt später Artillerie
      st.plan = 'arty'; st.at = st.t + 12; st.n = 0;
      return;
    }
    if (st.plan === 'arty' && st.t >= st.at) {
      // Salve: erste Granaten 40–60 m daneben, jede weitere näher am Hubschrauber
      const R = Math.max(4, 55 - st.n * 16);
      const a = rand() * Math.PI * 2, r = R * (0.6 + rand() * 0.5);
      const x = h.pos.x + Math.cos(a) * r, z = h.pos.z + Math.sin(a) * r;
      this.shells.push({ x, z, t: 1.2, h });
      if (st.n === 0 && g.heli === h) g.radio('TOC: ARTILLERIE auf Ihre LZ! Die schießen sich ein – sofort abheben!', 'TOC', true);
      st.n++;
      st.at = st.t + 1.8 + rand() * 1.2;
    }
  }

  // ------------------------------------------------------------ FPV-Drohnen
  launchDrone(h) {
    const g = this.g, w = g.world;
    const a = rand() * Math.PI * 2, d = 260 + rand() * 90;
    const x = h.pos.x + Math.cos(a) * d, z = h.pos.z + Math.sin(a) * d;
    const y = Math.max(0, w.height(x, z)) + 25 + rand() * 15;
    const mesh = droneMesh();
    mesh.position.set(x, y, z);
    g.scene.add(mesh);
    this.drones.push({ mesh, pos: mesh.position, vel: new THREE.Vector3(), target: h, life: 0, aiT: 1.5, alive: true });
  }

  updateDrones(dt) {
    const g = this.g, w = g.world;
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const D = this.drones[i];
      D.life += dt;
      const h = D.target;
      if (!D.alive || D.life > 40 || !h || h.crashed) { this.removeDrone(i, D.alive && D.life <= 40); continue; }
      // Steuerung: auf den Hubschrauber zu, bis 80 m über Gelände halten, dann Sturzflug
      const tx = h.pos.x, ty = h.pos.y + 0.5, tz = h.pos.z;
      const dx = tx - D.pos.x, dy = ty - D.pos.y, dz = tz - D.pos.z;
      const dh = Math.hypot(dx, dz), dist = Math.hypot(dh, dy);
      if (dist > 900) { this.removeDrone(i, false); continue; }
      const sp = 31;
      const gy = Math.max(0, w.height(D.pos.x, D.pos.z));
      let vx, vy, vz;
      if (dh > 90) {
        // Anflug in 10–12 m Höhe über dem Gelände
        const wantY = Math.max(ty + 12, gy + 10);
        vx = (dx / (dh || 1)) * sp; vz = (dz / (dh || 1)) * sp; vy = clamp((wantY - D.pos.y) * 1.5, -14, 10);
      } else {
        // Endanflug: direkt auf das Ziel (Pilot der Drohne korrigiert schnell)
        vx = (dx / dist) * sp; vy = (dy / dist) * sp; vz = (dz / dist) * sp;
      }
      const k = Math.min(1, dt * (dh > 90 ? 3 : 7));
      D.vel.x += (vx - D.vel.x) * k; D.vel.z += (vz - D.vel.z) * k; D.vel.y += (vy - D.vel.y) * k;
      D.pos.addScaledVector(D.vel, dt);
      D.mesh.rotation.set(clamp(-D.vel.length() * 0.012, -0.5, 0), Math.atan2(-D.vel.x, -D.vel.z), Math.sin(D.life * 9) * 0.05, 'YXZ');
      if (D.pos.y < gy + 0.3) { this.detonate(D, dist < 12 ? h : null); this.removeDrone(i, false); continue; }
      // Einschlag am Hubschrauber
      if (dist < 4.5) {
        this.detonate(D, h);
        this.removeDrone(i, false);
        continue;
      }
      // KI-Bordschützen bekämpfen die Drohne, wenn sie nah genug ist
      if (g.owns(h.index) && dist < 260 && this.aiGunners(h)) {
        D.aiT -= dt;
        if (D.aiT <= 0) {
          D.aiT = 0.5;
          const from = h.pos.clone().add(new THREE.Vector3(0, 0.5, 0));
          g.combat.visualShot(from, D.pos.clone().add(new THREE.Vector3(rand.range(-3, 3), rand.range(-2, 2), rand.range(-3, 3))), 800, [1.0, 0.3, 0.15], true);
          g.audio.shot('m60', g.camera.position.distanceTo(from));
          if (rand() < 0.12) { this.shootDown(D); if (g.heli === h) g.radio('Schütze: Drohne abgeschossen!', 'Schütze'); }
        }
      }
    }
  }

  // Sitzt an mindestens einer Bordwaffe die KI?
  aiGunners(h) {
    if (h.spec.noGuns || !h.spec.gun || h.spec.gun.ammo <= 0) return false;
    const c = this.g.crews[h.index];
    return !!c && (c.left == null || (h.spec.seats || ['pilot', 'left', 'right']).includes('right') && c.right == null);
  }

  // Treffer durch ein Geschoss (Segment von o mit Richtung s)
  hitTest(ox, oy, oz, sx, sy, sz) {
    for (const D of this.drones) {
      if (!D.alive) continue;
      const cx = D.pos.x - ox, cy = D.pos.y - oy, cz = D.pos.z - oz;
      const l2 = sx * sx + sy * sy + sz * sz || 1;
      const t = clamp((cx * sx + cy * sy + cz * sz) / l2, 0, 1);
      const ex = cx - sx * t, ey = cy - sy * t, ez = cz - sz * t;
      if (ex * ex + ey * ey + ez * ez < 1.6 * 1.6) {
        this.shootDown(D);
        if (this.g.heli === D.target) this.g.radio('Crew: Drohne getroffen – sie ist runter!', 'Crew');
        return true;
      }
    }
    return false;
  }

  shootDown(D) {
    if (!D.alive) return;
    D.alive = false;
    const g = this.g;
    g.effects.explosion(D.pos.x, D.pos.y, D.pos.z, 0.35);
    g.audio.boom(g.camera.position.distanceTo(D.pos) + 80);
  }

  detonate(D, h) {
    const g = this.g, p = D.pos;
    g.effects.explosion(p.x, p.y, p.z, 0.6);
    g.audio.boom(g.camera.position.distanceTo(p));
    if (h) {
      g.damageHeli(h, 30 + rand() * 18, p);
      if (g.heli === h) g.radio('Crew: DROHNENTREFFER! Schaden prüfen!', 'Crew', true);
    }
    this.hurtFoot(p.x, p.y, p.z, 8, 70);
  }

  removeDrone(i, quiet) {
    const D = this.drones[i];
    this.g.scene.remove(D.mesh);
    this.drones.splice(i, 1);
    if (!quiet) return;
  }

  // ------------------------------------------------------------ Artillerie
  updateShells(dt) {
    const g = this.g, w = g.world;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.t -= dt;
      if (s.t > 0) continue;
      this.shells.splice(i, 1);
      const y = Math.max(0, w.height(s.x, s.z));
      g.effects.explosion(s.x, y + 0.5, s.z, 1.3);
      g.effects.puff(s.x, y + 1, s.z, 0.32, 0.28, 0.24, 10, 6, 6, 4);
      g.audio.boom(g.camera.position.distanceTo(new THREE.Vector3(s.x, y, s.z)));
      for (const h of g.helis) {
        if (h.crashed || !g.owns(h.index)) continue;
        const d = Math.hypot(h.pos.x - s.x, h.pos.y - y, h.pos.z - s.z);
        if (d < 9) g.damageHeli(h, 50, null);
        else if (d < 18) g.damageHeli(h, 22, null);
        else if (d < 30) g.damageHeli(h, 6, null);
      }
      this.hurtFoot(s.x, y, s.z, 14, 100);
      // Feinde in der Nähe werden nicht getroffen (Beschuss gilt den eigenen Truppen)
    }
  }

  hurtFoot(x, y, z, r, dmg) {
    const g = this.g;
    for (const ft of g.footTargets()) {
      const d = Math.hypot(ft.s.pos.x - x, ft.s.pos.y - y, ft.s.pos.z - z);
      if (d < r) g.damageSoldier(ft.pid, d < r * 0.4 ? dmg : dmg * 0.4);
    }
  }

  clear() {
    for (const D of this.drones) this.g.scene.remove(D.mesh);
    for (const M of this.missiles) this.g.scene.remove(M.mesh);
    this.drones.length = 0; this.shells.length = 0; this.state.clear();
    this.missiles.length = 0; this.flares.length = 0; this.alt.clear();
  }
}
