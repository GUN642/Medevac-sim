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

  // Stimmlage je Sprecher (gleicher Sprecher = gleiche Stimme)
  pitchFor(from) {
    let h = 0;
    for (const c of from || 'x') h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return 0.8 + (h % 9) * 0.06;
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
    const v = this.voices.filter((x) => x.lang && x.lang.toLowerCase().startsWith(lang.slice(0, 2)));
    if (v.length) u.voice = v[Math.floor(pitch * 100) % v.length];
    this.queue++;
    u.onend = u.onerror = () => { this.queue = Math.max(0, this.queue - 1); };
    w.speak(u);
  }

  stop() {
    try { if (this.native) window.AndroidApp.speak('', 'de-DE', 1, 1, true); else if (this.web) this.web.cancel(); } catch (e) { /* egal */ }
    this.queue = 0;
  }
}
