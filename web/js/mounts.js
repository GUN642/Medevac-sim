// Besetzbare schwere MGs: Stellungen an der FOB-Mauer und Dachlafetten der Konvoi-Fahrzeuge.
// Unbesetzt schießt ein KI-Schütze (nur Host), der Spieler kann zu Fuß einsteigen (E / Ⓐ) und selbst feuern.
import * as THREE from './lib/three.module.min.js';
import { P, merge, vcMat, m2Geo, Figure, eotechParts } from './models.js';
import { T } from './theme.js';
import { rand, dist2, clamp } from './util.js';

// Waffe am Lafettenplatz (schweres MG M2, Kaliber .50)
export const MOUNT_WEAPON = {
  id: 'm2', name: 'M2 .50', desc: 'schweres MG', mag: 100, reserve: 1000, rpm: 550, auto: true, vel: 890,
  spread: 0.006, fov: 30, reload: 5.5, sound: 'dshk', tracer: 3, recoil: 0.003, big: true, sight: [0.13, 0.3, -1.5, 0.5],
};

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
let gunGeo = null, nestGeo = null, ringGeo = null;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

// Sandsackstellung mit Dreibein (offen nach hinten)
function nestParts() {
  const p = [];
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.75 + (i / 8) * Math.PI * 1.5 + (layer % 2) * 0.09;
      p.push(P(box(0.62, 0.26, 0.36), layer % 2 ? 0xa48f68 : 0x9a8660, [Math.sin(a) * 1.55, 0.13 + layer * 0.26, -Math.cos(a) * 1.55], [0, -a, 0]));
    }
  }
  for (const a of [0, 2.1, -2.1]) p.push(P(box(0.05, 1.05, 0.05), 0x2a2b28, [Math.sin(a) * 0.35, 0.45, -Math.cos(a) * 0.35 + 0.1], [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]));
  p.push(P(cyl(0.05, 0.06, 0.25, 8), 0x2a2b28, [0, 0.95, 0]));
  return p;
}

export class Mounts {
  constructor(game) {
    this.g = game;
    this.list = [];
    if (!gunGeo) { gunGeo = m2Geo(); nestGeo = merge(nestParts()); ringGeo = merge([P(cyl(0.45, 0.45, 0.12, 14), 0x34362f, [0, 0, 0]), P(box(0.9, 0.3, 0.05), 0x3d4134, [0, 0.12, -0.55]), P(box(0.05, 0.3, 0.45), 0x3d4134, [0.45, 0.12, -0.32]), P(box(0.05, 0.3, 0.45), 0x3d4134, [-0.45, 0.12, -0.32])]); }
  }

  // Gemeinsamer Aufbau: Schwenkgruppe (Seite) und Höhengruppe mit Waffe und KI-Schütze
  makeGun(parent, pos, kind, extra = {}) {
    const yawG = new THREE.Group();
    yawG.position.copy(pos);
    parent.add(yawG);
    const pitchG = new THREE.Group();
    pitchG.position.set(0, kind === 'veh' ? 0.3 : 1.12, 0);
    yawG.add(pitchG);
    if (kind === 'veh') yawG.add(new THREE.Mesh(ringGeo, vcMat));       // Drehring mit Schutzschild
    const gun = new THREE.Mesh(gunGeo, vcMat);
    gun.castShadow = true;
    pitchG.add(gun);
    const crew = new Figure(kind === 'veh' ? T.friend() : T.friend());
    crew.group.position.set(0, kind === 'veh' ? -0.95 : 0, 0.85);
    yawG.add(crew.group);
    const M = {
      kind, yawG, pitchG, crew, arc: kind === 'veh' ? Math.PI : 1.4, yaw: 0, pitch: 0, occupied: false,
      ammo: { mag: MOUNT_WEAPON.mag, res: MOUNT_WEAPON.reserve }, fireT: rand() * 3, burst: 0, shotT: 0, tgt: null, ...extra,
    };
    this.list.push(M);
    return M;
  }

