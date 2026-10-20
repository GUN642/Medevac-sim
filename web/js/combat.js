// Geschosse, Bordschützen (M60) und Feindbeschuss
import * as THREE from './lib/three.module.min.js';
import { GUN, G } from './config.js';
import { clamp, wrapAngle, rand } from './util.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _d = new THREE.Vector3();

export class Combat {
  constructor(game) {
    this.game = game;
    this.bullets = [];   // echte Geschosse der Bordschützen (mit Trefferprüfung)
    this.visual = [];    // rein visuelle Leuchtspuren (Feind / Bodentruppen)
  }

  clear() { this.bullets.length = 0; this.visual.length = 0; }

  fire(p, dir, inherit, tracer) {
    this.bullets.push({
      p: p.clone(),
      v: dir.clone().multiplyScalar(GUN.muzzleVel).add(inherit),
      life: 0, tracer,
    });
  }

  // Sichtbare Leuchtspur von a nach b; onEnd wird bei Ankunft aufgerufen
  visualShot(a, b, speed, color, tracer, onEnd) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    this.visual.push({ p: a.clone(), dir: d.divideScalar(len || 1), speed, t: 0, T: len / speed, color, tracer, onEnd });
  }

  update(dt) {
    const g = this.game;
    const world = g.world, fx = g.effects, enemies = g.units.enemies;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const ox = b.p.x, oy = b.p.y, oz = b.p.z;
      b.v.y -= G * dt;
      b.p.addScaledVector(b.v, dt);
      b.life += dt;
      let dead = b.life > 2.6;
      // Treffer auf Gegner (Segment gegen Kugel)
      const sx = b.p.x - ox, sy = b.p.y - oy, sz = b.p.z - oz;
      const sl2 = sx * sx + sy * sy + sz * sz;
      for (const e of enemies) {
        if (!e.alive) continue;
        const cx = e.x - ox, cy = e.y + 0.9 - oy, cz = e.z - oz;
        if (Math.abs(cx) > 900 || Math.abs(cz) > 900) continue;
        const t = clamp((cx * sx + cy * sy + cz * sz) / (sl2 || 1), 0, 1);
        const dx = cx - sx * t, dy = cy - sy * t, dz = cz - sz * t;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.85 * 0.85 && !(e.cover && rand() < e.cover)) {
          g.units.killEnemy(e);
          fx.puff(e.x, e.y + 1, e.z, 0.35, 0.12, 0.1, 2, 0.8, 1, 0.8);
          dead = true;
          break;
        }
        if (d2 < 7 * 7) e.suppress = Math.max(e.suppress, 2.5);
      }
      // Bodentreffer
      if (!dead) {
        const gh = world.groundHeight(b.p.x, b.p.z);
        if (b.p.y <= gh) {
          if (world.height(b.p.x, b.p.z) < 0) fx.dust(b.p.x, 0.2, b.p.z, 0, 0, 0.85, 0.88, 0.85, 0.6);
          else fx.puff(b.p.x, gh + 0.3, b.p.z, 0.45, 0.38, 0.27, 2, 0.9, 1.5, 0.9);
          for (const e of enemies) if (e.alive && Math.abs(e.x - b.p.x) < 9 && Math.abs(e.z - b.p.z) < 9) e.suppress = Math.max(e.suppress, 2.5);
          dead = true;
        }
      }
      if (b.tracer && !dead) {
        _v.copy(b.v).normalize();
        fx.tracer(b.p.x, b.p.y, b.p.z, -_v.x, -_v.y, -_v.z, 11, 1.0, 0.28, 0.16);
      }
      if (dead) this.bullets.splice(i, 1);
    }

    for (let i = this.visual.length - 1; i >= 0; i--) {
      const s = this.visual[i];
      s.t += dt;
      if (s.t >= s.T) {
        if (s.onEnd) s.onEnd();
        this.visual.splice(i, 1);
        continue;
      }
      const d = s.t * s.speed;
      if (s.tracer) {
        fx.tracer(s.p.x + s.dir.x * d, s.p.y + s.dir.y * d, s.p.z + s.dir.z * d, -s.dir.x, -s.dir.y, -s.dir.z, Math.min(10, d), s.color[0], s.color[1], s.color[2]);
      }
    }
  }
}

// ------------------------------------------------------------------ Bordschütze
export class Gunner {
  constructor(side, heli) {
    this.side = side;
    this.heli = heli;
    this.rig = heli.model.guns[side];
    this.baseYaw = this.rig.mount.userData.baseYaw;
    this.yaw = 0;
    this.pitch = -0.3;
    this.reset();
  }

  reset() {
    this.ammo = GUN.ammo;
    this.cool = 0;
    this.burst = 0;
    this.pause = 0;
    this.target = null;
    this.retarget = 0;
    this.shots = 0;
    this.player = false;
    this.firing = false;
  }

  // Richtung im Hubschrauber-Koordinatensystem -> Schwenk/Neigung
  anglesTo(worldPoint, out) {
    const pivot = this.rig.mount.getWorldPosition(_w);
    _d.subVectors(worldPoint, pivot);
    const dist = _d.length();
    _q.copy(this.heli.quat).invert();
    _d.applyQuaternion(_q).divideScalar(dist || 1);
    out.yaw = wrapAngle(Math.atan2(-_d.x, -_d.z) - this.baseYaw);
    out.pitch = Math.asin(clamp(_d.y, -1, 1));
    out.dist = dist;
    return out;
  }

