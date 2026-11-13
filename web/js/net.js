// LAN-Mehrspieler
//
// Ein Gerät eröffnet das Spiel (Host), weitere Geräte im selben WLAN treten bei.
// Der Host berechnet Aufträge, Bodentruppen und Feinde. Wer einen Hubschrauber
// fliegt, berechnet dessen Flugphysik selbst und schickt den Zustand an den Host,
// der ihn an alle verteilt. Schützen zielen und schießen lokal; Treffer auf Feinde
// werden dem Host gemeldet.
//
// Transport: in der Android-App über window.AndroidApp (LanNet.java: TCP + UDP-
// Broadcast zur Spielsuche) und zusätzlich per Spielcode (WebRTC/PeerJS). Im Browser
// nur per Spielcode. Für Tests gibt es mit "?net=test" einen BroadcastChannel-Transport
// zwischen zwei Fenstern/Tabs.
import * as THREE from './lib/three.module.min.js';
import { Soldier, WEAPONS } from './soldier.js';
import { T } from './theme.js';

function androidTransport() {
  const A = window.AndroidApp;
  if (!A || !A.netHost) return null;
  return {
    kind: 'lan',
    host: (info) => A.netHost(JSON.stringify(info)),
    info: (info) => A.netInfo(JSON.stringify(info)),
    join: (ip, port) => A.netJoin(String(ip), port | 0),
    send: (peer, obj) => A.netSend(peer, JSON.stringify(obj)),
    poll: () => {
      const s = A.netPoll(), out = [];
      if (!s) return out;
      for (const line of s.split('\n')) {
        const i = line.indexOf('\t');
        if (i < 0) continue;
        try { out.push({ p: +line.slice(0, i), m: JSON.parse(line.slice(i + 1)) }); } catch (e) { /* defekte Nachricht */ }
      }
      return out;
    },
    scan: (on) => A.netScan(!!on),
    hosts: () => { try { return JSON.parse(A.netHosts()); } catch (e) { return []; } },
    ip: () => A.netIp(),
    deviceName: () => (A.deviceName ? A.deviceName() : 'Android'),
    stop: () => A.netStop(),
  };
}

function testTransport() {
  const ch = new BroadcastChannel('dustoff-net'), tok = Math.random().toString(36).slice(2, 8);
  const inbox = [], peers = new Map(), toks = new Map(), hosts = new Map();
  let role = null, hostTok = null, nextId = 1, info = null, beacon = null;
  ch.onmessage = (e) => {
    const d = e.data;
    if (d.k === 'beacon') { hosts.set(d.tok, { ip: 'test-' + d.tok, port: 1, info: d.info, t: Date.now() }); return; }
    if (role === 'host') {
      if (d.k === 'join' && d.to === tok) {
        const id = nextId++; peers.set(id, d.tok); toks.set(d.tok, id);
        ch.postMessage({ k: 'acc', to: d.tok, from: tok }); inbox.push({ p: id, m: { t: '_join' } });
      } else if (d.k === 'msg' && d.to === tok && toks.has(d.from)) inbox.push({ p: toks.get(d.from), m: d.m });
      else if (d.k === 'bye' && toks.has(d.from)) { const id = toks.get(d.from); toks.delete(d.from); peers.delete(id); inbox.push({ p: id, m: { t: '_leave' } }); }
    } else if (role === 'client') {
      if (d.k === 'acc' && d.to === tok) inbox.push({ p: 0, m: { t: '_open' } });
      else if (d.k === 'msg' && d.from === hostTok && (d.to === tok || d.to === '*')) inbox.push({ p: 0, m: d.m });
      else if (d.k === 'bye' && d.from === hostTok) inbox.push({ p: 0, m: { t: '_leave' } });
    }
  };
  window.addEventListener('beforeunload', () => { if (role) ch.postMessage({ k: 'bye', from: tok }); });
  return {
    kind: 'test',
    host: (inf) => { role = 'host'; info = inf; beacon = setInterval(() => ch.postMessage({ k: 'beacon', tok, info }), 400); return 'ok:test:1'; },
    info: (inf) => { info = inf; },
    join: (ip) => { role = 'client'; hostTok = String(ip).replace('test-', ''); ch.postMessage({ k: 'join', to: hostTok, tok }); },
    send: (peer, m) => {
      if (role === 'host') {
        if (peer < 0) ch.postMessage({ k: 'msg', from: tok, to: '*', m });
        else if (peers.has(peer)) ch.postMessage({ k: 'msg', from: tok, to: peers.get(peer), m });
      } else if (role === 'client') ch.postMessage({ k: 'msg', from: tok, to: hostTok, m });
    },
    poll: () => inbox.splice(0),
    scan: () => {},
    hosts: () => [...hosts.values()].filter((h) => Date.now() - h.t < 2500),
    ip: () => 'test',
    deviceName: () => 'Browser',
    stop: () => { if (beacon) clearInterval(beacon); beacon = null; if (role) ch.postMessage({ k: 'bye', from: tok }); role = null; },
  };
}

