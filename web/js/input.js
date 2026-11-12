// Eingabe: Tastatur/Maus, Gamepad (z. B. Nintendo Switch Pro Controller), Touchscreen
import { clamp } from './util.js';
import { BINDS, resolveBinds, bindActive } from './binds.js';

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

    this.refreshBinds();
    // Gyro: Neigung des Handys (Lagesensor)
    this.gyro = null;      // letzte Werte { beta, gamma }
    this.gyroZero = null;  // Neutralstellung
    window.addEventListener('deviceorientation', (e) => {
      if (e.beta == null || e.gamma == null) return;
      this.gyro = { beta: e.beta, gamma: e.gamma };
      if (this.settings.gyro && !this.gyroZero) this.calibrateGyro();
    });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.fire = false; });
    this.mfx = 0; this.mfy = 0; this.mYaw = 0; this.mPitch = 0;
    // Tastenbelegung ändern: nächste Taste/Maustaste abfangen
    window.addEventListener('mousedown', (e) => {
      if (!this.capture) return;
      e.preventDefault(); e.stopPropagation();
      const cb = this.capture; this.capture = null; cb('Mouse' + e.button);
    }, true);
    // Android-App: Maus über die App einfangen (WebView kennt kein Pointer Lock) – Bewegung/Tasten kommen über HotLZ_mouse
    this.native = !!(window.AndroidApp && window.AndroidApp.capturePointer);
    this.nativeLock = false;
    window.HotLZ_mouse = (dx, dy, buttons, wheel) => {
      this.device = 'keyboard';
      for (let b = 0; b < 3; b++) {
        const down = !!(buttons & [1, 4, 2][b]);   // Android: 1 primär, 2 sekundär, 4 Mitte -> DOM: 0 links, 1 Mitte, 2 rechts
        if (down !== this.mouseDown[b]) (down ? this.mouseButton(b, true) : this.mouseButton(b, false));
      }
      if (dx || dy) this.mouseMove(dx, dy);
      if (wheel) this.mouseWheel(-wheel);
    };
    window.HotLZ_mouseLock = (on) => { this.nativeLock = !!on; if (!on) { this.mPitch = 0; this.mRoll = 0; for (let b = 0; b < 3; b++) if (this.mouseDown[b]) this.mouseButton(b, false); } };
    canvas.addEventListener('mousedown', (e) => {
      this.device = 'keyboard';
      this.mouseButton(e.button, true);
      const want = this.mode !== 'pilot' || (this.settings.mouseFly && e.button === 0);
      if (want && !this.locked) this.lockPointer();
    });
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas) { this.mPitch = 0; this.mRoll = 0; } });
    window.addEventListener('mouseup', (e) => { if (!this.nativeLock) this.mouseButton(e.button, false); });
    window.addEventListener('mousemove', (e) => { if (!this.nativeLock) this.mouseMove(e.movementX, e.movementY); });
    canvas.addEventListener('wheel', (e) => { this.mouseWheel(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('gamepadconnected', () => { this.gpConnected = true; this.device = 'gamepad'; this.onDevice && this.onDevice(); });
    this.gpCal = {};
    window.addEventListener('gamepaddisconnected', (e) => {
      if (e && e.gamepad) delete this.gpCal[e.gamepad.index]; this.gpConnected = [...(navigator.getGamepads ? navigator.getGamepads() : [])].some((g) => g); });
    this.setupTouch();
  }

  // Lage des Handys relativ zum Bildschirm: Lenkwinkel (Drehen wie ein Lenkrad) und Neigung (Oberkante weg/her).
  // Über den Schwerkraft-Vektor gerechnet – stetig auch bei fast senkrecht gehaltenem Gerät (keine Sprünge wie bei Beta/Gamma).
  gyroAngles() {
    if (!this.gyro) return null;
    const D = Math.PI / 180, b = this.gyro.beta * D, g = this.gyro.gamma * D;
    const ux = -Math.cos(b) * Math.sin(g), uy = Math.sin(b), uz = Math.cos(b) * Math.cos(g);   // „oben“ in Gerätekoordinaten
    const ang = ((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 90) % 360;
    let sx = ux, sy = uy;
    if (ang === 90) { sx = -uy; sy = ux; } else if (ang === 270 || ang === -90) { sx = uy; sy = -ux; } else if (ang === 180) { sx = -ux; sy = -uy; }
    return { roll: -Math.atan2(sx, sy) / D, pitch: Math.atan2(uz, Math.hypot(sx, sy)) / D };
  }
  // Aktuelle Haltung des Handys als Neutralstellung übernehmen
  calibrateGyro() { const a = this.gyroAngles(); if (a) { this.gyroZero = a; this.gyroSm = { roll: 0, pitch: 0 }; } }
  // Für iOS: Zugriff auf den Lagesensor erfragen (muss aus einer Nutzeraktion heraus passieren)
  requestGyro() {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') D.requestPermission().catch(() => {});
    this.gyroZero = null;
  }
  // Neigung in Steuerausschlag: Totzone, sanfte Kennlinie (feinfühlig um die Mitte), voller Ausschlag erst bei ca. 35° (Empfindlichkeit 1)
  gyroControl() {
    if (!this.settings.gyro || !this.gyroZero) return null;
    const a = this.gyroAngles();
    if (!a) return null;
    let dr = a.roll - this.gyroZero.roll, dp = a.pitch - this.gyroZero.pitch;
    if (dr > 180) dr -= 360; if (dr < -180) dr += 360;
    const sens = this.settings.gyroSens || 1, dead = 3;
    const k = (v, full) => {
      if (Math.abs(v) < dead) return 0;
      const x = clamp((Math.abs(v) - dead) / (full / sens), 0, 1);
      return Math.sign(v) * Math.pow(x, 1.6);
    };
    const sm = this.gyroSm || (this.gyroSm = { roll: 0, pitch: 0 });
    sm.roll += (k(dr, 35) - sm.roll) * 0.35;
    sm.pitch += (k(dp, 30) - sm.pitch) * 0.35;
    return { roll: sm.roll, pitch: sm.pitch * (this.settings.gyroInvert ? -1 : 1) };
  }

  // Belegung neu einlesen (nach Änderung in den Einstellungen)
  refreshBinds() { this.binds = resolveBinds(this.settings); }
  held(id) { const c = this.binds[id]; return c && (this.keys.has(c[0]) || (c[1] !== undefined && this.keys.has(c[1]))) ? 1 : 0; }
  // Taste/Maustaste gedrückt: alle Aktionen auslösen, die im aktuellen Modus darauf liegen
  pressCode(code) {
    for (const b of BINDS) {
      if (b.held || !bindActive(b, this.mode)) continue;
      if (this.binds[b.id].includes(code)) this.actions.push(b.id);
    }
  }

  // Zeiger eingefangen (Browser: Pointer Lock, App: Pointer Capture)
  get locked() { return document.pointerLockElement === this.canvas || this.nativeLock; }

  lockPointer() {
    // der Klick, der den Zeiger einfängt, löst keinen Schuss aus
    if (this.mode === 'foot') this.lockClick = true;
    if (this.native) {
      try { if (window.AndroidApp.capturePointer(true)) return; } catch (_) { /* weiter mit Pointer Lock */ }
    }
    if (this.canvas.requestPointerLock) {
      try { const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {}
    }
  }

  unlockPointer() {
    if (this.nativeLock) { try { window.AndroidApp.capturePointer(false); } catch (_) {} this.nativeLock = false; }
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  }

  mouseButton(b, down) {
    this.mouseDown[b] = down;
    if (down) { this.pressCode('Mouse' + b); this.keys.add('Mouse' + b); }
    else { this.keys.delete('Mouse' + b); if (b === 0) this.lockClick = false; }
  }

  mouseWheel(dy) {
    if (this.mode === 'foot') this.actions.push(dy > 0 ? 'wnext' : 'wprev');
    else this.look.zoom += Math.sign(dy);
  }

  mouseMove(mx, my) {
    const locked = this.locked;
    if (this.mode === 'pax' && (locked || this.mouseDown[0] || this.mouseDown[2])) {
      this.look.dx += mx * 0.005;
      this.look.dy += my * 0.005;
    } else if (this.mode !== 'pilot' && (locked || this.mouseDown[0] || this.mouseDown[2])) {
      const s = 0.0022 * this.settings.sensitivity;
      this.aim.dx += mx * s;
      this.aim.dy += my * s * (this.settings.invertY ? -1 : 1);
    } else if (this.mode === 'pilot' && locked && this.settings.mouseFly && !this.mouseDown[2]) {
      // Maus als Steuerknüppel: links/rechts = rollen, vor/zurück = nicken
      this.mfx += mx;
      this.mfy += my;
    } else if (this.mouseDown[0] || this.mouseDown[2]) {
      this.look.dx += mx * 0.005;
      this.look.dy += my * 0.005;
    }
  }

  onKey(e, down) {
    const k = e.code;
    if (down && this.capture) {
      e.preventDefault();
      const cb = this.capture; this.capture = null; cb(k);
      return;
    }
    // Loslassen immer verarbeiten: sonst „klemmt“ eine Taste, die außerhalb eines Eingabefelds gedrückt und
    // erst im Feld losgelassen wurde (z. B. Steuerkreuz des Controllers = Pfeiltasten in der Mehrspieler-Lobby)
    if (!down) { this.keys.delete(k); return; }
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (down) {
      if (this.device !== 'keyboard') { this.device = 'keyboard'; this.onDevice && this.onDevice(); }
      if (!this.keys.has(k)) {
        if (k === 'Escape') this.actions.push('pause');
        this.pressCode(k);
        if (k === 'Tab') e.preventDefault();
        const nav = { ArrowUp: 'nav-up', ArrowDown: 'nav-down', ArrowLeft: 'nav-left', ArrowRight: 'nav-right' }[k];
        if (nav) this.pushNav(nav, 'key');
      }
      this.keys.add(k);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    } else this.keys.delete(k);
  }

  key(...codes) { return codes.some((c) => this.keys.has(c)) ? 1 : 0; }
  // alle gehaltenen Tasten vergessen (Spielstart, Fenster schließen) – verhindert hängende Tasten
  releaseAll() { for (const k of [...this.keys]) if (!k.startsWith('Mouse')) this.keys.delete(k); this.aim.dx = this.aim.dy = 0; }

  setMode(mode) {
    this.mode = mode;
    if ((mode === 'pilot' && !this.settings.mouseFly) || mode === 'pax') this.unlockPointer();
    const gunner = mode === 'left' || mode === 'right' || mode === 'ramp';
    document.body.classList.toggle('gunner-mode', gunner);
    document.body.classList.toggle('foot-mode', mode === 'foot');
    document.body.classList.toggle('pax-mode', mode === 'pax');
    document.body.classList.toggle('aim-mode', gunner || mode === 'foot');
    document.body.classList.toggle('pilot-seat', mode === 'pilot');
  }

  get aimMode() { return this.mode === 'left' || this.mode === 'right' || this.mode === 'ramp' || this.mode === 'foot'; }

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
        this.touch[side] = { id: t.identifier, x: 0, y: 0, t0: e.timeStamp, moved: 0 };
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
          tt.moved = Math.max(tt.moved, Math.hypot(dx, dy));
          st.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
      }, { passive: false });
      const end = (e) => {
        for (const t of e.changedTouches) {
          if (this.touch.aim && this.touch.aim.id === t.identifier) this.touch.aim = null;
          const tt = this.touch[side];
          if (tt && tt.id === t.identifier) {
            // Kurzes Antippen des linken Sticks (ohne Steuerausschlag) feuert als Pilot eine Rakete
            if (side === 'left' && this.mode === 'pilot' && e.timeStamp - tt.t0 < 250 && tt.moved < 10) this.actions.push('rocket-tap');
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
    const fly = this.mode !== 'foot';
    const kp = fly ? this.held('fly-fwd') - this.held('fly-back') : 0;
    const kr = fly ? this.held('fly-right') - this.held('fly-left') : 0;
    const ky = fly ? this.held('yaw-right') - this.held('yaw-left') : 0;
    const kc = fly ? this.held('coll-up') - this.held('coll-down') : 0;
    if (!this.kb) this.kb = { pitch: 0, roll: 0, yaw: 0, collective: 0 };
    const sm = (cur, tgt, rate) => cur + clamp(tgt - cur, -rate * dt, rate * dt);
    this.kb.pitch = sm(this.kb.pitch, kp, kp ? 2.5 : 5);
    this.kb.roll = sm(this.kb.roll, kr, kr ? 2.5 : 5);
    this.kb.yaw = sm(this.kb.yaw, ky, 5);
    this.kb.collective = sm(this.kb.collective, kc, 4);
    f.pitch += this.kb.pitch; f.roll += this.kb.roll; f.yaw += this.kb.yaw; f.collective += this.kb.collective;
    // Gyro-Steuerung als Pilot (Touch-Sticks bleiben zusätzlich nutzbar)
    if (this.mode === 'pilot') {
      const gc = this.gyroControl();
      if (gc) { f.roll += gc.roll; f.pitch += gc.pitch; }
    }
    // Maus als Steuerknüppel (nur Pilot, Zeiger eingefangen): Ausschlag wie ein echter Stick,
    // links/rechts = rollen, vor/zurück = nicken; ohne Bewegung zentriert er sich langsam
    this.mouseFlying = this.mode === 'pilot' && this.settings.mouseFly && this.locked;
    if (this.mouseFlying) {
      const sens = this.settings.sensitivity;
      const inv = this.settings.mouseFlyInvert ? -1 : 1;
      this.mPitch = clamp(this.mPitch - this.mfy * 0.004 * sens * inv, -1, 1);
      this.mRoll = clamp((this.mRoll || 0) + this.mfx * 0.004 * sens, -1, 1);
      if (this.mfy === 0) this.mPitch -= clamp(this.mPitch, -dt * 0.35, dt * 0.35);
      if (this.mfx === 0) this.mRoll -= clamp(this.mRoll, -dt * 0.35, dt * 0.35);
      if (kp) this.mPitch = 0;
      if (kr) this.mRoll = 0;
      f.pitch += this.mPitch;
      f.roll += this.mRoll;
    } else { this.mPitch = 0; this.mRoll = 0; }
    this.mfx = 0; this.mfy = 0;
    const mv = { x: 0, y: 0 };
    this.sprint = false;
    const jump = this.mode === 'foot' && !!this.held('jump');
    if (this.mode === 'foot') {
      // Zu Fuß: WASD laufen, Pfeiltasten umsehen, Maus zielen, Shift sprinten, Leertaste springen
      mv.x = this.held('walk-right') - this.held('walk-left');
      mv.y = this.held('walk-fwd') - this.held('walk-back');
      this.sprint = !!this.held('sprint');
      const ax = this.key('ArrowRight') - this.key('ArrowLeft');
      const ay = this.key('ArrowDown') - this.key('ArrowUp');
      this.aim.dx += ax * dt * 1.6;
      this.aim.dy += ay * dt * 1.2;
      fire = fire || (!!this.held('fire') && !this.lockClick);
      this.zoomHeld = !!this.held('aim');
    } else if (this.mode === 'left' || this.mode === 'right' || this.mode === 'ramp') {
      // Im Schützensitz: Pfeiltasten zum Zielen, Leertaste/Maus zum Feuern
      const ax = this.key('ArrowRight', 'KeyD') - this.key('ArrowLeft', 'KeyA');
      const ay = this.key('ArrowDown', 'KeyS') - this.key('ArrowUp', 'KeyW');
      this.aim.dx += ax * dt * 1.2;
      this.aim.dy += ay * dt * 1.0;
      fire = fire || !!this.held('gun-fire');
      this.zoomHeld = !!this.held('gun-zoom');
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
      // Achsen kalibrieren: manche Controller (z. B. Switch Pro/Joy-Con an Android, nicht-Standard-Mapping)
      // melden unbenutzte Achsen oder Schultertasten dauerhaft bei -1/+1 – ohne Kalibrierung schaut der
      // Spieler dann ständig nach unten. Achsen, die nie in der Mitte waren und sich nicht bewegen, gelten als Ruhelage.
      const cal = this.gpCal[gp.index] || (this.gpCal[gp.index] = { rest: ax.map(() => 0), nchg: ax.map(() => 0), center: ax.map(() => false), last: ax.slice(), still: ax.map(() => 0), moved: ax.map(() => 0) });
      for (let i = 2; i < ax.length; i++) {
        const v = ax[i] || 0;
        if (v === cal.last[i]) cal.still[i] += dt; else { cal.still[i] = 0; cal.last[i] = v; cal.nchg[i]++; }
        // analoge Sticks liefern beim Bewegen viele Zwischenwerte; springt eine Achse ohne Zwischenwerte
        // an den Anschlag und bleibt dort, ist das eine Ruhelage (Schultertaste, unbelegte Achse)
        if (cal.nchg[i] > 3 && Math.abs(v) < 0.15) { cal.center[i] = true; cal.rest[i] = 0; }
        if (!cal.center[i] && cal.nchg[i] <= 3 && cal.still[i] > 0.4 && Math.abs(v) > 0.5) cal.rest[i] = v;
        cal.moved[i] = Math.max(cal.moved[i], Math.abs(v - cal.rest[i]));
      }
      const A = (i) => {
        if (i >= ax.length) return 0;
        const r = cal.rest[i], v = (ax[i] || 0) - r;
        return Math.abs(r) > 0.3 ? 0 : dz(v);   // Achse in Ruhe am Anschlag: Schultertaste o. Ä., nicht als Stick werten
      };
      // rechter Stick: Standard 2/3; bei nicht-Standard-Mapping (Android) oft Z/RZ = 2/5
      let ri = 2, rj = 3;
      if (gp.mapping !== 'standard' && ax.length >= 6 && (Math.abs(cal.rest[3]) > 0.3 || (cal.moved[5] > 0.35 && cal.moved[3] < 0.2))) rj = 5;
      if (gp.mapping !== 'standard' && ax.length >= 6 && Math.abs(cal.rest[2]) > 0.3 && Math.abs(cal.rest[3]) < 0.3) { ri = 3; rj = 5; }
      const lx = A(0), ly = A(1), rx = A(ri), ry = A(rj);
      const any = Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) + b(6) + b(7) > 0.2 || gp.buttons.some((x) => x.pressed);
      if (any && this.device !== 'gamepad') { this.device = 'gamepad'; this.onDevice && this.onDevice(); }
      if (this.mode === 'pilot') {
        if (pressed(10)) this.actions.push('nvg');
        if (pressed(11)) this.actions.push('cam-dist');   // rechten Stick drücken: Kameraabstand
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
        if (pressed(11)) this.actions.push('magnifier');   // rechten Stick drücken: Visier/Vergrößerer
      } else if (this.mode === 'pax') {
        if (pressed(10)) this.actions.push('nvg');
        this.look.dx += rx * dt * 2;
        this.look.dy += ry * dt * 2;
      } else {
        const s = 2.2 * this.settings.sensitivity * dt;
        if (pressed(10)) this.actions.push('nvg');
        this.aim.dx += (rx + lx * 0.5) * s;
        this.aim.dy += (ry + ly * 0.5) * s * (this.settings.invertY ? -1 : 1);
        fire = fire || b(7) > 0.4;
        this.zoomHeld = this.zoomHeld || b(6) > 0.4;
      }
      // Tasten: 0=B(unten) 1=A(rechts) 2=Y(links) 3=X(oben) 4=L 5=R 8=− 9=+ 12-15=Steuerkreuz
      if (pressed(0) || pressed(1)) this.actions.push('confirm');
      if (pressed(3)) this.actions.push(this.mode === 'foot' ? 'pickup' : 'map');
      if (pressed(2)) this.actions.push(this.mode === 'foot' ? 'reload' : 'camera');
      if (pressed(4)) this.actions.push('seat-prev');
      if (pressed(5)) this.actions.push(this.mode === 'foot' ? 'seat-next' : 'pad-r');
      if (pressed(9)) this.actions.push('pause');
      if (pressed(8)) this.actions.push('crew');
      if (pressed(12)) { this.pushDpad('up'); this.pushNav('nav-up', 'pad'); }
      if (pressed(13)) { this.pushDpad('down'); this.pushNav('nav-down', 'pad'); }
      if (pressed(14)) { this.pushDpad('left'); this.pushNav('nav-left', 'pad'); }
      if (pressed(15)) { this.pushDpad('right'); this.pushNav('nav-right', 'pad'); }
      // Menü-Navigation auch mit dem linken Stick und dem Steuerkreuz als Achse (nicht-standard Mapping, z. B. Android)
      let hx = 0, hy = 0;
      if (gp.mapping !== 'standard' && ax.length >= 8) {
        if (Math.abs(ax[7] || 0) > 0.5) hy = Math.sign(ax[7]);
        if (Math.abs(ax[6] || 0) > 0.5) hx = Math.sign(ax[6]);
      }
      if (ax.length > 9 && Math.abs(ax[9] || 0) <= 1 && gp.mapping !== 'standard') {
        // POV-Hut als einzelne Achse: -1 hoch, ~0.14 runter, 0.71 links, -0.43 rechts
        const hv = ax[9];
        if (Math.abs(hv + 1) < 0.1) hy = -1; else if (Math.abs(hv - 0.143) < 0.1) hy = 1;
        else if (Math.abs(hv - 0.714) < 0.1) hx = -1; else if (Math.abs(hv + 0.429) < 0.1) hx = 1;
      }
      // Steuerkreuz als Achse (z. B. Switch-Controller an Android): auch die Spielaktionen auslösen
      const hat = hy < 0 ? 'up' : hy > 0 ? 'down' : hx < 0 ? 'left' : hx > 0 ? 'right' : null;
      const ph = (this.hatPrev || {})[gp.index];
      if (hat && hat !== ph && !(gp.buttons[12] && (gp.buttons[12].pressed || gp.buttons[13].pressed || gp.buttons[14].pressed || gp.buttons[15].pressed))) this.pushDpad(hat);
      (this.hatPrev = this.hatPrev || {})[gp.index] = hat;
      this.stickNav(gp.index, hx || lx, hy || ly, dt);
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

  // Steuerkreuz kommt auf Android teils als Taste UND als Achse an: je Richtung nur einmal pro 300 ms werten
  pushDpad(dir) {
    const now = performance.now();
    if (!this.lastDpad) this.lastDpad = {};
    if (now - (this.lastDpad[dir] || 0) < 300) return;
    this.lastDpad[dir] = now;
    this.actions.push('dpad-' + dir);
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