  inArc(a) { return Math.abs(a.yaw) < 1.35 && a.pitch > -1.2 && a.pitch < 0.35; }

  update(dt, game, aimInput, fireInput) {
    const h = this.heli;
    this.firing = false;
    if (h.crashed) return;
    this.cool -= dt;
    if (this.player) {
      this.yaw = clamp(this.yaw + aimInput.dx, -1.35, 1.35);
      this.pitch = clamp(this.pitch - aimInput.dy, -1.2, 0.35);
      if (fireInput) this.tryFire(game, 0.0035);
    } else {
      this.ai(dt, game);
    }
    this.rig.mount.rotation.y = this.baseYaw + this.yaw;
    this.rig.pitch.rotation.x = this.pitch;
  }

  ai(dt, game) {
    const h = this.heli;
    this.retarget -= dt;
    const a = this._a || (this._a = {});
    if (this.retarget <= 0) {
      this.retarget = 0.35;
      let best = null, bestScore = 1e9;
      for (const e of game.units.enemies) {
        if (!e.alive) continue;
        const dx = e.x - h.pos.x, dz = e.z - h.pos.z;
        const d = Math.hypot(dx, dz, e.y - h.pos.y);
        if (d > GUN.range) continue;
        if (!(e.reveal > 0 || d < 90)) continue;
        _v.set(e.x, e.y + 1, e.z);
        this.anglesTo(_v, a);
        if (!this.inArc(a)) continue;
        if (!game.world.los(h.pos.x, h.pos.y - 1, h.pos.z, e.x, e.y + 1.2, e.z)) continue;
        const score = d * (e.reveal > 0 ? 0.6 : 1) * (e.heavy ? 0.5 : 1) * (e === this.target ? 0.8 : 1);
        if (score < bestScore) { bestScore = score; best = e; }
      }
      if (best !== this.target && best) {
        this.burst = 0;
        this.pause = Math.max(this.pause, 0.6 + rand() * 0.8); // Reaktionszeit
        const dd = Math.hypot(best.x - h.pos.x, best.z - h.pos.z);
        this.err = new THREE.Vector3(rand() - 0.5, (rand() - 0.5) * 0.4, rand() - 0.5).normalize().multiplyScalar(5 + dd * 0.04);
      }
      this.target = best;
    }
    const t = this.target;
    let tyaw = 0, tpitch = -0.3, aligned = false;
    if (t && t.alive) {
      const d0 = Math.hypot(t.x - h.pos.x, t.y - h.pos.y, t.z - h.pos.z);
      const tt = d0 / GUN.muzzleVel;
      _v.set(t.x - h.vel.x * tt, t.y + 0.9 + 0.5 * G * tt * tt, t.z - h.vel.z * tt);
      _v.y -= h.vel.y * tt;
      if (this.err) { _v.add(this.err); this.err.multiplyScalar(Math.exp(-dt * 0.9)); }
      this.anglesTo(_v, a);
      if (this.inArc(a)) {
        tyaw = a.yaw; tpitch = a.pitch;
        aligned = Math.abs(wrapAngle(tyaw - this.yaw)) < 0.04 && Math.abs(tpitch - this.pitch) < 0.04;
      } else this.target = null;
    }
    const rate = 2.4 * dt;
    this.yaw += clamp(wrapAngle(tyaw - this.yaw), -rate, rate);
    this.pitch += clamp(tpitch - this.pitch, -rate, rate);
    if (t && aligned) {
      if (this.burst <= 0) {
        this.pause -= dt;
        if (this.pause <= 0) { this.burst = 8 + Math.floor(rand() * 10); this.pause = 0.35 + rand() * 0.6; }
      }
      if (this.burst > 0 && this.tryFire(game, 0.014)) this.burst--;
    }
  }

  tryFire(game, spread) {
    if (this.cool > 0) return false;
    if (this.ammo <= 0) {
      if (!this.emptyWarned) { this.emptyWarned = true; game.radio(`${this.side === 'left' ? 'Linker' : 'Rechter'} Schütze: Munition leer!`, 'Crew'); }
      return false;
    }
    this.emptyWarned = false;
    this.cool = 60 / GUN.rpm;
    this.ammo--;
    this.shots++;
    this.firing = true;
    const muzzle = this.rig.muzzle.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rig.pitch.getWorldQuaternion(_q));
    dir.x += (rand() - 0.5) * spread * 2; dir.y += (rand() - 0.5) * spread * 2; dir.z += (rand() - 0.5) * spread * 2;
    dir.normalize();
    game.combat.fire(muzzle, dir, this.heli.vel, this.shots % 2 === 0);
    game.effects.muzzle(muzzle.x + dir.x * 0.3, muzzle.y + dir.y * 0.3, muzzle.z + dir.z * 0.3, true);
    game.audio.shot('m60', game.camera.position.distanceTo(muzzle));
    return true;
  }
}
