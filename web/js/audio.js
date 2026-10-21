// Synthetischer Sound über Web Audio (keine externen Dateien nötig)
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.voices = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    this.buffers = {
      rotor: this.makeRotor(),
      m60: this.makeShot(0.22, 1400, 35, 0.9),
      ak: this.makeShot(0.18, 2200, 40, 0.6),
      dshk: this.makeShot(0.35, 700, 18, 1.0),
      m16: this.makeShot(0.16, 2600, 45, 0.5),
      shotgun: this.makeShot(0.4, 1100, 14, 1.2),
      pistol: this.makeShot(0.14, 2000, 50, 0.4),
      thump: this.makeShot(0.2, 400, 25, 1.4),
      click: this.makeShot(0.03, 6000, 200, 0),
      hit: this.makePing(),
      boom: this.makeBoom(),
      squelch: this.makeSquelch(),
      noise: this.makeNoise(2),
    };

    // Rotor
    this.rotorSrc = ctx.createBufferSource();
    this.rotorSrc.buffer = this.buffers.rotor;
    this.rotorSrc.loop = true;
    this.rotorFilter = ctx.createBiquadFilter();
    this.rotorFilter.type = 'lowpass';
    this.rotorFilter.frequency.value = 900;
    this.rotorGain = ctx.createGain();
    this.rotorGain.gain.value = 0;
    this.rotorSrc.connect(this.rotorFilter).connect(this.rotorGain).connect(this.master);
    this.rotorSrc.start();
    // Turbine
    this.turb = ctx.createOscillator();
    this.turb.type = 'sawtooth';
    this.turb.frequency.value = 600;
    this.turbFilter = ctx.createBiquadFilter();
    this.turbFilter.type = 'bandpass';
    this.turbFilter.frequency.value = 2400;
    this.turbFilter.Q.value = 3;
    this.turbGain = ctx.createGain();
    this.turbGain.gain.value = 0;
    this.turb.connect(this.turbFilter).connect(this.turbGain).connect(this.master);
    this.turb.start();
    const ns = ctx.createBufferSource();
    ns.buffer = this.buffers.noise;
    ns.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 3000;
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    ns.connect(nf).connect(this.whineGain).connect(this.master);
    ns.start();
    // Wind
    const ws = ctx.createBufferSource();
    ws.buffer = this.buffers.noise;
    ws.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 500;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    ws.connect(this.windFilter).connect(this.windGain).connect(this.master);
    ws.start();
    // Warnton
    this.warnOsc = ctx.createOscillator();
    this.warnOsc.type = 'square';
    this.warnOsc.frequency.value = 880;
    this.warnGain = ctx.createGain();
    this.warnGain.gain.value = 0;
    this.warnOsc.connect(this.warnGain).connect(this.master);
    this.warnOsc.start();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  makeNoise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  makeRotor() {
    // 2-Blatt-Rotor: ca. 10,8 Blattdurchgänge pro Sekunde ("Whop-Whop")
    const sr = this.ctx.sampleRate;
    const pulses = 22, period = 1 / 10.8;
    const len = Math.floor(sr * period * pulses);
    const b = this.ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const ph = (t % period) / period;
      const env = Math.exp(-ph * 9) * (ph < 0.02 ? ph / 0.02 : 1);
      const n = Math.random() * 2 - 1;
      lp += (n - lp) * 0.08;
      const thump = Math.sin(2 * Math.PI * 62 * (t % period)) * Math.exp(-ph * 7);
      d[i] = (lp * 2.2 * env + thump * 0.8 * env) * 0.55 + lp * 0.12;
    }
    return b;
  }

  makeShot(dur, cutoff, decay, thumpAmt) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * dur);
    const b = this.ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    let lp = 0;
    const k = Math.min(1, (2 * Math.PI * cutoff) / sr);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      lp += (Math.random() * 2 - 1 - lp) * k;
      const env = Math.exp(-t * decay);
      d[i] = (lp * 1.6 + Math.sin(2 * Math.PI * 90 * t) * thumpAmt * Math.exp(-t * 30)) * env;
    }
    return b;
  }

  makePing() {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 0.25);
    const b = this.ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      d[i] = (Math.sin(2 * Math.PI * 2300 * t) * 0.5 + Math.sin(2 * Math.PI * 3700 * t) * 0.3 + (Math.random() * 2 - 1) * Math.exp(-t * 200)) * Math.exp(-t * 22);
    }
    return b;
  }

  makeBoom() {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 2.5);
    const b = this.ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      lp += (Math.random() * 2 - 1 - lp) * 0.03;
      d[i] = (lp * 3 + Math.sin(2 * Math.PI * 40 * t) * Math.exp(-t * 4)) * Math.exp(-t * 1.6);
    }
    return b;
  }

  makeSquelch() {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 0.22);
    const b = this.ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const tone = t < 0.07 ? Math.sin(2 * Math.PI * 1400 * t) * 0.4 : 0;
      d[i] = (tone + (Math.random() * 2 - 1) * 0.35 * (t > 0.06 ? Math.exp(-(t - 0.06) * 18) : 0));
    }
    return b;
  }

  play(name, { gain = 1, rate = 1, delay = 0, lowpass = 0 } = {}) {
    if (!this.ctx || this.voices > 28) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffers[name];
    s.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    let node = s;
    if (lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(this.sfx);
    this.voices++;
    s.onended = () => { this.voices--; };
    s.start(this.ctx.currentTime + delay);
  }

  // Schuss mit Entfernungsdämpfung
  shot(type, dist) {
    const g = Math.min(1, 40 / Math.max(10, dist));
    if (g < 0.02) return;
    const delay = Math.min(1.5, dist / 343);
    this.play(type, { gain: g * (type === 'm60' ? 0.55 : type === 'click' ? 0.3 : 0.9), rate: 0.92 + Math.random() * 0.16, delay, lowpass: dist > 150 ? 1800 : 0 });
  }
  hit() { this.play('hit', { gain: 0.6, rate: 0.8 + Math.random() * 0.5 }); }
  boom(dist = 0) { this.play('boom', { gain: Math.min(1, 200 / Math.max(50, dist)), delay: Math.min(2, dist / 343) }); }
  radio() { this.play('squelch', { gain: 0.5 }); }

  update(h, inside, warn, time, dist = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const far = Math.min(1, 30 / Math.max(30, dist));
    const rpm = h.rpm;
    const load = h.thrustFrac;
    this.rotorSrc.playbackRate.setTargetAtTime(Math.max(0.2, rpm * (0.96 + load * 0.08)), t, 0.1);
    this.rotorGain.gain.setTargetAtTime(h.crashed ? 0 : rpm * (0.35 + load * 0.5) * (inside ? 0.8 : 1) * far, t, 0.1);
    this.rotorFilter.frequency.setTargetAtTime(inside ? 700 : 1200 + load * 1500, t, 0.1);
    const eng = h.engineOn && !h.crashed ? 1 : 0;
    this.turb.frequency.setTargetAtTime(380 + rpm * 520 * (0.9 + load * 0.2), t, 0.2);
    this.turbGain.gain.setTargetAtTime(eng * rpm * (inside ? 0.05 : 0.035) * far, t, 0.2);
    this.whineGain.gain.setTargetAtTime(eng * rpm * 0.05 * far, t, 0.2);
    const sp = h.vel.length();
    this.windGain.gain.setTargetAtTime(dist > 5 ? 0 : Math.min(0.35, sp / 160) * (inside ? 0.6 : 1), t, 0.2);
    this.windFilter.frequency.setTargetAtTime(300 + sp * 15, t, 0.2);
    const beep = warn && (Math.floor(time * 4) % 2 === 0) ? 0.05 : 0;
    this.warnGain.gain.setTargetAtTime(beep, t, 0.01);
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}
