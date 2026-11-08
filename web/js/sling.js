// Außenlast am Lastenhaken: Lastmodelle und Pendelphysik (Seil als feste Höchstlänge, Last als Massepunkt)
import * as THREE from './lib/three.module.min.js';
import { P, merge, vcMat } from './models.js';
import { G } from './config.js';
import { damp } from './util.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, s = 12) => new THREE.CylinderGeometry(r, r, h, s);

export const ROPE = 15;   // Seillänge in m

// Lastmodelle: Netz mit Kisten, Big Bags (Sandsäcke), Geländewagen. top = Höhe des Anschlagpunkts
export function slingModel(kind) {
  const p = [];
  let top;
  if (kind === 'jeep') {
    p.push(P(box(1.85, 0.75, 3.9), 0x4f5534, [0, 0.85, 0]));
    p.push(P(box(1.7, 0.7, 1.7), 0x454a2e, [0, 1.55, 0.2]));
    p.push(P(box(1.5, 0.45, 0.06), 0x22282a, [0, 1.6, -0.66]));
    for (const sx of [-1, 1]) for (const sz of [-1.25, 1.25]) p.push(P(cyl(0.42, 0.3), 0x1c1c1c, [sx * 0.92, 0.42, sz], [0, 0, Math.PI / 2]));
    p.push(P(box(0.08, 0.08, 0.08), 0x333333, [0, 2.0, 0]));
    top = 2.0;
  } else if (kind === 'bags') {
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
      p.push(P(box(1.05, 1.0, 1.05), 0xe8e6dc, [x, 0.5, z]));
      p.push(P(box(0.1, 0.25, 0.1), 0x3a6fb0, [x, 1.1, z]));
    }
    top = 1.3;
  } else {
    p.push(P(box(1.9, 1.1, 1.9), 0x7a6a44, [0, 0.55, 0]));
    p.push(P(box(1.92, 0.08, 1.92), 0x3a3f2a, [0, 0.3, 0]));
    p.push(P(box(1.92, 0.08, 1.92), 0x3a3f2a, [0, 0.8, 0]));
    // Netzmaschen und Bündel oben
    for (const a of [0, Math.PI / 2]) p.push(P(box(0.06, 1.4, 2.0), 0x2f3424, [0, 1.2, 0], [0, a, 0.5]));
    p.push(P(cyl(0.12, 0.2), 0x222222, [0, 1.75, 0]));
    top = 1.85;
  }
  const mesh = new THREE.Mesh(merge(p), vcMat);
  mesh.castShadow = true;
  return { mesh, top };
}

// Massenanteil der Last am Leergewicht (Hubschrauber bleibt flugfähig, wird aber spürbar träger)
export const SLING_MASS = { net: 0.22, bags: 0.26, jeep: 0.33 };

export class SlingLoad {
  constructor(scene, kind, x, y, z, heliEmpty) {
    this.kind = kind;
    const m = slingModel(kind);
    this.mesh = m.mesh; this.top = m.top;
    this.mass = heliEmpty * (SLING_MASS[kind] || 0.25);
    this.pos = new THREE.Vector3(x, y, z);    // Unterkante der Last
    this.vel = new THREE.Vector3();
    this.grounded = true; this.groundT = 0;
    this.yaw = 0;
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.rope = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x151515 }));
    this.rope.frustumCulled = false;
    this.rope.visible = false;
    scene.add(this.rope);
    this._d = new THREE.Vector3(); this._a = new THREE.Vector3();
  }

  topPos(out) { return out.set(this.pos.x, this.pos.y + this.top, this.pos.z); }

  // Lasthaken unter dem Rumpf
  hookPos(h, out) { return h.model.group.localToWorld(out.set(0, -h.spec.skidH * 0.55, 0)); }

  // Ein Zeitschritt; h = Hubschrauber am Haken (oder null). Liefert den Aufprall (m/s) beim Aufsetzen
  update(dt, h, world) {
    let impact = 0;
    const v = this.vel, p = this.pos;
    v.y -= G * dt;
    // Luftwiderstand (Last pendelt hinterher)
    const sp = v.length();
    v.multiplyScalar(1 - Math.min(0.5, (0.12 + sp * 0.006) * dt));
    p.addScaledVector(v, dt);
    if (h) {
      const hook = this.hookPos(h, this._a);
      const d = this._d.set(p.x, p.y + this.top, p.z).sub(hook);
      const len = d.length();
      this.taut = len >= ROPE - 0.05;
      if (len > ROPE) {
        d.multiplyScalar(1 / len);
        p.x = hook.x + d.x * ROPE; p.y = hook.y + d.y * ROPE - this.top; p.z = hook.z + d.z * ROPE;
        // Seil zieht: radiale Relativgeschwindigkeit aufheben, waagerechten Anteil an den Hubschrauber weitergeben
        const rv = (v.x - h.vel.x) * d.x + (v.y - h.vel.y) * d.y + (v.z - h.vel.z) * d.z;
        if (rv > 0) {
          v.addScaledVector(d, -rv);
          const k = (this.mass / h.mass) * rv;
          h.vel.x += d.x * k; h.vel.z += d.z * k;
        }
      }
      this.yaw += (h.yaw - this.yaw) * damp(0.6, dt);
      const r = this.rope.geometry.attributes.position;
      r.setXYZ(0, hook.x, hook.y, hook.z); r.setXYZ(1, p.x, p.y + this.top, p.z);
      r.needsUpdate = true;
      this.rope.visible = true;
    } else { this.taut = false; this.rope.visible = false; }
    // Boden (Wasser trägt die Last an der Oberfläche)
    const gh = Math.max(world.height(p.x, p.z), 0);
    if (p.y <= gh) {
      if (!this.grounded) impact = Math.hypot(v.y, Math.hypot(v.x, v.z) * 0.6);
      p.y = gh;
      if (v.y < 0) v.y = 0;
      const fr = 1 - Math.min(1, 6 * dt);
      v.x *= fr; v.z *= fr;
      this.grounded = true;
      this.groundT += dt;
    } else { this.grounded = false; this.groundT = 0; }
    this.mesh.position.copy(p);
    this.mesh.rotation.set(0, this.yaw, 0);
    return impact;
  }

  dispose(scene) {
    scene.remove(this.mesh); scene.remove(this.rope);
    this.mesh.geometry.dispose(); this.rope.geometry.dispose();
  }
}
