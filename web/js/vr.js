// VR-/XR-Brillen (z. B. VITURE): 3D-Bild im Side-by-Side-Format und Umsehen per Kopfbewegung.
// Die Kopfdaten (Gieren/Nicken/Rollen in Bogenmaß) liefert ein Sensor-Treiber über
//   window.HotLZ_setHead(yaw, pitch, roll)
// – in der Android-App über das Brillen-SDK, am PC über ein Hilfsprogramm. Ohne Daten bleibt der Blick fest.
import * as THREE from './lib/three.module.min.js';

export class VrView {
  constructor(game) {
    this.g = game;
    this.stereo = new THREE.StereoCamera();
    this.stereo.aspect = 0.5;          // Halbbild je Auge (Brille streckt es auf volle Breite)
    this.stereo.eyeSep = 0.064;
    this.head = null;                  // letzte Kopfdaten
    this.zero = null;                  // Neutralstellung
    this.lastAim = null;
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    window.HotLZ_setHead = (yaw, pitch, roll = 0) => {
      this.head = { yaw: +yaw || 0, pitch: +pitch || 0, roll: +roll || 0, t: performance.now() };
      if (!this.zero) this.recenter();
    };
    this.apply();
  }

  get settings() { return this.g.settings; }

  // Einstellungen übernehmen (3D-Modus: HUD für das linke Auge zusammenschieben)
  apply() {
    document.body.classList.toggle('vr3d', !!this.settings.vr3d);
  }

  recenter() { if (this.head) this.zero = { ...this.head }; this.lastAim = null; }

  // Kopfdrehung relativ zur Neutralstellung (null = keine aktuellen Daten)
  rel() {
    if (!this.settings.headTrack || !this.head || !this.zero || performance.now() - this.head.t > 1000) return null;
    const w = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    return { yaw: w(this.head.yaw - this.zero.yaw), pitch: w(this.head.pitch - this.zero.pitch), roll: w(this.head.roll - this.zero.roll) };
  }

  // Nach der normalen Kameraführung: Blick um die Kopfdrehung ergänzen.
  // Als Schütze bzw. zu Fuß steuert der Kopf das Zielen, sonst dreht er nur den Blick.
  updateCamera(cam, seat) {
    const r = this.rel();
    if (!r) { this.lastAim = null; return; }
    if (seat === 'left' || seat === 'right' || seat === 'ramp' || seat === 'foot') {
      if (this.lastAim) {
        const dy = r.yaw - this.lastAim.yaw, dp = r.pitch - this.lastAim.pitch;
        this.g.input.aim.dx -= dy;
        this.g.input.aim.dy -= dp;
      }
      this.lastAim = r;
      return;
    }
    this.lastAim = null;
    this._e.set(r.pitch, r.yaw, r.roll, 'YXZ');
    cam.quaternion.multiply(this._q.setFromEuler(this._e));
  }

  render(renderer, scene, cam) {
    if (!this.settings.vr3d) { renderer.render(scene, cam); return; }
    cam.updateMatrixWorld();
    this.stereo.update(cam);
    const size = renderer.getSize(this._size || (this._size = new THREE.Vector2()));
    const w = size.x / 2, h = size.y;
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, w, h); renderer.setViewport(0, 0, w, h);
    renderer.render(scene, this.stereo.cameraL);
    renderer.setScissor(w, 0, w, h); renderer.setViewport(w, 0, w, h);
    renderer.render(scene, this.stereo.cameraR);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.x, size.y);
  }
}
