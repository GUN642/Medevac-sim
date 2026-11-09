// Funksprüche vorlesen: Android-App über die Sprachausgabe des Geräts (AndroidApp.speak), im Browser per Web Speech API.
// Jeder Sprecher bekommt eine eigene Stimmlage; bei Funkverkehr-Stau werden alte, unwichtige Sprüche verworfen.
import { getLang, tr } from './i18n.js';

const ABBR_DE = [[/\bHLZ\b/g, 'H L Z'], [/\bLZ\b/g, 'L Z'], [/\bFOB\b/g, 'F O B'], [/\bTOC\b/g, 'T O C'], [/\bPOL\b/g, 'P O L'], [/\bMEDEVAC\b/gi, 'Medevac'],
  [/(\d+)\s?kt\b/g, '$1 Knoten'], [/(\d+)\s?km\b/g, '$1 Kilometer'], [/(\d+)\s?m\b/g, '$1 Meter'], [/(\d+)\s?ft\b/g, '$1 Fuß'], [/(\d+)\s?°/g, '$1 Grad'], [/#(\d)/g, 'Nummer $1']];
const ABBR_EN = [[/\bHLZ\b/g, 'H L Z'], [/\bLZ\b/g, 'L Z'], [/\bTOC\b/g, 'T O C'], [/(\d+)\s?kt\b/g, '$1 knots'], [/(\d+)\s?km\b/g, '$1 kilometers'],
  [/(\d+)\s?m\b/g, '$1 meters'], [/(\d+)\s?ft\b/g, '$1 feet'], [/(\d+)\s?°/g, '$1 degrees'], [/#(\d)/g, 'number $1']];

export class Voice {
  constructor(game) {
    this.g = game;
    this.queue = 0;
    this.native = !!(window.AndroidApp && window.AndroidApp.speak);
    this.web = !this.native && 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.voices = [];
    if (this.web) {
      const load = () => { this.voices = this.web.getVoices(); };
      load();
      try { this.web.addEventListener('voiceschanged', load); } catch (e) { /* alte Browser */ }
    }
  }

  get on() { return this.g.settings.tts !== false && (this.native || this.web); }

  // Stimmlage je Sprecher (gleicher Sprecher = gleiche Stimme), tief für eine männliche Stimme
  pitchFor(from) {
    let h = 0;
    for (const c of from || 'x') h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return 0.78 + (h % 6) * 0.04;
  }

  // männliche Stimme der Sprache bevorzugen
  maleVoice(lang) {
    const key = lang.slice(0, 2);
    if (this._male && this._male.k === key && this.voices.length === this._male.n) return this._male.v;
    const list = this.voices.filter((x) => x.lang && x.lang.toLowerCase().startsWith(key));
    const male = /\bmale\b|männlich|stefan|hans|markus|conrad|klaus|jonas|florian|daniel|david|mark|guy|ryan|christopher|eric|brian|james|george|alex|fred|thomas/i;
    const female = /female|weiblich|anna|petra|katja|hedda|marlene|vicki|zira|samantha|susan|aria|jenny|libby|sonia|karen|moira|tessa|helena|amala|seraphina/i;
    const v = list.find((x) => male.test(x.name) && !female.test(x.name)) || list.find((x) => !female.test(x.name)) || list[0] || null;
    this._male = { k: key, n: this.voices.length, v };
    return v;
  }

  clean(text) {
    const en = getLang() === 'en';
    let t = en ? tr(text) : text;
    t = t.replace(/[„“"»«]/g, '').replace(/\s[–—-]\s/g, ', ').replace(/…/g, '.').replace(/\s+/g, ' ').trim();
    for (const [re, rp] of en ? ABBR_EN : ABBR_DE) t = t.replace(re, rp);
    return t;
  }

  say(text, from = '', urgent = false) {
    if (!this.on || !text || this.g.state === 'menu') return;
    const lang = getLang() === 'en' ? 'en-US' : 'de-DE';
    const t = this.clean(text), pitch = this.pitchFor(from), rate = urgent ? 1.18 : 1.08;
    if (this.native) {
      try { window.AndroidApp.speak(t, lang, rate, pitch, !!urgent); } catch (e) { /* ohne Sprachausgabe */ }
      return;
    }
    const w = this.web;
    // Stau: Dringendes unterbricht, sonst höchstens zwei Sprüche in der Warteschlange
    if (urgent) w.cancel();
    else if (w.pending && this.queue >= 2) return;
    const u = new SpeechSynthesisUtterance(t);
    u.lang = lang; u.rate = rate; u.pitch = pitch; u.volume = Math.min(1, (this.g.settings.volume ?? 0.8) + 0.2);
    const v = this.maleVoice(lang);
    if (v) u.voice = v;
    this.queue++;
    u.onend = u.onerror = () => { this.queue = Math.max(0, this.queue - 1); };
    w.speak(u);
  }

  stop() {
    try { if (this.native) window.AndroidApp.speak('', 'de-DE', 1, 1, true); else if (this.web) this.web.cancel(); } catch (e) { /* egal */ }
    this.queue = 0;
  }
}
