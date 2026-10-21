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
import { Soldier, WEAPONS } from './soldier.js';
import { FUEL, HELI, CALLSIGN, FOB_NAME, GUN } from './config.js';
import { clamp, damp, dist2, rand } from './util.js';
import * as PF from './platform.js';

const $ = (id) => document.getElementById(id);
const SEATS = ['pilot', 'left', 'right'];
const SEAT_NAMES = { pilot: 'Pilot', left: 'Schütze links', right: 'Schütze rechts', pax: 'Passagier', foot: 'zu Fuß' };
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
  // Bezugspunkt für Kompass, Karte und Wegpunkt: Soldat zu Fuß oder eigener Hubschrauber
  viewer() {
    if (this.seat === 'foot' && this.soldier.active) {
      const S = this.soldier;
      return { pos: S.pos, yaw: S.yaw, speed: S.moving ? 3.6 : 0 };
    }
    return this.heli;
  }
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
    this.crews = [{ pilot: 0, left: null, right: null, pax: [] }];
    this.soldier = new Soldier(this);
    this.avatars = new Map();
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
    h.aiPickup = null;
  }

  // Sitz eines Spielers: Besatzungsplatz, Passagier ('pax') oder zu Fuß (null)
  seatOf(pid) {
    for (let i = 0; i < this.crews.length; i++) {
      const c = this.crews[i];
      for (const s of SEATS) if (c[s] === pid) return { i, seat: s };
      if (c.pax && c.pax.includes(pid)) return { i, seat: 'pax' };
    }
    return null;
  }

  // Belegung der Kabine (Passagiere des Auftrags + mitfliegende Spieler)
  heliLoad(h) { return h.passengers.length + ((this.crews[h.index] && this.crews[h.index].pax.length) || 0); }

  // Position eines Spielers (für Ein-/Aussteigen und Abholung)
  playerPos(pid) {
    if (pid === this.myId) return this.seat === 'foot' ? this.soldier.pos : this.heli.pos;
    const a = this.avatars.get(pid);
    if (a && a.active) return a.pos;
    const s = this.seatOf(pid);
    return s ? this.helis[s.i].pos : null;
  }

  // Sitz des lokalen Spielers übernehmen (Kamera, Eingabe, Figuren)
  setLocalSeat(i, seat) {
    const prevSeat = this.seat, prevHeli = this.myHeli;
    const changedHeli = i !== this.myHeli;
    this.myHeli = i;
    this.seat = seat;
    this.input.setMode(seat);
    this.zoomToggle = false;
    this.helis.forEach((h, k) => {
      h.model.guns.left.gunner.group.visible = !(k === i && seat === 'left');
      h.model.guns.right.gunner.group.visible = !(k === i && seat === 'right');
    });
    if (changedHeli) this.camInit = false;
    if (seat === 'foot') {
      if (prevSeat !== 'foot' || !this.soldier.active) {
        const h = this.helis[prevHeli];
        const side = h.gunners && prevSeat === 'right' ? 'right' : 'left';
        const p = h.doorPoint(side);
        const out = new THREE.Vector3(side === 'left' ? -1.8 : 1.8, 0, 0).applyQuaternion(h.quat);
        this.soldier.spawn(p.x + out.x, p.z + out.z, h.yaw);
      }
    } else this.soldier.hide();
    if (seat === 'left' || seat === 'right') {
      const pilot = this.crews[i] && this.crews[i].pilot;
      const who = pilot != null && pilot !== this.myId ? this.playerName(pilot) + ' fliegt' : 'Der KI-Pilot fliegt den Auftrag';
      this.radioOnce('ap' + seat, 3, `Sie bedienen das ${seat === 'left' ? 'linke' : 'rechte'} M60. ${who}.`, 'Crew', false, true);
    } else if (seat === 'pax') {
      const pilot = this.crews[i] && this.crews[i].pilot;
      this.radioOnce('pax', 3, `Sie sitzen in der Kabine von UH-1D #${i + 1}. ${pilot != null && pilot !== this.myId ? this.playerName(pilot) + ' fliegt.' : 'Der KI-Pilot fliegt den Auftrag.'} Aussteigen: E / Ⓐ – nur am Boden.`, 'Crew', false, true);
    }
    this.helis.forEach((h) => { h.playerPax = this.crews[h.index] ? this.crews[h.index].pax.length : 0; h.updatePassengerDisplay(); });
    this.hud.updateCrew();
  }

  playerName(pid) {
    if (!this.net) return 'Sie';
    const p = this.net.players.get(pid);
    return p ? p.name : 'Spieler ' + pid;
  }

  // Sitzwunsch des lokalen Spielers ('foot' = aussteigen)
  wantSeat(i, seat) {
    if (!this.helis[i]) return;
    if (this.role === 'client') { this.net.send({ t: 'seat', i, seat, p: this.seat === 'foot' ? this.soldier.getState() : null }); return; }
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
    if (cur) {
      const c = this.crews[cur.i];
      if (cur.seat === 'pax') c.pax = c.pax.filter((x) => x !== pid);
      else c[cur.seat] = null;
    }
    if (seat === 'pax') this.crews[i].pax.push(pid);
    else if (seat !== 'foot') this.crews[i][seat] = pid;
    // Abholung erledigt?
    if (seat !== 'foot') for (const h of this.helis) if (h.aiPickup && h.aiPickup.pid === pid && h.index === i) h.aiPickup = null;
    if (pid === this.myId) this.setLocalSeat(seat === 'foot' && cur ? cur.i : i, seat);
    this.helis.forEach((h) => { h.playerPax = this.crews[h.index].pax.length; h.updatePassengerDisplay(); });
    if (this.net) this.net.sendCrews();
    this.hud.updateCrew();
    return true;
  }

  seatError(pid, i, seat) {
    const c = this.crews[i];
    if (!c) return 'Diesen Hubschrauber gibt es nicht.';
    const cur = this.seatOf(pid);
    const h = this.helis[i];
    if (seat === 'foot') {
      if (!cur) return null;
      const a = this.helis[cur.i];
      if (!a.contact && !a.crashed) return 'Aussteigen geht nur am Boden – erst landen.';
      return null;
    }
    if (seat === 'pax') {
      if (cur && cur.i === i && cur.seat === 'pax') return null;
      if (this.heliLoad(h) >= HELI.capacity) return 'Die Kabine ist voll.';
    } else if (c[seat] != null && c[seat] !== pid) return `Der Platz ${SEAT_NAMES[seat]} ist besetzt (${this.playerName(c[seat])}).`;
    if (!cur) {
      // zu Fuß: nur an einen gelandeten Hubschrauber in der Nähe
      if (!h.contact || h.crashed) return 'Einsteigen geht nur, wenn der Hubschrauber gelandet ist.';
      const p = this.playerPos(pid);
      if (!p || dist2(p.x, p.z, h.pos.x, h.pos.z) > 10) return 'Zum Einsteigen näher an den Hubschrauber gehen.';
      return null;
    }
    if (cur.i === i) return null;
    const a = this.helis[cur.i];
    if (!h.contact || h.crashed) return 'Umsteigen geht nur, wenn der andere Hubschrauber gelandet ist.';
    if (a.crashed) return null;
    if (!a.contact) return 'Erst landen – dann können Sie umsteigen.';
    if (dist2(a.pos.x, a.pos.z, h.pos.x, h.pos.z) > 150) return 'Zum Umsteigen müssen beide Hubschrauber nebeneinander landen (unter 150 m).';
    return null;
  }

  assignSeat(pid) {
    const order = [[1, 'pilot'], [0, 'left'], [0, 'right'], [1, 'left'], [1, 'right'], [0, 'pilot']];
    for (const [i, s] of order) {
      if (this.crews[i] && this.crews[i][s] == null) { this.crews[i][s] = pid; return; }
    }
    if (this.heliLoad(this.helis[0]) < HELI.capacity) this.crews[0].pax.push(pid);
  }

  freeSeats(pid) {
    for (const c of this.crews) {
      for (const s of SEATS) if (c[s] === pid) c[s] = null;
      c.pax = c.pax.filter((x) => x !== pid);
    }
    for (const h of this.helis) if (h.aiPickup && h.aiPickup.pid === pid) h.aiPickup = null;
    this.hud.updateCrew();
  }

  applyCrews(c) {
    this.crews = c;
    while (this.helis.length < c.length) this.addHeli();
    const me = this.seatOf(this.myId);
    if (me && (me.i !== this.myHeli || me.seat !== this.seat)) this.setLocalSeat(me.i, me.seat);
    else if (!me && this.seat !== 'foot') this.setLocalSeat(this.myHeli, 'foot');
    else this.helis.forEach((h) => { h.playerPax = this.crews[h.index].pax.length; h.updatePassengerDisplay(); });
    this.hud.updateCrew();
  }

  cycleSeat(dir) {
    if (this.seat === 'foot' || this.seat === 'pax') return;
    const c = this.crews[this.myHeli];
    let k = SEATS.indexOf(this.seat);
    for (let n = 0; n < 3; n++) {
      k = (k + dir + 3) % 3;
      const s = SEATS[k];
      if (c[s] == null || c[s] === this.myId) { if (s !== this.seat) this.wantSeat(this.myHeli, s); return; }
    }
  }

  // Zu Fuß: in den nächsten gelandeten Hubschrauber einsteigen; im Hubschrauber: aussteigen
  useAction() {
    if (this.seat === 'foot') {
      if (!this.soldier.alive) return;
      let best = null, bd = 12;
      for (const h of this.helis) {
        const d = dist2(this.soldier.pos.x, this.soldier.pos.z, h.pos.x, h.pos.z);
        if (d < bd && !h.crashed) { bd = d; best = h; }
      }
      if (!best) { this.radioOnce('nouse', 2, 'Kein Hubschrauber in der Nähe.', 'Crew', false, true); return; }
      this.wantSeat(best.index, 'pax');
    } else if (this.seat !== 'pilot') this.wantSeat(this.myHeli, 'foot');
  }

  // Abholung per Funk anfordern (zu Fuß)
  requestPickup() {
    if (this.seat !== 'foot' || !this.soldier.alive) return;
    if (this.role === 'client') { this.net.send({ t: 'pickup' }); return; }
    this.handlePickup(this.myId);
  }

  handlePickup(pid) {
    const p = this.playerPos(pid);
    if (!p) return;
    const w = this.world;
    // nächster Landeplatz: Lichtung oder FOB
    let spot = { x: w.fob.pads.troop.x, z: w.fob.pads.troop.z, name: 'FOB Pad H1' }, bd = dist2(p.x, p.z, spot.x, spot.z);
    for (const s of w.sites) { const d = dist2(p.x, p.z, s.x, s.z); if (d < bd) { bd = d; spot = { x: s.x, z: s.z, name: s.name }; } }
    let heli = null;
    for (const h of this.helis) if (!h.crashed && this.crews[h.index].pilot == null && (!heli || dist2(h.pos.x, h.pos.z, p.x, p.z) < dist2(heli.pos.x, heli.pos.z, p.x, p.z))) heli = h;
    const reply = (x) => { if (pid === this.myId) this.radio(x, CALLSIGN, false, true); else this.net.sendTo(pid, { t: 'radio', x, f: CALLSIGN }); };
    if (!heli) { reply('Kein freier Hubschrauber – ein Mitspieler muss Sie abholen.'); return; }
    heli.aiPickup = { x: spot.x, z: spot.z, pid, t: this.time, name: spot.name };
    reply(`Verstanden – UH-1D #${heli.index + 1} holt Sie bei ${spot.name} ab (${Math.round(bd)} m von Ihnen).`);
    if (pid === this.myId) this.myPickup = { x: spot.x, z: spot.z, name: spot.name };
    else this.net.sendTo(pid, { t: 'pickupAck', x: spot.x, z: spot.z, name: spot.name });
  }

  // KI-Pilot für Hubschrauber ohne menschlichen Piloten (Host)
  aiPilot(h, dt) {
    const c = this.crews[h.index], M = this.missions, w = this.world;
    const humans = (c.left != null ? 1 : 0) + (c.right != null ? 1 : 0) + c.pax.length;
    if (h.aiPickup && this.time - h.aiPickup.t > 240) h.aiPickup = null;
    let goal = null;
    if (h.aiPickup) goal = h.aiPickup;
    else if (humans > 0 || M.paxOf(h) > 0) {
      if (h.fuel < 22 || (h.refueling && h.fuel < 95)) goal = w.fob.pads.pol;
      else goal = M.waypoint(h);
    }
    if (!goal) goal = this.padFor(h.index);
    return this.flyTo(h, goal, dt);
  }

  flyTo(h, goal, dt) {
    const w = this.world;
    const idle = { pitch: 0, roll: 0, yaw: 0, collective: -0.3 };
    h.aiGroundT = h.contact ? (h.aiGroundT || 0) + dt : 0;
    const dx = goal.x - h.pos.x, dz = goal.z - h.pos.z, d = Math.hypot(dx, dz);
    const gy = w.groundHeight(goal.x, goal.z);
    if (d < 28) {
      if (h.contact) return idle;
      // Restfahrt abbauen und senkrecht landen
      return { pitch: clamp(Math.hypot(dx, dz) > 6 ? 0.15 : 0, -1, 1), roll: 0, yaw: 0, collective: h.speed < 6 ? -0.8 : 0 };
    }
    if (h.contact && h.aiGroundT < 5) return idle; // Zeit zum Ein-/Aussteigen
    const e = Math.atan2(-dx, -dz) - h.yaw;
    const err = Math.atan2(Math.sin(e), Math.cos(e));
    const vf = h.vel.dot(h.fwd);
    let hmax = w.groundHeight(h.pos.x, h.pos.z);
    for (const s of [60, 140, 240, 360]) { const t = Math.min(s, d) / d; hmax = Math.max(hmax, w.groundHeight(h.pos.x + dx * t, h.pos.z + dz * t)); }
    let targetY = hmax + 60;
    if (d < 180) targetY = Math.max(gy + 20 + Math.max(0, d - 25) * 0.35, w.groundHeight(h.pos.x, h.pos.z) + 22);
    const targetSpeed = d > 400 ? 50 : clamp((d - 12) * 0.2, 2, 50);
    let pitch = Math.abs(err) > 0.5 ? clamp(-vf * 0.05, -1, 1) : clamp((targetSpeed - vf) * 0.07, -1, 1);
    if (h.agl < 12 && d > 40) pitch = Math.min(pitch, 0.1);
    return { pitch, roll: 0, yaw: clamp(-err * 2.2, -1, 1), collective: clamp((targetY - h.pos.y) * 0.08 - h.vel.y * 0.12, -1, 1) };
  }

  // Ziele für Feinde: Spieler zu Fuß
  footTargets() {
    const out = [];
    if (this.seat === 'foot' && this.soldier.active && this.soldier.alive) out.push({ pid: this.myId, s: this.soldier });
    for (const [pid, a] of this.avatars) if (a.active && a.alive && a.isFoot) out.push({ pid, s: a });
    return out;
  }

  damageSoldier(pid, dmg) {
    if (pid === this.myId) {
      if (this.seat !== 'foot' || !this.soldier.alive) return;
      this.soldier.takeDamage(dmg);
      this.lastHitTime = this.time;
      this.hud.damageFlash(0.25 + dmg * 0.02);
      this.audio.hit();
      if (!this.soldier.alive) this.onSoldierDied();
    } else if (this.role === 'host') this.net.sendTo(pid, { t: 'pdmg', a: Math.round(dmg) });
  }

  onSoldierDied() {
    this.deathAt = this.time;
    this.stats.losses++;
    this.radio('Sanitäter! Sie sind gefallen.', 'Crew', true, true);
  }

  respawnSoldier() {
    const p = this.world.fob.pads.troop;
    this.soldier.spawn(p.x + 18 + rand() * 6, p.z + 10 + rand() * 6, 0);
    this.soldier.mag = this.soldier.mag.map((_, i) => WEAPONS[i].mag);
    this.soldier.res = this.soldier.res.map((_, i) => WEAPONS[i].reserve);
    this.deathShown = false;
    this.hud.hideCrash();
    this.radio('Neuer Einsatz zu Fuß – Sie stehen in der FOB bei Pad H1.', 'TOC', false, true);
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
    on('btn-start-foot', () => { this.startGame(); if (this.seat !== 'foot') this.wantSeat(this.myHeli, 'foot'); });
    on('btn-continue', () => this.startGame());
    on('btn-help', () => this.openPanel('help'));
    on('btn-settings', () => this.openPanel('settings'));
    on('btn-mp', () => this.openLobby());
    on('btn-resume', () => this.pause(false));
    on('btn-pause-help', () => this.openPanel('help'));
    on('btn-pause-settings', () => this.openPanel('settings'));
    on('btn-pause-menu', () => { $('pause').classList.add('hidden'); this.showMenu(); });
    on('brief-accept', () => this.missions.accept());
    on('btn-respawn', () => { if (this.seat === 'foot') this.respawnSoldier(); else this.requestRespawn(); });
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
    $('btn-start-foot').classList.toggle('hidden', !!this.started);
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
    if (heli2 && this.helis.length < 2) { this.addHeli(); this.crews.push({ pilot: null, left: null, right: null, pax: [] }); }
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
      if (this.seat === 'foot') {
        const S = this.soldier;
        const wmap = { 'seat-pilot': 0, 'seat-left': 1, 'seat-right': 2, num4: 3, num5: 4 };
        if (a in wmap) { S.setWeapon(wmap[a]); continue; }
        if (a === 'seat-next' || a === 'wnext') { S.setWeapon(S.w + 1); continue; }
        if (a === 'seat-prev' || a === 'wprev') { S.setWeapon(S.w - 1); continue; }
        if (a === 'reload') { S.startReload(); continue; }
        if (a === 'camera' || a === 'crouch') { S.crouch = !S.crouch; continue; }
        if (a === 'zoom') { this.zoomToggle = !this.zoomToggle; continue; }
        if (a === 'use' || a === 'confirm') { if (!this.hud.mapOpen) { this.useAction(); continue; } }
        if (a === 'radio' || a === 'pickup' || a === 'dpad-down') { this.requestPickup(); continue; }
        if (a === 'dpad-up' || a === 'dpad-left' || a === 'dpad-right') continue;
      } else if (a === 'use' || (a === 'confirm' && this.seat === 'pax' && !this.hud.mapOpen)) {
        if (this.seat !== 'pilot') this.useAction();
        continue;
      }
      switch (a) {
        case 'pause': this.pause(true); break;
        case 'map': this.hud.toggleMap(); break;
        case 'help': this.pause(true); this.openPanel('help'); break;
        case 'crew': this.hud.toggleCrew(); break;
        case 'camera':
          if (this.seat === 'pilot') this.camMode = this.camMode === 'chase' ? 'cockpit' : 'chase';
          break;
        case 'zoom': this.zoomToggle = !this.zoomToggle; break;
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
        } else ctl = this.aiPilot(h, dt);
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
    const onFoot = this.seat === 'foot';
    if (!onFoot && h.crashed && !this.crashShown && this.time - (this.crashAt ?? -10) > 4) {
      this.crashShown = true;
      this.hud.showCrash(h.crashCause);
      if (document.pointerLockElement) document.exitPointerLock();
      this.focusFirst($('crashscreen'));
    }
    if (this.crashShown && (!h.crashed || onFoot)) { this.crashShown = false; this.hud.hideCrash(); }

    // Bordschützen und Soldat
    const aim = this.input.consumeAim();
    if (this.settings.invertX) aim.dx = -aim.dx;
    if (this.seat === 'pax') { this.input.look.dx += aim.dx; this.input.look.dy += aim.dy; }
    if (onFoot) {
      const S = this.soldier;
      const zoom = !background && (this.input.zoomHeld || this.zoomToggle);
      S.update(dt, background ? { move: { x: 0, y: 0 } } : this.input, background ? { dx: 0, dy: 0 } : aim, !background && this.input.fire, zoom);
      if (!S.alive && !this.deathShown && this.time - (this.deathAt ?? -10) > 3) {
        this.deathShown = true;
        this.hud.showCrash('Gefallen', 'Sie wurden im Gefecht getroffen.', 'ZURÜCK IN DIE FOB');
        if (document.pointerLockElement) document.exitPointerLock();
        this.focusFirst($('crashscreen'));
      }
    }
    for (const [pid, a] of this.avatars) {
      if (this.role === 'host' && a.active && this.seatOf(pid)) { a.hide(); a.isFoot = false; }
      a.updateRemote(dt);
    }
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
    if (onFoot) {
      const S = this.soldier;
      if (S.alive && S.hp < 35) warnings.push({ text: 'SCHWER VERWUNDET – IN DECKUNG!', level: 'crit' });
      if (S.alive && this.time - this.lastHitTime < 1.2) warnings.push({ text: 'TREFFER!', level: 'crit' });
      let near = null, nd = 12;
      for (const hh of this.helis) { const d = dist2(S.pos.x, S.pos.z, hh.pos.x, hh.pos.z); if (d < nd && !hh.crashed) { nd = d; near = hh; } }
      const key = this.input.device === 'gamepad' ? 'Ⓐ' : this.input.device === 'touch' ? 'EIN/AUS' : 'E';
      if (near) hint = near.contact ? `${key}: In UH-1D #${near.index + 1} einsteigen` : 'Hubschrauber noch in der Luft – warten bis er gelandet ist';
      else if (S.reloadT > 0) hint = 'Nachladen …';
      else if (S.mag[S.w] === 0 && S.res[S.w] === 0) hint = 'Keine Munition – in der FOB auffüllen oder Waffe wechseln';
    } else if (this.seat === 'pax') {
      if (h.contact && !h.crashed) hint = (this.input.device === 'gamepad' ? 'Ⓐ' : this.input.device === 'touch' ? 'EIN/AUS' : 'E') + ': Aussteigen';
    }
    if (!h.crashed && !onFoot) {
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
      if (!hint && this.missions.target(h) === 'from' && this.heliLoad(h) >= HELI.capacity) hint = 'Kabine voll!';
      if (!hint && this.seat === 'pilot' && this.input.device === 'keyboard' && this.settings.mouseFly && !this.input.mouseFlying) hint = 'Linksklick ins Bild: Maussteuerung (Maus ←→ drehen, ↑↓ vor/zurück)';
    }
    const critical = warnings.some((x) => x.level === 'crit');

    this.effects.update(dt, this.camera.position);
    this.world.update(dt, this.time, this.camera);
    this.updateCamera(dt);
    if (this.myPickup && (this.seat !== 'foot' || this.helis.every((x) => !x.aiPickup))) this.myPickup = null;
    this.hud.update(dt, {
      waypoint: this.myPickup ? { x: this.myPickup.x, z: this.myPickup.z, y: this.world.height(this.myPickup.x, this.myPickup.z), label: 'Abholung ' + this.myPickup.name, radius: 45 } : this.missions.waypoint(),
      warnings, hint,
      cameraLabel: this.seat === 'pilot' ? (this.camMode === 'chase' ? 'Außenansicht' : 'Cockpit') : '',
    });
    this.updateWaypointBeam();
    let ah = h, ad = 0;
    if (onFoot) {
      ad = 1e9;
      for (const hh of this.helis) { const d = this.camera.position.distanceTo(hh.pos); if (d < ad) { ad = d; ah = hh; } }
    }
    this.audio.update(ah, !onFoot && (this.seat !== 'pilot' || this.camMode === 'cockpit'), critical, this.time, ad);
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
    if (this.seat === 'foot') {
      // Schulterkamera hinter dem Soldaten
      const S = this.soldier;
      const zoom = S.zoom && S.alive;
      let yaw = S.yaw, pitch = S.pitch;
      if (!S.alive) { this.deadOrbit = (this.deadOrbit || 0) + dt * 0.3; yaw += this.deadOrbit; pitch = -0.5; }
      const cp = Math.cos(pitch);
      const fx = -Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = -Math.cos(yaw) * cp;
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const dist = zoom ? 0.9 : S.alive ? 3.0 : 6, side = zoom ? 0.42 : 0.7;
      const py = S.pos.y + (S.crouch ? 1.1 : 1.62);
      const px = S.pos.x + rx * side, pz = S.pos.z + rz * side;
      cam.position.set(px - fx * dist, py - fy * dist, pz - fz * dist);
      cam.position.y = Math.max(cam.position.y, this.world.groundHeight(cam.position.x, cam.position.z) + 0.4);
      cam.lookAt(px + fx * 50, py + fy * 50, pz + fz * 50);
      fov = zoom ? S.weapon.fov : 70;
      this.camInit = false;
    } else if ((this.seat === 'left' || this.seat === 'right') && !h.crashed) {
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
