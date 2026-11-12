// Tageszeit (Tag/Nacht), Sternenhimmel, Landescheinwerfer und Nachtsichtgerät (NVG)
import { ENV } from './gfx.js';
import * as THREE from './lib/three.module.min.js';
import { T } from './theme.js';

export class NightSys {
  constructor(game) {
    this.g = game;
    this.night = false;
    this.nvg = false;
    // Landescheinwerfer des eigenen Hubschraubers (von Anfang an vorhanden, damit beim Umschalten nichts neu kompiliert)
    this.spot = new THREE.SpotLight(0xfff4dc, 0, 220, 0.42, 0.5, 1.2);
    this.spot.castShadow = false;
    game.scene.add(this.spot, this.spot.target);
    this.overlay = document.getElementById('nvg');
    this.makeNoise();
  }

  // Körniges Rauschen für das Nachtsichtgerät (CSS-Hintergrund)
  makeNoise() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const img = x.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) { const v = Math.random() * 255; img.data.set([v, v, v, 60], i * 4); }
    x.putImageData(img, 0, 0);
    if (this.overlay) this.overlay.style.setProperty('--noise', `url(${c.toDataURL()})`);
  }

  // Sterne auf einer großen Kugel (nur nachts sichtbar)
  stars() {
    if (this.starPts) return this.starPts;
    const n = 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, y = 0.12 + Math.random() * 0.88;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 4500, y * 4500, Math.sin(a) * r * 4500], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starPts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.3, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
    this.starPts.renderOrder = -9;
    this.g.scene.add(this.starPts);
    return this.starPts;
  }

  set(night) {
    const g = this.g, w = g.world, s = T.sky;
    this.night = !!night;
    document.body.classList.toggle('night', this.night);
    const sky = w.sky.material.uniforms;
    if (this.night) {
      sky.top.value.set(0x02040b);
      sky.horizon.value.set(T.id === 'afghanistan' ? 0x141824 : 0x0d1418);
      g.scene.fog.color.set(0x0b111c);
      g.hemi.color.set(0x4a5a80); g.hemi.groundColor.set(0x14161c); this.baseHemi = 0.6;
      g.sun.color.set(0xb0c0ff); this.baseSun = 0.7;
      this.stars().visible = true;
    } else {
      sky.top.value.set(s.top); sky.horizon.value.set(s.horizon);
      g.scene.fog.color.set(s.fog);
      g.hemi.color.set(s.hemiSky); g.hemi.groundColor.set(s.hemiGround); this.baseHemi = s.hemi;
      g.sun.color.set(s.sun); this.baseSun = s.sunI;
      if (this.starPts) this.starPts.visible = false;
      this.setNvg(false);
    }
    for (const c of w.clouds.children) c.material.opacity = this.night ? 0.08 : 0.55 + (c.id % 7) * 0.04;
    for (const p of [g.effects.smoke, g.effects.glow]) p.mat.uniforms.fogColor.value.copy(g.scene.fog.color);
    this.applyLights();
    if (ENV.update) ENV.update();
  }

  // Restlichtverstärker: Szene heller rechnen und per CSS grün einfärben, Röhrenrand und Rauschen darüber
  setNvg(on) {
    this.nvg = !!on && this.night;
    document.body.classList.toggle('nvg', this.nvg);
    this.applyLights();
  }
  toggleNvg() {
    if (!this.night) return false;
    this.setNvg(!this.nvg);
    return true;
  }

  applyLights() {
    const g = this.g, amp = this.nvg ? 4 : 1;
    g.hemi.intensity = (this.baseHemi ?? T.sky.hemi) * amp;
    g.sun.intensity = (this.baseSun ?? T.sky.sunI) * (this.nvg ? 3 : 1);
  }

  // Landescheinwerfer: nachts unter 60 m automatisch an (mit Nachtsichtgerät aus, wie im Einsatz)
  update(h) {
    if (this.starPts && this.night) this.starPts.position.copy(this.g.camera.position);
    const on = this.night && !this.nvg && h && !h.crashed && h.agl < 60 && this.g.seat !== 'foot';
    this.spot.intensity = on ? 900 : 0;
    if (!on) return;
    const p = h.model.group.localToWorld(new THREE.Vector3(0, -0.8, -2.5));
    this.spot.position.copy(p);
    const t = h.model.group.localToWorld(new THREE.Vector3(0, -12, -14));
    this.spot.target.position.copy(t);
    this.spot.target.updateMatrixWorld();
  }
}
