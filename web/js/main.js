// Dustoff – UH-1D Medevac Vietnam: Hauptprogramm
import * as THREE from './lib/three.module.min.js';
import { World } from './world.js';
import { Effects } from './effects.js';
import { Helicopter } from './helicopter.js';
import { Combat, Gunner } from './combat.js';
import { Units } from './units.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { FUEL, HELI, CALLSIGN, FOB_NAME } from './config.js';
import { clamp, damp, dist2, rand } from './util.js';
import * as PF from './platform.js';

const $ = (id) => document.getElementById(id);
const SEATS = ['pilot', 'left', 'right'];

class Game {
  constructor() {
    this.settings = PF.loadSettings();
    this.stats = PF.loadStats();
    this.state = 'loading';
    this.time = 0;
    this.seat = 'pilot';
    this.camMode = 'chase';
    this.orbit = { yaw: 0, pitch: 0.2, dist: 24, look: 0 };
    this.cockpitLook = { yaw: 0, pitch: 0 };
    this.lastHitTime = -10;
    this.radioThrottle = {};
  }

  async init() {
    const q = this.settings.quality;
    const canvas = $('game');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    this.pixelCap = q === 'low' ? 1 : q === 'medium' ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.fogDensity = 0.0005;
    this.scene.fog = new THREE.FogExp2(0xc4cbbd, this.fogDensity);
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 7000);
    this.scene.add(new THREE.HemisphereLight(0xd9e3ea, 0x46522f, 1.25));
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
    sun.position.set(-0.5, 1, 0.35).multiplyScalar(1000);
    this.scene.add(sun);

