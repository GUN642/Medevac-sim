// Eingabe: Tastatur/Maus, Gamepad (z. B. Nintendo Switch Pro Controller), Touchscreen
import { clamp } from './util.js';

const DEAD = 0.14;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.keys = new Set();
    this.flight = { pitch: 0, roll: 0, yaw: 0, collective: 0 };
    this.aim = { dx: 0, dy: 0 };
    this.look = { dx: 0, dy: 0, zoom: 0 };
    this.fire = false;
    this.zoomHeld = false;
    this.actions = [];
    this.device = 'keyboard';
    this.mouseDown = [false, false, false];
    this.gpPrev = [];
    this.gpConnected = false;
    this.touch = { left: null, right: null, aim: null, fire: false };
    this.mode = 'pilot';
    this.move = { x: 0, y: 0 };
    this.sprint = false;
    this.jumpPressed = false;

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.fire = false; });
    this.mfx = 0; this.mfy = 0; this.mYaw = 0; this.mPitch = 0;
    canvas.addEventListener('mousedown', (e) => {
      this.device = 'keyboard';
      this.mouseDown[e.button] = true;
      const want = this.mode !== 'pilot' || (this.settings.mouseFly && e.button === 0);
      if (this.mode === 'foot' && e.button === 0 && document.pointerLockElement !== canvas) this.lockClick = true;
      if (want && document.pointerLockElement !== canvas && canvas.requestPointerLock) {
        try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {}
      }
    });
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas) { this.mPitch = 0; this.mYaw = 0; } });
    window.addEventListener('mouseup', (e) => { this.mouseDown[e.button] = false; });
    window.addEventListener('mousemove', (e) => {
      const locked = document.pointerLockElement === canvas;
      if (this.mode === 'pax' && (locked || this.mouseDown[0] || this.mouseDown[2])) {
        this.look.dx += e.movementX * 0.005;
        this.look.dy += e.movementY * 0.005;
      } else if (this.mode !== 'pilot' && (locked || this.mouseDown[0] || this.mouseDown[2])) {
        const s = 0.0022 * this.settings.sensitivity;
        this.aim.dx += e.movementX * s;
        this.aim.dy += e.movementY * s * (this.settings.invertY ? -1 : 1);
      } else if (this.mode === 'pilot' && locked && this.settings.mouseFly && !this.mouseDown[2]) {
        // Maus-Flugsteuerung: links/rechts = Pedale, vor/zurück = Zyklisch vor/zurück
        this.mfx += e.movementX;
        this.mfy += e.movementY;
      } else if (this.mouseDown[0] || this.mouseDown[2]) {
        this.look.dx += e.movementX * 0.005;
        this.look.dy += e.movementY * 0.005;
      }
    });
    canvas.addEventListener('wheel', (e) => {
      if (this.mode === 'foot') this.actions.push(e.deltaY > 0 ? 'wnext' : 'wprev');
      else this.look.zoom += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.lockClick = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('gamepadconnected', () => { this.gpConnected = true; this.device = 'gamepad'; this.onDevice && this.onDevice(); });
    window.addEventListener('gamepaddisconnected', () => { this.gpConnected = [...(navigator.getGamepads ? navigator.getGamepads() : [])].some((g) => g); });
    this.setupTouch();
  }

  onKey(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    const k = e.code;
    if (down) {
      if (this.device !== 'keyboard') { this.device = 'keyboard'; this.onDevice && this.onDevice(); }
      if (!this.keys.has(k)) {
        const map = {
          Digit1: 'seat-pilot', Digit2: 'seat-left', Digit3: 'seat-right', KeyC: 'camera', KeyV: 'camera', KeyM: 'map',
          Escape: 'pause', KeyP: 'pause', Enter: 'confirm', NumpadEnter: 'confirm', KeyH: 'help', Tab: 'seat-next', KeyT: 'radio', KeyX: 'crew', KeyB: 'crew',
          KeyE: 'use', KeyR: 'reload', Digit4: 'num4', Digit5: 'num5', KeyG: 'pickup',
        };
        if (map[k]) { this.actions.push(map[k]); if (k === 'Tab') e.preventDefault(); }
        const nav = { ArrowUp: 'nav-up', ArrowDown: 'nav-down', ArrowLeft: 'nav-left', ArrowRight: 'nav-right' }[k];
        if (nav) this.pushNav(nav, 'key');
      }
      this.keys.add(k);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    } else this.keys.delete(k);
  }

  key(...codes) { return codes.some((c) => this.keys.has(c)) ? 1 : 0; }

  setMode(mode) {
    this.mode = mode;
    if ((mode === 'pilot' || mode === 'pax') && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    const gunner = mode === 'left' || mode === 'right';
    document.body.classList.toggle('gunner-mode', gunner);
    document.body.classList.toggle('foot-mode', mode === 'foot');
    document.body.classList.toggle('pax-mode', mode === 'pax');
    document.body.classList.toggle('aim-mode', gunner || mode === 'foot');
    document.body.classList.toggle('pilot-seat', mode === 'pilot');
  }

  get aimMode() { return this.mode === 'left' || this.mode === 'right' || this.mode === 'foot'; }

  // ---------------------------------------------------------------- Touch
  setupTouch() {
    const tc = document.getElementById('touch-controls');
    if (!tc) return;
    this.touchEl = tc;
    const sticks = {
      left: { zone: document.getElementById('stick-left'), knob: document.querySelector('#stick-left .knob'), base: document.querySelector('#stick-left .base') },
      right: { zone: document.getElementById('stick-right'), knob: document.querySelector('#stick-right .knob'), base: document.querySelector('#stick-right .base') },
    };
    this.sticks = sticks;
    const R = 62;
    for (const side of ['left', 'right']) {
      const st = sticks[side];
      st.zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.setTouchDevice();
        const t = e.changedTouches[0];
        if (side === 'right' && this.mode !== 'pilot') {
          this.touch.aim = { id: t.identifier, x: t.clientX, y: t.clientY };
          return;
        }
        const rect = st.zone.getBoundingClientRect();
        st.ox = t.clientX; st.oy = t.clientY;
        st.base.style.left = t.clientX - rect.left + 'px';
        st.base.style.top = t.clientY - rect.top + 'px';
        st.base.classList.add('active');
        this.touch[side] = { id: t.identifier, x: 0, y: 0 };
        st.knob.style.transform = 'translate(-50%,-50%)';
      }, { passive: false });
      st.zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          const a = this.touch.aim;
          if (side === 'right' && a && a.id === t.identifier) {
            const s = 0.005 * this.settings.sensitivity;
            this.aim.dx += (t.clientX - a.x) * s;
            this.aim.dy += (t.clientY - a.y) * s * (this.settings.invertY ? -1 : 1);
            a.x = t.clientX; a.y = t.clientY;
            continue;
          }
          const tt = this.touch[side];
          if (!tt || tt.id !== t.identifier) continue;
          let dx = t.clientX - st.ox, dy = t.clientY - st.oy;
          const l = Math.hypot(dx, dy);
          if (l > R) { dx *= R / l; dy *= R / l; }
          tt.x = dx / R; tt.y = dy / R;
          st.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
      }, { passive: false });
      const end = (e) => {
        for (const t of e.changedTouches) {
          if (this.touch.aim && this.touch.aim.id === t.identifier) this.touch.aim = null;
          const tt = this.touch[side];
          if (tt && tt.id === t.identifier) {
            this.touch[side] = null;
            st.knob.style.transform = 'translate(-50%,-50%)';
            st.base.classList.remove('active');
          }
        }
      };
      st.zone.addEventListener('touchend', end);
      st.zone.addEventListener('touchcancel', end);
    }
    tc.querySelectorAll('[data-action]').forEach((b) => {
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.setTouchDevice(); this.actions.push(b.dataset.action); }, { passive: false });
      b.addEventListener('click', (e) => { e.preventDefault(); this.actions.push(b.dataset.action); });
    });
    // Feuerknopf: gedrückt halten feuert, Ziehen mit demselben Finger zielt (wie bei Battle of Hoth)
    const fireBtn = document.getElementById('btn-fire');
    if (fireBtn) {
      fireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        const t = e.changedTouches[0];
        this.touch.fire = true;
        this.touch.fireAim = { id: t.identifier, x: t.clientX, y: t.clientY };
      }, { passive: false });
      fireBtn.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const fa = this.touch.fireAim;
        for (const t of e.changedTouches) {
          if (!fa || fa.id !== t.identifier) continue;
          const s = 0.005 * this.settings.sensitivity;
          this.aim.dx += (t.clientX - fa.x) * s;
          this.aim.dy += (t.clientY - fa.y) * s * (this.settings.invertY ? -1 : 1);
          fa.x = t.clientX; fa.y = t.clientY;
        }
      }, { passive: false });
      const fend = (e) => { e.preventDefault(); this.touch.fire = false; this.touch.fireAim = null; };
      fireBtn.addEventListener('touchend', fend);
      fireBtn.addEventListener('touchcancel', fend);
    }
    window.addEventListener('touchstart', () => this.setTouchDevice(), { passive: true });
  }

  setTouchDevice() {
    if (this.device !== 'touch') { this.device = 'touch'; this.onDevice && this.onDevice(); }
  }

  // ---------------------------------------------------------------- Abfrage pro Frame
  update(dt) {
    const f = { pitch: 0, roll: 0, yaw: 0, collective: 0 };
    let fire = false;
    this.zoomHeld = false;

    // Tastatur (geglättet)
    const kp = this.key('KeyW', 'ArrowUp') - this.key('KeyS', 'ArrowDown');
    const kr = this.key('KeyD', 'ArrowRight') - this.key('KeyA', 'ArrowLeft');
    const ky = this.key('KeyE') - this.key('KeyQ');
    const kc = this.key('Space', 'KeyR', 'PageUp') - this.key('ShiftLeft', 'ShiftRight', 'KeyF', 'PageDown');
    if (!this.kb) this.kb = { pitch: 0, roll: 0, yaw: 0, collective: 0 };
    const sm = (cur, tgt, rate) => cur + clamp(tgt - cur, -rate * dt, rate * dt);
    this.kb.pitch = sm(this.kb.pitch, kp, kp ? 2.5 : 5);
    this.kb.roll = sm(this.kb.roll, kr, kr ? 2.5 : 5);
    this.kb.yaw = sm(this.kb.yaw, ky, 5);
    this.kb.collective = sm(this.kb.collective, kc, 4);
    f.pitch += this.kb.pitch; f.roll += this.kb.roll; f.yaw += this.kb.yaw; f.collective += this.kb.collective;
    // Maus als Steuerknüppel (nur Pilot, Zeiger gesperrt)
    this.mouseFlying = this.mode === 'pilot' && this.settings.mouseFly && document.pointerLockElement === this.canvas;
    if (this.mouseFlying) {
      const sens = this.settings.sensitivity;
      const yt = clamp((this.mfx / Math.max(dt, 0.001)) * 0.0022 * sens, -1, 1);
      this.mYaw += (yt - this.mYaw) * Math.min(1, dt * 14);
      const inv = this.settings.mouseFlyInvert ? -1 : 1;
      this.mPitch = clamp(this.mPitch - this.mfy * 0.004 * sens * inv, -1, 1);
      if (this.mfy === 0) this.mPitch -= clamp(this.mPitch, -dt * 0.35, dt * 0.35);
      if (kp) this.mPitch = 0;
      f.yaw += this.mYaw;
      f.pitch += this.mPitch;
    } else { this.mYaw = 0; this.mPitch = 0; }
    this.mfx = 0; this.mfy = 0;
    const mv = { x: 0, y: 0 };
    this.sprint = false;
    const jump = this.keys.has('Space');
    if (this.mode === 'foot') {
      // Zu Fuß: WASD laufen, Pfeiltasten umsehen, Maus zielen, Shift sprinten, Leertaste springen
      mv.x = this.key('KeyD') - this.key('KeyA');
      mv.y = this.key('KeyW') - this.key('KeyS');
      this.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      const ax = this.key('ArrowRight') - this.key('ArrowLeft');
      const ay = this.key('ArrowDown') - this.key('ArrowUp');
      this.aim.dx += ax * dt * 1.6;
      this.aim.dy += ay * dt * 1.2;
      fire = fire || (this.mouseDown[0] && !this.lockClick);
      this.zoomHeld = this.mouseDown[2];
    } else if (this.mode === 'left' || this.mode === 'right') {
      // Im Schützensitz: Pfeiltasten zum Zielen, Leertaste/Maus zum Feuern
      const ax = this.key('ArrowRight', 'KeyD') - this.key('ArrowLeft', 'KeyA');
      const ay = this.key('ArrowDown', 'KeyS') - this.key('ArrowUp', 'KeyW');
      this.aim.dx += ax * dt * 1.2;
      this.aim.dy += ay * dt * 1.0;
      fire = fire || this.mouseDown[0] || this.keys.has('Space');
      this.zoomHeld = this.mouseDown[2];
    }
    this.jumpPressed = jump && !this.prevJump && this.mode === 'foot';
    this.prevJump = jump;

    // Gamepad (Standard-Mapping)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const ax = gp.axes;
      const b = (i) => (gp.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0);
      const prev = this.gpPrev[gp.index] || [];
      const pressed = (i) => gp.buttons[i] && gp.buttons[i].pressed && !prev[i];
      const lx = dz(ax[0] || 0), ly = dz(ax[1] || 0), rx = dz(ax[2] || 0), ry = dz(ax[3] || 0);
      const any = Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) + b(6) + b(7) > 0.2 || gp.buttons.some((x) => x.pressed);
      if (any && this.device !== 'gamepad') { this.device = 'gamepad'; this.onDevice && this.onDevice(); }
      if (this.mode === 'pilot') {
        f.roll += lx; f.pitch += -ly; f.yaw += rx;
        f.collective += -ry + b(7) - b(6);
      } else if (this.mode === 'foot') {
        mv.x += lx; mv.y += -ly;
        const s = 2.4 * this.settings.sensitivity * dt;
        this.aim.dx += rx * s;
        this.aim.dy += ry * s * 0.8 * (this.settings.invertY ? -1 : 1);
        fire = fire || b(7) > 0.4;
        this.zoomHeld = this.zoomHeld || b(6) > 0.4;
        if (pressed(10)) this.padSprint = !this.padSprint;
        if (Math.hypot(lx, ly) < 0.2) this.padSprint = false;
        this.sprint = this.sprint || !!this.padSprint;
        if (pressed(11)) this.actions.push('crouch');
      } else if (this.mode === 'pax') {
        this.look.dx += rx * dt * 2;
        this.look.dy += ry * dt * 2;
      } else {
        const s = 2.2 * this.settings.sensitivity * dt;
        this.aim.dx += (rx + lx * 0.5) * s;
        this.aim.dy += (ry + ly * 0.5) * s * (this.settings.invertY ? -1 : 1);
        fire = fire || b(7) > 0.4;
        this.zoomHeld = this.zoomHeld || b(6) > 0.4;
      }
      // Tasten: 0=B(unten) 1=A(rechts) 2=Y(links) 3=X(oben) 4=L 5=R 8=− 9=+ 12-15=Steuerkreuz
      if (pressed(0) || pressed(1)) this.actions.push('confirm');
      if (pressed(3)) this.actions.push('map');
      if (pressed(2)) this.actions.push(this.mode === 'foot' ? 'reload' : 'camera');
      if (pressed(4)) this.actions.push('seat-prev');
      if (pressed(5)) this.actions.push('seat-next');
      if (pressed(9)) this.actions.push('pause');
      if (pressed(8)) this.actions.push('crew');
      if (pressed(12)) { this.actions.push('dpad-up'); this.pushNav('nav-up', 'pad'); }
      if (pressed(13)) { this.actions.push('dpad-down'); this.pushNav('nav-down', 'pad'); }
      if (pressed(14)) { this.actions.push('dpad-left'); this.pushNav('nav-left', 'pad'); }
      if (pressed(15)) { this.actions.push('dpad-right'); this.pushNav('nav-right', 'pad'); }
      // Menü-Navigation auch mit dem linken Stick und dem Steuerkreuz als Achse (nicht-standard Mapping, z. B. Android)
      let ny = ly, nx = lx;
      if (gp.mapping !== 'standard' && ax.length >= 8) {
        if (Math.abs(ax[7] || 0) > 0.5) ny = ax[7];
        if (Math.abs(ax[6] || 0) > 0.5) nx = ax[6];
      }
      if (ax.length > 9 && Math.abs(ax[9] || 0) <= 1 && gp.mapping !== 'standard') {
        // POV-Hut als einzelne Achse: -1 hoch, ~0.14 runter, 0.71 links, -0.43 rechts
        const hv = ax[9];
        if (Math.abs(hv + 1) < 0.1) ny = -1; else if (Math.abs(hv - 0.143) < 0.1) ny = 1;
        else if (Math.abs(hv - 0.714) < 0.1) nx = -1; else if (Math.abs(hv + 0.429) < 0.1) nx = 1;
      }
      this.stickNav(gp.index, nx, ny, dt);
      this.gpPrev[gp.index] = gp.buttons.map((x) => x.pressed);
      this.gpConnected = true;
    }

    // Touch
    if (this.touch.left && this.mode === 'foot') { mv.x += this.touch.left.x; mv.y += -this.touch.left.y; this.sprint = this.sprint || Math.hypot(this.touch.left.x, this.touch.left.y) > 0.95; }
    else if (this.touch.left) { f.yaw += this.touch.left.x; f.collective += -this.touch.left.y; }
    if (this.touch.right && this.mode === 'pilot') { f.roll += this.touch.right.x; f.pitch += -this.touch.right.y; }
    fire = fire || this.touch.fire;

    f.pitch = clamp(f.pitch, -1, 1); f.roll = clamp(f.roll, -1, 1); f.yaw = clamp(f.yaw, -1, 1); f.collective = clamp(f.collective, -1, 1);
    this.flight = f;
    this.move = mv;
    this.fire = fire;
  }

  // Stick-Bewegung als Menütaste mit Wiederholung
  stickNav(idx, x, y, dt) {
    if (!this.navState) this.navState = {};
    const st = this.navState[idx] || (this.navState[idx] = { dir: null, t: 0 });
    const dir = y < -0.6 ? 'nav-up' : y > 0.6 ? 'nav-down' : x < -0.6 ? 'nav-left' : x > 0.6 ? 'nav-right' : null;
    if (dir !== st.dir) { st.dir = dir; st.t = 0.45; if (dir) this.pushNav(dir, 'pad'); return; }
    if (!dir) return;
    st.t -= dt;
    if (st.t <= 0) { st.t = 0.18; this.pushNav(dir, 'pad'); }
  }

  // Auf Android kommt das Steuerkreuz doppelt an (Gamepad-API und Tastenereignis der WebView): nur einmal werten
  pushNav(dir, src) {
    const now = performance.now();
    if (!this.lastNav) this.lastNav = {};
    const other = this.lastNav[dir + (src === 'key' ? 'pad' : 'key')];
    this.lastNav[dir + src] = now;
    if (other && now - other < 150) return;
    this.actions.push(dir);
  }

  consumeAim() { const a = { dx: this.aim.dx, dy: this.aim.dy }; this.aim.dx = this.aim.dy = 0; return a; }
  consumeLook() { const l = { ...this.look }; this.look.dx = this.look.dy = this.look.zoom = 0; return l; }
  popActions() { const a = this.actions; this.actions = []; return a; }
}
