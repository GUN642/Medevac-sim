// Außenlast am Lastenhaken: Lastmodelle und Pendelphysik (Seil als feste Höchstlänge, Last als Massepunkt)
import * as THREE from './lib/three.module.min.js';
import { P, merge, vcMat } from './models.js';
import { G } from './config.js';
import { damp } from './util.js';
import { T } from './theme.js';

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
  } else if (kind === 'howitzer') {
    // leichte Feldhaubitze (105 mm): Rohr, Wiege, Schutzschild, Spreizlafette, zwei Räder
    const c = T.id === 'vietnam' ? 0x4f5534 : 0x6b6a52;
    p.push(P(cyl(0.09, 3.4, 10), 0x2c2f26, [0, 1.15, -1.5], [Math.PI / 2 - 0.08, 0, 0]));
    p.push(P(cyl(0.16, 1.2, 10), c, [0, 1.05, -0.2], [Math.PI / 2 - 0.08, 0, 0]));
    p.push(P(box(0.55, 0.45, 1.3), c, [0, 0.95, 0.15]));
    p.push(P(box(1.7, 0.9, 0.06), c, [0, 1.15, -0.45], [-0.12, 0, 0]));
    for (const sx of [-1, 1]) {
      p.push(P(cyl(0.48, 0.26, 14), 0x1c1c1c, [sx * 0.95, 0.48, 0], [0, 0, Math.PI / 2]));
      p.push(P(box(0.14, 0.16, 2.6), c, [sx * 0.42, 0.45, 1.35], [0, sx * 0.22, 0]));
    }
    p.push(P(box(1.8, 0.12, 0.2), 0x333333, [0, 0.62, 0.02]));
    p.push(P(cyl(0.06, 0.4, 8), 0x333333, [0, 1.75, 0.1]));
    top = 1.95;
  } else if (kind === 'bladder') {
    // Treibstoffblase (Gummi, ca. 1900 l) im Tragegeschirr
    p.push(P(cyl(1.15, 0.9, 18), 0x1b1c1a, [0, 0.45, 0]));
    p.push(P(new THREE.SphereGeometry(1.15, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x1f201d, [0, 0.9, 0], [0, 0, 0], [1, 0.25, 1]));
    for (const a of [0, Math.PI / 2]) p.push(P(box(0.08, 0.02, 2.4), 0xb89a3a, [0, 1.2, 0], [0, a, 0]));
    p.push(P(cyl(0.08, 0.3, 8), 0x8a7a3a, [0, 1.4, 0]));
    top = 1.55;
  } else if (kind === 'water') {
    // zwei Wassertanks (IBC) im Gitterrahmen auf Palette
    for (const x of [-0.6, 0.6]) {
      p.push(P(box(1.0, 1.05, 1.2), 0xe6e8e2, [x, 0.68, 0]));
      p.push(P(box(1.06, 0.06, 1.26), 0x8a8d8e, [x, 1.2, 0]));
      for (const z of [-0.6, 0.6]) p.push(P(box(1.06, 1.1, 0.04), 0x8a8d8e, [x, 0.68, z]));
      p.push(P(box(1.1, 0.14, 1.25), 0x6a5a3e, [x, 0.07, 0]));
      p.push(P(cyl(0.12, 0.1, 10), 0x1a3a7a, [x, 1.26, 0]));
    }
    top = 1.45;
  } else if (kind === 'container') {
    // Stromaggregat bzw. Material in einem kleinen Container
    p.push(P(box(2.3, 1.55, 1.5), T.peaceful && T.id === 'flood' ? 0x2d4fa0 : 0x5a6450, [0, 0.8, 0]));
    p.push(P(box(2.32, 0.1, 1.52), 0x2a2c2a, [0, 1.55, 0]));
    p.push(P(box(0.7, 0.7, 0.03), 0x30323a, [0.5, 0.85, 0.76]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(P(box(0.05, 0.9, 0.05), 0x222222, [sx * 1.0, 2.0, sz * 0.6], [sz * 0.5, 0, -sx * 0.6]));
    p.push(P(cyl(0.1, 0.2, 8), 0x222222, [0, 2.45, 0]));
    top = 2.5;
  } else if (kind === 'boat') {
    // Rettungsboot (Aluminium) mit Außenborder
    p.push(P(box(1.7, 0.55, 4.6), 0xd06a20, [0, 0.35, 0]));
    p.push(P(box(1.5, 0.45, 4.3), 0x9aa0a4, [0, 0.42, 0]));
    p.push(P(box(1.2, 0.3, 0.9), 0xd06a20, [0, 0.3, -2.55], [0.5, 0, 0]));
    p.push(P(box(0.4, 0.8, 0.35), 0x222222, [0, 0.75, 2.4]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(P(box(0.04, 1.6, 0.04), 0x222222, [sx * 0.5, 1.45, sz * 1.2], [sz * 0.6, 0, -sx * 0.4]));
    top = 2.2;
  } else if (kind === 'bucket') {
    // Löschwasser-Außenbehälter („Bambi Bucket“) mit Fangleinen
    p.push(P(new THREE.CylinderGeometry(0.95, 0.75, 1.4, 16, 1, true), 0xc8501e, [0, 0.75, 0]));
    p.push(P(new THREE.CylinderGeometry(0.75, 0.75, 0.04, 16), 0x2a2a2a, [0, 0.06, 0]));
    p.push(P(new THREE.TorusGeometry(0.95, 0.05, 6, 16), 0x2a2a2a, [0, 1.45, 0], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push(P(box(0.025, 1.7, 0.025), 0x222222, [Math.cos(a) * 0.48, 2.3, Math.sin(a) * 0.48], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5])); }
    p.push(P(cyl(0.1, 0.25, 8), 0x222222, [0, 3.2, 0]));
    top = 3.3;
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
export const SLING_MASS = { net: 0.22, bags: 0.26, jeep: 0.33, howitzer: 0.3, bladder: 0.3, water: 0.24, container: 0.28, boat: 0.12, bucket: 0.05, bucketFull: 0.24 };

export class SlingLoad {
  constructor(scene, kind, x, y, z, heliEmpty) {
    this.kind = kind;
    const m = slingModel(kind);
    this.mesh = m.mesh; this.top = m.top;
    this.mass = heliEmpty * (SLING_MASS[kind] || 0.25);
    this.baseMass = this.mass;
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
