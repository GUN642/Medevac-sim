// Fahrbare Fahrzeuge an der FOB (Dingo/MRAP bzw. M151-Jeep in Vietnam) mit Dach-MG und Rotpunktvisier.
// Zu Fuß einsteigen (E/Ⓐ), mit WAFFE/Tab zwischen Fahrersitz und MG wechseln, E/Ⓐ zum Aussteigen.
import * as THREE from './lib/three.module.min.js';
import { P, merge, vcMat } from './models.js';
import { dingoParts, mrapParts } from './afgModels.js';
import { T } from './theme.js';
import { HALF } from './config.js';
import { clamp, dist2 } from './util.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, s = 12) => new THREE.CylinderGeometry(r, r, h, s);

// M151 „Mutt“ mit MG-Pfosten (Vietnam)
function jeepParts() {
  const c = 0x4b5330;
  const p = [
    P(box(1.6, 0.55, 3.3), c, [0, 0.85, 0]),
    P(box(1.5, 0.3, 1.2), c, [0, 1.2, -1.0]),                        // Motorhaube
    P(box(1.5, 0.45, 0.05), 0x2a2d22, [0, 1.6, -0.35], [-0.15, 0, 0]),   // Windschutzrahmen
    P(box(1.3, 0.35, 0.03), 0x7f9aa8, [0, 1.6, -0.36], [-0.15, 0, 0]),
    P(box(0.5, 0.3, 0.45), 0x3a3f28, [-0.4, 1.25, 0.25]), P(box(0.5, 0.3, 0.45), 0x3a3f28, [0.4, 1.25, 0.25]),   // Sitze
    P(box(0.5, 0.45, 0.08), 0x3a3f28, [-0.4, 1.45, 0.5]), P(box(0.5, 0.45, 0.08), 0x3a3f28, [0.4, 1.45, 0.5]),
    P(box(0.4, 0.15, 0.05), 0x222222, [-0.4, 1.35, -0.55], [-0.5, 0, 0]),   // Lenkrad
    P(cyl(0.05, 1.1, 8), 0x2a2b28, [0, 1.6, 0.9]),                    // MG-Pfosten
    P(box(0.25, 0.2, 0.15), 0x2a2b28, [0, 0.95, -1.7]),               // Stoßstange
  ];
  for (const sx of [-1, 1]) for (const sz of [-1.05, 1.05]) p.push(P(cyl(0.38, 0.28, 12), 0x161616, [sx * 0.78, 0.4, sz], [0, 0, Math.PI / 2]));
  return p;
}

export class Vehicles {
  constructor(game) {
    this.g = game;
    this.list = [];
  }

  // Zwei bis drei Fahrzeuge im Fahrzeugpark der FOB
  buildFob() {
    const g = this.g, w = g.world, f = w.fob;
    const armed = !T.peaceful;
    const kinds = T.id === 'vietnam' ? ['jeep', 'jeep'] : T.peaceful ? ['dingo'] : ['dingo', 'mrap', 'dingo'];
    const pads = Object.values(f.pads || {});
    const spots = [];
    for (let k = 0; k < 64 && spots.length < kinds.length; k++) {
      const a = (k / 64) * Math.PI * 2 + 0.2, r = 95 + (k % 3) * 18;
      const x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
      if (pads.some((p) => dist2(p.x, p.z, x, z) < 32) || spots.some((s) => dist2(s.x, s.z, x, z) < 14)) continue;
      if (w.height(x, z) < 0.5 || w.normal(x, z).y < 0.97) continue;
      spots.push({ x, z, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI });
    }
    kinds.forEach((kind, i) => {
      const s = spots[i];
      if (!s) return;
      const parts = kind === 'jeep' ? jeepParts() : kind === 'mrap' ? mrapParts() : dingoParts();
      const obj = new THREE.Mesh(merge(parts), vcMat);
      obj.castShadow = true;
      g.scene.add(obj);
      const V = { kind, obj, pos: new THREE.Vector3(s.x, w.height(s.x, s.z), s.z), yaw: s.yaw, speed: 0, dead: false, drivable: true, name: kind === 'jeep' ? 'M151' : kind === 'mrap' ? 'MRAP' : 'Dingo 2' };
      if (armed && g.mounts) {
        const top = kind === 'jeep' ? 2.05 : kind === 'mrap' ? 3.15 : 2.75;
        V.mount = g.mounts.addVehicle(obj, top, null, V);
        g.mounts.addOptic(V.mount);
        V.mount.noAI = true;
        V.mount.crew.group.visible = false;
        V.mount.name = `MG auf ${V.name}`;
        if (kind === 'jeep') V.mount.yawG.position.z = 0.9;
      }
      this.place(V);
      this.list.push(V);
    });
  }

