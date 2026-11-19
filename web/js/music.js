// Bordmusik (Vietnam): „Walkürenritt“ (Wagner, gemeinfrei) synthetisch erzeugt; eigene Musikdatei (z. B. „Fortunate Son“) wählbar
// Die eigene Datei bleibt nur auf diesem Gerät (IndexedDB) und wird nicht mit dem Spiel ausgeliefert.

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const hz = (n) => {
  const m = /^([A-G]#?)(-?\d)$/.exec(n);
  return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
};
const tr = (n, semi) => {
  const m = /^([A-G]#?)(-?\d)$/.exec(n);
  const v = NOTE[m[1]] + (+m[2] + 1) * 12 + semi;
  const names = Object.keys(NOTE);
  return names[v % 12] + (Math.floor(v / 12) - 1);
};

// Hauptmotiv (9/8): ♪.♬♪ ♩. ♩. – vier Takte, Grundtöne der Dreiklänge aufsteigend
function motif(root, third = 3) {
  const [a, b, c, d, lo] = [root, tr(root, -5), tr(root, third), tr(root, 7), tr(root, -2)];
  // [Note, Dauer in Achteln]
  return [
    [a, 1.5], [b, 0.5], [a, 1], [c, 3], [a, 3],
    [c, 1.5], [a, 0.5], [c, 1], [d, 3], [c, 3],
    [d, 1.5], [c, 0.5], [d, 1], [tr(d, 3), 3], [tr(lo, 0), 3],
    [c, 1.5], [tr(lo, 0), 0.5], [c, 1], [d, 6],
  ];
}

function impulse(ctx, sec) {
  const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

// Arrangement rendern (OfflineAudioContext) – einmalig, danach als Schleife abspielen
async function renderValkyries() {
  const E = 0.125;                       // Achtel in Sekunden
  const BAR = 9 * E;
  // Ablauf: Einleitung (Streicher), Motiv in h-Moll, in D-Dur, h-Moll voll mit Oktave, Fis-Dur-Schluss
  const sections = [
    { root: null, bars: 2 },
    { root: 'B3', bars: 4, chord: ['B', 'D', 'F#'] },
    { root: 'D4', bars: 4, chord: ['D', 'F#', 'A'], third: 4 },
    { root: 'B3', bars: 4, chord: ['B', 'D', 'F#'], full: true },
    { root: 'F#3', bars: 4, chord: ['F#', 'A#', 'C#'], full: true, third: 4 },
  ];
  const total = sections.reduce((s, x) => s + x.bars, 0) * BAR;
  const SR = 32000;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.ceil((total + 0.05) * SR), SR);
  const out = ctx.createGain(); out.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  out.connect(comp).connect(ctx.destination);
  const rev = ctx.createConvolver(); rev.buffer = impulse(ctx, 2.2);
  const revGain = ctx.createGain(); revGain.gain.value = 0.28;
  rev.connect(revGain).connect(out);
  const dry = ctx.createGain(); dry.connect(out); dry.connect(rev);

  // Blechbläser: drei verstimmte Sägezähne, Filter öffnet beim Anblasen
  const brass = (f, t, dur, vol, bright = 1) => {
    const g = ctx.createGain(), flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.Q.value = 1.2;
    const top = Math.min(6000, f * 7 * bright);
    flt.frequency.setValueAtTime(f * 1.4, t);
    flt.frequency.linearRampToValueAtTime(top, t + 0.06);
    flt.frequency.exponentialRampToValueAtTime(Math.max(f * 2.5, top * 0.55), t + Math.max(0.1, dur));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.025);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.03, dur - 0.04));
    g.gain.linearRampToValueAtTime(0, t + dur + 0.07);
    flt.connect(g).connect(dry);
    for (const det of [-6, 0, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      if (dur > 0.5) {                     // Vibrato auf langen Tönen
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(9, t + dur);
        lfo.connect(lg).connect(o.detune); lfo.start(t); lfo.stop(t + dur + 0.1);
      }
      o.connect(flt); o.start(t); o.stop(t + dur + 0.1);
    }
  };
  // Streicher: schnelle aufwärts rauschende Läufe (typische Begleitfigur) pro punktierter Viertel
  const strings = (notes, t, vol) => {
    const g = ctx.createGain(), flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 3800;
    g.gain.value = vol; flt.connect(g).connect(dry);
    const step = E / 2.5;
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), eg = ctx.createGain();
      const s = t + i * step, d = i === notes.length - 1 ? E * 1.6 : step * 1.1;
      o.type = 'sawtooth'; o.frequency.value = f;
      eg.gain.setValueAtTime(0, s); eg.gain.linearRampToValueAtTime(1, s + 0.01); eg.gain.linearRampToValueAtTime(0, s + d);
      o.connect(eg).connect(flt); o.start(s); o.stop(s + d + 0.02);
    });
  };
  // Pauke: tiefer Sinus mit Tonhöhenabfall plus Rauschanteil
  const noiseBuf = ctx.createBuffer(1, SR, SR);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const timp = (f, t, vol) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    o.connect(g).connect(dry); o.start(t); o.stop(t + 1.2);
    const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noiseBuf; nf.type = 'lowpass'; nf.frequency.value = 500;
    ng.gain.setValueAtTime(vol * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    n.connect(nf).connect(ng).connect(dry); n.start(t); n.stop(t + 0.3);
  };
  // tiefer Haltetonbass (Posaunen/Celli)
  const bass = (f, t, dur, vol) => {
    const o = ctx.createOscillator(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f;
    flt.type = 'lowpass'; flt.frequency.value = 420;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.15); g.gain.setValueAtTime(vol, t + dur - 0.1); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(flt).connect(g).connect(dry); o.start(t); o.stop(t + dur + 0.05);
  };

  let t = 0;
  let chord = ['B', 'D', 'F#'];
  for (const sec of sections) {
    if (sec.chord) chord = sec.chord;
    const chordHz = (oct) => chord.map((c) => hz(c + oct));
    // Begleitung: Streicherläufe auf jeder punktierten Viertel, Pauke auf der Eins, Bass liegt
    for (let b = 0; b < sec.bars; b++) {
      const bt = t + b * BAR;
      for (let beat = 0; beat < 3; beat++) {
        const lo = chordHz(4), hi = chordHz(5);
        strings([lo[0], lo[1], lo[2], hi[0], hi[1]], bt + beat * 3 * E, sec.root ? 0.035 : 0.05);
      }
      timp(hz(chord[0] + '2'), bt, 0.55);
      if (b % 2 === 1) timp(hz(chord[2] + '1'), bt + 6 * E, 0.4);
      bass(hz(chord[0] + '2'), bt, BAR, 0.11);
    }
    // Melodie (Auftakt-Sechzehntel vor dem Takt)
    if (sec.root) {
      const m = motif(sec.root, sec.third);
      let mt = t;
      brass(hz(tr(sec.root, -5)), mt - 0.5 * E, 0.5 * E * 0.9, 0.09);
      for (const [n, d] of m) {
        const f = hz(n), dur = d * E * 0.92;
        brass(f, mt, dur, 0.1);
        if (sec.full) { brass(f * 2, mt, dur, 0.05, 0.8); brass(f / 2, mt, dur, 0.06, 0.6); }
        mt += d * E;
      }
    }
    t += sec.bars * BAR;
  }
  return ctx.startRendering();
}

