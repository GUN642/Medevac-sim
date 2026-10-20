// Partikel (Rauch, Staub, Feuer, Mündungsfeuer) und Leuchtspurgeschosse
import * as THREE from './lib/three.module.min.js';
import { rand } from './util.js';

const VERT = `
attribute float size;
attribute vec4 pcolor;
uniform float scale;
varying vec4 vColor;
varying float vFog;
uniform float fogDensity;
void main(){
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(size * scale / max(-mv.z, 0.5), 900.0);
  float d = length(mv.xyz);
  vFog = 1.0 - exp(-fogDensity * fogDensity * d * d);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 fogColor;
uniform float additive;
varying vec4 vColor;
varying float vFog;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.1, d) * vColor.a;
  vec3 col = mix(vColor.rgb, fogColor, vFog * (1.0 - additive));
  a *= 1.0 - vFog * additive;
  gl_FragColor = vec4(col, a);
}`;

class ParticlePool {
  constructor(scene, max, additive) {
    this.max = max;
    this.n = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.c = new Float32Array(max * 3);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.colAttr = new THREE.BufferAttribute(new Float32Array(max * 4), 4);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('size', this.sizeAttr);
    geo.setAttribute('pcolor', this.colAttr);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        scale: { value: 500 }, fogDensity: { value: 0.0004 }, fogColor: { value: new THREE.Color(0xc4cbbd) },
        additive: { value: additive ? 1 : 0 },
      },
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, drag = 0.5, grav = 0) {
    let i;
    if (this.n < this.max) i = this.n++;
    else i = Math.floor(Math.random() * this.max);
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = 0; this.maxLife[i] = life;
    this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a;
    this.c[i * 3] = r; this.c[i * 3 + 1] = g; this.c[i * 3 + 2] = b;
    this.drag[i] = drag; this.grav[i] = grav;
  }
  update(dt, wind) {
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) {
        const j = --this.n;
        if (i !== j) {
          this.p.copyWithin(i * 3, j * 3, j * 3 + 3); this.v.copyWithin(i * 3, j * 3, j * 3 + 3); this.c.copyWithin(i * 3, j * 3, j * 3 + 3);
          this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j];
          this.a0[i] = this.a0[j]; this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j];
        }
        continue;
      }
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i * 3] = this.v[i * 3] * k + wind.x * dt * 0.4;
      this.v[i * 3 + 1] = this.v[i * 3 + 1] * k + this.grav[i] * dt;
      this.v[i * 3 + 2] = this.v[i * 3 + 2] * k + wind.z * dt * 0.4;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      i++;
    }
    const P = this.posAttr.array, S = this.sizeAttr.array, C = this.colAttr.array;
    for (let j = 0; j < this.n; j++) {
      const t = this.life[j] / this.maxLife[j];
      P[j * 3] = this.p[j * 3]; P[j * 3 + 1] = this.p[j * 3 + 1]; P[j * 3 + 2] = this.p[j * 3 + 2];
      S[j] = this.s0[j] + (this.s1[j] - this.s0[j]) * t;
      C[j * 4] = this.c[j * 3]; C[j * 4 + 1] = this.c[j * 3 + 1]; C[j * 4 + 2] = this.c[j * 3 + 2];
      C[j * 4 + 3] = this.a0[j] * Math.min(1, t * 8) * (1 - t);
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.posAttr.needsUpdate = this.sizeAttr.needsUpdate = this.colAttr.needsUpdate = true;
  }
}

export const SMOKE_COLORS = {
  gelb: [0.95, 0.85, 0.25], rot: [0.85, 0.2, 0.18], grün: [0.35, 0.75, 0.3], violett: [0.6, 0.35, 0.8],
};

