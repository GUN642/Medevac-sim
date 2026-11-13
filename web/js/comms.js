// Kommunikation im Mehrspieler: Text-Chat (über die Spielverbindung) und Sprechfunk (WebRTC über PeerJS).
// Sprechfunk: jeder Teilnehmer meldet eine eigene Peer-ID, alle verbinden sich direkt miteinander (Masche).
// Gesendet wird immer ein WebAudio-Strom; Push-to-talk schaltet nur dessen Lautstärke – keine Neuverhandlung nötig.
import { loadPeerJs, peerOptions } from './net.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Comms {
  constructor(g) {
    this.g = g;
    this.peer = null; this.vid = null; this.state = '';     // '' | 'pending' | 'ready' | 'err'
    this.vids = new Map();        // Spieler-ID -> Sprach-Peer-ID (Host führt die Liste)
    this.calls = new Map();       // Sprach-Peer-ID -> { call, el, nodes }
    this.talking = new Map();     // Spieler-ID -> Name
    this.ptt = false; this.touchPtt = false;
    this.mic = null; this.micState = '';   // '' | 'pending' | 'ok' | 'denied'
    this.warned = {};
    this.el = {
      box: document.getElementById('chat-box'), input: document.getElementById('chat-input'),
      talk: document.getElementById('talk-ind'), ptt: document.getElementById('btn-ptt'),
    };
    this.chatOpen = false;
    const inp = this.el.input;
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.closeChat(true); }
      else if (e.key === 'Escape') { e.preventDefault(); this.closeChat(false); }
      e.stopPropagation();
    });
    inp.addEventListener('blur', () => { if (this.chatOpen) setTimeout(() => this.closeChat(false), 0); });
    document.querySelectorAll('#chat-quick button').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.sendChat(b.textContent); this.closeChat(false); }));
    const p = this.el.ptt;
    if (p) {
      const on = (e) => { e.preventDefault(); e.stopPropagation(); this.touchPtt = true; };
      const off = (e) => { e.preventDefault(); this.touchPtt = false; };
      p.addEventListener('touchstart', on, { passive: false });
      p.addEventListener('touchend', off); p.addEventListener('touchcancel', off);
      p.addEventListener('mousedown', on); window.addEventListener('mouseup', () => { this.touchPtt = false; });
    }
  }

  get active() { return !!(this.g.net && this.g.netReady); }
  myName() { return this.g.net ? this.g.net.name || 'Ich' : 'Ich'; }

  // ------------------------------------------------------------ Text-Chat
  openChat() {
    if (!this.active) return;
    this.g.input.releaseAll();
    this.chatOpen = true;
    this.el.box.classList.remove('hidden');
    this.el.input.value = '';
    this.el.input.focus();
  }

  closeChat(send) {
    if (!this.chatOpen) return;
    this.chatOpen = false;
    if (send) this.sendChat(this.el.input.value);
    this.el.box.classList.add('hidden');
    this.el.input.blur();
  }

  sendChat(text) {
    text = String(text || '').trim().slice(0, 140);
    if (!text || !this.active) return;
    const net = this.g.net;
    this.showChat(this.myName(), text, true);
    if (net.isHost) net.send({ t: 'chat', x: text, n: this.myName(), p: 0 });
    else net.send({ t: 'chat', x: text });
  }

  showChat(name, text, mine = false) {
    this.g.hud.chat(esc(name), esc(text), mine);
    this.g.audio.radio();
  }

  // Host: Chatzeile eines Mitspielers an alle weitergeben
  onHostChat(p, m) {
    const pl = this.g.net.players.get(p);
    const name = pl ? pl.name : 'Spieler';
    const text = String(m.x || '').slice(0, 140);
    if (!text) return;
    this.showChat(name, text);
    this.g.net.send({ t: 'chat', x: text, n: name, p });
  }

  onClientChat(m) { if (m.p !== this.g.myId) this.showChat(String(m.n || '?').slice(0, 16), String(m.x || '').slice(0, 140)); }

  // ------------------------------------------------------------ Sprechfunk
  start() {
    if (this.state || !window.RTCPeerConnection || !navigator.mediaDevices) return;
    this.state = 'pending';
    loadPeerJs().then((Peer) => {
      if (!this.active) { this.state = ''; return; }
      const p = new Peer(undefined, peerOptions());
      this.peer = p;
      p.on('open', (id) => {
        this.vid = id; this.state = 'ready';
        if (this.g.net.isHost) this.setVid(0, id);
        else this.g.net.send({ t: 'vid', v: id });
      });
      p.on('call', (call) => {
        if (![...this.vids.values()].includes(call.peer)) { call.close(); return; }
        call.answer(this.outStream());
        this.wire(call);
      });
      p.on('error', (e) => { if (this.state !== 'ready') this.state = 'err'; if (e && e.type === 'peer-unavailable') { /* Mitspieler weg */ } });
      p.on('disconnected', () => { if (!p.destroyed) setTimeout(() => { try { p.reconnect(); } catch (e) { /* egal */ } }, 2000); });
    }).catch(() => { this.state = 'err'; });
  }

  stop() {
    for (const c of this.calls.values()) this.drop(c);
    this.calls.clear(); this.vids.clear(); this.talking.clear();
    if (this.peer) try { this.peer.destroy(); } catch (e) { /* egal */ }
    this.peer = null; this.vid = null; this.state = '';
    if (this.mic) { this.mic.getTracks().forEach((t) => t.stop()); this.mic = null; this.micState = ''; }
    this.micSrc = null;
    if (this.tx) this.tx.gain.value = 0;
    this.ptt = false;
    this.closeChat(false);
    this.renderTalk();
  }

  ctx() { this.g.audio.init(); return this.g.audio.ctx; }

  // ausgehender Strom: Mikrofon -> Sendeschalter -> MediaStream
  outStream() {
    if (!this.dest) {
      const ctx = this.ctx();
      this.dest = ctx.createMediaStreamDestination();
      this.tx = ctx.createGain();
      this.tx.gain.value = 0;
      this.tx.connect(this.dest);
    }
    return this.dest.stream;
  }

  async getMic() {
    if (this.micState) return;
    this.micState = 'pending';
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.outStream();
      this.micSrc = this.ctx().createMediaStreamSource(this.mic);
      this.micSrc.connect(this.tx);
      this.tx.gain.value = this.ptt ? 1 : 0;
      this.micState = 'ok';
      this.renderTalk();
    } catch (e) {
      this.micState = 'denied';
      this.g.radio('Mikrofon nicht freigegeben – Sprechfunk nur als Empfang. Chat: Taste K bzw. CHAT.', 'Funk', false, true);
    }
  }

  // Host: Liste aller Sprach-IDs pflegen und verteilen
  setVid(p, vid) {
    if (vid) this.vids.set(p, String(vid)); else this.vids.delete(p);
    this.g.net.send({ t: 'vids', l: [...this.vids] });
    this.connectAll();
  }
  dropPlayer(p) { if (this.vids.has(p)) this.setVid(p, null); this.talking.delete(p); this.renderTalk(); }
  onVids(l) {
    this.vids = new Map(Array.isArray(l) ? l : []);
    this.connectAll();
  }

  connectAll() {
    if (this.state !== 'ready') return;
    const want = new Set(this.vids.values());
    for (const [v, c] of this.calls) if (!want.has(v)) { this.drop(c); this.calls.delete(v); }
    // je Paar ruft nur die kleinere ID an
    for (const v of want) if (v !== this.vid && !this.calls.has(v) && this.vid < v) this.wire(this.peer.call(v, this.outStream()));
  }

  wire(call) {
    if (!call) return;
    const old = this.calls.get(call.peer);
    if (old && old.call !== call) this.drop(old);
    const c = { call, el: null, nodes: [] };
    this.calls.set(call.peer, c);
    call.on('stream', (stream) => this.play(c, stream));
    call.on('close', () => { if (this.calls.get(call.peer) === c) { this.drop(c); this.calls.delete(call.peer); } });
    call.on('error', () => {});
  }

  // Empfang mit Funkklang: Bandpass, leichte Sättigung, Rauschteppich nur beim Sprechen (Rauschsperre)
  play(c, stream) {
    const ctx = this.ctx();
    if (c.el) return;
    // Chrome liefert entfernte WebRTC-Töne nur an WebAudio, wenn auch ein (stummes) Audio-Element den Strom hält
    const el = new Audio();
    el.muted = true; el.srcObject = stream;
    el.play().catch(() => {});
    c.el = el;
    const src = ctx.createMediaStreamSource(stream);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2900;
    const sh = ctx.createWaveShaper();
    const n = 256, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
    sh.curve = curve;
    const out = ctx.createGain(); out.gain.value = 1.5;
    src.connect(hp); hp.connect(lp); lp.connect(sh); sh.connect(out); out.connect(this.g.audio.master);
    c.nodes = [src, hp, lp, sh, out];
  }

  drop(c) {
    try { c.call.close(); } catch (e) { /* egal */ }
    for (const n of c.nodes) try { n.disconnect(); } catch (e) { /* egal */ }
    c.nodes = [];
    if (c.el) { c.el.srcObject = null; c.el = null; }
  }

  // Rauschsperre: kurzes Rauschen beim Öffnen/Schließen des Kanals
  squelch(open) {
    const ctx = this.g.audio.ctx;
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * (open ? 0.07 : 0.16));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
    const gn = ctx.createGain(); gn.gain.value = open ? 0.12 : 0.22;
    s.connect(bp); bp.connect(gn); gn.connect(this.g.audio.master);
    s.start();
  }

  onPtt(p, on, name) {
    if (p === this.g.myId) return;
    if (on) this.talking.set(p, name || (this.g.net.players.get(p) || {}).name || 'Spieler');
    else this.talking.delete(p);
    this.squelch(on);
    this.renderTalk();
  }

  // Host: Sprechtaste eines Mitspielers an alle melden
  onHostPtt(p, on) {
    const name = (this.g.net.players.get(p) || {}).name || 'Spieler';
    this.onPtt(p, on, name);
    this.g.net.send({ t: 'ptt', p, on: on ? 1 : 0, n: name });
  }

  renderTalk() {
    const el = this.el.talk;
    if (!el) return;
    const list = [...this.talking.values()].map(esc);
    if (this.ptt) list.unshift(this.micState === 'ok' ? 'Sie senden' : this.micState === 'denied' ? 'kein Mikrofon' : 'Mikrofon …');
    el.innerHTML = list.length ? list.map((n) => `<span>🎙 ${n}</span>`).join('') : '';
    el.classList.toggle('hidden', !list.length);
    if (this.el.ptt) this.el.ptt.classList.toggle('on', this.ptt);
  }

  update() {
    document.body.classList.toggle('mp', this.active);
    if (!this.active) { if (this.state) this.stop(); return; }
    if (!this.state) this.start();
    const want = !this.chatOpen && !!(this.g.input.held('ptt') || this.touchPtt || this.g.settings.openMic);
    if (want === this.ptt) return;
    this.ptt = want;
    if (want) {
      if (this.state === 'err' && !this.warned.net) { this.warned.net = true; this.g.radio('Sprechfunk braucht eine Internetverbindung (Vermittlungsserver nicht erreichbar). Chat geht trotzdem: Taste K bzw. CHAT.', 'Funk', false, true); }
      this.getMic();
    }
    if (this.tx) {
      const t = this.tx.context.currentTime;
      this.tx.gain.cancelScheduledValues(t);
      this.tx.gain.setTargetAtTime(want ? 1 : 0, t, 0.02);
    }
    if (!this.g.settings.openMic) {
      this.squelch(want);
      const net = this.g.net;
      if (net.isHost) net.send({ t: 'ptt', p: 0, on: want ? 1 : 0, n: this.myName() });
      else net.send({ t: 'ptt', on: want ? 1 : 0 });
    }
    this.renderTalk();
  }
}