    await this.step('Erzeuge Gelände …', 10);
    this.world = new World(this.scene, q);
    await this.step('Effekte …', 60);
    this.effects = new Effects(this.scene, q);
    this.heli = new Helicopter(this.scene, this.effects);
    this.gunners = { left: new Gunner('left', this.heli), right: new Gunner('right', this.heli) };
    this.combat = new Combat(this);
    this.units = new Units(this);
    this.missions = new Missions(this);
    this.hud = new HUD(this);
    this.input = new Input(canvas, this.settings);
    this.input.onDevice = () => this.updateTouchVisibility();
    this.audio = new AudioSys();
    this.audio.setVolume(this.settings.volume);
    await this.step('Bereite FOB vor …', 85);
    this.spawnHeli();
    this.units.spawnPatrols(12);

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.state === 'playing') this.pause(true); this.audio.suspend(); }
      else if (this.state === 'playing') this.audio.resume();
    });
    this.setupUI();
    this.onResize();
    $('loading').classList.add('hidden');
    this.showMenu();
    this.last = performance.now();
    window.game = this; // für Debugging
    this.renderer.setAnimationLoop(() => this.frame());
  }

  step(text, pct) {
    $('load-text').textContent = text;
    $('load-bar').style.width = pct + '%';
    return new Promise((r) => setTimeout(r, 30));
  }

  spawnHeli() {
    const pad = this.world.fob.pads.troop;
    this.heli.reset(pad.x, this.world.height(pad.x, pad.z) + 0.12, pad.z, Math.PI * 0.1);
    this.gunners.left.reset();
    this.gunners.right.reset();
    this.setSeat('pilot');
  }

  // ------------------------------------------------------------ UI
  setupUI() {
    const on = (id, fn) => { const e = $(id); if (e) e.addEventListener('click', (ev) => { ev.preventDefault(); this.audio.init(); fn(); }); };
    on('btn-start', () => this.startGame());
    on('btn-continue', () => this.startGame());
    on('btn-help', () => this.openPanel('help'));
    on('btn-settings', () => this.openPanel('settings'));
    on('btn-resume', () => this.pause(false));
    on('btn-pause-help', () => this.openPanel('help'));
    on('btn-pause-settings', () => this.openPanel('settings'));
    on('btn-pause-menu', () => { $('pause').classList.add('hidden'); this.showMenu(); });
    on('brief-accept', () => this.missions.accept());
    on('btn-respawn', () => this.respawn());
    on('btn-update', () => PF.appCheckUpdate());
    on('fullmap', () => this.hud.toggleMap(false));
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); this.closePanel(b.dataset.close); }));
    document.querySelectorAll('.help-tabs button').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.help-tabs button').forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('.help-page').forEach((p) => p.classList.toggle('hidden', p.id !== b.dataset.page));
    }));

    // Einstellungen
    const s = this.settings;
    const bind = (id, key, conv, apply) => {
      const el = $(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!s[key]; else el.value = s[key];
      el.addEventListener('change', () => {
        s[key] = el.type === 'checkbox' ? el.checked : conv(el.value);
        PF.saveSettings(s);
        apply && apply(s[key]);
      });
    };
    bind('set-quality', 'quality', String, () => { $('quality-note').classList.remove('hidden'); });
    bind('set-volume', 'volume', Number, (v) => this.audio.setVolume(v));
    bind('set-sens', 'sensitivity', Number);
    bind('set-invert', 'invertY', Boolean);
    bind('set-diff', 'difficulty', Number);
    bind('set-fps', 'showFps', Boolean, (v) => $('fps').classList.toggle('hidden', !v));
    $('fps').classList.toggle('hidden', !s.showFps);
    on('btn-reload', () => location.reload());

    // Version / Android
    const vEl = $('version');
    const appV = PF.appVersion();
    if (PF.isApp) {
      document.body.classList.add('is-app');
      vEl.textContent = 'App-Version ' + (appV || '?');
    }
    PF.fetchVersion().then((v) => {
      if (!v) { if (!PF.isApp) vEl.textContent = 'Webversion (lokal)'; return; }
      if (!PF.isApp) vEl.textContent = 'Version ' + v.versionName;
    });
  }

  openPanel(id) {
    this.panelStack = this.panelStack || [];
    this.panelStack.push(id);
    $(id).classList.remove('hidden');
    this.focusFirst($(id));
  }
  closePanel(id) {
    $(id).classList.add('hidden');
    this.panelStack = (this.panelStack || []).filter((p) => p !== id);
  }

  focusFirst(root) {
    const b = root && root.querySelector('button:not(.hidden), select, input');
    if (b && this.input && this.input.device === 'gamepad') b.focus();
  }

  showMenu() {
    this.state = 'menu';
    this.hud.show(false);
    this.updateTouchVisibility();
    $('menu').classList.remove('hidden');
    $('btn-continue').classList.toggle('hidden', !this.started);
    $('btn-start').classList.toggle('hidden', !!this.started);
    const st = this.stats;
    $('menu-stats').innerHTML = `<b>${PF.rankFor(st.score)}</b> · ${st.score} Punkte · ${st.missions} Einsätze · ${st.rescued} gerettet · ${st.transported} transportiert`;
    this.focusFirst($('menu'));
  }

  startGame() {
    PF.enterFullscreen();
    this.audio.init();
    $('menu').classList.add('hidden');
    this.hud.show(true);
    this.state = 'playing';
    this.updateTouchVisibility();
    if (!this.started) {
      this.started = true;
      this.hud.radio(`${CALLSIGN}, hier TOC ${FOB_NAME}. Willkommen in Vietnam. Halten Sie sich bereit.`, 'TOC');
      setTimeout(() => this.missions.generate(), 1200);
    }
  }

  pause(on) {
    if (on && this.state === 'playing') {
      this.state = 'paused';
      $('pause').classList.remove('hidden');
      this.audio.suspend();
      if (document.pointerLockElement) document.exitPointerLock();
      this.focusFirst($('pause'));
    } else if (!on && this.state === 'paused') {
      $('pause').classList.add('hidden');
      for (const p of ['help', 'settings']) $(p).classList.add('hidden');
      this.state = 'playing';
      this.audio.resume();
      this.last = performance.now();
    }
    this.updateTouchVisibility();
  }

  updateTouchVisibility() {
    const show = this.input && this.input.device === 'touch' && this.state === 'playing';
    $('touch-controls').classList.toggle('hidden', !show);
    document.body.classList.toggle('touch', this.input && this.input.device === 'touch');
    document.body.classList.toggle('pad', this.input && this.input.device === 'gamepad');
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.effects.setView(h * this.renderer.getPixelRatio(), this.camera.fov, this.fogDensity);
  }

  // ------------------------------------------------------------ Spielereignisse
  radio(text, from = '', urgent = false) {
    this.hud.radio(text, from, urgent);
    this.audio.radio();
  }
  radioOnce(key, sec, text, from, urgent) {
    if (this.time - (this.radioThrottle[key] ?? -1e9) < sec) return;
    this.radioThrottle[key] = this.time;
    this.radio(text, from, urgent);
  }

  onHeliHit(dmg) {
    this.lastHitTime = this.time;
    this.hud.damageFlash(0.18 + dmg * 0.04);
    this.audio.hit();
    this.radioOnce('hit', 12, rand.pick(['Wir werden beschossen!', 'Treffer im Heck!', 'Feuer von unten!', 'Die schießen auf uns!']), 'Crew', true);
  }

  onEnemyKilled() {
    if (rand() < 0.4) this.radioOnce('kill', 9, rand.pick(['Hab ihn!', 'Einer weniger!', 'Ziel ausgeschaltet!', 'Treffer – der ist erledigt!']), 'Schütze');
  }

  setSeat(seat) {
    this.seat = seat;
    this.gunners.left.player = seat === 'left';
    this.gunners.right.player = seat === 'right';
    this.input.setMode(seat);
    const m = this.heli.model;
    m.guns.left.gunner.group.visible = seat !== 'left';
    m.guns.right.gunner.group.visible = seat !== 'right';
    if (seat !== 'pilot') {
      this.apHoldY = Math.max(this.heli.pos.y, this.world.groundHeight(this.heli.pos.x, this.heli.pos.z) + 30);
      this.radioOnce('ap', 3, seat === 'left' ? 'Sie bedienen das linke M60. Der Kopilot hält die Maschine.' : 'Sie bedienen das rechte M60. Der Kopilot hält die Maschine.', 'Crew');
    }
  }

  autopilot() {
    const h = this.heli;
    if (h.contact) return { pitch: 0, roll: 0, yaw: 0, collective: -0.2 };
    const gnd = this.world.groundHeight(h.pos.x + h.vel.x * 3, h.pos.z + h.vel.z * 3);
    const tree = this.world.treeTopAt(h.pos.x, h.pos.z) || 0;
    this.apHoldY = Math.max(this.apHoldY, gnd + 25, tree + 15);
    return { pitch: 0, roll: 0, yaw: 0, collective: clamp((this.apHoldY - h.pos.y) * 0.06, -1, 1) };
  }

  respawn() {
    this.hud.hideCrash();
    this.crashShown = false;
    this.spawnHeli();
    this.radio(`TOC: ${CALLSIGN}, eine Ersatzmaschine steht auf Pad H1 bereit.`, 'TOC');
    this.missions.nextTimer = 3;
  }

  handleActions(actions) {
    for (const a of actions) {
      if (this.state === 'menu' || this.state === 'paused' || this.hud.briefOpen || this.crashShown) {
        if (a === 'confirm') {
          const ov = this.topOverlay();
          if (ov) {
            const b = ov.querySelector(':focus') || ov.querySelector('.primary:not(.hidden)') || ov.querySelector('button:not(.hidden)');
            if (b) { this.audio.init(); b.click(); }
            continue;
          }
        }
        if (a === 'dpad-down' || a === 'dpad-up') { this.moveFocus(a === 'dpad-down' ? 1 : -1); continue; }
        if (a === 'pause' && this.state === 'paused') { this.pause(false); continue; }
        if (this.state !== 'playing') continue;
      }
      switch (a) {
        case 'pause': this.pause(true); break;
        case 'map': this.hud.toggleMap(); break;
        case 'help': this.pause(true); this.openPanel('help'); break;
        case 'camera':
          if (this.seat === 'pilot') this.camMode = this.camMode === 'chase' ? 'cockpit' : 'chase';
          break;
        case 'seat-pilot': case 'dpad-up': this.setSeat('pilot'); break;
        case 'seat-left': case 'dpad-left': this.setSeat('left'); break;
        case 'seat-right': case 'dpad-right': this.setSeat('right'); break;
        case 'seat-next': this.setSeat(SEATS[(SEATS.indexOf(this.seat) + 1) % 3]); break;
        case 'seat-prev': this.setSeat(SEATS[(SEATS.indexOf(this.seat) + 2) % 3]); break;
        case 'dpad-down': case 'radio': {
          const m = this.missions.current;
          if (m) this.hud.showBriefing(m, this.missions.describe(m)), setTimeout(() => this.missions.phase !== 'briefing' && this.hud.hideBriefing(), 5000);
          break;
        }
        case 'confirm': if (this.hud.mapOpen) this.hud.toggleMap(false); break;
      }
    }
  }

  topOverlay() {
    const ids = ['crashscreen', 'settings', 'help', 'pause', 'briefing', 'menu'];
    for (const id of ids) { const e = $(id); if (e && !e.classList.contains('hidden')) return e; }
    return null;
  }
  moveFocus(dir) {
    const ov = this.topOverlay();
    if (!ov) return;
    const items = [...ov.querySelectorAll('button:not(.hidden), select, input')].filter((e) => e.offsetParent !== null);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    items[(i + dir + items.length) % items.length].focus();
  }

  // ------------------------------------------------------------ Hauptschleife
  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.input.update(dt);
    this.handleActions(this.input.popActions());
    if (this.state === 'playing') for (let i = 0; i < (this.timeScale || 1); i++) this.tick(dt);
    else if (this.state === 'menu') this.attract(dt);
    this.renderer.render(this.scene, this.camera);
  }

  attract(dt) {
    this.attractT = (this.attractT || 0) + dt;
    const h = this.heli, t = this.attractT * 0.08;
    this.heli.animate(dt);
    this.camera.position.set(h.pos.x + Math.sin(t) * 26, h.pos.y + 6 + Math.sin(t * 0.7) * 2, h.pos.z + Math.cos(t) * 26);
    this.camera.lookAt(h.pos.x, h.pos.y + 1, h.pos.z);
    this.effects.update(dt, this.camera.position);
    this.world.update(dt, this.time + this.attractT, this.camera);
  }

  tick(dt) {
    this.time += dt;
    const h = this.heli, w = this.world;
    let ctl;
    if (this.hud.briefOpen && this.missions.phase === 'briefing' && h.contact) ctl = { pitch: 0, roll: 0, yaw: 0, collective: -0.2 };
    else if (this.seat === 'pilot') ctl = this.input.flight;
    else ctl = this.autopilot();
    h.update(dt, ctl, w, true);
    if (!h.crashed) this.stats.flightTime += h.contact ? 0 : dt;

    for (const ev of h.events) {
      if (ev === 'crash') {
        this.missions.onHeliLost();
        this.stats.losses++;
        this.saveStats();
        this.radio(`MAYDAY, MAYDAY! ${CALLSIGN} stürzt ab!`, CALLSIGN, true);
        this.audio.boom(this.camera.position.distanceTo(h.pos));
        this.crashAt = this.time;
      } else if (ev === 'impact') this.audio.boom(this.camera.position.distanceTo(h.pos));
      else if (ev === 'hardlanding') { this.radioOnce('hl', 5, 'Autsch! Das war eine harte Landung!', 'Crew'); this.hud.damageFlash(0.4); this.audio.hit(); }
      else if (ev === 'flameout') this.radio('TRIEBWERK AUS! Treibstoff leer – Autorotation einleiten!', 'Crew', true);
      else if (ev === 'leak') this.radio('Wir verlieren Treibstoff – Tank getroffen!', 'Crew', true);
      else if (ev === 'slope') this.radioOnce('slope', 10, 'Gelände zu steil – wir rutschen!', 'Crew');
      else if (ev === 'water') this.radioOnce('water', 10, 'Wir stehen im Wasser!', 'Crew');
    }
    h.events.length = 0;
    if (h.crashed && !this.crashShown && this.time - this.crashAt > 4) {
      this.crashShown = true;
      this.hud.showCrash(h.crashCause);
      if (document.pointerLockElement) document.exitPointerLock();
      this.focusFirst($('crashscreen'));
    }

    const aim = this.input.consumeAim();
    this.gunners.left.update(dt, this, this.seat === 'left' ? aim : { dx: 0, dy: 0 }, this.seat === 'left' && this.input.fire);
    this.gunners.right.update(dt, this, this.seat === 'right' ? aim : { dx: 0, dy: 0 }, this.seat === 'right' && this.input.fire);
    this.units.update(dt);
    this.combat.update(dt);
    const prevPhase = this.missions.phase;
    this.missions.update(dt);
    if (prevPhase !== 'briefing' && this.missions.phase === 'briefing') this.units.refreshPatrols();

    // Tanken / Reparieren / Munition an der POL-Pad
    let hint = '';
    const f = w.fob;
    const pol = f.pads.pol;
    const dPol = dist2(h.pos.x, h.pos.z, pol.x, pol.z);
    if (!h.crashed && h.onGround && dPol < 16) {
      const full = h.fuel >= 99.9 && h.hp >= 99.9 && this.gunners.left.ammo >= 1500 && this.gunners.right.ammo >= 1500;
      h.fuel = Math.min(100, h.fuel + FUEL.refuelRate * dt);
      h.hp = Math.min(100, h.hp + FUEL.repairRate * dt);
      h.leak = false;
      for (const g of Object.values(this.gunners)) g.ammo = Math.min(1500, g.ammo + Math.ceil(400 * dt));
      if (!h.engineOn && h.fuel > 5) { h.engineOn = true; this.radio('Triebwerk wieder gestartet.', 'Crew'); }
      hint = full ? 'Betankt, repariert und aufmunitioniert – startklar!' : `BETANKUNG ${Math.round(h.fuel)} % · REPARATUR ${Math.round(h.hp)} % · MUNITION`;
      if (!this.wasRefueling) this.radio('Tankwart: Schlauch ist dran – wir füllen auf!', 'POL');
      this.wasRefueling = true;
    } else this.wasRefueling = false;

    // Warnungen
    const warnings = [];
    const dF = dist2(h.pos.x, h.pos.z, f.x, f.z);
    if (!h.crashed) {
      if (!h.engineOn) warnings.push({ text: 'TRIEBWERK AUS – AUTOROTATION', level: 'crit' });
      else if (h.fuel < 12) warnings.push({ text: 'TREIBSTOFF KRITISCH', level: 'crit' });
      else if (h.fuel < 25) warnings.push({ text: 'TREIBSTOFF NIEDRIG – TANKEN', level: 'warn' });
      const needed = (dF / 48) * 0.14 + 4;
      if (h.engineOn && dF > 400 && h.fuel < needed * 1.25) warnings.push({ text: 'BINGO FUEL – SOFORT ZUR FOB', level: 'crit' });
      if (h.leak) warnings.push({ text: 'TANKLECK', level: 'crit' });
      if (h.hp < 25) warnings.push({ text: 'STRUKTUR KRITISCH', level: 'crit' });
      if (h.treeWarn > 0) warnings.push({ text: 'ROTOR IN DEN BÄUMEN – STEIGEN!', level: 'crit' });
      if (this.time - this.lastHitTime < 1.6) warnings.push({ text: 'TREFFER – BESCHUSS!', level: 'crit' });
      if (!h.contact && h.agl < 25 && h.vel.y < -5) warnings.push({ text: 'SINKRATE – ZIEHEN!', level: 'crit' });
      if (h.boundaryWarn) warnings.push({ text: 'EINSATZGEBIET VERLASSEN – UMKEHREN', level: 'warn' });
      if (!hint && h.fuel < 35 && dF < 600) hint = 'Zum Tanken auf Pad POL (gelber Rand, neben dem Tankwagen) landen';
      if (!hint && this.missions.phase === 'pickup' && this.missions.current && h.passengers.length >= HELI.capacity) hint = 'Kabine voll!';
    }
    const critical = warnings.some((x) => x.level === 'crit');

    this.effects.update(dt, this.camera.position);
    this.world.update(dt, this.time, this.camera);
    this.updateCamera(dt);
    this.hud.update(dt, {
      waypoint: this.missions.waypoint(),
      warnings, hint,
      cameraLabel: this.seat === 'pilot' ? (this.camMode === 'chase' ? 'Außenansicht' : 'Cockpit') : '',
    });
    this.updateWaypointBeam();
    this.audio.update(h, this.seat !== 'pilot' || this.camMode === 'cockpit', critical, this.time);
    if (this.time - (this.lastSave || 0) > 30) { this.lastSave = this.time; this.saveStats(); }
  }

  saveStats() { PF.saveStats(this.stats); }

  updateWaypointBeam() {
    if (!this.beam) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd257, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 400, 12, 1, true), mat);
      this.beam.renderOrder = 6;
      this.scene.add(this.beam);
      this.ring = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffd257, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.renderOrder = 6;
      this.scene.add(this.ring);
    }
    const wp = this.missions.waypoint();
    this.beam.visible = this.ring.visible = !!wp;
    if (!wp) return;
    const h = this.heli;
    const d = dist2(h.pos.x, h.pos.z, wp.x, wp.z);
    this.beam.position.set(wp.x, wp.y + 200, wp.z);
    const s = clamp(d / 400, 1, 8) * (wp.approx ? 4 : 1);
    this.beam.scale.set(s, 1, s);
    this.beam.material.opacity = clamp(d / 1500, 0.06, 0.25);
    this.ring.position.set(wp.x, wp.y + 0.3, wp.z);
    this.ring.scale.setScalar(wp.radius);
    this.ring.visible = !wp.approx;
  }

  updateCamera(dt) {
    const h = this.heli, cam = this.camera, m = h.model;
    const look = this.input.consumeLook();
    let fov = 65;
    m.pilots[1].group.visible = true;
    m.glass.visible = true;
    if (this.seat !== 'pilot' && !h.crashed) {
      const rig = m.guns[this.seat];
      rig.eye.getWorldPosition(cam.position);
      rig.pitch.getWorldQuaternion(cam.quaternion);
      fov = this.input.zoomHeld ? 28 : 62;
    } else if (this.camMode === 'cockpit' && !h.crashed) {
      this.cockpitLook.yaw = clamp(this.cockpitLook.yaw - look.dx, -2.2, 2.2);
      this.cockpitLook.pitch = clamp(this.cockpitLook.pitch - look.dy, -0.9, 0.6);
      if (!this.input.mouseDown[0] && !this.input.mouseDown[2]) { this.cockpitLook.yaw *= 1 - damp(1.5, dt); this.cockpitLook.pitch *= 1 - damp(1.5, dt); }
      cam.position.copy(m.eyePilot).applyQuaternion(h.quat).add(h.pos);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.cockpitLook.pitch - 0.08, this.cockpitLook.yaw, 0, 'YXZ'));
      cam.quaternion.copy(h.quat).multiply(q);
      m.pilots[1].group.visible = false;
      fov = 75;
    } else {
      const o = this.orbit;
      o.yaw -= look.dx; o.pitch = clamp(o.pitch + look.dy, -0.15, 1.2);
      o.dist = clamp(o.dist + look.zoom * 3, 12, 70);
      if (!this.input.mouseDown[0] && !this.input.mouseDown[2]) o.yaw *= 1 - damp(0.8, dt);
      const yaw = h.yaw + o.yaw;
      const tx = h.pos.x + Math.sin(yaw) * Math.cos(o.pitch) * o.dist;
      const tz = h.pos.z + Math.cos(yaw) * Math.cos(o.pitch) * o.dist;
      let ty = h.pos.y + 3 + Math.sin(o.pitch) * o.dist;
      ty = Math.max(ty, this.world.groundHeight(tx, tz) + 2);
      if (!this.camInit || cam.position.distanceTo(h.pos) > 250) { cam.position.set(tx, ty, tz); this.camInit = true; }
      const k = damp(h.crashed ? 2 : 7, dt);
      cam.position.x += (tx - cam.position.x) * k;
      cam.position.y += (ty - cam.position.y) * k;
      cam.position.z += (tz - cam.position.z) * k;
      cam.position.y = Math.max(cam.position.y, this.world.groundHeight(cam.position.x, cam.position.z) + 1.5);
      cam.lookAt(h.pos.x + h.fwd.x * 6, h.pos.y + 1.5, h.pos.z + h.fwd.z * 6);
    }
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov += (fov - cam.fov) * damp(10, dt);
      cam.updateProjectionMatrix();
      this.effects.setView(window.innerHeight * this.renderer.getPixelRatio(), cam.fov, this.fogDensity);
    }
  }
}

const game = new Game();
game.init().catch((e) => {
  console.error(e);
  const t = $('load-text');
  if (t) t.textContent = 'Fehler beim Start: ' + e.message;
});