  place(V) {
    const w = this.g.world, p = V.pos;
    const fx = -Math.sin(V.yaw), fz = -Math.cos(V.yaw), rx = Math.cos(V.yaw), rz = -Math.sin(V.yaw);
    const hf = w.height(p.x + fx * 1.6, p.z + fz * 1.6), hb = w.height(p.x - fx * 1.6, p.z - fz * 1.6);
    const hr = w.height(p.x + rx * 0.9, p.z + rz * 0.9), hl = w.height(p.x - rx * 0.9, p.z - rz * 0.9);
    p.y = Math.max(0, (hf + hb + hr + hl) / 4);
    V.obj.position.copy(p);
    V.obj.rotation.set(Math.atan2(hf - hb, 3.2), V.yaw, Math.atan2(hl - hr, 1.8), 'YXZ');
    V.obj.updateMatrixWorld(true);
  }

  nearest(pos) {
    let best = null, bd = 4.2;
    for (const V of this.list) {
      const d = dist2(V.pos.x, V.pos.z, pos.x, pos.z);
      if (d < bd && Math.abs(V.pos.y - pos.y) < 3) { bd = d; best = V; }
    }
    return best;
  }

  // Einsteigen als Fahrer
  enter(V, silent) {
    const S = this.g.soldier;
    if (S.mount) this.g.mounts.dismount(true);
    S.drive = V;
    V.driver = true;
    S.yaw = V.yaw; S.pitch = -0.15;
    S.group.visible = false;
    if (!silent) this.g.radio(`Sie fahren den ${V.name}.${V.mount ? ' WAFFE/Tab: ans MG.' : ''} E/Ⓐ zum Aussteigen.`, 'Crew', false, true);
  }

  // Aussteigen neben der Fahrertür
  exit() {
    const S = this.g.soldier, V = S.drive;
    if (!V) return;
    S.drive = null;
    V.driver = false;
    const rx = Math.cos(V.yaw), rz = -Math.sin(V.yaw);
    const x = V.pos.x - rx * 2.2, z = V.pos.z - rz * 2.2;
    S.pos.set(x, Math.max(0, this.g.world.height(x, z)), z);
    S.vy = 0;
    S.group.visible = true;
    S.sync();
  }

  // Fahrersitz <-> MG
  swapSeat() {
    const S = this.g.soldier;
    if (S.drive && S.drive.mount) { const V = S.drive; S.drive = null; V.driver = false; this.g.mounts.mount(V.mount, true); return true; }
    if (S.mount && S.mount.veh && S.mount.veh.drivable) { const V = S.mount.veh; this.g.mounts.dismount(true); this.enter(V, true); return true; }
    return false;
  }

  // Fahrphysik (Arcade): Gas/Bremse und Lenkung aus dem Bewegungs-Stick, Gelände folgen
  drive(dt, move) {
    const V = this.g.soldier.drive, w = this.g.world;
    const thr = clamp(move.y, -1, 1), steer = clamp(move.x, -1, 1);
    if (thr > 0.05) V.speed += (V.speed < 0 ? 9 : 4.5) * thr * dt;
    else if (thr < -0.05) V.speed += (V.speed > 0 ? 9 : 3) * thr * dt;
    else V.speed -= Math.sign(V.speed) * Math.min(Math.abs(V.speed), 2.5 * dt);
    V.speed = clamp(V.speed, -5, V.kind === 'jeep' ? 20 : 17);
    V.yaw -= steer * 0.9 * clamp(V.speed / 6, -1, 1) * dt;
    this.move(V, dt);
  }

  move(V, dt) {
    const w = this.g.world;
    const fx = -Math.sin(V.yaw), fz = -Math.cos(V.yaw);
    const nx = V.pos.x + fx * V.speed * dt, nz = V.pos.z + fz * V.speed * dt;
    const h0 = w.height(V.pos.x, V.pos.z), h1 = w.height(nx, nz);
    // nicht ins Wasser, nicht steile Hänge hinauf, nicht aus dem Einsatzgebiet
    if (h1 < 0.3 || (h1 - h0) / Math.max(0.01, Math.abs(V.speed * dt)) > 0.9 || Math.abs(nx) > HALF - 60 || Math.abs(nz) > HALF - 60) V.speed *= -0.2;
    else { V.pos.x = nx; V.pos.z = nz; }
    if (w.trunkPush) { const before = V.pos.x + V.pos.z; w.trunkPush(V.pos); if (Math.abs(V.pos.x + V.pos.z - before) > 0.01) V.speed *= 0.5; }
    this.place(V);
  }

  // führerlose Fahrzeuge rollen aus
  update(dt) {
    for (const V of this.list) {
      if (V.driver || Math.abs(V.speed) < 0.01) continue;
      V.speed -= Math.sign(V.speed) * Math.min(Math.abs(V.speed), 3 * dt);
      this.move(V, dt);
    }
  }
}
