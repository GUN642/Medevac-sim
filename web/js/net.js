// LAN-Mehrspieler
//
// Ein Gerät eröffnet das Spiel (Host), weitere Geräte im selben WLAN treten bei.
// Der Host berechnet Aufträge, Bodentruppen und Feinde. Wer einen Hubschrauber
// fliegt, berechnet dessen Flugphysik selbst und schickt den Zustand an den Host,
// der ihn an alle verteilt. Schützen zielen und schießen lokal; Treffer auf Feinde
// werden dem Host gemeldet.
//
// Transport: in der Android-App über window.AndroidApp (LanNet.java: TCP + UDP-
// Broadcast zur Spielsuche). Für Tests im Browser gibt es mit "?net=test" einen
// BroadcastChannel-Transport zwischen zwei Fenstern/Tabs.
import * as THREE from './lib/three.module.min.js';

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

export function netTransport() {
  if (/[?&]net=test/.test(location.search) && window.BroadcastChannel) return testTransport();
  return androidTransport();
}

const SIDES = ['left', 'right'];
const PAX_CODE = { wounded: 'w', pilot: 'p', us: 'u' };
const PAX_TYPE = { w: 'wounded', p: 'pilot', u: 'us' };
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

  // ------------------------------------------------------------ Verbindungsaufbau
  host(name, heli2) {
    this.mode = 'host';
    this.name = name;
    this.heli2 = heli2;
    this.players.set(0, { id: 0, name });
    const r = this.tr.host({ name, heli2, n: 1, v: 1 });
    return r;
  }

  join(ip, port, name) {
    this.mode = 'client';
    this.name = name;
    this.tr.join(ip, port);
  }

  updateBeacon() {
    if (this.isHost) this.tr.info({ name: this.name, heli2: this.heli2, n: this.players.size, v: 1 });
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
    const msg = { t: 's', T: Math.round(g.time * 10) / 10, H, E: this.ev };
    if (this.snapN % 2 === 0) msg.U = g.units.snapshot();
    this.ev = [];
    this.send(msg);
  }

  // Client: eigenen Hubschrauber und eigenes MG melden
  sendOwn() {
    const g = this.game;
    g.helis.forEach((h, i) => { if (g.owns(i)) this.send({ t: 'h', i, s: h.getState(), c: h.crashed ? h.crashCause : '' }); });
    if (g.seat !== 'pilot') {
      const gu = g.heli.gunners[g.seat];
      this.send({ t: 'g', i: g.myHeli, s: g.seat === 'left' ? 0 : 1, y: r2(gu.yaw), p: r2(gu.pitch), a: gu.ammo });
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
        this.sendTo(p, { t: 'welcome', id: p, heli2: this.heli2, c: g.crews, pl: [...this.players.values()], mission: g.missions.toNet(), time: g.time });
        this.sendCrews();
        g.radio(`${name} ist dem Einsatz beigetreten.`, 'TOC');
        break;
      }
      case '_leave': {
        const pl = this.players.get(p);
        this.players.delete(p);
        g.freeSeats(p);
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
      case 'kill': {
        const e = g.units.enemies.find((x) => x.id === m.id);
        if (e && e.alive) g.units.killEnemy(e);
        break;
      }
      case 'seat': g.requestSeat(p, m.i, m.seat); break;
      case 'accept': if (g.missions.current && g.missions.current.id === m.id) g.missions.accept(); break;
      case 'respawn': g.respawnHeli(m.i); break;
    }
  }

  // ------------------------------------------------------------ Client empfängt
  onClient(m) {
    const g = this.game;
    switch (m.t) {
      case '_open': this.send({ t: 'hello', name: this.name }); g.onNetStatus('Verbunden – warte auf den Host …'); break;
      case '_fail': g.onNetStatus('Verbindung fehlgeschlagen.', true); this.mode = null; break;
      case '_leave': g.onNetLost(); break;
      case 'welcome':
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
      case 'dmg': if (g.owns(m.i)) g.damageHeli(g.helis[m.i], m.a); break;
      case 'reset': if (g.owns(m.i)) g.respawnHeli(m.i); break;
      case 'radio': g.hud.radio(m.x, m.f, m.u); g.audio.radio(); break;
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
        gu.netYaw = d.g[k][0]; gu.netPitch = d.g[k][1]; gu.ammo = d.g[k][2];
      });
    });
    if (m.U) g.units.applySnapshot(m.U);
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
    g.combat.fire(this._a, this._b, h.vel, true, true);
    g.effects.muzzle(this._a.x + this._b.x * 0.3, this._a.y + this._b.y * 0.3, this._a.z + this._b.z * 0.3, true);
    g.audio.shot('m60', g.camera.position.distanceTo(this._a));
  }
}

export { COLORS };
