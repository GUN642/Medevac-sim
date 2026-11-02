// Hubschrauber: Flugmodell (arcade-nah mit Flugassistent), Treibstoff, Schaden, Kabine – Werte je nach Typ
import * as THREE from './lib/three.module.min.js';
import { FUEL, G, HALF } from './config.js';
import { Figure } from './models.js';
import { buildHeliModel } from './heliModels.js';
import { HELI_TYPES, T, figFor } from './theme.js';
import { clamp, damp, rand } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Helicopter {
  constructor(scene, effects, index = 0, type = 'uh1d') {
    this.scene = scene;
    this.effects = effects;
    this.index = index;
    this.seatFigs = [];
    this.setType(type);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.up = new THREE.Vector3(0, 1, 0);
    this.fwd = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.events = [];
    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3();

    // Blob-Schatten
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    scene.add(this.shadow);

    this.smokeEmitter = null;
  }

  // Hubschraubertyp wechseln (neues Modell, andere Flugwerte)
  setType(type) {
    this.type = HELI_TYPES[type] ? type : 'uh1d';
    this.spec = HELI_TYPES[this.type];
    if (this.model) this.scene.remove(this.model.group);
    this.model = buildHeliModel(this.spec, { number: this.spec.numbers[this.index % this.spec.numbers.length] });
    // eigene Materialkopien (zum Abdunkeln nach einem Absturz)
    this.model.tint = [this.model.body, this.model.detail].filter(Boolean).map((m) => (m.material = m.material.clone()));
    this.model.rotorHome = this.model.mainRotor.position.clone();
    // Luftwiderstand so, dass bei voll nach vorn gedrücktem Stick die Höchstgeschwindigkeit erreicht wird
    const S = this.spec;
    if (S.vmax) { const v = S.vmax * 0.5144 * 1.2; this.kDrag = Math.max(0.0001, (G * Math.tan(S.maxPitch) - 0.05 * v) / (v * v)); }
    else this.kDrag = 0.0009 * S.drag;
    this.model.rotorCenters = this.model.spin.filter((r) => r[1] === 'y').map((r) => r[0].position.clone());
    this.model.group.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(this.model.group);
    this.seatFigs = [];
    if (this.passengers) this.updatePassengerDisplay();
  }

  reset(x, y, z, yaw) {
    this.pos.set(x, y + this.spec.skidH, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw; this.pitch = 0; this.roll = 0; this.yawRate = 0;
    this.rpm = 0.35;
    this.engineOn = true;
    this.fuel = 100;
    this.hp = 100;
    this.leak = false;
    this.crashed = false;
    this.crashCause = '';
    this.contact = true;
    this.onGround = true;
    this.groundTime = 2;
    this.thrust = 0;
    this.thrustFrac = 0;
    this.agl = 0;
    this.passengers = [];
    this.treeWarn = 0;
    this.boundaryWarn = false;
    this.damageTaken = 0;
    this.lastHit = -10;
    for (const m of this.model.tint) m.color.setRGB(1, 1, 1);
    this.model.group.visible = true;
    this.model.mainRotor.rotation.set(0, 0, 0);
    this.model.mainRotor.position.copy(this.model.rotorHome);
    this.updatePassengerDisplay();
    if (this.smokeEmitter) { this.effects.removeEmitter(this.smokeEmitter); this.smokeEmitter = null; }
    if (this.fireEmitter) { this.effects.removeEmitter(this.fireEmitter); this.fireEmitter = null; }
    this.syncModel();
  }

  get mass() { const S = this.spec; return S.emptyMass + (S.fuelMassFull * this.fuel) / 100 + this.passengers.length * S.paxMass; }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }

  addPassenger(p) { this.passengers.push(p); this.updatePassengerDisplay(); }
  removePassenger() { const p = this.passengers.pop(); this.updatePassengerDisplay(); return p; }

  updatePassengerDisplay() {
    const seats = this.model.seats;
    const list = this.passengers.concat(Array.from({ length: this.playerPax || 0 }, () => ({ type: 'us' })));
    for (let i = 0; i < seats.length; i++) {
      const p = list[i];
      let f = this.seatFigs[i];
      if (p) {
        if (!p.fig) p.fig = figFor(p.type);
        const type = p.fig;
        if (!f || f.type !== type) {
          if (f) this.model.group.remove(f.group);
          f = new Figure(type);
          const s = seats[i];
          f.group.position.set(s.p[0], 0, s.p[1]);
          f.group.rotation.y = s.r;
          f.sit(s.sit[0], s.sit[1]);
          this.model.group.add(f.group);
          this.seatFigs[i] = f;
        }
        f.group.visible = true;
      } else if (f) f.group.visible = false;
    }
  }

  // Tür-Punkt am Boden (für ein-/aussteigende Soldaten)
  doorPoint(side, out = new THREE.Vector3()) {
    if (this.spec.door === 'ramp') out.set(side === 'left' ? -0.9 : 0.9, -this.spec.skidH, this.spec.rampZ + 1.6);
    else out.set(side === 'left' ? -2.2 : 2.2, -this.spec.skidH, 0.2);
    out.applyQuaternion(this.quat).add(this.pos);
    return out;
  }

  takeDamage(n, kind = 'bullet') {
    if (this.crashed) return;
    if (kind === 'bullet') n *= this.spec.armor || 1;   // Kampfhubschrauber sind gepanzert
    this.hp -= n;
    this.damageTaken += n;
    this.lastHit = performance.now() / 1000;
    if (kind === 'bullet' && !this.leak && this.hp < 80 && rand() < 0.04) { this.leak = true; this.events.push('leak'); }
    if (this.hp <= 0) { this.hp = 0; this.crash(kind === 'bullet' ? 'Abgeschossen!' : 'Hubschrauber zerstört!'); }
  }

  crash(cause) {
    if (this.crashed) return;
    this.crashed = true;
    this.crashCause = cause;
    this.engineOn = false;
    this.events.push('crash');
    this.effects.explosion(this.pos.x, this.pos.y, this.pos.z, 1.2);
    for (const m of this.model.tint) m.color.setRGB(0.3, 0.28, 0.26);
    this.crashTimer = 0;
    this.yawRate = 2.5 + rand() * 2;
  }

  update(dt, ctl, world, assist = true) {
    const m = this.model;
    if (this.crashed) { this.updateCrashed(dt, world); this.animate(dt); return; }

    // Triebwerk / Rotor
    if (this.engineOn) this.rpm = Math.min(1, this.rpm + dt * 0.3);
    else this.rpm = Math.max(0.6, this.rpm - dt * (this.vel.y < -3 ? 0.005 : 0.04));

    if (this.engineOn) {
      const burn = (FUEL.idleBurn + FUEL.thrustBurn * this.thrustFrac) * (this.leak ? 2.5 : 1) * this.spec.burn;
      this.fuel -= burn * dt;
      this.burnRate = burn;
      if (this.fuel <= 0) { this.fuel = 0; this.engineOn = false; this.events.push('flameout'); }
    } else this.burnRate = 0;

    const S = this.spec;
    const mass = this.mass, W = mass * G;
    const ground = world.groundHeight(this.pos.x, this.pos.z);
    this.agl = this.pos.y - S.skidH - ground;
    const ge = 1 + 0.12 * clamp(1 - this.agl / 11, 0, 1);
    const power = (this.engineOn ? 1 : 0.58) * (this.hp < 25 ? 0.87 : 1);
    const Tmax = S.maxThrust * ge * power * this.rpm * this.rpm;

    // Lage
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    this.fwd.set(-sy, 0, -cy);
    this.right.set(cy, 0, -sy);
    const vf = this.vel.dot(this.fwd), vr = this.vel.dot(this.right);
    const hs = Math.hypot(vf, vr);
    let tp = -ctl.pitch * S.maxPitch;
    let tr = -ctl.roll * S.maxRoll;
    if (assist) {
      const ap = 1 - Math.min(1, Math.abs(ctl.pitch) / 0.15);
      const ar = 1 - Math.min(1, Math.abs(ctl.roll) / 0.15);
      tp += clamp(vf * 0.03, -0.26, 0.26) * ap;
      tr += clamp(vr * 0.04, -0.26, 0.26) * ar;
    }
    const k = damp(3.2 * S.agility, dt);
    this.pitch += (tp - this.pitch) * k;
    this.roll += (tr - this.roll) * k;

    const speedFac = clamp((hs - 10) / 25, 0, 1);
    let yt = -ctl.yaw * S.yawRate * (1 - 0.45 * speedFac) + this.roll * 1.1 * speedFac;
    if (vf > 8) yt += -Math.atan2(vr, vf) * 1.4 * speedFac;
    if (this.contact) yt *= this.thrust > 0.7 * W ? 0.5 : 0;
    this.yawRate += (yt - this.yawRate) * damp(3 * S.agility, dt);
    this.yaw += this.yawRate * dt;

    // Rotorkreisebene (bestimmt die Schubrichtung) und Rumpflage getrennt: Im Reiseflug liegt der Rumpf
    // fast waagerecht, nur beim Beschleunigen und Abbremsen neigt sich die Nase deutlich.
    this.euler.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.quat.setFromEuler(this.euler);
    this.up.copy(UP).applyQuaternion(this.quat);
    const dragAcc = this.kDrag * vf * vf + 0.05 * Math.abs(vf);
    const trim = Math.sign(vf) * Math.atan(dragAcc / G) * 0.88;
    this.bodyPitch = this.pitch + trim;
    if (Math.abs(trim) > 0.001) {
      this.euler.set(this.bodyPitch, this.yaw, this.roll, 'YXZ');
      this.quat.setFromEuler(this.euler);
    }

    // Schub (Kollektiv als Steig-/Sinkratenvorgabe)
    let vyT = ctl.collective >= 0 ? ctl.collective * S.climbRate : ctl.collective * S.sinkRate;
    if (this.contact && ctl.collective < 0.08) vyT = -3;
    else if (assist && vyT < 0 && this.agl < 8) vyT = Math.max(vyT, -1.5 - this.agl * 0.55); // Landehilfe
    if (this.pos.y > 2400) vyT = Math.min(vyT, 0);
    const cosT = Math.max(this.up.y, 0.35);
    const Treq = (mass * (G + (vyT - this.vel.y) * 2.2)) / cosT;
    this.thrust = clamp(Treq, 0, Tmax);
    this.thrustFrac = this.thrust / S.maxThrust;

    // Kräfte
    const a = this._v.copy(this.up).multiplyScalar(this.thrust / mass);
    a.y -= G;
    const df = -(this.kDrag * Math.abs(vf) * vf + 0.05 * vf);
    const dr = -(0.006 * Math.abs(vr) * vr + 0.3 * vr);
    a.x += this.fwd.x * df + this.right.x * dr;
    a.z += this.fwd.z * df + this.right.z * dr;
    a.y -= 0.01 * Math.abs(this.vel.y) * this.vel.y + 0.15 * this.vel.y;
    // Böen und Turbulenz über der heißen Wüste
    if (T.gusts && !this.contact) {
      const t = this.gustT = (this.gustT || rand() * 100) + dt;
      const gs = T.gusts * (0.4 + 0.6 * Math.max(0, Math.sin(t * 0.13) * Math.sin(t * 0.071 + 1)));
      const sizeK = 7.3 / S.rotorRadius;
      a.x += (Math.sin(t * 0.37) + 0.5 * Math.sin(t * 1.3 + 2)) * 1.1 * gs * sizeK;
      a.z += (Math.cos(t * 0.29 + 1) + 0.5 * Math.sin(t * 1.7)) * 1.1 * gs * sizeK;
      a.y += Math.sin(t * 2.3) * Math.sin(t * 0.9 + 3) * 1.4 * gs * sizeK;
      this.gustLevel = gs;
    }
    // Kartenrand
    this.boundaryWarn = false;
    const lim = HALF - 180;
    if (Math.abs(this.pos.x) > lim) { a.x -= Math.sign(this.pos.x) * (Math.abs(this.pos.x) - lim) * 0.12; this.boundaryWarn = true; }
    if (Math.abs(this.pos.z) > lim) { a.z -= Math.sign(this.pos.z) * (Math.abs(this.pos.z) - lim) * 0.12; this.boundaryWarn = true; }
    this.vel.addScaledVector(a, dt);
    this.pos.addScaledVector(this.vel, dt);

    // Bodenkontakt
    const gh = world.height(this.pos.x, this.pos.z);
    const gnd = Math.max(gh, 0);
    const water = gh < -0.05;
    const bottom = this.pos.y - S.skidH;
    if (bottom <= gnd) {
      if (!this.contact) {
        const vy = this.vel.y, h2 = this.speed;
        const tilt = Math.acos(clamp(this.up.y, -1, 1));
        if (water && (vy < -1.5 || h2 > 4)) { this.crash('Notwasserung im Fluss!'); }
        else if (vy < -9 || h2 > 22 || tilt > 0.75) this.crash('Absturz – zu harte Landung!');
        else if (vy < -4.2 || h2 > 9) {
          this.takeDamage((-vy - 4.2) * 9 + Math.max(0, h2 - 9) * 2.5, 'impact');
          this.events.push('hardlanding');
        } else this.events.push('touchdown');
      }
      this.pos.y = gnd + S.skidH;
      if (this.vel.y < 0) this.vel.y = 0;
      const fr = damp(this.thrust > 0.9 * W ? 0.8 : 5, dt);
      this.vel.x *= 1 - fr;
      this.vel.z *= 1 - fr;
      this.contact = true;
      if (water) { this.takeDamage(4 * dt, 'impact'); this.events.push('water'); }
      if (this.thrust < 0.95 * W) {
        const n = world.normal(this.pos.x, this.pos.z, this._n);
        const tP = -Math.asin(clamp(n.dot(this.fwd), -1, 1));
        const tR = -Math.asin(clamp(n.dot(this.right), -1, 1));
        const kk = damp(8, dt);
        this.pitch += (tP - this.pitch) * kk;
        this.roll += (tR - this.roll) * kk;
        this.slope = Math.acos(n.y);
        if (this.slope > 0.33) {
          this.vel.x += n.x * 4 * dt; this.vel.z += n.z * 4 * dt;
          this.events.push('slope');
        }
      }
    } else this.contact = false;
    this.onGround = this.contact && this.speed < 1.6 && Math.abs(this.vel.y) < 0.8;
    this.groundTime = this.onGround ? this.groundTime + dt : 0;

    // Bäume
    let tc = null;
    for (const rc of this.model.rotorCenters) {
      const wx = this.pos.x + this.fwd.x * -rc.z, wz = this.pos.z + this.fwd.z * -rc.z;
      const c = world.treeContact(wx, wz, S.rotorRadius * 0.85, this.pos.y - S.skidH, this.pos.y + S.rotorTop);
      if (c && (!tc || c.pen > tc.pen)) tc = c;
    }
    if (tc) {
      const dx = this.pos.x - tc.x, dz = this.pos.z - tc.z;
      const l = Math.hypot(dx, dz) || 1;
      this.vel.x += (dx / l) * 14 * dt; this.vel.z += (dz / l) * 14 * dt;
      this.vel.y = Math.max(this.vel.y, 0.5);
      this.vel.multiplyScalar(1 - damp(2, dt));
      this.takeDamage(28 * dt, 'impact');
      this.treeWarn = 0.5;
      if (tc.pen > 6 && this.pos.y < tc.top - 5) this.crash(T.crashTrees);
      if (rand() < dt * 8) this.effects.puff(tc.x + dx * 0.4, Math.min(this.pos.y + 2.5, tc.top), tc.z + dz * 0.4, 0.22, 0.4, 0.15, 2, 1.5, 3, 1);
    }
    this.treeWarn = Math.max(0, this.treeWarn - dt);

    this.fx(dt, world);
    this.syncModel();
    this.animate(dt);
  }

  // Rotorabwind und Schadensrauch (lokal und für Hubschrauber anderer Spieler)
  fx(dt, world) {
    if (this.crashed) return;
    // Rotorabwind-Staub
    const dustH = 22 * Math.sqrt(this.spec.rotorRadius / 7.3) * (T.dust > 1 ? 1.4 : 1);
    const inFob0 = Math.hypot(this.pos.x - world.fob.x, this.pos.z - world.fob.z) < 220;
    const bo = T.dust > 1 && !inFob0 && this.rpm > 0.5 ? clamp(1 - this.agl / (dustH * 0.55), 0, 1) * Math.min(1, this.thrustFrac * 1.4) * world.dustAt(this.pos.x, this.pos.z) : 0;
    this.brownout = (this.brownout || 0) + (bo - (this.brownout || 0)) * Math.min(1, dt * (bo > (this.brownout || 0) ? 0.8 : 2));
    if (this.rpm > 0.5 && this.agl < dustH) {
      const rate = (1 - this.agl / dustH) * 70 * Math.max(0.3, this.thrustFrac) * this.effects.mul * T.dust * (this.spec.rotorRadius / 7.3);
      const rr = this.spec.rotorRadius / 7.3;
      this.dustAcc = (this.dustAcc || 0) + rate * dt;
      const inFob = Math.hypot(this.pos.x - world.fob.x, this.pos.z - world.fob.z) < 220;
      while (this.dustAcc > 1) {
        this.dustAcc -= 1;
        const ang = rand() * Math.PI * 2, r = (3 + rand() * 7) * rr;
        const px = this.pos.x + Math.cos(ang) * r, pz = this.pos.z + Math.sin(ang) * r;
        const ph = world.height(px, pz);
        const sp = 8 + rand() * 6;
        if (ph < 0) this.effects.dust(px, 0.3, pz, Math.cos(ang) * sp, Math.sin(ang) * sp, 0.82, 0.85, 0.82, 1.2);
        else if (T.dust > 1 && !inFob && world.dustAt(px, pz) > 0.5) this.effects.dust(px, ph + 0.4, pz, Math.cos(ang) * sp * rr, Math.sin(ang) * sp * rr, 0.86, 0.77, 0.6, 3.2 * Math.sqrt(rr), 2.2, 0.7, 2.4); // Brownout
        else if (T.dust > 1) this.effects.dust(px, ph + 0.4, pz, Math.cos(ang) * sp * rr, Math.sin(ang) * sp * rr, 0.7, 0.62, 0.5, 1.8, 1.2, 0.45);
        else if (inFob) this.effects.dust(px, ph + 0.4, pz, Math.cos(ang) * sp, Math.sin(ang) * sp, 0.62, 0.45, 0.32, 1.5);
        else this.effects.dust(px, ph + 0.4, pz, Math.cos(ang) * sp, Math.sin(ang) * sp, 0.52, 0.5, 0.36, 1.3);
      }
    }

    // Schadensrauch
    if (this.hp < 50 && !this.smokeEmitter) {
      this.smokeEmitter = this.effects.addEmitter({ type: 'damage', rate: 12, acc: 0, src: () => (this.crashed ? null : this.exhaustPos()) });
    }
    if (this.smokeEmitter) { this.smokeEmitter.dark = this.hp < 25; this.smokeEmitter.fire = this.hp < 15; }
    if (this.hp >= 50 && this.smokeEmitter) { this.effects.removeEmitter(this.smokeEmitter); this.smokeEmitter = null; }

  }

  // ---------------------------------------------------------------- Netzwerk
  getState() {
    const p = this.pos, q = this.quat, v = this.vel;
    const f = (this.crashed ? 1 : 0) | (this.engineOn ? 2 : 0) | (this.contact ? 4 : 0) | (this.onGround ? 8 : 0) | (this.leak ? 16 : 0);
    const r = (x, n = 100) => Math.round(x * n) / n;
    return [r(p.x), r(p.y), r(p.z), r(q.x, 1e4), r(q.y, 1e4), r(q.z, 1e4), r(q.w, 1e4), r(v.x), r(v.y), r(v.z),
      r(this.rpm), r(this.fuel), r(this.hp), f, r(this.yaw, 1e3), r(this.thrustFrac), r(this.damageTaken), r(this.agl)];
  }

  applyState(st, cause) {
    if (!this.net) this.net = { p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), t: 0 };
    const n = this.net;
    const jump = n.t === 0 || this.pos.distanceTo(n.p.set(st[0], st[1], st[2])) > 60;
    n.p.set(st[0], st[1], st[2]); n.v.set(st[7], st[8], st[9]); n.q.set(st[3], st[4], st[5], st[6]); n.t = performance.now();
    if (jump) { this.pos.copy(n.p); this.quat.copy(n.q); }
    this.vel.copy(n.v);
    this.rpm = st[10]; this.fuel = st[11];
    const hp0 = this.hp;
    this.hp = st[12];
    this.hpDrop = Math.max(0, hp0 - this.hp);
    const f = st[13];
    this.engineOn = !!(f & 2); this.contact = !!(f & 4); this.onGround = !!(f & 8); this.leak = !!(f & 16);
    this.yaw = st[14]; this.thrustFrac = st[15]; this.damageTaken = st[16]; this.agl = st[17];
    if ((f & 1) && !this.crashed) this.crash(cause || 'Abgestürzt!');
    if (!(f & 1) && this.crashed) { this.reset(n.p.x, n.p.y - this.spec.skidH, n.p.z, this.yaw); this.pos.copy(n.p); this.quat.copy(n.q); }
  }

  // Hubschrauber, dessen Flugphysik ein anderes Gerät berechnet
  updateRemote(dt, world) {
    if (this.net && this.net.t) {
      const n = this.net;
      const age = Math.min(0.4, (performance.now() - n.t) / 1000);
      const tx = n.p.x + n.v.x * age, ty = n.p.y + n.v.y * age, tz = n.p.z + n.v.z * age;
      const k = damp(12, dt);
      this.pos.x += (tx - this.pos.x) * k; this.pos.y += (ty - this.pos.y) * k; this.pos.z += (tz - this.pos.z) * k;
      this.quat.slerp(n.q, k);
    }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    this.fwd.set(-sy, 0, -cy);
    this.right.set(cy, 0, -sy);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);
    this.fx(dt, world);
    this.syncModel();
    this.animate(dt);
  }

  exhaustPos() { return this.model.group.localToWorld(this.model.exhaust.clone()); }

  updateCrashed(dt, world) {
    this.crashTimer += dt;
    const gnd = world.groundHeight(this.pos.x, this.pos.z);
    if (this.pos.y - this.spec.skidH > gnd + 0.1) {
      this.vel.y -= G * dt;
      this.vel.x *= 1 - damp(0.4, dt); this.vel.z *= 1 - damp(0.4, dt);
      this.pos.addScaledVector(this.vel, dt);
      this.yaw += this.yawRate * dt;
      this.roll += dt * 0.6;
      if (this.pos.y - this.spec.skidH <= gnd) {
        this.pos.y = gnd + this.spec.skidH - 0.4;
        this.effects.explosion(this.pos.x, this.pos.y, this.pos.z, 1.5);
        this.events.push('impact');
        this.vel.set(0, 0, 0);
      }
    } else {
      this.pos.y = gnd + this.spec.skidH - 0.4;
      this.vel.set(0, 0, 0);
      this.yawRate *= 1 - damp(3, dt);
      if (!this.fireEmitter) this.fireEmitter = this.effects.wreckFire(this.pos.x, gnd, this.pos.z);
    }
    this.rpm = Math.max(0, this.rpm - dt * 0.4);
    this.euler.set(this.pitch, this.yaw, Math.min(this.roll, 1.4), 'YXZ');
    this.quat.setFromEuler(this.euler);
    this.syncModel();
  }

  syncModel() {
    const g = this.model.group;
    g.position.copy(this.pos);
    g.quaternion.copy(this.quat);
    g.updateMatrixWorld(true);
  }

  animate(dt) {
    const m = this.model;
    for (const [obj, axis, rate] of m.spin) obj.rotation[axis] += this.rpm * rate * dt;
    m.discMat.opacity = this.rpm > 0.3 ? 0.08 + this.rpm * 0.08 : 0;
    const t = performance.now() / 1000;
    m.beaconMat.color.setHex(!this.crashed && (t % 1.2) < 0.12 ? 0xff2020 : 0x400000);
    // Schatten
    const gnd = this.agl;
    const s = this.spec.shadow + Math.min(gnd, 60) * 0.1;
    this.shadow.visible = gnd < 120 && !(this.realShadows && gnd < 30);
    this.shadow.position.set(this.pos.x + 0, this.pos.y - this.spec.skidH - gnd + 0.25, this.pos.z);
    this.shadow.scale.set(s, s * (this.spec.door === 'ramp' ? 1.8 : 1.25), 1);
    this.shadow.rotation.z = this.yaw;
    this.shadow.material.opacity = Math.max(0, 1 - gnd / 120);
  }
}