// ---------------------------------------------------------------- eigene Datei (IndexedDB)
const DB = 'hotlz-music', STORE = 'files';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbOp(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode), st = tx.objectStore(STORE);
    const r = fn(st);
    tx.oncomplete = () => res(r && r.result);
    tx.onerror = () => rej(tx.error);
  });
}

export class Music {
  constructor(game) {
    this.g = game;
    this.track = null;        // 'valk' | 'own' | null
    this.valkBuf = null;
    this.own = null;          // { name, blob }
    this.load();
  }

  async load() {
    try { this.own = (await idbOp('readonly', (s) => s.get('own'))) || null; } catch (e) { this.own = null; }
    this.renderUi();
  }

  async setOwn(file) {
    if (!file) return;
    this.own = { name: file.name, blob: file };
    try { await idbOp('readwrite', (s) => s.put({ name: file.name, blob: file }, 'own')); } catch (e) { /* nur für diese Sitzung */ }
    this.renderUi();
  }

  async clearOwn() {
    if (this.track === 'own') this.stop();
    this.own = null;
    try { await idbOp('readwrite', (s) => s.delete('own')); } catch (e) { /* egal */ }
    this.renderUi();
  }

  renderUi() {
    const n = document.getElementById('music-own-name'), c = document.getElementById('btn-music-clear');
    if (n) n.textContent = this.own ? this.own.name : 'keine Datei gewählt';
    if (c) c.classList.toggle('hidden', !this.own);
  }

  // Taste/Knopf: aus → Walkürenritt → eigene Datei (falls vorhanden) → aus
  async toggle() {
    const a = this.g.audio;
    a.init();
    if (!a.ctx) return;
    const next = this.track === null ? 'valk' : this.track === 'valk' && this.own ? 'own' : null;
    this.stop();
    if (!next) { this.g.radio('Bordlautsprecher aus', 'Crew', false, true); this.mark(); return; }
    this.track = next;
    this.mark();
    if (next === 'valk') {
      this.g.radio('Bordlautsprecher: Richard Wagner – „Walkürenritt“', 'Crew', false, true);
      if (!this.valkBuf) {
        try { this.valkBuf = await renderValkyries(); } catch (e) { console.warn(e); this.track = null; this.mark(); return; }
        if (this.track !== 'valk') return;
      }
      this.out = a.ctx.createGain();
      this.out.gain.value = 0.55;
      this.out.connect(a.master);
      const src = (this.src = a.ctx.createBufferSource());
      src.buffer = this.valkBuf; src.loop = true;
      src.connect(this.out); src.start();
    } else {
      this.g.radio(`Bordlautsprecher: ${this.own.name.replace(/\.[^.]+$/, '')}`, 'Crew', false, true);
      const el = (this.el = new Audio());
      this.url = URL.createObjectURL(this.own.blob);
      el.src = this.url; el.loop = true;
      this.out = a.ctx.createGain();
      this.out.gain.value = 0.7;
      this.out.connect(a.master);
      try { a.ctx.createMediaElementSource(el).connect(this.out); } catch (e) { el.volume = a.volume * 0.7; }
      el.play().catch(() => { this.g.radio('Musikdatei kann nicht abgespielt werden', 'Crew', false, true); this.stop(); this.mark(); });
    }
  }

  stop() {
    if (this.src) { try { this.src.stop(); } catch (e) { /* schon gestoppt */ } this.src.disconnect(); this.src = null; }
    if (this.el) { this.el.pause(); this.el.removeAttribute('src'); this.el = null; }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
    if (this.out) { this.out.disconnect(); this.out = null; }
    this.track = null;
  }

  // Pause/Weiterspielen (die eigene Datei läuft nicht über den angehaltenen AudioContext-Takt)
  pause(p) { if (this.el) { if (p) this.el.pause(); else this.el.play().catch(() => {}); } }

  mark() { document.body.classList.toggle('music-on', !!this.track); }
}
