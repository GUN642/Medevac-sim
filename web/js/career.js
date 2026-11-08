// Karriere: Einsatztage mit je 4 Aufträgen, Beförderungen schalten weitere Hubschrauber frei, Auszeichnungen.
// Im freien Modus ist alles verfügbar; die Karriere wird getrennt von der allgemeinen Statistik gespeichert.
import { T, HELI_TYPES } from './theme.js';

const KEY = 'dustoff.career.v1';
export const SHIFT = 4;   // Aufträge pro Einsatztag

export const RANKS = [
  [0, 'Warrant Officer 1'], [4000, 'Chief Warrant Officer 2'], [10000, 'Chief Warrant Officer 3'],
  [18000, 'Chief Warrant Officer 4'], [30000, 'Captain'], [45000, 'Major'], [65000, 'Lieutenant Colonel'],
];

// Auszeichnungen: id, Name, Bedingung (st = Karrierestand, e = Ereignis des Auftrags)
const MEDALS = [
  ['first', 'Erster Einsatz', (st) => st.missions >= 1],
  ['air', 'Air Medal (10 Einsätze)', (st) => st.missions >= 10],
  ['air25', 'Air Medal mit Eichenlaub (25 Einsätze)', (st) => st.missions >= 25],
  ['life', 'Lebensretter (25 gerettet)', (st) => st.rescued >= 25],
  ['life100', 'Schutzengel (100 gerettet)', (st) => st.rescued >= 100],
  ['dfc', 'Distinguished Flying Cross (heiße LZ ohne Schaden)', (st, e) => e && e.hot && e.dmg < 1],
  ['auto', 'Goldene Kufe (Autorotation butterweich)', (st, e) => e && e.type === 'auto' && e.vy < 2],
  ['sling', 'Lastenträger (5 Außenlasten)', (st) => (st.types.sling || 0) >= 5],
  ['weather', 'Allwetterpilot (Auftrag bei Gewitter, Schnee oder Nebel)', (st, e) => e && e.badWeather],
  ['night', 'Nachtfalke (5 Nachteinsätze)', (st) => st.night >= 5],
  ['day5', 'Dienstzeitabzeichen (5 Einsatztage)', (st) => st.day > 5],
  ['clean', 'Sicherheitspreis (Einsatztag ohne Verlust)', (st, e) => e && e.cleanShift],
];

export class Career {
  constructor(game) {
    this.g = game;
    this.st = { xp: 0, day: 1, shiftN: 0, shiftScore: 0, shiftLoss: 0, missions: 0, rescued: 0, night: 0, types: {}, medals: [] };
    try { Object.assign(this.st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* privat */ }
  }

  get on() { return !!this.g.settings.career; }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.st)); } catch (e) { /* privat */ } }

  rankIdx(xp = this.st.xp) { let i = 0; RANKS.forEach(([s], k) => { if (xp >= s) i = k; }); return i; }
  rankName(xp) { return RANKS[this.rankIdx(xp)][1]; }
  nextRank() { const i = this.rankIdx(); return RANKS[i + 1] || null; }

  // freigeschaltete Hubschrauber dieser Karte: einer pro Rang (Reihenfolge der Kartenliste)
  unlocked(list = T.helis) { return this.on ? list.slice(0, Math.min(list.length, this.rankIdx() + 1)) : list.slice(); }
  isUnlocked(type) { return this.unlocked().includes(type); }

  // Auftrag beendet: Punkte, Beförderung, Auszeichnungen, Einsatztag. Liefert Zusatzzeilen fürs Ergebnis.
  onResult(r, m, info = {}) {
    if (!this.on) return [];
    const st = this.st, lines = [];
    const rank0 = this.rankIdx();
    st.xp += r.score || 0;
    st.missions++;
    st.shiftN++;
    st.shiftScore += r.score || 0;
    if (m) {
      st.types[m.type] = (st.types[m.type] || 0) + 1;
      if (['medevac', 'csar', 'winch'].includes(m.type) || (m.type === 'ship' && m.variant === 'med')) st.rescued += m.count || 0;
    }
    if (info.night) st.night++;
    const ev = { hot: m && m.hot, dmg: info.dmg ?? 99, type: m && m.type, vy: m && m.drill ? m.drill.vy : 99, badWeather: info.badWeather };
    // Einsatztag beendet
    let shiftDone = false;
    if (st.shiftN >= SHIFT) {
      shiftDone = true;
      const clean = st.shiftLoss === 0;
      ev.cleanShift = clean;
      const bonus = clean ? 300 : 0;
      st.xp += bonus;
      lines.push([`Einsatztag ${st.day} beendet`, `${st.shiftScore + bonus} Punkte`]);
      if (bonus) lines.push(['Ohne Verluste', `+${bonus}`]);
      st.day++; st.shiftN = 0; st.shiftScore = 0; st.shiftLoss = 0;
    } else lines.push([`Einsatztag ${st.day}`, `Auftrag ${st.shiftN}/${SHIFT}`]);
    // Auszeichnungen
    const fresh = [];
    for (const [id, name, ok] of MEDALS) if (!st.medals.includes(id) && ok(st, ev)) { st.medals.push(id); fresh.push(name); }
    for (const n of fresh) lines.push(['Auszeichnung', n]);
    // Beförderung
    const rank1 = this.rankIdx();
    if (rank1 > rank0) {
      lines.push(['BEFÖRDERT', RANKS[rank1][1]]);
      const nu = T.helis[rank1];
      setTimeout(() => {
        this.g.radio(`Kommandeur: Glückwunsch, ${this.g.callsign} – Sie sind ab sofort ${RANKS[rank1][1]}!${nu ? ` Neu für Sie freigegeben: ${HELI_TYPES[nu].short}.` : ''}`, 'Kommandeur');
      }, 2500);
    }
    for (const n of fresh) setTimeout(() => this.g.radio(`Kommandeur: Für Ihren Einsatz erhalten Sie: ${n}.`, 'Kommandeur'), 4500);
    if (shiftDone) setTimeout(() => this.g.radio(`TOC: Einsatztag ${st.day - 1} beendet – gute Arbeit. Kurze Ruhezeit, dann beginnt Einsatztag ${st.day}.`, 'TOC'), 6500);
    const nx = this.nextRank();
    if (nx) lines.push(['Nächster Rang', `${nx[1]} ab ${nx[0]} Punkten (${st.xp})`]);
    this.save();
    return lines;
  }

  onLoss() {
    if (!this.on) return;
    this.st.shiftLoss++;
    this.st.xp = Math.max(0, this.st.xp - 200);
    this.save();
  }

  menuLine() {
    const st = this.st;
    const medals = st.medals.length ? ` · ${st.medals.length} ${st.medals.length === 1 ? 'Auszeichnung' : 'Auszeichnungen'}` : '';
    return `<b>KARRIERE: ${this.rankName()}</b> · Einsatztag ${st.day} (${st.shiftN}/${SHIFT}) · ${st.xp} Punkte${medals}`;
  }

  medalNames() { return MEDALS.filter(([id]) => this.st.medals.includes(id)).map((x) => x[1]); }
}
