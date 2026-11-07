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
      const sx = this.settings.headInvX ? -1 : 1, sy = this.settings.headInvY ? -1 : 1;
      this.head = { yaw: (+yaw || 0) * sx, pitch: (+pitch || 0) * sy, roll: +roll || 0, t: performance.now() };
      if (!this.zero) this.recenter();
      // Brille erkannt, Head-Tracking aber aus: einmal darauf hinweisen
      if (!this.settings.headTrack && !this.hinted && this.g.state === 'playing') {
        this.hinted = true;
        this.g.radio('XR-Brille erkannt – Umsehen per Kopfbewegung in den Einstellungen einschalten.', 'Crew', false, true);
      }
    };
    this.apply();
    // Brille im 3D-Modus als eigenes Display (3840×1080, 32:9): automatisch zwei Halbbilder
    window.addEventListener('resize', () => { if (this.autoStereo() !== this._auto) this.apply(); });
  }

  get settings() { return this.g.settings; }

  autoStereo() { return innerWidth >= innerHeight * 3; }
  get stereoOn() { return !!this.settings.vr3d || this.autoStereo(); }

  // Einstellungen übernehmen (3D-Modus: HUD für das linke Auge zusammenschieben)
  apply(changed3d) {
    this._auto = this.autoStereo();
    const on = this.stereoOn;
    document.body.classList.toggle('vr3d', on);
    try { if (window.AndroidApp && window.AndroidApp.stereoActive) window.AndroidApp.stereoActive(on); } catch (e) { /* egal */ }
    try { if (window.AndroidApp && window.AndroidApp.glassOutput && this._glassOut !== (this.settings.glassOut !== false)) { this._glassOut = this.settings.glassOut !== false; window.AndroidApp.glassOutput(this._glassOut); } } catch (e) { /* egal */ }
    // Android-App mit VITURE-Brille: Brille passend in den 3D-Modus schalten
    if (changed3d) try { if (window.AndroidApp && window.AndroidApp.glasses3D && window.AndroidApp.glassesConnected()) window.AndroidApp.glasses3D(!!this.settings.vr3d); } catch (e) { /* ohne Brille egal */ }
  }

  recenter() {
    this.lastAim = null;
    // Android-App mit VITURE Pro 2: die App setzt die Neutralstellung selbst und liefert danach Werte um null
    let native = false;
    try { native = !!(window.AndroidApp && window.AndroidApp.headRecenter && window.AndroidApp.headRecenter()); } catch (e) { /* egal */ }
    if (native) this.zero = { yaw: 0, pitch: 0, roll: 0 };
    else if (this.head) this.zero = { ...this.head };
  }

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

  // Anzeigen und Menüs für das rechte Auge spiegeln: Kopie des linken Halbbilds (nur zum Ansehen, Bedienung links)
  mirror() {
    let box = this._mirror;
    if (!this.stereoOn) { if (box) { box.remove(); this._mirror = null; } return; }
    if (!box) {
      box = this._mirror = document.createElement('div');
      box.id = 'vr-mirror';
      document.body.appendChild(box);
      this._tick = 0;
    }
    if (this._tick++ % 2) return;                         // 30 Hz reichen
    const src = [document.getElementById('hud'), document.getElementById('touch-controls'),
      ...document.querySelectorAll('body > .overlay:not(.hidden)')].filter((e) => e && !e.classList.contains('hidden'));
    const frag = document.createDocumentFragment();
    for (const e of src) {
      const c = e.cloneNode(true);
      // Zeichenflächen (Kompass, Minikarte, Karte) und Eingaben übernehmen
      const a = e.querySelectorAll('canvas, input, select'), b = c.querySelectorAll('canvas, input, select');
      frag.appendChild(c);
      this._fix = this._fix || [];
      this._fix.push([a, b]);
    }
    box.replaceChildren(frag);
    for (const [a, b] of this._fix) {
      for (let i = 0; i < a.length && i < b.length; i++) {
        const x = a[i], y = b[i];
        if (x.tagName === 'CANVAS') { if (x.width && x.height) y.getContext('2d').drawImage(x, 0, 0); }
        else if (x.type === 'checkbox' || x.type === 'radio') y.checked = x.checked;
        else if ('value' in x) y.value = x.value;
      }
    }
    this._fix.length = 0;
    // gescrollte Fenster (Einstellungen, Hilfe) an der gleichen Stelle zeigen
    const sa = document.querySelectorAll('body > .overlay:not(.hidden) *'), sb = box.querySelectorAll('.overlay *');
    for (let i = 0; i < sa.length && i < sb.length; i++) if (sa[i].scrollTop) sb[i].scrollTop = sa[i].scrollTop;
  }

  render(renderer, scene, cam) {
    this.mirror();
    if (!this.stereoOn) { renderer.render(scene, cam); return; }
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