// ------------------------------------------------------------ Browser: WebRTC über PeerJS
// Der Host meldet sich mit einem kurzen Spielcode beim öffentlichen PeerJS-Vermittlungsserver
// (0.peerjs.com, ohne Anmeldung) an; die Spieldaten laufen danach direkt zwischen den Geräten.
// Eine Spielsuche gibt es nicht – Mitspieler geben den Code ein oder öffnen den Einladungslink.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PEER_PREFIX = 'hotlz-v2-';
export const isGameCode = (s) => /^[A-Z0-9]{4,6}$/i.test(String(s).trim()) && !/^\d+$/.test(String(s).trim());
const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

let peerLib = null;
export function loadPeerJs() {
  if (window.peerjs && window.peerjs.Peer) return Promise.resolve(window.peerjs.Peer);
  if (!peerLib) {
    peerLib = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = new URL('./lib/peerjs.min.js', import.meta.url).href;
      s.onload = () => (window.peerjs && window.peerjs.Peer ? res(window.peerjs.Peer) : rej(new Error('PeerJS fehlt')));
      s.onerror = () => { peerLib = null; rej(new Error('PeerJS konnte nicht geladen werden')); };
      document.head.appendChild(s);
    });
  }
  return peerLib;
}

// eigener Vermittlungsserver nur für Tests: ?peer=localhost:9000
export function peerOptions() {
  const m = /[?&]peer=([^&]+)/.exec(location.search);
  if (!m) return { debug: 0 };
  const [host, port] = decodeURIComponent(m[1]).split(':');
  return { host, port: +port || 9000, path: '/', secure: false, debug: 0 };
}