export class Effects {
  constructor(scene, quality) {
    const mul = quality === 'low' ? 0.5 : quality === 'high' ? 1.4 : 1;
    this.mul = mul;
    this.smoke = new ParticlePool(scene, Math.floor(2600 * mul), false);
    this.glow = new ParticlePool(scene, Math.floor(900 * mul), true);
    this.wind = new THREE.Vector3(2.2, 0, 1.2);
    this.emitters = [];
    // Leuchtspur-Instanzen
    this.maxTracers = 220;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.tracerMesh = new THREE.InstancedMesh(geo, mat, this.maxTracers);
    this.tracerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tracerMesh.count = 0;
    this.tracerMesh.frustumCulled = false;
    this.tracerMesh.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(this.tracerMesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._f = new THREE.Vector3(0, 0, 1);
    this._c = new THREE.Color();
    this.tracerList = [];
  }

  setView(height, fov, fogDensity) {
    const scale = height / (2 * Math.tan((fov * Math.PI) / 360));
    for (const p of [this.smoke, this.glow]) {
      p.mat.uniforms.scale.value = scale;
      p.mat.uniforms.fogDensity.value = fogDensity;
    }
  }

  // Dauerhafte Emitter (Rauchgranaten, brennende Wracks, beschädigter Hubschrauber)
  addEmitter(e) { this.emitters.push(e); return e; }
  removeEmitter(e) { const i = this.emitters.indexOf(e); if (i >= 0) this.emitters.splice(i, 1); }

  smokeGrenade(x, y, z, colorName) {
    const c = SMOKE_COLORS[colorName] || SMOKE_COLORS.gelb;
    return this.addEmitter({ type: 'smoke', x, y, z, c, rate: 14, acc: 0, size: [2, 16], life: 9, rise: 2.4, alpha: 0.75 });
  }
  wreckFire(x, y, z) {
    return this.addEmitter({ type: 'fire', x, y, z, rate: 10, acc: 0, size: [4, 30], life: 14, rise: 6, alpha: 0.6 });
  }

  puff(x, y, z, r, g, b, n = 4, size = 2, spread = 1.5, life = 1.4) {
    for (let i = 0; i < n * this.mul; i++)
      this.smoke.spawn(x, y, z, rand.range(-spread, spread), rand.range(0.5, spread * 1.5), rand.range(-spread, spread), life * rand.range(0.7, 1.2), size * 0.5, size * 2, r, g, b, 0.7, 1.2, 0.3);
  }
  muzzle(x, y, z, big = false) {
    this.glow.spawn(x, y, z, 0, 0, 0, 0.06, big ? 1.4 : 0.8, big ? 1.8 : 1.0, 1.0, 0.75, 0.35, 1.0, 0, 0);
  }
  sparks(x, y, z) {
    for (let i = 0; i < 5; i++) this.glow.spawn(x, y, z, rand.range(-6, 6), rand.range(-2, 6), rand.range(-6, 6), 0.25, 0.3, 0.1, 1, 0.8, 0.4, 1, 2, -9);
  }
  explosion(x, y, z, scale = 1) {
    for (let i = 0; i < 40 * this.mul * scale; i++)
      this.glow.spawn(x, y, z, rand.range(-12, 12) * scale, rand.range(-2, 14) * scale, rand.range(-12, 12) * scale, rand.range(0.4, 1.1), 3 * scale, 9 * scale, 1, rand.range(0.45, 0.7), 0.2, 1, 2.5, 2);
    for (let i = 0; i < 30 * this.mul * scale; i++)
      this.smoke.spawn(x, y, z, rand.range(-6, 6) * scale, rand.range(1, 9) * scale, rand.range(-6, 6) * scale, rand.range(3, 7), 4 * scale, 22 * scale, 0.12, 0.11, 0.1, 0.85, 0.8, 1.5);
  }
  dust(x, y, z, vx, vz, r, g, b, size) {
    this.smoke.spawn(x, y, z, vx, rand.range(0.5, 2.5), vz, rand.range(1.2, 2.4), size, size * 3.5, r, g, b, 0.45, 1.0, 0.4);
  }

  // Leuchtspur zeichnen: Position, Richtung (normiert), Länge, Farbe
  tracer(px, py, pz, dx, dy, dz, len, r, g, b) {
    this.tracerList.push(px, py, pz, dx, dy, dz, len, r, g, b);
  }

  update(dt, cameraPos) {
    for (const e of this.emitters) {
      e.acc += dt * e.rate * this.mul;
      while (e.acc > 1) {
        e.acc -= 1;
        if (e.type === 'smoke') {
          this.smoke.spawn(e.x + rand.range(-0.5, 0.5), e.y + 0.3, e.z + rand.range(-0.5, 0.5), rand.range(-0.6, 0.6), e.rise * rand.range(0.7, 1.3), rand.range(-0.6, 0.6),
            e.life * rand.range(0.8, 1.2), e.size[0], e.size[1], e.c[0] * rand.range(0.9, 1.05), e.c[1] * rand.range(0.9, 1.05), e.c[2] * rand.range(0.9, 1.05), e.alpha, 0.25, 0.25);
        } else if (e.type === 'fire') {
          this.glow.spawn(e.x + rand.range(-3, 3), e.y + 0.5, e.z + rand.range(-3, 3), rand.range(-0.5, 0.5), rand.range(2, 5), rand.range(-0.5, 0.5), rand.range(0.4, 0.9), 3, 1.2, 1, 0.5, 0.15, 0.9, 0.5, 2);
          this.smoke.spawn(e.x + rand.range(-2, 2), e.y + 2, e.z + rand.range(-2, 2), rand.range(-0.5, 0.5), e.rise * rand.range(0.7, 1.3), rand.range(-0.5, 0.5),
            e.life * rand.range(0.8, 1.2), e.size[0], e.size[1], 0.09, 0.085, 0.08, e.alpha, 0.2, 0.4);
        } else if (e.type === 'damage' && e.src) {
          const p = e.src();
          if (!p) continue;
          const dark = e.dark ? 0.06 : 0.35;
          this.smoke.spawn(p.x, p.y, p.z, rand.range(-0.4, 0.4), 1, rand.range(-0.4, 0.4), 3, 1, 7, dark, dark, dark, e.dark ? 0.8 : 0.45, 0.6, 0.6);
          if (e.fire) this.glow.spawn(p.x, p.y, p.z, 0, 0.5, 0, 0.3, 1.5, 0.6, 1, 0.5, 0.15, 0.9, 0, 0);
        }
      }
    }
    this.smoke.update(dt, this.wind);
    this.glow.update(dt, this.wind);

    // Leuchtspuren
    const L = this.tracerList;
    const n = Math.min(this.maxTracers, L.length / 10);
    for (let i = 0; i < n; i++) {
      const o = i * 10;
      this._v.set(L[o + 3], L[o + 4], L[o + 5]);
      this._q.setFromUnitVectors(this._f, this._v);
      const dist = Math.hypot(L[o] - cameraPos.x, L[o + 1] - cameraPos.y, L[o + 2] - cameraPos.z);
      const w = Math.max(0.1, dist * 0.0022);
      this._m.compose(this._s.set(L[o], L[o + 1], L[o + 2]), this._q, new THREE.Vector3(w, w, L[o + 6]));
      this.tracerMesh.setMatrixAt(i, this._m);
      this.tracerMesh.setColorAt(i, this._c.setRGB(L[o + 7], L[o + 8], L[o + 9]));
    }
    this.tracerMesh.count = n;
    this.tracerMesh.instanceMatrix.needsUpdate = true;
    if (this.tracerMesh.instanceColor) this.tracerMesh.instanceColor.needsUpdate = true;
    L.length = 0;
  }

  clearEmitters(filter) {
    this.emitters = this.emitters.filter((e) => !filter(e));
  }
}