  // Stellungen an der FOB-Mauer (nicht bei friedlichen Karten)
  buildFob() {
    if (T.peaceful) return;
    const f = this.g.world.fob, scene = this.g.scene;
    // Podest direkt hinter der Mauer, hoch genug zum Darüber-Schießen (HESCO 2,3 m, Sandsäcke 1,3 m)
    const ph = T.id === 'afghanistan' || T.id === 'mali' || T.id === 'ukraine' ? 1.75 : 0.65;
    const podGeo = merge([
      P(box(3.6, ph, 3.4), 0x8a7550, [0, -ph / 2, 0]),
      P(box(3.7, 0.08, 3.5), 0x6b5a3e, [0, -0.04, 0]),
      ...[-0.35, 0.35].map((x) => P(box(0.06, ph + 0.2, 0.06), 0x5a4a30, [x, -ph / 2, 1.95], [-0.3, 0, 0])),
      ...Array.from({ length: Math.max(2, Math.round(ph / 0.35)) }, (_, k) => P(box(0.7, 0.05, 0.06), 0x5a4a30, [0, -ph + 0.3 + k * 0.35, 1.95 - (k * 0.35 + 0.3 - ph) * -0.31])),
    ]);
    [15, 120, 195, 300].forEach((deg, i) => {
      const a = (deg * Math.PI) / 180;
      const x = f.x + Math.cos(a) * 201, z = f.z + Math.sin(a) * 201, y = Math.max(0, this.g.world.height(x, z)) + ph;
      const base = new THREE.Group();
      base.position.set(x, y, z);
      base.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));       // nach außen
      base.add(new THREE.Mesh(nestGeo, vcMat));
      base.add(new THREE.Mesh(podGeo, vcMat));
      scene.add(base);
      this.makeGun(base, new THREE.Vector3(0, 0, 0), 'fob', { base, name: `MG-Stellung ${i + 1}` });
    });
  }

  // Dachlafette auf einem Konvoi-Fahrzeug
  addVehicle(obj, top, convoyId, veh) {
    return this.makeGun(obj, new THREE.Vector3(0, top, 0.3), 'veh', { convoyId, veh, name: 'Dachlafette' });
  }

  removeConvoy(id) {
    for (const M of this.list.filter((x) => x.convoyId === id)) {
      if (M.occupied && this.g.soldier.mount === M) this.dismount();
      M.yawG.parent && M.yawG.parent.remove(M.yawG);
    }
    this.list = this.list.filter((x) => x.convoyId !== id);
  }

  worldYaw(M) { M.yawG.parent.getWorldQuaternion(_q); _e.setFromQuaternion(_q, 'YXZ'); return _e.y; }
  seatPos(M, out) { M.yawG.updateWorldMatrix(true, false); return M.yawG.localToWorld(out.set(0, M.kind === 'veh' ? -0.95 : 0, 0.85)); }
  eyePos(M, out) { M.pitchG.updateWorldMatrix(true, false); return M.pitchG.localToWorld(M.optic ? out.set(0, 0.23, 0.42) : out.set(0, 0.33, 0.95)); }
  muzzle(M, out) { M.pitchG.updateWorldMatrix(true, false); return M.pitchG.localToWorld(out.set(0, 0.01, -1.63)); }

  // nächste freie Lafette für den Spieler zu Fuß
  nearest(pos) {
    let best = null, bd = 1e9;
    for (const M of this.list) {
      if (M.occupied || (M.veh && M.veh.dead)) continue;
      const s = this.seatPos(M, _v);
      const d = dist2(s.x, s.z, pos.x, pos.z), lim = M.kind === 'veh' ? 4.5 : 2.6;
      if (d < lim && d < bd && Math.abs(s.y - pos.y) < 4) { bd = d; best = M; }
    }
    return best;
  }

  // Rotpunktvisier (EOTech) auf dem MG; Blick genau durch das Fenster
  addOptic(M) {
    M.optic = true;
    const o = new THREE.Mesh(merge(eotechParts(0.23, 0.2, 0.125)), vcMat);
    M.pitchG.add(o);
  }

  mount(M, silent) {
    const S = this.g.soldier;
    M.occupied = true;
    M.crew.group.visible = false;
    S.mount = M;
    S.reloadT = 0;
    S.yaw = this.worldYaw(M) + M.yaw;
    S.pitch = M.pitch;
    if (!silent) this.g.radio(M.veh && M.veh.drivable ? `Sie bedienen das ${M.name}. WAFFE/Tab: ans Steuer, E/Ⓐ zum Aussteigen.` : M.kind === 'veh' ? 'Sie bedienen das MG auf dem Fahrzeug – Konvoi fährt mit Ihnen. E/Ⓐ zum Absitzen.' : `Sie besetzen die ${M.name}. E/Ⓐ zum Verlassen.`, 'Crew', false, true);
  }

  dismount(silent) {
    const S = this.g.soldier, M = S.mount;
    if (!M) return;
    S.mount = null;
    M.occupied = false;
    M.crew.group.visible = !(M.veh && M.veh.dead) && !M.noAI;
    // neben der Lafette bzw. neben dem Fahrzeug absetzen
    const w = this.g.world, yaw = this.worldYaw(M);
    const off = M.kind === 'veh' ? 2.4 : 1.2;
    const x = M.yawG.getWorldPosition(_w).x + Math.cos(yaw) * off + (M.kind === 'fob' ? Math.sin(yaw) * 1.6 : 0);
    const z = _w.z - Math.sin(yaw) * off + (M.kind === 'fob' ? Math.cos(yaw) * 1.6 : 0);
    S.pos.set(x, Math.max(0, w.height(x, z)), z);
    S.vy = 0;
    S.sync();
  }

  // Spieler an der Lafette: Lage aus der Blickrichtung (innerhalb des Schwenkbereichs)
  updatePlayer(S) {
    const M = S.mount;
    const base = this.worldYaw(M);
    let rel = Math.atan2(Math.sin(S.yaw - base), Math.cos(S.yaw - base));
    rel = clamp(rel, -M.arc, M.arc);
    S.yaw = base + rel;
    S.pitch = clamp(S.pitch, -0.45, 0.6);
    M.yaw = rel; M.pitch = S.pitch;
    M.yawG.rotation.y = rel;
    M.pitchG.rotation.x = S.pitch;
    this.seatPos(M, S.pos);
  }

  // Hat der Spieler eine Lafette dieses Konvois besetzt?
  playerOnConvoy(id) { const M = this.g.soldier.mount; return !!(M && M.convoyId === id); }

  // KI-Schützen an unbesetzten Lafetten (Host)
  update(dt) {
    const g = this.g;
    if (g.role === 'client') return;
    const enemies = g.units.enemies;
    for (const M of this.list) {
      if (M.veh && M.veh.dead) { M.crew.group.visible = false; continue; }
      if (M.occupied || M.noAI) continue;
      const p = M.yawG.getWorldPosition(_w);
      if (!g.isNearAny(p.x, p.z) && !M.veh) continue;
      M.fireT -= dt;
      if (M.fireT <= 0 && M.burst <= 0) {
        M.fireT = 2.5 + rand() * 3;
        let best = 650, tgt = null;
        for (const e of enemies) {
          if (!e.alive) continue;
          const d = dist2(e.x, e.z, p.x, p.z);
          if (d < best && (e.vehicle || rand() < 0.8)) { best = d; tgt = e; }
        }
        M.tgt = tgt;
        if (tgt) M.burst = 6 + Math.floor(rand() * 6);
      }
      const t = M.tgt;
      if (t && t.alive) {
        // auf das Ziel schwenken (im Schwenkbereich)
        const base = this.worldYaw(M);
        const want = Math.atan2(-(t.x - p.x), -(t.z - p.z));
        let rel = Math.atan2(Math.sin(want - base), Math.cos(want - base));
        rel = clamp(rel, -M.arc, M.arc);
        M.yaw += (rel - M.yaw) * Math.min(1, dt * 4);
        M.yawG.rotation.y = M.yaw;
        M.pitchG.rotation.x = Math.atan2((t.y + 1) - (p.y + 1.1), Math.max(1, Math.hypot(t.x - p.x, t.z - p.z)));
      }
      if (M.burst > 0) {
        M.shotT -= dt;
        if (M.shotT <= 0) {
          M.shotT = 0.11;
          M.burst--;
          if (!t || !t.alive) { M.burst = 0; continue; }
          const a = this.muzzle(M, _v).clone();
          const b = new THREE.Vector3(t.x + rand.range(-3, 3), t.y + rand.range(0.5, 2.5), t.z + rand.range(-3, 3));
          if (g.isNearAny(p.x, p.z)) g.groundShot(a, b, 0, M.burst % 3 === 0, null);
          if (M.burst === 0) {
            if (t.vehicle) g.units.damageEnemy(t, 1.2 + rand() * 1.5);
            else if (rand() < (M.kind === 'veh' ? 0.12 : 0.3)) g.units.killEnemy(t);
            t.suppress = Math.max(t.suppress || 0, 2);
          }
        }
      }
    }
  }
}
