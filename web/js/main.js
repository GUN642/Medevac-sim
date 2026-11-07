// Dustoff – Medevac-Hubschraubersimulator (Vietnam 1968 / Afghanistan 2010): Hauptprogramm
import * as THREE from './lib/three.module.min.js';
import { World } from './world.js';
import { AfghanWorld } from './worldAfg.js';
import { FloodWorld } from './worldFlood.js';
import { MaliWorld } from './worldMali.js';
import { NorwayWorld } from './worldNorway.js';
import { AirSupport, SUPPORT } from './airsupport.js';
import { NightSys } from './night.js';
import { T, setTheme, themeOf, heliTypeFor, HELI_TYPES, THEMES } from './theme.js';
import { Effects } from './effects.js';
import { Helicopter } from './helicopter.js';
import { Combat, Gunner } from './combat.js';
import { Units } from './units.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Net, netTransport, COLORS } from './net.js';
import { Soldier, WEAPONS, setWeaponSet } from './soldier.js';
import { FUEL } from './config.js';
import { clamp, damp, dist2, rand, wrapAngle } from './util.js';
import * as PF from './platform.js';
import { setLang, defaultLang } from './i18n.js';
import { BIND_DEFS, resolveBinds, keyName } from './binds.js';

const $ = (id) => document.getElementById(id);
const SEATS = ['pilot', 'left', 'right', 'ramp'];
const GUN_SEATS = ['left', 'right', 'ramp'];
const isGunSeat = (s) => GUN_SEATS.includes(s);
const SEAT_NAMES = { pilot: 'Pilot', left: 'Schütze links', right: 'Schütze rechts', ramp: 'Heckschütze', pax: 'Passagier', foot: 'zu Fuß' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

class Game {
  constructor() {
    this.settings = PF.loadSettings();
    if (!this.settings.lang) this.settings.lang = defaultLang();
    setLang(this.settings.lang);
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
  get callsign() { const h = this.heli || this.helis[0]; return h ? h.spec.callsign : 'Dustoff'; }
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
    // Echte Schatten ab mittlerer Qualität (Schattenkarte folgt dem Spieler)
    this.shadows = q !== 'low';
    this.renderer.shadowMap.enabled = this.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Einsatzgebiet (Karte) festlegen, bevor die Welt entsteht
    const theme = themeOf(this.settings.map);
    setTheme(theme);
    setWeaponSet(theme);
    document.body.dataset.theme = theme;
    document.body.classList.toggle('snow', !!T.snow);
    const sky = T.sky;
    this.scene = new THREE.Scene();
    this.fogDensity = sky.fogDensity;
    this.scene.fog = new THREE.FogExp2(sky.fog, this.fogDensity);
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 7000);
    this.scene.add(this.camera); // für die Waffe in der Ego-Perspektive
    this.hemi = new THREE.HemisphereLight(sky.hemiSky, sky.hemiGround, sky.hemi);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(sky.sun, sky.sunI);
    sun.position.set(-0.5, 1, 0.35).multiplyScalar(1000);
    this.scene.add(sun);
    this.sun = sun;
    this.sunDir = new THREE.Vector3(-0.5, 1, 0.35).normalize();
    if (this.shadows) {
      sun.castShadow = true;
      const n = q === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.set(n, n);
      const c = sun.shadow.camera;
      this.shadowR = q === 'high' ? 90 : 60;
      c.left = -this.shadowR; c.right = this.shadowR; c.top = this.shadowR; c.bottom = -this.shadowR; c.near = 10; c.far = 900;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.04;
      this.scene.add(sun.target);
    }

    await this.step('Erzeuge Gelände …', 10);
    this.world = T.id === 'afghanistan' ? new AfghanWorld(this.scene, q, 2010) : T.id === 'flood' ? new FloodWorld(this.scene, q, 2021) : T.id === 'mali' ? new MaliWorld(this.scene, q, 2017) : T.id === 'norway' ? new NorwayWorld(this.scene, q, 1952) : new World(this.scene, q);
    await this.step('Effekte …', 60);
    this.effects = new Effects(this.scene, q);
    this.combat = new Combat(this);
    this.air = new AirSupport(this);
    this.nightSys = new NightSys(this);
    this.nightSys.set(this.settings.night);
    this.units = new Units(this);
    this.missions = new Missions(this);
    this.hud = new HUD(this);
    this.input = new Input(canvas, this.settings);
    this.input.onDevice = () => this.updateTouchVisibility();
    this.audio = new AudioSys();
    this.audio.setVolume(this.settings.volume);
    this.tr = netTransport();
    await this.step('Bereite FOB vor …', 85);
    this.addHeli(heliTypeFor(T.id, this.settings.heli));
    this.crews = [{ pilot: 0, left: null, right: null, pax: [] }];
    this.soldier = new Soldier(this);
    this.avatars = new Map();
    this.setLocalSeat(0, 'pilot');
    this.units.spawnPatrols(26);
    this.units.spawnFobDefenders();
    this.units.spawnVehiclePatrols(T.id === 'afghanistan' || T.id === 'mali' ? 5 : 3);

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.state === 'playing' && this.role === 'solo') this.pause(true); this.audio.suspend(); }
      else if (this.state === 'playing') this.audio.resume();
    });
    this.setupUI();
    this.onResize();
    $('loading').classList.add('hidden');
    this.showMenu();
    try { if (sessionStorage.getItem('dustoff.openLobby')) { sessionStorage.removeItem('dustoff.openLobby'); this.openLobby(); } } catch (e) { /* privat */ }
    // Nach einem Kartenwechsel automatisch wieder dem Mehrspieler-Spiel beitreten
    try {
      const aj = JSON.parse(sessionStorage.getItem('dustoff.autojoin') || 'null');
      if (aj) { sessionStorage.removeItem('dustoff.autojoin'); this.openLobby(); if (this.tr) this.startJoin(aj.ip, aj.port); }
    } catch (e) { /* privat */ }
    this.last = performance.now();
    window.game = this; // für Debugging
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // Wetter (Sandsturm in Mali): Sicht, Nebelfarbe, Böen
  updateWeather() {
    this.updateDaylight();
    if (!this.world.weather) return;
    const s = this.world.weather(this.time);
    const was = this.storm || 0;
    this.storm = s;
    if (this.baseGusts === undefined) this.baseGusts = T.gusts || 0;
    T.gusts = this.baseGusts + s * 1.8;
    this.scene.fog.density = this.fogDensity * (1 + s * 14);
    if (!this.nightSys.night) {
      const c = this._fogC || (this._fogC = new THREE.Color());
      this.scene.fog.color.copy(c.set(T.sky.fog).lerp(this._dustC || (this._dustC = new THREE.Color(0xb9895c)), s));
      const sky = this.world.sky.material.uniforms;
      sky.horizon.value.set(T.sky.horizon).lerp(this._dustC, s);
      sky.top.value.set(T.sky.top).lerp(this._dustC, s * 0.8);
    }
    if (was < 0.05 && s >= 0.05 && this.state === 'playing') this.radio('TOC: Sandsturm zieht auf – Sicht bald unter 200 m, Böen! Tief und langsam fliegen oder landen.', 'TOC', true);
    if (was > 0.05 && s <= 0.05 && this.state === 'playing') this.radio('TOC: Der Sandsturm ist durchgezogen, die Sicht wird besser.', 'TOC');
  }

  // Kurze Tage (Norwegen): Licht nimmt ab, Dämmerung färbt den Himmel, nachts Nachtflugbetrieb
  updateDaylight() {
    if (!this.world.daylight || this.settings.night) return;
    const d = this.world.daylight(this.time), ns = this.nightSys;
    if (d < 0.22 && !ns.night) { ns.set(true); this.autoNight = true; if (this.state === 'playing') this.radio('TOC: Die Sonne ist untergegangen – Nachtflugbetrieb. Nachtsichtgerät mit N.', 'TOC'); }
    else if (d > 0.4 && ns.night && this.autoNight) { ns.set(false); this.autoNight = false; if (this.state === 'playing') this.radio('TOC: Es wird hell – Tagflugbetrieb.', 'TOC'); }
    if (ns.night) return;
    const k = 0.4 + 0.6 * d;
    this.hemi.intensity = (ns.baseHemi ?? T.sky.hemi) * k;
    this.sun.intensity = (ns.baseSun ?? T.sky.sunI) * k;
    const sky = this.world.sky.material.uniforms, dusk = 1 - d;
    sky.horizon.value.set(T.sky.horizon).lerp(this._duskH || (this._duskH = new THREE.Color(0xe0905a)), dusk * 0.85);
    sky.top.value.set(T.sky.top).lerp(this._duskT || (this._duskT = new THREE.Color(0x2c3656)), dusk * 0.9);
    this.scene.fog.color.set(T.sky.fog).lerp(this._duskF || (this._duskF = new THREE.Color(0x8a7a8a)), dusk * 0.7);
  }

  step(text, pct) {
    $('load-text').textContent = text;
    $('load-bar').style.width = pct + '%';
    return new Promise((r) => setTimeout(r, 30));
  }

  // ------------------------------------------------------------ Hubschrauber & Besatzung
  addHeli(type) {
    const i = this.helis.length;
    if (!type) type = (this.netTypes && this.netTypes[i]) || T.helis[Math.min(i, T.helis.length - 1)];
    const h = new Helicopter(this.scene, this.effects, i, heliTypeFor(T.id, type));
    h.gunners = { left: new Gunner('left', h), right: new Gunner('right', h), ramp: new Gunner('ramp', h) };
    h.realShadows = this.shadows;
    this.helis.push(h);
    if (i === 0) this.orbit.dist = h.spec.camDist;
    if (i === 1) this.world.parked[0].visible = false;
    this.resetHeli(i);
    return h;
  }

  // Typ eines Hubschraubers wechseln (Menü vor dem Start, Mehrspieler-Abgleich)
  setHeliType(i, type) {
    const h = this.helis[i];
    type = heliTypeFor(T.id, type);
    if (!h || h.type === type) return;
    h.setType(type);
    h.gunners = { left: new Gunner('left', h), right: new Gunner('right', h), ramp: new Gunner('ramp', h) };
    this.resetHeli(i);
    if (i === this.myHeli) { this.orbit.dist = h.spec.camDist; this.camInit = false; }
    this.setLocalSeat(this.myHeli, this.seat);
  }

  padFor(i) { return i === 0 ? this.world.fob.pads.troop : this.world.fob.pads.h2; }

  resetHeli(i) {
    const p = this.padFor(i), h = this.helis[i];
    h.reset(p.x, this.world.height(p.x, p.z) + 0.12, p.z, i === 0 ? Math.PI * 0.1 : 0.3);
    for (const s of GUN_SEATS) h.gunners[s].reset();
    h.rockets = h.spec.rockets || 0;
    h.apHoldY = h.pos.y;
    h.wasCrashed = false;
    h.aiPickup = null;
  }

  // Leichte Zielhilfe für Controller und Touch: bremst das Zielen über einem Feind ab
  // und zieht das Visier sanft auf ihn, solange gezielt, bewegt oder gefeuert wird.
  // angles(e) liefert {yaw, pitch, dist} des Feindes im Bezugssystem der Waffe, cur die aktuelle Ausrichtung.
  aimAssist(dt, aim, cur, angles, zoom, range, gain = 1) {
    const lvl = this.settings.aimAssist;
    if (lvl === 'off' || (this.input.device !== 'gamepad' && this.input.device !== 'touch')) return;
    const s = lvl === 'strong' ? 1.8 : 1;
    const a = this._aa || (this._aa = {});
    let best = null, bestK = 1, by = 0, bp = 0;
    for (const e of this.units.enemies) {
      if (!e.alive || !e.obj) continue;
      if (!angles(e, a) || a.dist > range) continue;
      if (!(e.reveal > 0 || a.dist < 120)) continue;
      const dy = wrapAngle(a.yaw - cur.yaw), dp = a.pitch - cur.pitch;
      const cone = (0.05 + 1.3 / Math.max(a.dist, 5)) * (zoom ? 1.3 : 1) * (0.8 + 0.2 * s);
      const k = Math.hypot(dy * Math.cos(cur.pitch), dp) / cone;
      if (k < bestK) { bestK = k; best = e; by = dy; bp = dp; }
    }
    if (!best) return;
    // Abbremsen über dem Ziel
    const fr = 1 - 0.45 * Math.min(1, s * 0.8) * (1 - bestK);
    aim.dx *= fr; aim.dy *= fr;
    // Sanftes Nachziehen nur bei aktiver Eingabe
    const active = zoom || this.input.fire || Math.abs(aim.dx) + Math.abs(aim.dy) > 1e-4;
    if (!active) return;
    const pull = Math.min(1, dt * (zoom || this.input.fire ? 2.6 : 1.4) * s);
    aim.dx -= by * pull / gain; aim.dy -= bp * pull / gain;
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
      for (const s of GUN_SEATS) h.model.guns[s].gunner.group.visible = !h.spec.noGuns && !(k === i && seat === s);
    });
    if (changedHeli) this.camInit = false;
    if (seat === 'foot' && T.peaceful) return 'Im Katastropheneinsatz bleibt die Besatzung an Bord.';
    if (seat === 'foot') {
      if (prevSeat !== 'foot' || !this.soldier.active) {
        const h = this.helis[prevHeli];
        const side = h.gunners && prevSeat === 'right' ? 'right' : 'left';
        const p = h.doorPoint(side);
        const out = new THREE.Vector3(side === 'left' ? -1.8 : 1.8, 0, 0).applyQuaternion(h.quat);
        this.soldier.spawn(p.x + out.x, p.z + out.z, h.yaw);
      }
    } else this.soldier.hide();
    if (isGunSeat(seat)) {
      const pilot = this.crews[i] && this.crews[i].pilot;
      const who = pilot != null && pilot !== this.myId ? this.playerName(pilot) + ' fliegt' : 'Der KI-Pilot fliegt den Auftrag';
      const gs = this.helis[i].spec.gun;
      this.radioOnce('ap' + seat, 3, gs.turret ? `Sie sind Waffensystemoffizier: ${gs.name}-Kanone, Zoom mit Rechtsklick / ZL. ${who}.` : `Sie bedienen ${seat === 'ramp' ? 'das' : seat === 'left' ? 'das linke' : 'das rechte'} ${gs.name}${seat === 'ramp' ? ' auf der Heckrampe' : ''}. ${who}.`, 'Crew', false, true);
    } else if (seat === 'pax') {
      const pilot = this.crews[i] && this.crews[i].pilot;
      this.radioOnce('pax', 3, `Sie sitzen in der Kabine von ${this.helis[i].spec.short} #${i + 1}. ${pilot != null && pilot !== this.myId ? this.playerName(pilot) + ' fliegt.' : 'Der KI-Pilot fliegt den Auftrag.'} Aussteigen: E / Ⓐ – nur am Boden.`, 'Crew', false, true);
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
    if (h.spec.seats && SEATS.includes(seat) && !h.spec.seats.includes(seat)) return `Diesen Platz gibt es im ${h.spec.short} nicht.`;
    if (seat === 'pax' && h.spec.capacity === 0) return `Der ${h.spec.short} hat keine Kabine – nur Pilot und Waffensystemoffizier.`;
    if (seat === 'foot') {
      if (!cur) return null;
      const a = this.helis[cur.i];
      if (!a.contact && !a.crashed) return 'Aussteigen geht nur am Boden – erst landen.';
      return null;
    }
    if (seat === 'pax') {
      if (cur && cur.i === i && cur.seat === 'pax') return null;
      if (this.heliLoad(h) >= h.spec.capacity) return 'Die Kabine ist voll.';
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
      const hs = this.helis[i] && this.helis[i].spec.seats;
      if (hs && !hs.includes(s)) continue;
      if (this.crews[i] && this.crews[i][s] == null) { this.crews[i][s] = pid; return; }
    }
    if (this.heliLoad(this.helis[0]) < this.helis[0].spec.capacity) this.crews[0].pax.push(pid);
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
    const N = SEATS.length;
    for (let n = 0; n < N; n++) {
      k = (k + dir + N) % N;
      const s = SEATS[k];
      const hs = this.helis[this.myHeli].spec.seats || ['pilot', 'left', 'right'];
      if (hs && !hs.includes(s)) continue;
      if (c[s] == null || c[s] === this.myId) { if (s !== this.seat) this.wantSeat(this.myHeli, s); return; }
    }
  }

  // Zu Fuß: in den nächsten gelandeten Hubschrauber einsteigen; im Hubschrauber: aussteigen
  // Nächste Panzerfaust-Ablage in Reichweite (zu Fuß)
  nearRack() {
    const S = this.soldier, L = this.world.fob.launchers || [];
    return L.find((r) => dist2(r.x, r.z, S.pos.x, S.pos.z) < 3.5) || null;
  }

  useAction() {
    if (this.seat === 'foot') {
      if (!this.soldier.alive) return;
      if (this.nearRack()) {
        const w = this.soldier.takeLauncher();
        this.radio(w ? `${w.name} aufgenommen – ${w.mag + w.reserve} Schuss. Wirksam gegen Fahrzeuge.` : 'Sie tragen schon die volle Anzahl Panzerfäuste.', 'Crew', false, true);
        return;
      }
      let best = null, bd = 12;
      for (const h of this.helis) {
        const d = dist2(this.soldier.pos.x, this.soldier.pos.z, h.pos.x, h.pos.z);
        if (d < bd && !h.crashed) { bd = d; best = h; }
      }
      // Kein Hubschrauber daneben: per Funk einen rufen
      if (!best) { this.requestPickup(); return; }
      // Apache (keine Kabine): freien Besatzungsplatz nehmen
      if (best.spec.capacity === 0) {
        const c = this.crews[best.index];
        this.wantSeat(best.index, c.left == null ? 'left' : 'pilot');
        return;
      }
      this.wantSeat(best.index, 'pax');
    } else if (this.seat !== 'pilot') this.wantSeat(this.myHeli, 'foot');
  }

  // Apache: 70-mm-Rakete in Flugrichtung abfeuern (abwechselnd linker und rechter Werfer)
  fireRocket() {
    const h = this.heli;
    if (h.crashed || !h.model.rocketPods) return;
    if (!(h.rockets > 0)) { this.radioOnce('norkt', 3, 'Raketen leer – auf Pad POL nachladen.', 'Crew', false, true); return; }
    if (this.time - (h.lastRocket || -9) < 0.25) return;
    h.lastRocket = this.time;
    h.rockets--;
    h.rocketSide = 1 - (h.rocketSide || 0);
    const p = h.model.rocketPods[h.rocketSide].clone().applyQuaternion(h.quat).add(h.pos);
    const v = this.rocketDir(h).multiplyScalar(310).add(h.vel);
    this.combat.rocket(p, v, false);
    this.effects.muzzle(p.x, p.y, p.z, true);
    if (this.net) this.net.rocketFire(p, v);
  }
  rocketDir(h) { return new THREE.Vector3(0, -0.06, -1).normalize().applyQuaternion(h.quat); }

  toggleNvg() {
    if (!this.nightSys.toggleNvg()) { this.radioOnce('nonvg', 2, 'Nachtsichtgerät gibt es nur bei Nacht.', 'Crew', false, true); return; }
    this.radioOnce('nvg', 0.3, this.nightSys.nvg ? 'Nachtsichtgerät an' : 'Nachtsichtgerät aus', 'Crew', false, true);
  }

  // Luftunterstützung für die eigene Position anfordern (zu Fuß oder im Hubschrauber)
  requestSupport(kind) {
    const p = this.playerPos(this.myId);
    if (!p) return;
    this.hud.toggleCrew(false);
    if (this.role === 'client') { this.net.send({ t: 'cas', k: kind, x: Math.round(p.x), z: Math.round(p.z) }); this.radio(`Anforderung ${SUPPORT[kind].name} gesendet …`, this.callsign, false, true); return; }
    this.air.request(kind, { x: p.x, z: p.z }, this.myId);
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
    // Hubschrauber ohne menschlichen Piloten; Maschinen mit Kabine bevorzugt, dann die nächste
    const free = this.helis.filter((h) => this.crews[h.index].pilot == null);
    const score = (h) => dist2(h.pos.x, h.pos.z, p.x, p.z) + (h.spec.capacity === 0 ? 1e5 : 0) + (h.crashed ? 5e4 : 0);
    let heli = free.sort((a, b) => score(a) - score(b))[0] || null;
    const cs = this.callsign;
    const reply = (x) => { if (pid === this.myId) this.radio(x, cs, false, true); else this.net.sendTo(pid, { t: 'radio', x, f: cs }); };
    if (heli && heli.crashed) {
      // abgestürzte Maschine: Ersatz startet von der FOB
      if (this.owns(heli.index)) this.resetHeli(heli.index); else if (this.role === 'host') this.net.sendTo(this.owner(heli.index), { t: 'reset', i: heli.index });
      reply(`Ersatzmaschine startet von der ${T.fobName}.`);
    }
    if (!heli) {
      // alle Hubschrauber haben menschliche Piloten: die Piloten per Funk beauftragen
      const name = pid === this.myId ? 'Ihr Mitspieler' : this.playerName(pid);
      const tgt = this.helis.slice().sort((a, b) => dist2(a.pos.x, a.pos.z, p.x, p.z) - dist2(b.pos.x, b.pos.z, p.x, p.z))[0];
      reply(`Alle Hubschrauber sind bemannt – ${tgt.spec.short} #${tgt.index + 1} wurde angefunkt und holt Sie bei ${spot.name} ab.`);
      this.radio(`TOC: ${name} braucht Abholung bei ${spot.name} (Planquadrat ${w.gridRef(spot.x, spot.z)}).`, 'TOC', true);
      if (pid === this.myId) this.myPickup = { x: spot.x, z: spot.z, name: spot.name, manual: this.time };
      else this.net.sendTo(pid, { t: 'pickupAck', x: spot.x, z: spot.z, name: spot.name });
      return;
    }
    heli.aiPickup = { x: spot.x, z: spot.z, pid, t: this.time, name: spot.name };
    reply(`Verstanden – ${heli.spec.short} #${heli.index + 1} holt Sie bei ${spot.name} ab (${Math.round(bd)} m von Ihnen).`);
    if (pid === this.myId) this.myPickup = { x: spot.x, z: spot.z, name: spot.name };
    else this.net.sendTo(pid, { t: 'pickupAck', x: spot.x, z: spot.z, name: spot.name });
  }

  // KI-Pilot für Hubschrauber ohne menschlichen Piloten (Host)
  aiPilot(h, dt) {
    const c = this.crews[h.index], M = this.missions, w = this.world;
    const humans = (c.left != null ? 1 : 0) + (c.right != null ? 1 : 0) + c.pax.length;
    if (h.aiPickup && this.time - h.aiPickup.t > 600) h.aiPickup = null;
    let goal = null;
    if (h.spec.capacity === 0 && !h.aiPickup) {
      // Kampfhubschrauber: über dem Gefechtsfeld kreisen, damit der Waffensystemoffizier wirken kann
      const m = M.current;
      if (m && M.phase === 'active' && (m.type === 'cas' || m.type === 'convoy') && h.fuel > 20) {
        const wp = m.type === 'convoy' ? M.waypoint(h) : null;
        const cx = wp ? wp.x : m.from.x, cz = wp ? wp.z : m.from.z;
        const a = Math.atan2(h.pos.z - cz, h.pos.x - cx) + 0.45;
        const far = dist2(h.pos.x, h.pos.z, cx, cz) > 700;
        return this.flyTo(h, { x: cx + Math.cos(a) * 320, z: cz + Math.sin(a) * 320, hover: 85, fast: far, face: far ? null : { x: cx, z: cz } }, dt);
      }
      if (humans > 0) goal = h.fuel < 22 || (h.refueling && h.fuel < 95) ? w.fob.pads.pol : null;
    } else if (h.aiPickup) goal = h.aiPickup;
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
    if (goal.hover) {
      // Kreisflug in Höhe: Geschwindigkeitsvektor auf das Ziel regeln, Nase zum Gefechtsfeld
      const dx = goal.x - h.pos.x, dz = goal.z - h.pos.z, d = Math.hypot(dx, dz) || 1;
      const sp = goal.fast ? 50 : 26;
      const vf = h.vel.dot(h.fwd), vr = h.vel.dot(h.right);
      const ux = dx / d, uz = dz / d;
      const df = (ux * h.fwd.x + uz * h.fwd.z) * sp, dr = (ux * h.right.x + uz * h.right.z) * sp;
      const fp = goal.face || goal;
      const e = Math.atan2(-(fp.x - h.pos.x), -(fp.z - h.pos.z)) - h.yaw;
      const err = Math.atan2(Math.sin(e), Math.cos(e));
      let gmax = w.groundHeight(h.pos.x, h.pos.z);
      for (const t of [0.3, 0.7, 1]) gmax = Math.max(gmax, w.groundHeight(h.pos.x + h.vel.x * 6 * t, h.pos.z + h.vel.z * 6 * t));
      const ty = gmax + goal.hover;
      return {
        pitch: clamp((df - vf) * 0.07, -1, 1), roll: clamp((dr - vr) * 0.07, -1, 1), yaw: clamp(-err * 2, -1, 1),
        collective: clamp((ty - h.pos.y) * 0.08 - h.vel.y * 0.12, -1, 1),
      };
    }
    h.aiGroundT = h.contact ? (h.aiGroundT || 0) + dt : 0;
    const dx = goal.x - h.pos.x, dz = goal.z - h.pos.z, d = Math.hypot(dx, dz);
    const gy = w.groundHeight(goal.x, goal.z);
    if (d < 28 && h.contact) return idle;
    if (h.contact && h.aiGroundT < 5 && d > 28) return idle; // Zeit zum Ein-/Aussteigen
    const ux = dx / (d || 1), uz = dz / (d || 1);
    const vf = h.vel.dot(h.fwd), vr = h.vel.dot(h.right);
    const e = Math.atan2(-dx, -dz) - h.yaw;
    const err = Math.atan2(Math.sin(e), Math.cos(e));
    // Höhe: Reiseflug mit Abstand zum Gelände, ab ca. 600 m flacher Gleitpfad zur LZ
    let hmax = w.groundHeight(h.pos.x, h.pos.z), hnear = hmax;
    for (const sd of [60, 140, 240, 360]) {
      const t = Math.min(sd, d) / d;
      const gh = w.groundHeight(h.pos.x + dx * t, h.pos.z + dz * t);
      hmax = Math.max(hmax, gh);
      if (sd <= 140) hnear = Math.max(hnear, gh);
    }
    const glide = gy + 22 + Math.max(0, d - 20) * 0.15;
    let targetY = Math.min(hmax + 60, glide);
    if (d > 60) targetY = Math.max(targetY, hnear + 26);
    if (goal.winch) targetY = Math.max(targetY, goal.hoverY);   // Windenrettung: über dem Dach bleiben
    // Geschwindigkeit: ab 300 m gleichmäßig abbremsen (ca. 1,5 m/s²)
    const cruise = h.spec.vmax ? h.spec.vmax * 0.5144 * 0.9 : 50;
    const brakeD = Math.max(300, cruise * cruise / 3 * 0.75);
    const targetSpeed = d > brakeD ? cruise : Math.min(cruise * 0.9, Math.sqrt(2 * 1.5 * Math.max(0, d - 8)));
    let pitch, roll = 0, yaw = clamp(-err * 2.2, -1, 1);
    if (d > brakeD) {
      pitch = Math.abs(err) > 0.5 ? clamp(-vf * 0.05, -1, 1) : clamp((targetSpeed - vf) * 0.07, -1, 1);
    } else {
      // Anflug: Geschwindigkeitsvektor direkt auf die LZ regeln (verhindert Überschießen und Abdrift)
      const df = (ux * h.fwd.x + uz * h.fwd.z) * targetSpeed, dr = (ux * h.right.x + uz * h.right.z) * targetSpeed;
      pitch = clamp((df - vf) * 0.08, -1, 1);
      roll = clamp((dr - vr) * 0.08, -1, 1);
      if (d < 60) yaw = 0;
    }
    if (h.agl < 12 && d > 40) pitch = Math.min(pitch, 0.1);
    let collective = clamp((targetY - h.pos.y) * 0.08 - h.vel.y * 0.12, -1, 1);
    if (d < 28) collective = h.speed < 6 ? -0.8 : 0; // senkrecht aufsetzen
    // Bootstrupp: über dem Wasser in 3 m Höhe schweben statt wassern
    if (goal.winch && d < 60) collective = clamp((goal.hoverY - h.pos.y) * 0.15 - h.vel.y * 0.25, -1, 1);
    if (goal.water && d < 60) collective = clamp((3 - h.agl) * 0.15 - h.vel.y * 0.25, -1, 1);
    return { pitch, roll, yaw, collective };
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
    this.soldier.mag = this.soldier.mag.map((_, i) => WEAPONS[i].start ?? WEAPONS[i].mag);
    this.soldier.res = this.soldier.res.map((_, i) => WEAPONS[i].start ?? WEAPONS[i].reserve);
    if (WEAPONS[this.soldier.w].launcher) this.soldier.setWeapon(0);
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
    on('btn-map', () => this.cycleMap());
    on('btn-time', () => {
      if (this.started) return;
      this.settings.night = !this.settings.night;
      PF.saveSettings(this.settings);
      this.nightSys.set(this.settings.night);
      this.updateMenuLabels();
    });
    on('btn-heli', () => this.cycleHeli(1));
    $('mp-heli2').innerHTML = '<option value="">keiner</option>' + T.helis.map((t) => `<option value="${t}">${HELI_TYPES[t].name}</option>`).join('');
    $('mp-heli2').value = T.helis[T.helis.length > 1 ? 1 : 0];
    on('btn-settings', () => this.openPanel('settings'));
    on('btn-mp', () => {
      // Läuft schon ein Spiel, erst beenden (sauberer Neustart), dann direkt die Lobby öffnen
      if (this.started) { this.quitGame(true); return; }
      this.openLobby();
    });
    on('btn-quit', () => this.quitGame(false));
    on('confirm-yes', () => { $('confirm').classList.add('hidden'); const f = this.confirmYes; this.confirmYes = null; if (f) f(); });
    on('confirm-no', () => { $('confirm').classList.add('hidden'); this.confirmYes = null; this.focusFirst($('menu')); });
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
      const cas = e.target.closest('[data-cas]');
      if (cas) { this.audio.init(); this.requestSupport(cas.dataset.cas); return; }
      const b = e.target.closest('[data-heli]');
      if (!b) return;
      this.audio.init();
      this.wantSeat(+b.dataset.heli, b.dataset.seat);
    });
    $('mp-hosts').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ip]');
      if (!b) return;
      if (b.dataset.map && b.dataset.map !== T.id) { this.switchMap(b.dataset.map, { ip: b.dataset.ip, port: +b.dataset.port }); return; }
      this.startJoin(b.dataset.ip, +b.dataset.port);
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
    bind('set-footview', 'footView', String);
    bind('set-aimassist', 'aimAssist', String);
    bind('set-sens', 'sensitivity', Number);
    bind('set-invert', 'invertY', Boolean);
    bind('set-invertx', 'invertX', Boolean);
    bind('set-mouse-fly', 'mouseFly', Boolean);
    bind('set-mouse-inv', 'mouseFlyInvert', Boolean);
    if (s.gyroSens == null) s.gyroSens = 1;
    bind('set-gyro', 'gyro', Boolean, (v) => { if (v) this.input.requestGyro(); document.body.classList.toggle('gyro-on', !!v); });
    bind('set-gyro-sens', 'gyroSens', Number);
    bind('set-gyro-inv', 'gyroInvert', Boolean);
    document.body.classList.toggle('gyro-on', !!s.gyro);
    on('btn-gyro-cal', () => { this.input.calibrateGyro(); this.radio('Gyro neu ausgerichtet – aktuelle Haltung ist neutral.', 'Crew', false, true); });
    bind('set-diff', 'difficulty', Number);
    bind('set-lang', 'lang', String, (v) => setLang(v));
    bind('set-fps', 'showFps', Boolean, (v) => $('fps').classList.toggle('hidden', !v));
    $('fps').classList.toggle('hidden', !s.showFps);
    on('btn-reload', () => location.reload());
    on('btn-binds', () => { this.renderBinds(); this.openPanel('binds'); });
    on('btn-binds-reset', () => { delete s.binds; PF.saveSettings(s); this.input.refreshBinds(); this.renderBinds(); });

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

  // Tabelle der Tastenbelegung; Klick auf ein Feld wartet auf die neue Taste
  renderBinds() {
    const tbl = $('binds-table'), s = this.settings, cur = resolveBinds(s);
    tbl.innerHTML = '';
    for (const d of BIND_DEFS) {
      const tr = document.createElement('tr');
      if (d.g) { tr.className = 'grp'; tr.innerHTML = `<th colspan="3">${d.g}</th>`; tbl.appendChild(tr); continue; }
      const th = document.createElement('th'); th.textContent = d.label; tr.appendChild(th);
      for (let slot = 0; slot < 2; slot++) {
        const td = document.createElement('td'), b = document.createElement('button');
        b.className = 'bk'; b.textContent = keyName(cur[d.id][slot]);
        b.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.input.capture) return;
          b.classList.add('wait'); b.textContent = 'Taste drücken …';
          this.input.capture = (code) => {
            if (code !== 'Escape') {
              const arr = resolveBinds(s)[d.id].slice();
              if (code === 'Backspace' || code === 'Delete') arr.splice(slot, 1);
              else { arr[slot] = code; if (arr[1 - slot] === code) arr.splice(1 - slot, 1); }
              s.binds = Object.assign({}, s.binds, { [d.id]: arr.filter(Boolean) });
              PF.saveSettings(s);
              this.input.refreshBinds();
            }
            setTimeout(() => this.renderBinds(), 0);
          };
        });
        td.appendChild(b); tr.appendChild(td);
      }
      tbl.appendChild(tr);
    }
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

  // Kartenwahl: Welt wird neu erzeugt (Neuladen der Seite)
  cycleMap() {
    const ids = Object.keys(THEMES);
    const next = ids[(ids.indexOf(T.id) + 1) % ids.length];
    this.switchMap(next);
  }

  switchMap(map, join) {
    this.settings.map = map;
    this.settings.heli = heliTypeFor(map, this.settings.heli);
    PF.saveSettings(this.settings);
    this.saveStats();
    try { if (join) sessionStorage.setItem('dustoff.autojoin', JSON.stringify(join)); } catch (e) { /* privat */ }
    if (this.net) this.net.stop();
    $('menu').classList.add('hidden');
    $('lobby').classList.add('hidden');
    $('load-text').textContent = 'Wechsle nach ' + THEMES[map].name + ' …';
    $('loading').classList.remove('hidden');
    setTimeout(() => location.reload(), 50);
  }

  cycleHeli(dir) {
    if (this.started || T.helis.length < 2) return;
    const list = T.helis;
    const next = list[(list.indexOf(this.helis[0].type) + dir + list.length) % list.length];
    this.settings.heli = next;
    PF.saveSettings(this.settings);
    this.setHeliType(0, next);
    this.updateMenuLabels();
  }

  updateMenuLabels() {
    const spec = this.helis[0].spec;
    $('menu-sub').textContent = `${spec.short} ${spec.capacity > 12 ? `· ${spec.capacity} PLÄTZE` : 'MEDEVAC'} · ${T.sub}`;
    $('btn-map').textContent = 'KARTE: ' + T.name.toUpperCase();
    $('btn-heli').textContent = 'HUBSCHRAUBER: ' + spec.short;
    $('btn-heli').classList.toggle('hidden', !!this.started || T.helis.length < 2);
    $('btn-map').classList.toggle('hidden', !!this.started);
    $('btn-time').textContent = 'ZEIT: ' + (this.nightSys.night ? 'NACHT' : 'TAG');
    $('btn-time').classList.toggle('hidden', !!this.started);
  }

  showMenu() {
    this.state = 'menu';
    $('brownout').style.opacity = 0; this.boShown = 0;
    this.updateMenuLabels();
    this.hud.show(false);
    this.updateTouchVisibility();
    $('menu').classList.remove('hidden');
    $('btn-continue').classList.toggle('hidden', !this.started);
    $('btn-start').classList.toggle('hidden', !!this.started);
    $('btn-start-foot').classList.toggle('hidden', !!this.started || !!T.peaceful);
    $('btn-mp').classList.toggle('hidden', false);
    $('btn-quit').classList.toggle('hidden', !this.started);
    $('btn-quit').textContent = this.role === 'solo' ? 'SPIEL BEENDEN' : this.role === 'host' ? 'MEHRSPIELER BEENDEN' : 'MEHRSPIELER VERLASSEN';
    const st = this.stats;
    $('menu-stats').innerHTML = `<b>${PF.rankFor(st.score)}</b> · ${st.score} Punkte · ${st.missions} Einsätze · ${st.rescued} gerettet · ${st.transported} transportiert`;
    this.focusFirst($('menu'));
  }

  // Laufendes Spiel beenden: Verbindung trennen, Statistik sichern und frisch starten
  quitGame(toLobby) {
    const msg = this.role === 'host' ? 'Mehrspieler-Spiel beenden? Alle Mitspieler werden getrennt.' : this.role === 'client' ? 'Mehrspieler-Spiel verlassen?' : 'Laufendes Spiel beenden?';
    this.askConfirm(msg, () => this.doQuit(toLobby));
  }

  doQuit(toLobby) {
    this.saveStats();
    if (this.net) this.net.stop();
    try { if (toLobby) sessionStorage.setItem('dustoff.openLobby', '1'); } catch (e) { /* privat */ }
    location.reload();
  }

  // Eigener Bestätigungsdialog (Controller- und Touch-tauglich)
  askConfirm(text, onYes) {
    $('confirm-text').textContent = text;
    $('confirm').classList.remove('hidden');
    this.confirmYes = onYes;
    const yes = $('confirm-yes');
    if (this.input.device !== 'touch') yes.focus();
  }

  startGame() {
    if (this.settings.gyro && this.input) this.input.calibrateGyro();   // beim Start: aktuelle Haltung = neutral
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
      this.hud.radio(`${this.callsign}, hier TOC ${T.fobName}. Willkommen in ${T.country}. Halten Sie sich bereit.`, 'TOC');
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
      ? list.map((h) => {
        const map = THEMES[h.info.map] ? h.info.map : 'vietnam';
        const types = (h.info.types || []).map((t) => (HELI_TYPES[t] ? HELI_TYPES[t].short : t)).join(' + ') || (h.info.heli2 ? '2 Hubschrauber' : 'UH-1D');
        return `<button data-ip="${esc(h.ip)}" data-port="${h.port}" data-map="${map}">${esc(h.info.name || 'Host')} · ${h.info.n || 1} Spieler · ${THEMES[map].name}<small>${esc(types)} · ${esc(h.ip)}${map !== T.id ? ' · Karte wird gewechselt' : ''}</small></button>`;
      }).join('')
      : '<p class="note">Suche nach Spielen im Netzwerk …</p>';
  }

  myName() { return ($('mp-name').value || 'Pilot').trim().slice(0, 16) || 'Pilot'; }

  startHost() {
    const heli2Type = $('mp-heli2').value;
    const heli2 = !!heli2Type;
    if (heli2 && this.helis.length < 2) { this.addHeli(heli2Type); this.crews.push({ pilot: null, left: null, right: null, pax: [] }); }
    this.net = new Net(this, this.tr);
    const r = this.net.host(this.myName(), heli2);
    if (!r || String(r).startsWith('err')) { this.onNetStatus('Spiel konnte nicht eröffnet werden: ' + r, true); this.net = null; return; }
    this.role = 'host';
    this.myId = 0;
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
    this.netTypes = w.types || null;
    if (w.night !== undefined) this.nightSys.set(w.night);
    if (this.netTypes) this.helis.forEach((h, i) => this.netTypes[i] && this.setHeliType(i, this.netTypes[i]));
    if (w.heli2 && this.helis.length < 2) this.addHeli();
    for (let i = 0; i < this.helis.length; i++) this.resetHeli(i);
    this.applyCrews(w.c);
    this.missions.applyNet(w.mission);
    this.netReady = true;
    this.started = true;
    this.startGame();
    this.radio(`Verbunden mit ${this.playerName(0)}. Sie sind ${SEAT_NAMES[this.seat]} in ${this.heli.spec.short} #${this.myHeli + 1}.`, 'TOC', false, true);
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
      this.radio(`MAYDAY, MAYDAY! ${h.spec.callsign}${this.helis.length > 1 ? ' #' + (h.index + 1) : ''} stürzt ab!`, h.spec.callsign, true, true);
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
      const blocking = !$('confirm').classList.contains('hidden') || this.state === 'menu' || this.state === 'paused' || this.hud.briefOpen || this.crashShown || this.hud.crewOpen || !$('lobby').classList.contains('hidden');
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
        if (a === 'camera' || a === 'crouch' || a === 'dpad-right') { S.crouch = !S.crouch; continue; }
        if (a === 'zoom') { this.zoomToggle = !this.zoomToggle; continue; }
        if (a === 'nvg' || (a === 'dpad-up' && this.nightSys.night)) { this.toggleNvg(); continue; }
        if (a === 'view' || a === 'dpad-up') {
          this.settings.footView = this.settings.footView === 'first' ? 'third' : 'first';
          PF.saveSettings(this.settings);
          $('set-footview').value = this.settings.footView;
          continue;
        }
        if (a === 'use' || a === 'confirm') { if (!this.hud.mapOpen) { this.useAction(); continue; } }
        if (a === 'radio' || a === 'pickup' || a === 'dpad-down') { this.requestPickup(); continue; }
        if (a === 'dpad-left') { S.setWeapon(S.w - 1); continue; }
        // Visier/Vergrößerer: Taste B bzw. rechten Stick drücken (Waffenwechsel nur mit L/R und Steuerkreuz links)
        if (a === 'magnifier') {
          if (!S.weapon.optic) { this.radioOnce('noopt', 2, `${S.weapon.name}: kein Rotpunktvisier – mit ZL über Kimme und Korn zielen.`, 'Waffe', false, true); continue; }
          if (S.toggleMagnifier()) this.radioOnce('mag', 0.5, S.magOn ? '3x-Vergrößerer aufgeklappt' : '3x-Vergrößerer weggeklappt', 'Waffe', false, true);
          continue;
        }
      } else if (a === 'use' || (a === 'confirm' && this.seat === 'pax' && !this.hud.mapOpen)) {
        if (this.seat !== 'pilot') this.useAction();
        continue;
      }
      switch (a) {
        case 'pause': this.pause(true); break;
        case 'map': this.hud.toggleMap(); break;
        case 'help': this.pause(true); this.openPanel('help'); break;
        case 'crew': this.hud.toggleCrew(); break;
        case 'airsupport': this.hud.toggleCrew(true); break;
        case 'nvg': this.toggleNvg(); break;
        case 'camera': case 'view':
          if (this.seat === 'pilot') this.camMode = this.camMode === 'chase' ? 'cockpit' : 'chase';
          break;
        case 'zoom': this.zoomToggle = !this.zoomToggle; break;
        case 'gyro-cal': this.input.calibrateGyro(); this.radio('Gyro neu ausgerichtet – aktuelle Haltung ist neutral.', 'Crew', false, true); break;
        // Außenansicht: Abstand zum Hubschrauber (Stufen bzw. +/−)
        case 'cam-dist': case 'cam-in': case 'cam-out': {
          if (this.seat !== 'pilot' || this.camMode !== 'chase') break;
          const o = this.orbit, base = this.heli.spec.camDist;
          if (a === 'cam-dist') {
            const steps = [0.5, 0.75, 1, 1.5, 2.2], cur = o.dist / base;
            const i = steps.findIndex((s) => s > cur + 0.05);
            o.dist = base * steps[i < 0 ? 0 : i];
          } else o.dist *= a === 'cam-in' ? 0.82 : 1.22;
          o.dist = clamp(o.dist, base * 0.45, base * 2.6);
          break;
        }
        case 'seat-pilot': case 'dpad-up': this.wantSeat(this.myHeli, 'pilot'); break;
        case 'seat-left': case 'dpad-left': this.wantSeat(this.myHeli, 'left'); break;
        case 'seat-right': case 'dpad-right': this.wantSeat(this.myHeli, 'right'); break;
        case 'num4': if ((this.heli.spec.seats || []).includes('ramp')) this.wantSeat(this.myHeli, 'ramp'); break;
        // SITZ / Tab wechselt immer den Platz; Controller R feuert als Apache-Pilot Raketen
        case 'seat-next': this.cycleSeat(1); break;
        case 'rocket-tap': if (this.seat === 'pilot' && this.heli.spec.rockets) this.fireRocket(); break;
        case 'pad-r': if (this.seat === 'pilot' && this.heli.spec.rockets) this.fireRocket(); else this.cycleSeat(1); break;
        case 'pickup': case 'rocket': if (this.seat === 'pilot' && this.heli.spec.rockets) this.fireRocket(); break;
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
    const ids = ['confirm', 'netlost', 'crashscreen', 'crew', 'binds', 'settings', 'help', 'lobby', 'pause', 'briefing', 'menu'];
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
    if (el.id === 'btn-heli') { this.cycleHeli(dir); return; }
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
    const r = h.spec.camDist * 1.1;
    this.camera.position.set(h.pos.x + Math.sin(t) * r, h.pos.y + 6 + Math.sin(t * 0.7) * 2 + r * 0.05, h.pos.z + Math.cos(t) * r);
    this.camera.lookAt(h.pos.x, h.pos.y + 1, h.pos.z);
    this.updateShadow(h.pos);
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
      if (!background && S.alive) {
        const cam = this.camera, cp = cam.position, d = cam.getWorldDirection(this._aaDir || (this._aaDir = new THREE.Vector3()));
        const zf = zoom ? 0.45 : 1;
        this.aimAssist(dt, aim, { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(clamp(d.y, -1, 1)) }, (e, o) => {
          const dx = e.x - cp.x, dz = e.z - cp.z, dy = e.y + (e.pose & 1 ? 0.75 : 1.15) - cp.y;
          const h = Math.hypot(dx, dz);
          o.yaw = Math.atan2(-dx, -dz); o.pitch = Math.atan2(dy, h); o.dist = Math.hypot(h, dy);
          return true;
        }, zoom, 260, zf);
      }
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
      for (const side of GUN_SEATS) {
        const mine = i === this.myHeli && this.seat === side;
        const occupied = this.crews[i] && this.crews[i][side] != null;
        const mode = mine ? 'player' : occupied ? 'remote' : this.role === 'client' ? 'remote' : 'ai';
        if (mine && !background) {
          const gn = hh.gunners[side];
          this.aimAssist(dt, aim, gn, (e, o) => { this._aaV = (this._aaV || new THREE.Vector3()).set(e.x, e.y + 1, e.z); gn.anglesTo(this._aaV, o); return gn.inArc(o); }, this.input.zoomHeld, gn.gun.range);
        }
        hh.gunners[side].update(dt, this, mine && !background ? aim : { dx: 0, dy: 0 }, mine && !background && this.input.fire, mode);
      }
    });

    if (this.role === 'client') { this.units.updateMirror(dt); this.air.updateMirror(dt); }
    else { this.units.update(dt); this.units.updateFobAttack(dt); this.fobAttack = !!this.units.attack; this.air.update(dt); }
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
      for (const side of GUN_SEATS) {
        const gu = hh.gunners[side];
        if (gu.mode === 'player' || gu.mode === 'ai') {
          // erst die Ersatzmagazine, dann den Gurt auffüllen
          if (gu.mags < (gu.gun.mags || 1) - 1 && rand() < dt * 0.5) gu.mags++;
          else gu.ammo = Math.min(gu.gun.ammo, gu.ammo + Math.ceil(400 * dt));
          if (gu.ammo > 0 && gu.reloadUntil) gu.reloadUntil = 0;
        }
        if (hh.spec.rockets && hh.rockets < hh.spec.rockets && rand() < dt * 4) hh.rockets++;
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
      const rack = this.nearRack();
      if (rack) hint = `${key}: Panzerfaust aufnehmen`;
      else if (near) hint = near.contact ? `${key}: In ${near.spec.short} #${near.index + 1} einsteigen` : 'Hubschrauber noch in der Luft – warten bis er gelandet ist';
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
      if (!hint && h.spec.capacity > 0 && this.missions.target(h) === 'from' && this.heliLoad(h) >= h.spec.capacity) hint = 'Kabine voll!';
      if (!hint && this.seat === 'pilot' && h.spec.rockets && this.time < 90) hint = this.input.device === 'gamepad' ? 'Raketen: R · Kanone: KI-Waffensystemoffizier' : this.input.device === 'touch' ? 'Raketen: linken Stick kurz antippen (oder RAKETE)' : 'Raketen: G · Kanone schießt der Waffensystemoffizier';
      if (!hint && this.seat === 'pilot' && this.input.device === 'keyboard' && this.settings.mouseFly && !this.input.mouseFlying) hint = 'Linksklick ins Bild: Maussteuerung (Maus ←→ drehen, ↑↓ vor/zurück)';
    }
    if (this.fobAttack) warnings.push({ text: 'FOB WIRD ANGEGRIFFEN', level: 'warn' });
    if ((this.storm || 0) > 0.35) warnings.push({ text: 'SANDSTURM – SICHT EINGESCHRÄNKT', level: 'warn' });
    if (h.wireDist < 110 && !h.crashed) warnings.push({ text: 'STROMLEITUNG – ABSTAND HALTEN!', level: h.wireDist < 55 ? 'crit' : 'warn' });
    const critical = warnings.some((x) => x.level === 'crit');

    this.effects.update(dt, this.camera.position);
    this.world.update(dt, this.time, this.camera);
    this.updateWeather();
    this.updateCamera(dt);
    if (this.myPickup && (this.seat !== 'foot' || (this.helis.every((x) => !x.aiPickup) && !(this.time - (this.myPickup.manual ?? -1e9) < 300)))) this.myPickup = null;
    this.hud.update(dt, {
      waypoint: this.myPickup ? { x: this.myPickup.x, z: this.myPickup.z, y: this.world.height(this.myPickup.x, this.myPickup.z), label: 'Abholung ' + this.myPickup.name, radius: 45 } : this.missions.waypoint(),
      warnings, hint,
      cameraLabel: this.seat === 'pilot' ? (this.camMode === 'chase' ? 'Außenansicht' : 'Cockpit') : '',
    });
    this.updateWaypointBeam();
    this.nightSys.update(onFoot ? null : h);
    // Brownout: Sicht trübt sich beim Schweben über Sand (nur im/am eigenen Hubschrauber)
    const bo = Math.max(!onFoot && !h.crashed ? h.brownout || 0 : 0, (this.storm || 0) * 0.55);
    if (Math.abs(bo - (this.boShown || 0)) > 0.02) { this.boShown = bo; $('brownout').style.opacity = (bo * 0.75).toFixed(2); }
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

  // Schattenkarte um Spieler bzw. Hubschrauber zentrieren (in Texelschritten gegen Flimmern)
  updateShadow(f) {
    if (!this.shadows) return;
    const st = (this.shadowR * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(f.x / st) * st, fz = Math.round(f.z / st) * st;
    this.sun.target.position.set(fx, f.y, fz);
    this.sun.position.set(fx + this.sunDir.x * 400, f.y + this.sunDir.y * 400, fz + this.sunDir.z * 400);
    this.sun.target.updateMatrixWorld();
  }

  updateCamera(dt) {
    const h = this.heli, cam = this.camera, m = h.model;
    const look = this.input.consumeLook();
    let fov = 65;
    for (const hh of this.helis) hh.model.pilots[1].group.visible = true;
    if (this.seat !== 'foot') {
      this.soldier.updateViewModel(dt, cam, false);
      document.body.classList.remove('fp-view', 'fp-ads');
    }
    if (this.seat === 'foot') {
      // Schulterkamera hinter dem Soldaten
      const S = this.soldier;
      const zoom = S.zoom && S.alive;
      let yaw = S.yaw, pitch = S.pitch;
      const first = this.settings.footView === 'first' && S.alive;
      S.group.visible = !first;
      S.updateViewModel(dt, cam, first);
      document.body.classList.toggle('fp-view', first);
      document.body.classList.toggle('fp-ads', first && S.adsT > 0.6);
      document.body.classList.toggle('fp-mag', first && S.adsT > 0.8 && S.magFactor() > 1);
      document.body.classList.toggle('optic', !!S.weapon.optic);
      if (first) {
        cam.position.set(S.pos.x, S.pos.y + (S.crouch ? 1.05 : 1.6), S.pos.z);
        cam.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
        fov = zoom ? (S.weapon.fov * 1.25) / S.magFactor() : 75;
        this.camInit = false;
      } else {
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
      fov = zoom ? S.weapon.fov / S.magFactor() : 70;
      this.camInit = false;
      }
    } else if (isGunSeat(this.seat) && !h.crashed) {
      const rig = m.guns[this.seat];
      rig.eye.getWorldPosition(cam.position);
      rig.pitch.getWorldQuaternion(cam.quaternion);
      const tur = h.spec.gun.turret;
      fov = this.input.zoomHeld ? (tur ? 9 : 28) : tur ? 48 : 62;
    } else if (this.camMode === 'cockpit' && !h.crashed) {
      this.cockpitLook.yaw = clamp(this.cockpitLook.yaw - look.dx, -2.2, 2.2);
      this.cockpitLook.pitch = clamp(this.cockpitLook.pitch - look.dy, -0.9, 0.6);
      if (!this.input.mouseDown[2]) { this.cockpitLook.yaw *= 1 - damp(1.5, dt); this.cockpitLook.pitch *= 1 - damp(1.5, dt); }
      cam.position.copy(m.eyePilot).applyQuaternion(h.quat).add(h.pos);
      // Im Landeanflug (tief und langsam) blickt der Pilot automatisch etwas nach unten
      const landing = clamp((45 - h.agl) / 35, 0, 1) * clamp((22 - h.speed) / 12, 0, 1);
      this.ckDown = (this.ckDown || 0) + (landing * 0.32 - (this.ckDown || 0)) * Math.min(1, dt * 2);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.cockpitLook.pitch - 0.12 - this.ckDown, this.cockpitLook.yaw, 0, 'YXZ'));
      cam.quaternion.copy(h.quat).multiply(q);
      m.pilots[1].group.visible = false;
      fov = cam.aspect < 1.2 ? 95 : 84;   // weitwinklig, damit man auch seitlich hinaussieht
    } else {
      const o = this.orbit;
      o.yaw -= look.dx; o.pitch = clamp(o.pitch + look.dy, -0.15, 1.2);
      o.dist = clamp(o.dist * (1 + look.zoom * 0.12), h.spec.camDist * 0.45, h.spec.camDist * 2.6);
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
    this.updateShadow(this.seat === 'foot' && this.soldier.active ? this.soldier.pos : h.pos);
    // Apache-Pilot: Zielmarke für die Raketen (Treffpunkt auf 400 m)
    const rk = this.seat === 'pilot' && h.spec.rockets && !h.crashed && this.state === 'playing';
    document.body.classList.toggle('rocket-mode', !!rk);
    const rel = $('rkt-reticle');
    if (rk) {
      const d = this.rocketDir(h);
      const t = Math.min(600, this.world.raycast(h.pos, d, 600));
      const p = new THREE.Vector3().copy(h.pos).addScaledVector(d, Math.max(60, t)).project(cam);
      const on = p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
      rel.style.display = on ? 'block' : 'none';
      if (on) { rel.style.left = ((p.x + 1) / 2) * 100 + '%'; rel.style.top = ((1 - p.y) / 2) * 100 + '%'; }
    } else rel.style.display = 'none';
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