export function peerTransport() {
  if (!window.RTCPeerConnection) return null;
  const inbox = [], conns = new Map(), seen = new Map();
  let peer = null, role = null, code = null, nextId = 1, hostConn = null, status = '', beat = null;
  const push = (p, m) => inbox.push({ p, m });

  // Herzschlag: geschlossene Tabs/abgerissene Verbindungen werden sonst erst spät bemerkt
  const startBeat = () => {
    if (beat) return;
    beat = setInterval(() => {
      const now = Date.now();
      if (role === 'host') {
        for (const [id, c] of conns) {
          if (c.open) c.send({ t: '_ping' });
          if (now - (seen.get(id) || now) > 20000) { conns.delete(id); try { c.close(); } catch (e) { /* egal */ } push(id, { t: '_leave' }); }
        }
      } else if (role === 'client' && hostConn) {
        if (hostConn.open) hostConn.send({ t: '_ping' });
        if (now - (seen.get(0) || now) > 20000) { const c = hostConn; hostConn = null; try { c.close(); } catch (e) { /* egal */ } push(0, { t: '_leave' }); }
      }
    }, 2000);
  };

  const wire = (c, id) => {
    c.on('data', (d) => {
      if (role === 'host' && conns.get(id) !== c) return;
      seen.set(id, Date.now());
      if (d && typeof d === 'object' && d.t !== '_ping') push(id, d);
    });
    c.on('close', () => {
      if (role === 'host') { if (conns.delete(id)) push(id, { t: '_leave' }); }
      else if (role === 'client' && c === hostConn) { hostConn = null; push(0, { t: '_leave' }); }
    });
    c.on('error', () => {});
  };

  const startHost = (Peer, tries = 0) => {
    code = newCode();
    const p = new Peer(PEER_PREFIX + code, peerOptions());
    peer = p;
    p.on('open', () => { status = 'ready'; });
    p.on('connection', (c) => {
      c.on('open', () => {
        const id = nextId++;
        conns.set(id, c);
        seen.set(id, Date.now());
        wire(c, id);
        startBeat();
        push(id, { t: '_join' });
      });
    });
    p.on('disconnected', () => { if (role === 'host' && !p.destroyed) setTimeout(() => { try { p.reconnect(); } catch (e) { /* egal */ } }, 2000); });
    p.on('error', (e) => {
      if (e.type === 'unavailable-id' && tries < 4) { p.destroy(); startHost(Peer, tries + 1); return; }
      if (['network', 'server-error', 'socket-error', 'browser-incompatible', 'ssl-unavailable'].includes(e.type) && status !== 'ready') status = 'err:' + e.type;
    });
  };

  return {
    kind: 'peer',
    // liefert sofort den Code; die Anmeldung beim Vermittlungsserver läuft im Hintergrund
    host: () => {
      role = 'host'; status = 'pending';
      code = newCode();
      loadPeerJs().then((Peer) => startHost(Peer)).catch(() => { status = 'err:lib'; });
      return 'pending';
    },
    code: () => code,
    status: () => status,
    info: () => {},
    join: (target) => {
      role = 'client';
      const want = String(target).trim().toUpperCase();
      loadPeerJs().then((Peer) => {
        const p = new Peer(undefined, peerOptions());
        peer = p;
        let opened = false, asked = false;
        const fail = () => { if (!opened && role === 'client') { role = null; push(0, { t: '_fail' }); } };
        const to = setTimeout(fail, 15000);
        p.on('open', () => {
          if (asked) return;
          asked = true;
          const c = p.connect(PEER_PREFIX + want, { serialization: 'json', reliable: true });
          hostConn = c;
          c.on('open', () => { opened = true; clearTimeout(to); seen.set(0, Date.now()); startBeat(); push(0, { t: '_open' }); });
          wire(c, 0);
        });
        p.on('error', (e) => { if (!opened) { clearTimeout(to); fail(); } else if (e.type === 'network' || e.type === 'peer-unavailable') { /* Verbindung bleibt evtl. bestehen */ } });
      }).catch(() => push(0, { t: '_fail' }));
    },
    send: (to, obj) => {
      if (role === 'host') {
        if (to < 0) { for (const c of conns.values()) if (c.open) c.send(obj); }
        else { const c = conns.get(to); if (c && c.open) c.send(obj); }
      } else if (hostConn && hostConn.open) hostConn.send(obj);
    },
    poll: () => inbox.splice(0),
    scan: () => {},
    hosts: () => [],
    ip: () => '',
    deviceName: () => (/Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone' : 'Browser'),
    stop: () => { role = null; clearInterval(beat); beat = null; seen.clear(); for (const c of conns.values()) try { c.close(); } catch (e) { /* egal */ } conns.clear(); hostConn = null; if (peer) try { peer.destroy(); } catch (e) { /* egal */ } peer = null; code = null; status = ''; },
  };
}

// Android-App: LAN (Spielsuche im WLAN) und Spielcode (Browser-Mitspieler) gleichzeitig.
// Spieler-IDs der Code-Verbindungen werden um 1000 verschoben.
const PEER_OFS = 1000;
function comboTransport(lan, pe) {
  let via = null;   // als Client: 'lan' | 'peer'
  return {
    kind: 'lan+peer',
    host: (info) => { const r = lan.host(info); if (!String(r).startsWith('err')) pe.host(info); return r; },
    code: () => pe.code(),
    status: () => pe.status(),
    info: (info) => lan.info(info),
    join: (ip, port) => { via = isGameCode(ip) ? 'peer' : 'lan'; return via === 'peer' ? pe.join(ip) : lan.join(ip, port); },
    send: (to, obj) => {
      if (via) return (via === 'peer' ? pe : lan).send(to, obj);
      if (to < 0) { lan.send(to, obj); pe.send(to, obj); } else if (to >= PEER_OFS) pe.send(to - PEER_OFS, obj); else lan.send(to, obj);
    },
    poll: () => {
      if (via === 'peer') return pe.poll();
      if (via === 'lan') return lan.poll();
      return lan.poll().concat(pe.poll().map((x) => ({ p: x.p + PEER_OFS, m: x.m })));
    },
    scan: (on) => lan.scan(on),
    hosts: () => lan.hosts(),
    ip: () => lan.ip(),
    deviceName: () => lan.deviceName(),
    stop: () => { via = null; try { lan.stop(); } catch (e) { /* egal */ } pe.stop(); },
  };
}

export function netTransport() {
  if (/[?&]net=test/.test(location.search) && window.BroadcastChannel) return testTransport();
  const lan = androidTransport(), pe = peerTransport();
  if (lan && pe) return comboTransport(lan, pe);
  return lan || pe;
}

const SIDES = ['left', 'right', 'ramp'];
const PAX_CODE = { wounded: 'w', pilot: 'p', us: 'u', sof: 's', cargo: 'c', vip: 'v' };
const PAX_TYPE = { w: 'wounded', p: 'pilot', u: 'us', s: 'sof', c: 'cargo', v: 'vip' };
const COLORS = [[1, 0.3, 0.18], [0.45, 1.0, 0.35], [0.45, 1.0, 0.35]];
const r2 = (v) => Math.round(v * 100) / 100;

export class Net {
  constructor(game, tr) {
    this.game = game;
    this.tr = tr;
    this.mode = null; // 'host' | 'client'
    this.players = new Map();
    this.ev = [];
    this.snapT = 0; this.sendT = 0; this.missionT = 0; this.snapN = 0;
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3();
  }

  get isHost() { return this.mode === 'host'; }
  beaconInfo() { return { name: this.name, heli2: this.heli2, n: this.players.size || 1, v: 2, map: T.id, types: this.game.helis.map((h) => h.type), night: this.game.nightSys.night ? 1 : 0 }; }

  // ------------------------------------------------------------ Verbindungsaufbau
  host(name, heli2) {
    this.mode = 'host';
    this.name = name;
    this.heli2 = heli2;
    this.players.set(0, { id: 0, name });
    const r = this.tr.host(this.beaconInfo());
    return r;
  }

  join(ip, port, name) {
    this.joinTarget = { ip, port };
    this.mode = 'client';
    this.name = name;
    this.tr.join(ip, port);
  }

  updateBeacon() {
    if (this.isHost) this.tr.info(this.beaconInfo());
  }

  send(obj) { this.tr.send(this.isHost ? -1 : 0, obj); }
  sendTo(peer, obj) {
    if (peer === 0 && this.isHost) return;
    this.tr.send(peer, obj);
  }
  stop() { try { this.tr.stop(); } catch (e) { /* egal */ } this.mode = null; }

  // ------------------------------------------------------------ Ereignisse
  gunFire(i, side, o, d) {
    const q = (v) => Math.round(v * 1e4) / 1e4;
    this.send({ t: 'f', i, s: side === 'left' ? 0 : 1, o: [r2(o.x), r2(o.y), r2(o.z)], d: [q(d.x), q(d.y), q(d.z)] });
  }

  // Rakete (Apache) – andere sehen sie fliegen und einschlagen
  rocketFire(o, v) {
    this.send({ t: 'rk', o: [r2(o.x), r2(o.y), r2(o.z)], v: [r2(v.x), r2(v.y), r2(v.z)] });
  }
  renderRocket(m) {
    this.game.combat.rocket(this._a.set(m.o[0], m.o[1], m.o[2]), this._b.set(m.v[0], m.v[1], m.v[2]), true);
  }

  // Schuss / Granate eines Spielers zu Fuß
  footFire(o, d, wid, tracer) {
    const q = (v) => Math.round(v * 1e4) / 1e4;
    this.send({ t: 'ff', o: [r2(o.x), r2(o.y), r2(o.z)], d: [q(d.x), q(d.y), q(d.z)], w: wid, tr: tracer ? 1 : 0 });
  }

  renderFoot(m) {
    const g = this.game;
    const w = WEAPONS.find((x) => x.id === m.w) || WEAPONS[0];
    this._a.set(m.o[0], m.o[1], m.o[2]);
    this._b.set(m.d[0], m.d[1], m.d[2]);
    if (w.grenade) g.combat.grenade(this._a, this._b, true);
    else g.combat.fire(this._a, this._b, new THREE.Vector3(), !!m.tr, true, w.vel);
    g.effects.muzzle(this._a.x, this._a.y, this._a.z, false);
    g.audio.shot(w.sound, g.camera.position.distanceTo(this._a));
  }

  // Avatar eines Mitspielers zu Fuß
  avatar(pid) {
    const g = this.game;
    let a = g.avatars.get(pid);
    if (!a) {
      const pl = this.players.get(pid);
      a = new Soldier(g, true, pl ? pl.name : 'Spieler');
      g.avatars.set(pid, a);
    }
    return a;
  }

  dropAvatar(pid) {
    const a = this.game.avatars.get(pid);
    if (a) { a.dispose(); this.game.avatars.delete(pid); }
  }

  groundShot(a, b, col, tracer, hit) {
    if (!this.isHost) return;
    this.ev.push(r2(a.x), r2(a.y), r2(a.z), r2(b.x), r2(b.y), r2(b.z), col, tracer ? 1 : 0, hit ? 1 : 0);
  }

  sendMission() { this.send({ t: 'm', d: this.game.missions.toNet() }); }
  sendCrews() { this.send({ t: 'crews', c: this.game.crews, pl: [...this.players.values()] }); this.updateBeacon(); }

  // ------------------------------------------------------------ Hauptschleife
  update(dt) {
    const g = this.game;
    for (const { p, m } of this.tr.poll()) {
      try { this.isHost ? this.onHost(p, m) : this.onClient(m); } catch (e) { console.error('Netz', m && m.t, e); }
    }
    if (!g.netReady) return;
    if (this.isHost) {
      this.snapT -= dt;
      if (this.snapT <= 0) { this.snapT = 1 / 12; this.sendSnapshot(); }
      this.missionT -= dt;
      if (this.missionT <= 0) { this.missionT = 1.5; this.sendMission(); }
    } else {
      this.sendT -= dt;
      if (this.sendT <= 0) { this.sendT = 1 / 15; this.sendOwn(); }
    }
  }

  sendSnapshot() {
    const g = this.game;
    this.snapN++;
    const H = g.helis.map((h) => ({
      s: h.getState(),
      c: h.crashed ? h.crashCause : '',
      px: h.passengers.map((p) => PAX_CODE[p.type] || 'u').join(''),
      g: SIDES.map((s) => { const gu = h.gunners[s]; return [r2(gu.yaw), r2(gu.pitch), gu.ammo]; }),
    }));
    const P = [];
    if (g.seat === 'foot' && g.soldier.active) P.push([0, g.soldier.getState()]);
    for (const [pid, a] of g.avatars) if (a.active && a.isFoot && !g.seatOf(pid) && a.tgt) P.push([pid, a.tgt]);
    const msg = { t: 's', T: Math.round(g.time * 10) / 10, H, E: this.ev, P, A: g.fobAttack ? 1 : 0, X: g.air.snapshot() };
    if (this.snapN % 2 === 0) msg.U = g.units.snapshot();
    const cv = g.missions.convoyNet();
    if (cv) msg.C = cv;
    this.ev = [];
    this.send(msg);
  }

  // Client: eigenen Hubschrauber und eigenes MG melden
  sendOwn() {
    const g = this.game;
    g.helis.forEach((h, i) => { if (g.owns(i)) this.send({ t: 'h', i, s: h.getState(), c: h.crashed ? h.crashCause : '' }); });
    if (g.seat === 'foot') this.send({ t: 'p', s: g.soldier.getState() });
    else if (SIDES.includes(g.seat)) {
      const gu = g.heli.gunners[g.seat];
      this.send({ t: 'g', i: g.myHeli, s: SIDES.indexOf(g.seat), y: r2(gu.yaw), p: r2(gu.pitch), a: gu.ammo });
    }
  }

  // ------------------------------------------------------------ Host empfängt
  onHost(p, m) {
    const g = this.game;
    switch (m.t) {
      case '_join': break;
      case 'hello': {
        const name = String(m.name || 'Spieler').slice(0, 16);
        this.players.set(p, { id: p, name });
        g.assignSeat(p);
        this.sendTo(p, { t: 'welcome', id: p, heli2: this.heli2, map: T.id, types: g.helis.map((h) => h.type), night: g.nightSys.night, c: g.crews, pl: [...this.players.values()], mission: g.missions.toNet(), time: g.time });
        this.sendCrews();
        g.radio(`${name} ist dem Einsatz beigetreten.`, 'TOC');
        break;
      }
      case 'chat': g.comms.onHostChat(p, m); break;
      case 'vid': if (typeof m.v === 'string' && m.v.length < 80) g.comms.setVid(p, m.v); break;
      case 'ptt': g.comms.onHostPtt(p, !!m.on); break;
      case '_leave': {
        g.comms.dropPlayer(p);
        const pl = this.players.get(p);
        this.players.delete(p);
        g.freeSeats(p);
        this.dropAvatar(p);
        this.sendCrews();
        if (pl) g.radio(`${pl.name} hat den Einsatz verlassen.`, 'TOC');
        break;
      }
      case 'h': if (g.owner(m.i) === p && g.helis[m.i]) g.helis[m.i].applyState(m.s, m.c); break;
      case 'g': {
        const side = SIDES[m.s];
        if (g.crews[m.i] && g.crews[m.i][side] === p) {
          const gu = g.helis[m.i].gunners[side];
          gu.netYaw = m.y; gu.netPitch = m.p; gu.ammo = m.a;
        }
        break;
      }
      case 'f':
        this.renderFire(m);
        for (const id of this.players.keys()) if (id !== 0 && id !== p) this.sendTo(id, m);
        break;
      case 'rk':
        this.renderRocket(m);
        for (const id of this.players.keys()) if (id !== 0 && id !== p) this.sendTo(id, m);
        break;
      case 'kill': {
        const e = g.units.enemies.find((x) => x.id === m.id);
        if (e && e.alive) g.units.killEnemy(e);
        break;
      }
      case 'seat':
        if (m.p) { const a = this.avatar(p); a.applyState(m.p); a.isFoot = true; }
        g.requestSeat(p, m.i, m.seat);
        break;
      case 'p': {
        if (g.seatOf(p)) break;
        const a = this.avatar(p);
        a.applyState(m.s);
        a.isFoot = true;
        break;
      }
      case 'ff':
        this.renderFoot(m);
        for (const id of this.players.keys()) if (id !== 0 && id !== p) this.sendTo(id, m);
        break;
      case 'pickup': g.handlePickup(p); break;
      case 'cas': g.air.request(m.k, { x: m.x, z: m.z }, p); break;
      case 'accept': if (g.missions.current && g.missions.current.id === m.id) g.missions.accept(); break;
      case 'respawn': g.respawnHeli(m.i); break;
    }
  }

  // ------------------------------------------------------------ Client empfängt
  onClient(m) {
    const g = this.game;
    switch (m.t) {
      case '_open': this.send({ t: 'hello', name: this.name }); g.onNetStatus('Verbunden – warte auf den Host …'); break;
      case '_fail': g.onNetStatus(this.joinTarget && isGameCode(this.joinTarget.ip) ? 'Kein Spiel mit diesem Code gefunden – Code prüfen.' : 'Verbindung fehlgeschlagen.', true); this.mode = null; break;
      case '_leave': g.onNetLost(); break;
      case 'welcome':
        // anderes Einsatzgebiet: Karte wechseln, neu laden und automatisch wieder beitreten
        if (m.map && m.map !== T.id) { g.switchMap(m.map, this.joinTarget); return; }
        this.myId = m.id;
        this.heli2 = m.heli2;
        for (const pl of m.pl) this.players.set(pl.id, pl);
        g.startClient(m);
        break;
      case 'crews':
        this.players.clear();
        for (const pl of m.pl) this.players.set(pl.id, pl);
        g.applyCrews(m.c);
        break;
      case 's': this.applySnapshot(m); break;
      case 'm': g.missions.applyNet(m.d); break;
      case 'f': this.renderFire(m); break;
      case 'rk': this.renderRocket(m); break;
      case 'asx': g.air.playFx(m); break;
      case 'ff': this.renderFoot(m); break;
      case 'pdmg': g.damageSoldier(g.myId, m.a); break;
      case 'pickupAck': g.myPickup = { x: m.x, z: m.z, name: m.name }; break;
      case 'dmg': if (g.owns(m.i)) g.damageHeli(g.helis[m.i], m.a); break;
      case 'reset': if (g.owns(m.i)) g.respawnHeli(m.i); break;
      case 'radio': g.hud.radio(m.x, m.f, m.u); g.audio.radio(); break;
      case 'chat': g.comms.onClientChat(m); break;
      case 'vids': g.comms.onVids(m.l); break;
      case 'ptt': g.comms.onPtt(m.p, !!m.on, String(m.n || '').slice(0, 16)); break;
      case 'result': g.onMissionResult(m.r); break;
    }
  }

  applySnapshot(m) {
    const g = this.game;
    m.H.forEach((d, i) => {
      const h = g.helis[i];
      if (!h) return;
      if (!g.owns(i)) h.applyState(d.s, d.c);
      const px = d.px || '';
      const cur = h.passengers.map((p) => PAX_CODE[p.type] || 'u').join('');
      if (cur !== px) {
        const mid = g.missions.current ? g.missions.current.id : null;
        h.passengers = [...px].map((c) => ({ type: PAX_TYPE[c], missionId: mid }));
        h.updatePassengerDisplay();
      }
      SIDES.forEach((s, k) => {
        if (i === g.myHeli && s === g.seat) return;
        const gu = h.gunners[s];
        if (!d.g[k]) return;
        gu.netYaw = d.g[k][0]; gu.netPitch = d.g[k][1]; gu.ammo = d.g[k][2];
      });
    });
    if (m.U) g.units.applySnapshot(m.U);
    if (m.C) g.missions.applyConvoyNet(m.C);
    g.fobAttack = !!m.A;
    if (m.X) g.air.applyNet(m.X);
    // Mitspieler zu Fuß
    const seen = new Set();
    for (const [pid, st] of m.P || []) {
      if (pid === g.myId) continue;
      seen.add(pid);
      const a = this.avatar(pid);
      a.applyState(st);
      a.isFoot = true;
    }
    for (const [pid, a] of g.avatars) if (!seen.has(pid) && a.active) { a.hide(); a.isFoot = false; }
    const E = m.E || [];
    for (let k = 0; k < E.length; k += 9) {
      this._a.set(E[k], E[k + 1], E[k + 2]);
      this._b.set(E[k + 3], E[k + 4], E[k + 5]);
      const hit = E[k + 8];
      const hp = hit ? this._b.clone() : null;
      g.groundShot(this._a, this._b, E[k + 6], !!E[k + 7], hp ? () => g.effects.sparks(hp.x, hp.y, hp.z) : null, true);
    }
  }

  renderFire(m) {
    const g = this.game;
    const h = g.helis[m.i];
    if (!h) return;
    this._a.set(m.o[0], m.o[1], m.o[2]);
    this._b.set(m.d[0], m.d[1], m.d[2]);
    const gun = h.spec.gun;
    g.combat.fire(this._a, this._b, h.vel, true, true, gun.muzzleVel, false, !!gun.he);
    g.effects.muzzle(this._a.x + this._b.x * 0.3, this._a.y + this._b.y * 0.3, this._a.z + this._b.z * 0.3, true);
    const d = g.camera.position.distanceTo(this._a);
    if (gun.minigun) g.audio.loopShot('net' + m.i + ':' + m.s, d, 0.16);   // nur jeder 5. Schuss kommt an
    else {
      // Übers Netz kommt nur jeder Leuchtspurschuss: die Schüsse dazwischen im Feuertakt nachspielen
      const n = gun.tracerEvery || 2, iv = 60 / gun.rpm;
      for (let k = 0; k < n; k++) g.audio.shot(gun.he ? 'dshk' : gun.heavy ? 'dshk' : 'm60', d, k * iv);
    }
  }
}

export { COLORS };
