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
import { Net, netTransport, COLORS } from './net.js';
import { FUEL, HELI, CALLSIGN, FOB_NAME, GUN } from './config.js';
import { clamp, damp, dist2, rand } from './util.js';
import * as PF from './platform.js';

const $ = (id) => document.getElementById(id);
const SEATS = ['pilot', 'left', 'right'];
const SEAT_NAMES = { pilot: 'Pilot', left: 'Schütze links', right: 'Schütze rechts' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

class Game {
  constructor() {
    this.settings = PF.loadSettings();
    this.stats = PF.loadStats();
    this.state = 'loading';
    this.time = 0;
    this.role = 'solo';      // 'solo' | 'host' | 'client'
    this.myId = 0;
    this.net = null;
    this.netReady = false;
    this.helis = [];
    this.crews = [];
    this.myHeli = 0;
    this.seat = 'pilot';
    this.camMode = 'chase';
    this.orbit = { yaw: 0, pitch: 0.2, dist: 24, look: 0 };
    this.cockpitLook = { yaw: 0, pitch: 0 };
    this.lastHitTime = -10;
    this.radioThrottle = {};
  }

  get heli() { return this.helis[this.myHeli]; }
  owner(i) { const c = this.crews[i]; return c && c.pilot != null ? c.pilot : 0; }
  owns(i) { return this.owner(i) === this.myId; }

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
    this.combat = new Combat(this);
    this.units = new Units(this);
    this.missions = new Missions(this);
    this.hud = new HUD(this);
    this.input = new Input(canvas, this.settings);
    this.input.onDevice = () => this.updateTouchVisibility();
    this.audio = new AudioSys();
    this.audio.setVolume(this.settings.volume);
    this.tr = netTransport();
    await this.step('Bereite FOB vor …', 85);
    this.addHeli();
    this.crews = [{ pilot: 0, left: null, right: null }];
    this.setLocalSeat(0, 'pilot');
    this.units.spawnPatrols(12);

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.state === 'playing' && this.role === 'solo') this.pause(true); this.audio.suspend(); }
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

  // ------------------------------------------------------------ Hubschrauber & Besatzung
  addHeli() {
    const i = this.helis.length;
    const h = new Helicopter(this.scene, this.effects, i);
    h.gunners = { left: new Gunner('left', h), right: new Gunner('right', h) };
    this.helis.push(h);
    if (i === 1) this.world.parked[0].visible = false;
    this.resetHeli(i);
    return h;
  }

  padFor(i) { return i === 0 ? this.world.fob.pads.troop : this.world.fob.pads.h2; }

  resetHeli(i) {
    const p = this.padFor(i), h = this.helis[i];
    h.reset(p.x, this.world.height(p.x, p.z) + 0.12, p.z, i === 0 ? Math.PI * 0.1 : 0.3);
    h.gunners.left.reset();
    h.gunners.right.reset();
    h.apHoldY = h.pos.y;
    h.wasCrashed = false;
  }

  seatOf(pid) {
    for (let i = 0; i < this.crews.length; i++) for (const s of SEATS) if (this.crews[i][s] === pid) return { i, seat: s };
    return null;
  }

  // Sitz des lokalen Spielers übernehmen (Kamera, Eingabe, Figuren)
  setLocalSeat(i, seat) {
    const changedHeli = i !== this.myHeli;
    this.myHeli = i;
    this.seat = seat;
    this.input.setMode(seat);
    this.helis.forEach((h, k) => {
      h.model.guns.left.gunner.group.visible = !(k === i && seat === 'left');
      h.model.guns.right.gunner.group.visible = !(k === i && seat === 'right');
    });
    if (changedHeli) this.camInit = false;
    if (seat !== 'pilot') {
      const h = this.heli;
      if (this.role === 'solo') h.apHoldY = Math.max(h.pos.y, this.world.groundHeight(h.pos.x, h.pos.z) + 30);
      const pilot = this.crews[i] && this.crews[i].pilot;
      const who = pilot != null && pilot !== this.myId ? this.playerName(pilot) + ' fliegt' : 'Der Kopilot hält die Maschine';
      this.radioOnce('ap' + seat, 3, `Sie bedienen das ${seat === 'left' ? 'linke' : 'rechte'} M60. ${who}.`, 'Crew', false, true);
    }
    this.hud.updateCrew();
  }

  playerName(pid) {
    if (!this.net) return 'Sie';
    const p = this.net.players.get(pid);
    return p ? p.name : 'Spieler ' + pid;
  }

  // Sitzwunsch des lokalen Spielers
  wantSeat(i, seat) {
    if (!this.helis[i]) return;
    if (this.role === 'client') { this.net.send({ t: 'seat', i, seat }); return; }
    this.requestSeat(this.myId, i, seat);
  }

  // Host/Einzelspieler: Sitzwechsel prüfen und durchführen
  requestSeat(pid, i, seat) {
    const err = this.seatError(pid, i, seat);
    if (err) {
      if (pid === this.myId) this.radio(err, 'Crew', false, true);
      else this.net.sendTo(pid, { t: 'radio', x: err, f: 'Crew' });
      return false;
    }
    const cur = this.seatOf(pid);
    if (cur) this.crews[cur.i][cur.seat] = null;
    this.crews[i][seat] = pid;
    if (pid === this.myId) this.setLocalSeat(i, seat);
    if (this.net) this.net.sendCrews();
    this.hud.updateCrew();
    return true;
  }

  seatError(pid, i, seat) {
    const c = this.crews[i];
    if (!c) return 'Diesen Hubschrauber gibt es nicht.';
    if (c[seat] != null && c[seat] !== pid) return `Der Platz ${SEAT_NAMES[seat]} ist besetzt (${this.playerName(c[seat])}).`;
    const cur = this.seatOf(pid);
    if (!cur || cur.i === i) return null;
    const a = this.helis[cur.i], b = this.helis[i];
    if (!b.contact || b.crashed) return 'Umsteigen geht nur, wenn der andere Hubschrauber gelandet ist.';
    if (a.crashed) return null;
    if (!a.contact) return 'Erst landen – dann können Sie umsteigen.';
    if (dist2(a.pos.x, a.pos.z, b.pos.x, b.pos.z) > 150) return 'Zum Umsteigen müssen beide Hubschrauber nebeneinander landen (unter 150 m).';
    return null;
  }

  assignSeat(pid) {
    const order = [[1, 'pilot'], [0, 'left'], [0, 'right'], [1, 'left'], [1, 'right'], [0, 'pilot']];
    for (const [i, s] of order) {
      if (this.crews[i] && this.crews[i][s] == null) { this.crews[i][s] = pid; return; }
    }
  }

  freeSeats(pid) {
    for (const c of this.crews) for (const s of SEATS) if (c[s] === pid) c[s] = null;
    this.hud.updateCrew();
  }

  applyCrews(c) {
    this.crews = c;
    while (this.helis.length < c.length) this.addHeli();
    const me = this.seatOf(this.myId);
    if (me && (me.i !== this.myHeli || me.seat !== this.seat)) this.setLocalSeat(me.i, me.seat);
    this.hud.updateCrew();
  }

  cycleSeat(dir) {
    const c = this.crews[this.myHeli];
    let k = SEATS.indexOf(this.seat);
    for (let n = 0; n < 3; n++) {
      k = (k + dir + 3) % 3;
      const s = SEATS[k];
      if (c[s] == null || c[s] === this.myId) { if (s !== this.seat) this.wantSeat(this.myHeli, s); return; }
    }
  }

  autopilot(h) {
    if (h.contact) return { pitch: 0, roll: 0, yaw: 0, collective: -0.2 };
    const gnd = this.world.groundHeight(h.pos.x + h.vel.x * 3, h.pos.z + h.vel.z * 3);
    const tree = this.world.treeTopAt(h.pos.x, h.pos.z) || 0;
    h.apHoldY = Math.max(h.apHoldY || h.pos.y, gnd + 25, tree + 15);
    return { pitch: 0, roll: 0, yaw: 0, collective: clamp((h.apHoldY - h.pos.y) * 0.06, -1, 1) };
  }

  // ------------------------------------------------------------ UI
  setupUI() {
    // Doppelte Bestätigung verhindern (Gamepad-Taste + native Tastenaktivierung)
    document.addEventListener('click', (e) => {
      if (this.synthClick) return;
      if (performance.now() < (this.suppressClickUntil || 0)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      this.lastNativeClick = performance.now();
    }, true);
    const on = (id, fn) => { const e = $(id); if (e) e.addEventListener('click', (ev) => { ev.preventDefault(); this.audio.init(); fn(); }); };
    on('btn-start', () => this.startGame());
    on('btn-continue', () => this.startGame());
    on('btn-help', () => this.openPanel('help'));
    on('btn-settings', () => this.openPanel('settings'));
    on('btn-mp', () => this.openLobby());
    on('btn-resume', () => this.pause(false));
    on('btn-pause-help', () => this.openPanel('help'));
    on('btn-pause-settings', () => this.openPanel('settings'));
    on('btn-pause-menu', () => { $('pause').classList.add('hidden'); this.showMenu(); });
    on('brief-accept', () => this.missions.accept());
    on('btn-respawn', () => this.requestRespawn());
    on('btn-update', () => PF.appCheckUpdate());
    on('fullmap', () => this.hud.toggleMap(false));
    on('btn-host', () => this.startHost());
    on('btn-join-ip', () => {
      const v = ($('mp-ip').value || '').trim();
      if (!v) return;
      const [ip, port] = v.split(':');
      this.startJoin(ip, +port || 47790);
    });
    on('btn-lobby-close', () => this.closeLobby());
    on('btn-netlost', () => location.reload());
    on('crew-close', () => this.hud.toggleCrew(false));
    $('crew-list').addEventListener('click', (e) => {
      const b = e.target.closest('[data-heli]');
      if (!b) return;
      this.audio.init();
      this.wantSeat(+b.dataset.heli, b.dataset.seat);
    });
    $('mp-hosts').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ip]');
      if (b) this.startJoin(b.dataset.ip, +b.dataset.port);
    });
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
    bind('set-invertx', 'invertX', Boolean);
    bind('set-mouse-fly', 'mouseFly', Boolean);
    bind('set-mouse-inv', 'mouseFlyInvert', Boolean);
    bind('set-diff', 'difficulty', Number);
    bind('set-fps', 'showFps', Boolean, (v) => $('fps').classList.toggle('hidden', !v));
    $('fps').classList.toggle('hidden', !s.showFps);
    on('btn-reload', () => location.reload());

    // Mehrspieler-Name
    let nm = '';
    try { nm = localStorage.getItem('dustoff.name') || ''; } catch (e) { /* privat */ }
    if (!nm) nm = ((this.tr && this.tr.deviceName && this.tr.deviceName()) || 'Pilot') + ' ' + (10 + Math.floor(Math.random() * 90));
    $('mp-name').value = nm.slice(0, 16);
    $('mp-name').addEventListener('change', () => {
      const v = ($('mp-name').value || 'Pilot').trim().slice(0, 16) || 'Pilot';
      $('mp-name').value = v;
      try { localStorage.setItem('dustoff.name', v); } catch (e) { /* privat */ }
    });

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
    $(id).classList.remove('hidden');
    this.focusFirst($(id));
  }
  closePanel(id) { $(id).classList.add('hidden'); }

  focusFirst(root) {
    if (!root || (this.input && this.input.device === 'touch')) return;
    const items = [...root.querySelectorAll('button:not(.hidden), select, input')].filter((e) => e.offsetParent !== null);
    const b = items.find((e) => e.classList.contains('primary')) || items[0];
    if (b) b.focus({ preventScroll: false });
  }

  showMenu() {
    this.state = 'menu';
    this.hud.show(false);
    this.updateTouchVisibility();
    $('menu').classList.remove('hidden');
    $('btn-continue').classList.toggle('hidden', !this.started);
    $('btn-start').classList.toggle('hidden', !!this.started);
    $('btn-mp').classList.toggle('hidden', this.role !== 'solo');
    const st = this.stats;
    $('menu-stats').innerHTML = `<b>${PF.rankFor(st.score)}</b> · ${st.score} Punkte · ${st.missions} Einsätze · ${st.rescued} gerettet · ${st.transported} transportiert`;
    this.focusFirst($('menu'));
  }

  startGame() {
    PF.enterFullscreen();
    this.audio.init();
    $('menu').classList.add('hidden');
    this.closeLobby(true);
    this.hud.show(true);
    this.state = 'playing';
    this.last = performance.now();
    this.updateTouchVisibility();
    if (!this.started) {
      this.started = true;
      this.hud.radio(`${CALLSIGN}, hier TOC ${FOB_NAME}. Willkommen in Vietnam. Halten Sie sich bereit.`, 'TOC');
      setTimeout(() => { if (!this.missions.current && this.role !== 'client') this.missions.generate(); }, 1200);
    }
  }

  pause(on) {
    if (on && this.state === 'playing') {
      this.state = 'paused';
      $('pause').classList.remove('hidden');
      $('pause-mp-note').classList.toggle('hidden', this.role === 'solo');
      if (this.role === 'solo') this.audio.suspend();
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

  // ------------------------------------------------------------ Mehrspieler-Lobby
  openLobby() {
    $('lobby').classList.remove('hidden');
    const ok = !!this.tr;
    $('mp-unavailable').classList.toggle('hidden', ok);
    $('mp-form').classList.toggle('hidden', !ok);
    $('mp-status').textContent = '';
    if (ok) {
      this.tr.scan(true);
      $('mp-myip').textContent = this.tr.ip ? 'Eigene IP: ' + this.tr.ip() : '';
      clearInterval(this.scanTimer);
      this.scanTimer = setInterval(() => this.refreshHosts(), 800);
      this.refreshHosts();
    }
    this.focusFirst($('lobby'));
  }

  closeLobby(keepScan) {
    $('lobby').classList.add('hidden');
    clearInterval(this.scanTimer);
    if (this.tr && !keepScan) this.tr.scan(false);
    if (this.tr && keepScan) this.tr.scan(false);
  }

  refreshHosts() {
    const list = this.tr.hosts();
    $('mp-hosts').innerHTML = list.length
      ? list.map((h) => `<button data-ip="${esc(h.ip)}" data-port="${h.port}">${esc(h.info.name || 'Host')} · ${h.info.n || 1} Spieler${h.info.heli2 ? ' · 2 Hubschrauber' : ''}<small>${esc(h.ip)}</small></button>`).join('')
      : '<p class="note">Suche nach Spielen im Netzwerk …</p>';
  }

  myName() { return ($('mp-name').value || 'Pilot').trim().slice(0, 16) || 'Pilot'; }

  startHost() {
    const heli2 = $('mp-heli2').checked;
    this.net = new Net(this, this.tr);
    const r = this.net.host(this.myName(), heli2);
    if (!r || String(r).startsWith('err')) { this.onNetStatus('Spiel konnte nicht eröffnet werden: ' + r, true); this.net = null; return; }
    this.role = 'host';
    this.myId = 0;
    if (heli2 && this.helis.length < 2) { this.addHeli(); this.crews.push({ pilot: null, left: null, right: null }); }
    this.netReady = true;
    const ip = String(r).split(':').slice(1).join(':');
    this.radio(`Mehrspieler-Spiel eröffnet (${ip}). Mitspieler im selben WLAN können jetzt beitreten.`, 'TOC', false, true);
    this.startGame();
    this.hud.updateCrew();
  }

  startJoin(ip, port) {
    this.net = new Net(this, this.tr);
    this.net.join(ip, port, this.myName());
    this.onNetStatus(`Verbinde mit ${ip} …`);
  }

  // Willkommensnachricht des Hosts: als Client starten
  startClient(w) {
    this.role = 'client';
    this.myId = w.id;
    this.units.clearAll();
    if (this.missions.current) this.missions.retire(this.missions.current);
    this.missions.nextTimer = -1;
    this.time = w.time || 0;
    if (w.heli2 && this.helis.length < 2) this.addHeli();
    for (let i = 0; i < this.helis.length; i++) this.resetHeli(i);
    this.applyCrews(w.c);
    this.missions.applyNet(w.mission);
    this.netReady = true;
    this.started = true;
    this.startGame();
    this.radio(`Verbunden mit ${this.playerName(0)}. Sie sind ${SEAT_NAMES[this.seat]} in UH-1D #${this.myHeli + 1}.`, 'TOC', false, true);
  }

  onNetStatus(text, err) {
    const el = $('mp-status');
    el.textContent = text;
    el.classList.toggle('err', !!err);
    if (err && this.role === 'solo') this.net = null;
  }

  onNetLost() {
    this.netReady = false;
    $('netlost').classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ------------------------------------------------------------ Spielereignisse
  radio(text, from = '', urgent = false, local = false) {
    this.hud.radio(text, from, urgent);
    this.audio.radio();
    if (!local && this.net && this.role === 'host') this.net.send({ t: 'radio', x: text, f: from, u: urgent });
  }
  radioOnce(key, sec, text, from, urgent, local = true) {
    if (this.time - (this.radioThrottle[key] ?? -1e9) < sec) return;
    this.radioThrottle[key] = this.time;
    this.radio(text, from, urgent, local);
  }

  isNearView(x, z) { const c = this.camera.position; return dist2(x, z, c.x, c.z) < 1500; }
  isNearAny(x, z) { return this.isNearView(x, z) || this.helis.some((h) => dist2(x, z, h.pos.x, h.pos.z) < 1600); }

  // Leuchtspur vom Boden (Feind oder eigene Truppen); col: 0 = eigene, 1 = Feind, 2 = schweres MG
  groundShot(a, b, col, tracer, onEnd, fromNet = false) {
    this.combat.visualShot(a, b, col === 0 ? 900 : col === 2 ? 820 : 715, COLORS[col], tracer, onEnd);
    const dc = this.camera.position.distanceTo(a);
    if (dc < 1600) {
      this.effects.muzzle(a.x, a.y, a.z, col === 2);
      if (col > 0) this.audio.shot(col === 2 ? 'dshk' : 'ak', dc);
      else if (rand() < 0.5) this.audio.shot('ak', dc * 1.1);
    }
    if (!fromNet && this.net && this.role === 'host') this.net.groundShot(a, b, col, tracer, !!onEnd);
  }

  damageHeli(h, dmg, hitPos) {
    if (h.crashed) return;
    if (hitPos) this.effects.sparks(hitPos.x, hitPos.y, hitPos.z);
    if (this.owns(h.index)) {
      h.takeDamage(dmg, 'bullet');
      if (h === this.heli) this.onHeliHit(dmg);
    } else if (this.role === 'host') this.net.sendTo(this.owner(h.index), { t: 'dmg', i: h.index, a: Math.round(dmg * 10) / 10 });
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

  onMissionResult(r) {
    this.hud.showResult(r);
    this.stats.score += r.score || 0;
    this.stats.missions++;
    this.saveStats();
  }

  onHeliCrashed(h) {
    this.missions.onHeliLost(h);
    if (h === this.heli) {
      this.stats.losses++;
      this.saveStats();
      this.radio(`MAYDAY, MAYDAY! ${CALLSIGN}${this.helis.length > 1 ? ' #' + (h.index + 1) : ''} stürzt ab!`, CALLSIGN, true, true);
      this.crashAt = this.time;
    }
    this.audio.boom(this.camera.position.distanceTo(h.pos));
  }

  requestRespawn() {
    if (this.role === 'client') this.net.send({ t: 'respawn', i: this.myHeli });
    else this.respawnHeli(this.myHeli);
  }

  respawnHeli(i) {
    const h = this.helis[i];
    if (!h || !h.crashed) return;
    if (this.owns(i)) {
      this.resetHeli(i);
      this.radio(`TOC: Eine Ersatzmaschine steht auf Pad ${this.padFor(i).name} bereit.`, 'TOC');
    } else if (this.role === 'host') this.net.sendTo(this.owner(i), { t: 'reset', i });
  }

  handleActions(actions) {
    for (const a of actions) {
      const blocking = this.state === 'menu' || this.state === 'paused' || this.hud.briefOpen || this.crashShown || this.hud.crewOpen || !$('lobby').classList.contains('hidden');
      if (blocking) {
        if (a === 'confirm') {
          // Hat Browser/WebView den Druck schon selbst als Klick ausgelöst, nicht noch einmal klicken
          if (performance.now() - (this.lastNativeClick || 0) < 350) continue;
          const ov = this.topOverlay();
          if (ov) {
            const b = ov.querySelector(':focus') || ov.querySelector('.primary:not(.hidden)') || ov.querySelector('button:not(.hidden)');
            if (b) { this.audio.init(); this.suppressClickUntil = performance.now() + 350; this.synthClick = true; b.click(); this.synthClick = false; }
            continue;
          }
        }
        if (a === 'nav-down' || a === 'nav-up') { this.moveFocus(a === 'nav-down' ? 1 : -1); continue; }
        if (a === 'nav-left' || a === 'nav-right') { this.adjustFocused(a === 'nav-right' ? 1 : -1); continue; }
        if (a.startsWith('dpad-')) continue;
        if (a === 'pause' && this.state === 'paused') { this.pause(false); continue; }
        if (a === 'crew' && this.hud.crewOpen) { this.hud.toggleCrew(false); continue; }
        if (this.state !== 'playing') continue;
      }
      switch (a) {
        case 'pause': this.pause(true); break;
        case 'map': this.hud.toggleMap(); break;
        case 'help': this.pause(true); this.openPanel('help'); break;
        case 'crew': this.hud.toggleCrew(); break;
        case 'camera':
          if (this.seat === 'pilot') this.camMode = this.camMode === 'chase' ? 'cockpit' : 'chase';
          break;
        case 'seat-pilot': case 'dpad-up': this.wantSeat(this.myHeli, 'pilot'); break;
        case 'seat-left': case 'dpad-left': this.wantSeat(this.myHeli, 'left'); break;
        case 'seat-right': case 'dpad-right': this.wantSeat(this.myHeli, 'right'); break;
        case 'seat-next': this.cycleSeat(1); break;
        case 'seat-prev': this.cycleSeat(-1); break;
        case 'dpad-down': case 'radio': {
          const m = this.missions.current;
          if (m) { this.hud.showBriefing(m, this.missions.describe(m)); setTimeout(() => this.missions.phase !== 'briefing' && this.hud.hideBriefing(), 5000); }
          break;
        }
        case 'confirm': if (this.hud.mapOpen) this.hud.toggleMap(false); break;
        default: break;
      }
    }
  }

  topOverlay() {
    const ids = ['netlost', 'crashscreen', 'crew', 'settings', 'help', 'lobby', 'pause', 'briefing', 'menu'];
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

  // Links/rechts ändert Auswahlfelder und Schieberegler im Menü
  adjustFocused(dir) {
    const el = document.activeElement;
    if (!el || !this.topOverlay() || !this.topOverlay().contains(el)) { this.moveFocus(dir); return; }
    if (el.tagName === 'SELECT') {
      el.selectedIndex = clamp(el.selectedIndex + dir, 0, el.options.length - 1);
      el.dispatchEvent(new Event('change'));
    } else if (el.type === 'range') {
      const step = +el.step || 0.1;
      el.value = clamp(+el.value + dir * step, +el.min, +el.max);
      el.dispatchEvent(new Event('change'));
    } else this.moveFocus(dir);
  }

  // ------------------------------------------------------------ Hauptschleife
  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.input.update(dt);
    this.handleActions(this.input.popActions());
    if (this.net) this.net.update(dt);
    // Im Mehrspieler läuft die Simulation auch im Pausenmenü weiter
    const run = this.state === 'playing' || (this.state === 'paused' && this.role !== 'solo') || (this.state === 'menu' && this.role !== 'solo' && this.started);
    if (run) for (let i = 0; i < (this.timeScale || 1); i++) this.tick(dt, this.state !== 'playing');
    else if (this.state === 'menu') this.attract(dt);
    this.renderer.render(this.scene, this.camera);
  }

  attract(dt) {
    this.attractT = (this.attractT || 0) + dt;
    const h = this.heli, t = this.attractT * 0.08;
    h.animate(dt);
    this.camera.position.set(h.pos.x + Math.sin(t) * 26, h.pos.y + 6 + Math.sin(t * 0.7) * 2, h.pos.z + Math.cos(t) * 26);
    this.camera.lookAt(h.pos.x, h.pos.y + 1, h.pos.z);
    this.effects.update(dt, this.camera.position);
    this.world.update(dt, this.time + this.attractT, this.camera);
  }

  tick(dt, background) {
    this.time += dt;
    const w = this.world;
    const idle = { pitch: 0, roll: 0, yaw: 0, collective: -0.2 };

    // Hubschrauber
    this.helis.forEach((h, i) => {
      if (this.owns(i)) {
        if (h.ownedBefore === false) h.apHoldY = Math.max(h.pos.y, w.groundHeight(h.pos.x, h.pos.z) + 25);
        h.ownedBefore = true;
        let ctl;
        if (this.crews[i].pilot === this.myId) {
          if (background || (this.hud.briefOpen && this.missions.phase === 'briefing' && h.contact)) ctl = idle;
          else ctl = this.input.flight;
        } else ctl = this.autopilot(h);
        h.update(dt, ctl, w, true);
      } else {
        h.ownedBefore = false;
        h.updateRemote(dt, w);
      }
      if (h.crashed && !h.wasCrashed) this.onHeliCrashed(h);
      h.wasCrashed = h.crashed;
      if (h === this.heli && !this.owns(i) && h.hpDrop > 0) { this.onHeliHit(h.hpDrop); h.hpDrop = 0; }
      if (h === this.heli && !h.crashed && !h.contact) this.stats.flightTime += dt;
      for (const ev of h.events) this.heliEvent(h, ev);
      h.events.length = 0;
    });
    const h = this.heli;
    if (h.crashed && !this.crashShown && this.time - (this.crashAt ?? -10) > 4) {
      this.crashShown = true;
      this.hud.showCrash(h.crashCause);
      if (document.pointerLockElement) document.exitPointerLock();
      this.focusFirst($('crashscreen'));
    }
    if (this.crashShown && !h.crashed) { this.crashShown = false; this.hud.hideCrash(); }

    // Bordschützen
    const aim = this.input.consumeAim();
    if (this.settings.invertX) aim.dx = -aim.dx;
    this.helis.forEach((hh, i) => {
      for (const side of ['left', 'right']) {
        const mine = i === this.myHeli && this.seat === side;
        const occupied = this.crews[i] && this.crews[i][side] != null;
        const mode = mine ? 'player' : occupied ? 'remote' : this.role === 'client' ? 'remote' : 'ai';
        hh.gunners[side].update(dt, this, mine && !background ? aim : { dx: 0, dy: 0 }, mine && !background && this.input.fire, mode);
      }
    });

    if (this.role === 'client') this.units.updateMirror(dt); else this.units.update(dt);
    this.combat.update(dt);
    const prevPhase = this.missions.phase;
    this.missions.update(dt);
    if (this.role !== 'client' && prevPhase !== 'briefing' && this.missions.phase === 'briefing') this.units.refreshPatrols();

    // Tanken / Reparieren / Munition an der POL-Pad
    let hint = '';
    const f = w.fob, pol = f.pads.pol;
    this.helis.forEach((hh, i) => {
      if (hh.crashed || !hh.onGround || dist2(hh.pos.x, hh.pos.z, pol.x, pol.z) > 16) { hh.refueling = false; return; }
      if (this.owns(i)) {
        hh.fuel = Math.min(100, hh.fuel + FUEL.refuelRate * dt);
        hh.hp = Math.min(100, hh.hp + FUEL.repairRate * dt);
        hh.leak = false;
        if (!hh.engineOn && hh.fuel > 5) { hh.engineOn = true; if (hh === h) this.radio('Triebwerk wieder gestartet.', 'Crew', false, true); }
      }
      for (const side of ['left', 'right']) {
        const gu = hh.gunners[side];
        if (gu.mode === 'player' || gu.mode === 'ai') gu.ammo = Math.min(GUN.ammo, gu.ammo + Math.ceil(400 * dt));
      }
      if (hh === h) {
        const full = h.fuel >= 99.9 && h.hp >= 99.9;
        hint = full ? 'Betankt, repariert und aufmunitioniert – startklar!' : `BETANKUNG ${Math.round(h.fuel)} % · REPARATUR ${Math.round(h.hp)} % · MUNITION`;
        if (!hh.refueling) this.radio('Tankwart: Schlauch ist dran – wir füllen auf!', 'POL', false, true);
      }
      hh.refueling = true;
    });

    // Warnungen (eigener Hubschrauber)
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
      if (!hint && this.missions.target(h) === 'from' && h.passengers.length >= HELI.capacity) hint = 'Kabine voll!';
      if (!hint && this.seat === 'pilot' && this.input.device === 'keyboard' && this.settings.mouseFly && !this.input.mouseFlying) hint = 'Linksklick ins Bild: Maussteuerung (Maus ←→ drehen, ↑↓ vor/zurück)';
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

  heliEvent(h, ev) {
    const mine = h === this.heli;
    if (ev === 'impact') this.audio.boom(this.camera.position.distanceTo(h.pos));
    if (!mine) return;
    if (ev === 'hardlanding') { this.radioOnce('hl', 5, 'Autsch! Das war eine harte Landung!', 'Crew'); this.hud.damageFlash(0.4); this.audio.hit(); }
    else if (ev === 'flameout') this.radio('TRIEBWERK AUS! Treibstoff leer – Autorotation einleiten!', 'Crew', true, true);
    else if (ev === 'leak') this.radio('Wir verlieren Treibstoff – Tank getroffen!', 'Crew', true, true);
    else if (ev === 'slope') this.radioOnce('slope', 10, 'Gelände zu steil – wir rutschen!', 'Crew');
    else if (ev === 'water') this.radioOnce('water', 10, 'Wir stehen im Wasser!', 'Crew');
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
    for (const hh of this.helis) hh.model.pilots[1].group.visible = true;
    if (this.seat !== 'pilot' && !h.crashed) {
      const rig = m.guns[this.seat];
      rig.eye.getWorldPosition(cam.position);
      rig.pitch.getWorldQuaternion(cam.quaternion);
      fov = this.input.zoomHeld ? 28 : 62;
    } else if (this.camMode === 'cockpit' && !h.crashed) {
      this.cockpitLook.yaw = clamp(this.cockpitLook.yaw - look.dx, -2.2, 2.2);
      this.cockpitLook.pitch = clamp(this.cockpitLook.pitch - look.dy, -0.9, 0.6);
      if (!this.input.mouseDown[2]) { this.cockpitLook.yaw *= 1 - damp(1.5, dt); this.cockpitLook.pitch *= 1 - damp(1.5, dt); }
      cam.position.copy(m.eyePilot).applyQuaternion(h.quat).add(h.pos);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.cockpitLook.pitch - 0.08, this.cockpitLook.yaw, 0, 'YXZ'));
      cam.quaternion.copy(h.quat).multiply(q);
      m.pilots[1].group.visible = false;
      fov = 75;
    } else {
      const o = this.orbit;
      o.yaw -= look.dx; o.pitch = clamp(o.pitch + look.dy, -0.15, 1.2);
      o.dist = clamp(o.dist + look.zoom * 3, 12, 70);
      if (!this.input.mouseDown[2]) o.yaw *= 1 - damp(0.8, dt);
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
