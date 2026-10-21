// Auftragserzeugung und -ablauf: MEDEVAC, Truppentransport, CSAR
import * as THREE from './lib/three.module.min.js';
import { FOB_NAME, CALLSIGN, HELI } from './config.js';
import { rand, clamp, bearing, dirName, fmtDist, fmtBearing, dist2 } from './util.js';
import { wreckParts, merge, vcMat } from './models.js';

const UNITS = [
  'Bravo 6, 2/7. Kavallerie', 'Charlie 3, 1/5. Kavallerie', 'Alpha 2, 2/12. Infanterie', 'Delta 6, 1/8. Kavallerie',
  'Tiger 4, Fernspäher-Team', 'Echo 1, 173. Luftlandebrigade', 'Raider 2, 1/327. Infanterie', 'Mustang 5, 3/21. Infanterie',
];
const SMOKES = ['gelb', 'rot', 'grün', 'violett'];
const SMOKE_ADJ = { gelb: 'Gelber', rot: 'Roter', grün: 'Grüner', violett: 'Violetter' };
const AIRCRAFT = [
  { kind: 'f4', name: 'F-4 Phantom', crew: 2, call: 'Gunfighter 2' },
  { kind: 'o1', name: 'O-1 Bird Dog', crew: 2, call: 'Bird Dog 1-4' },
  { kind: 'huey', name: 'UH-1H Huey', crew: 4, call: 'Gladiator 2-6' },
  { kind: 'a1', name: 'A-1 Skyraider', crew: 1, call: 'Sandy 3' },
];

export class Missions {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.phase = 'none';
    this.count = 0;
    this.nextTimer = -1;
    this.stale = [];
    this.lastSite = null;
    this.unloadT = 0;
  }

  fobPoint(pad) {
    const f = this.game.world.fob;
    return { name: `${FOB_NAME} – Pad ${pad.name}`, short: `Pad ${pad.name}`, x: pad.x, z: pad.z, y: f.y, kind: 'fob', pad, radius: 16 };
  }
  sitePoint(site) {
    return { name: site.name, short: site.name, x: site.x, z: site.z, y: site.y, kind: 'site', site, radius: 65 };
  }

  pickSite(exclude = []) {
    const w = this.game.world;
    const maxD = 1800 + this.count * 250;
    let cands = w.sites.filter((s) => s !== this.lastSite && !exclude.includes(s) && dist2(s.x, s.z, w.fob.x, w.fob.z) < maxD);
    if (cands.length < 2) cands = w.sites.filter((s) => s !== this.lastSite && !exclude.includes(s));
    const s = rand.pick(cands);
    this.lastSite = s;
    return s;
  }

  // ------------------------------------------------------------ Erzeugen
  generate() {
    const g = this.game, w = g.world;
    this.count++;
    const r = rand();
    const type = this.count === 1 ? 'medevac' : r < 0.5 ? 'medevac' : r < 0.78 ? 'transport' : 'csar';
    const hotChance = clamp(0.3 + this.count * 0.05, 0.3, 0.7);
    const m = {
      id: 'M' + this.count + '_' + Math.floor(rand() * 1e6), num: this.count, type,
      smoke: rand.pick(SMOKES), unit: rand.pick(UNITS), boarded: 0, delivered: 0,
      smokePopped: {}, hotWarned: false, revealed: true, emitters: [],
    };
    if (type === 'medevac') {
      const site = this.pickSite();
      m.title = 'MEDEVAC';
      m.from = this.sitePoint(site);
      m.to = this.fobPoint(w.fob.pads.med);
      m.count = rand.int(1, Math.min(6, 2 + Math.floor(this.count / 2)));
      m.litters = Math.round(m.count * rand.range(0.25, 0.75));
      m.walking = m.count - m.litters;
      m.hot = rand() < hotChance;
      m.hotAt = m.hot ? 'from' : null;
    } else if (type === 'transport') {
      const v = rand.int(0, 2);
      m.title = 'TRUPPENTRANSPORT';
      m.count = rand.int(4, 10);
      if (v === 0) {
        m.from = this.fobPoint(w.fob.pads.troop);
        m.to = this.sitePoint(this.pickSite());
        m.variant = 'Verstärkung';
        m.hot = rand() < hotChance * 0.8;
        m.hotAt = m.hot ? 'to' : null;
      } else if (v === 1) {
        m.from = this.sitePoint(this.pickSite());
        m.to = this.fobPoint(w.fob.pads.troop);
        m.variant = 'Ablösung';
        m.hot = rand() < hotChance * 0.6;
        m.hotAt = m.hot ? 'from' : null;
      } else {
        const a = this.pickSite();
        let b = null;
        const cands = w.sites.filter((s) => s !== a && dist2(s.x, s.z, a.x, a.z) > 900 && dist2(s.x, s.z, a.x, a.z) < 2600);
        b = cands.length ? rand.pick(cands) : this.pickSite([a]);
        m.from = this.sitePoint(a);
        m.to = this.sitePoint(b);
        m.variant = 'Umgruppierung';
        m.hot = rand() < hotChance * 0.7;
        m.hotAt = m.hot ? (rand() < 0.5 ? 'from' : 'to') : null;
      }
    } else {
      const ac = rand.pick(AIRCRAFT);
      const site = this.pickSite();
      m.title = 'CSAR';
      m.aircraft = ac;
      m.unit = ac.call;
      m.from = this.sitePoint(site);
      m.to = this.fobPoint(w.fob.pads.med);
      m.count = ac.crew;
      m.hot = rand() < 0.6;
      m.hotAt = m.hot ? 'from' : null;
      m.revealed = false;
      const a = rand() * Math.PI * 2, d = 220 + rand() * 180;
      m.approx = { x: site.x + Math.cos(a) * d, z: site.z + Math.sin(a) * d };
    }
    this.current = m;
    this.phase = 'briefing';
    g.hud.showBriefing(m, this.describe(m));
    g.audio.radio();
    this.changed();
  }

  // Host: geänderten Auftrag an die Mitspieler senden
  changed() { if (this.game.net && this.game.role === 'host') this.game.net.sendMission(); }

  describe(m) {
    const g = this.game, h = g.heli, w = g.world;
    const tgt = m.type === 'csar' && !m.revealed ? m.approx : m.from;
    const b = bearing(h.pos.x, h.pos.z, tgt.x, tgt.z);
    const d = dist2(h.pos.x, h.pos.z, tgt.x, tgt.z);
    const rows = [];
    let radio = '';
    const hotTxt = m.hot ? 'HEISS – Feindkontakt!' : 'KALT – keine Feindberührung';
    if (m.type === 'medevac') {
      rows.push(['Auftrag', 'Verwundetenbergung (Dustoff)']);
      rows.push(['Aufnahme', `${m.from.name} · Planquadrat ${w.gridRef(m.from.x, m.from.z)}`]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(b)} (${dirName(b)}) · ${fmtDist(d)}`]);
      rows.push(['Verwundete', `${m.count} (${m.litters} liegend, ${m.walking} gehfähig)`]);
      rows.push(['LZ-Status', hotTxt, m.hot ? 'hot' : 'cold']);
      rows.push(['Markierung', `${SMOKE_ADJ[m.smoke]} Rauch`]);
      rows.push(['Ablieferung', `${FOB_NAME} – Lazarett (Pad MED)`]);
      radio = `„${CALLSIGN}, hier ${m.unit}. Wir haben ${m.count === 1 ? 'einen Verwundeten' : m.count + ' Verwundete'}${m.litters && m.count > 1 ? `, davon ${m.litters} ${m.litters === 1 ? 'Tragefall' : 'Tragefälle'}` : m.litters ? ' (Tragefall)' : ''}. ${m.hot ? 'Wir stehen unter Beschuss!' : 'Die Lage ist ruhig.'} Erbitten sofortige Evakuierung bei ${m.from.name}.“`;
    } else if (m.type === 'transport') {
      const b2 = bearing(m.from.x, m.from.z, m.to.x, m.to.z), d2 = dist2(m.from.x, m.from.z, m.to.x, m.to.z);
      rows.push(['Auftrag', `Truppentransport (${m.variant})`]);
      rows.push(['Punkt A – Aufnahme', m.from.name]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(b)} (${dirName(b)}) · ${fmtDist(d)}`]);
      rows.push(['Punkt B – Absetzen', `${m.to.name} · ${fmtBearing(b2)} · ${fmtDist(d2)} ab A`]);
      rows.push(['Soldaten', `${m.count}`]);
      rows.push(['LZ-Status', m.hot ? `HEISS bei ${m.hotAt === 'from' ? 'Punkt A' : 'Punkt B'}!` : 'KALT – beide LZs ruhig', m.hot ? 'hot' : 'cold']);
      if (m.to.kind === 'site' || m.from.kind === 'site') rows.push(['Markierung', `${SMOKE_ADJ[m.smoke]} Rauch`]);
      radio = `„${CALLSIGN}, hier TOC ${FOB_NAME}. ${m.count} Soldaten von ${m.from.short} nach ${m.to.short} verbringen.${m.hot ? ' Rechnen Sie mit Feindfeuer!' : ''}“`;
    } else {
      rows.push(['Auftrag', 'Bergung abgeschossener Besatzung']);
      rows.push(['Maschine', `${m.aircraft.name} („${m.aircraft.call}“)`]);
      rows.push(['Absturzort (ca.)', `Planquadrat ${w.gridRef(m.approx.x, m.approx.z)} – Suchradius 400 m`]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(b)} (${dirName(b)}) · ca. ${fmtDist(d)}`]);
      rows.push(['Besatzung', `${m.count} Überlebende`]);
      rows.push(['LZ-Status', m.hot ? 'HEISS – Feind in der Nähe!' : 'KALT – unklar, Vorsicht', m.hot ? 'hot' : 'cold']);
      rows.push(['Markierung', `${SMOKE_ADJ[m.smoke]} Rauch, sobald sie Sie hören`]);
      rows.push(['Ablieferung', `${FOB_NAME} – Pad MED`]);
      radio = `„Mayday, Mayday! ${m.aircraft.call} ist runter! ${m.count === 1 ? 'Pilot ist' : 'Besatzung ist'} am Boden. Achten Sie auf die Rauchsäule des Wracks.“`;
    }
    const need = this.fuelNeeded(m);
    if (g.heli.fuel < need) rows.push(['Hinweis', `Treibstoff knapp (${Math.round(g.heli.fuel)} %, benötigt ca. ${Math.round(need)} %) – vorher am Tankwagen (POL) tanken!`, 'hot']);
    return { title: `AUFTRAG #${m.num} – ${m.title}`, rows, radio, hot: m.hot };
  }

  // grobe Schätzung des Treibstoffbedarfs in %
  fuelNeeded(m) {
    const h = this.game.heli;
    const d = dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) + dist2(m.from.x, m.from.z, m.to.x, m.to.z) + (m.to.kind === 'site' ? dist2(m.to.x, m.to.z, this.game.world.fob.x, this.game.world.fob.z) : 0);
    return (d / 48) * 0.135 + 12;
  }

  // ------------------------------------------------------------ Annahme
  accept() {
    const m = this.current;
    if (!m || this.phase !== 'briefing') return;
    const g = this.game, U = g.units, w = g.world;
    if (g.role === 'client') { g.net.send({ t: 'accept', id: m.id }); g.hud.hideBriefing(); return; }
    this.phase = 'active';
    m.acceptTime = g.time;
    m.damage0 = this.teamDamage();
    g.hud.hideBriefing();

    // Passagiere an Punkt A
    const kinds = [];
    if (m.type === 'medevac') { for (let i = 0; i < m.litters; i++) kinds.push('litter'); for (let i = 0; i < m.walking; i++) kinds.push('walking'); }
    else if (m.type === 'csar') for (let i = 0; i < m.count; i++) kinds.push('pilot');
    else for (let i = 0; i < m.count; i++) kinds.push('troop');
    kinds.forEach((k, i) => {
      let x, z;
      if (m.from.kind === 'fob') { x = m.from.x + 17 + (i % 3) * 1.6; z = m.from.z - 4 + Math.floor(i / 3) * 1.8; }
      else { const a = rand() * Math.PI * 2, r = 6 + rand() * 12; x = m.from.x + Math.cos(a) * r; z = m.from.z + Math.sin(a) * r; }
      U.spawnPassenger(k, x, z, m.id);
    });
    // Verteidiger
    for (const end of ['from', 'to']) {
      const p = m[end];
      if (p.kind !== 'site') continue;
      if (m.type === 'csar') continue;
      const def = U.spawnDefenders(p, 4 + Math.floor(rand() * 4), m.id);
      if (m.hotAt === end) for (const d of def) d.engage = true;
    }
    // Feind
    if (m.hot) {
      const p = m[m.hotAt];
      const n = 12 + Math.floor(rand() * 8) + Math.min(8, Math.floor(this.count / 2)) + (g.helis.length > 1 ? 5 : 0);
      const en = U.spawnEnemies(p.x, p.z, n, { missionId: m.id, heavy: rand() < 0.3 + this.count * 0.02 });
      let sx = 0, sz = 0;
      for (const e of en) { sx += e.x; sz += e.z; }
      m.enemyDir = dirName(bearing(p.x, p.z, sx / en.length, sz / en.length));
    }
    // Auch an „kalten“ LZs lauern ein paar Späher weiter draußen
    for (const end of ['from', 'to']) {
      const p = m[end];
      if (p.kind !== 'site' || m.hotAt === end) continue;
      U.spawnEnemies(p.x, p.z, 2 + Math.floor(rand() * 3), { missionId: m.id, rMin: 260, rMax: 420 });
    }
    // Wrack
    if (m.type === 'csar') {
      const a = rand() * Math.PI * 2;
      m.wreckInfo = { x: m.from.x + Math.cos(a) * 30, z: m.from.z + Math.sin(a) * 30, r: rand() * 6 };
      this.buildWreck(m);
    }
    g.radio(this.describe(m).radio, m.unit);
    if (m.from.kind === 'fob') g.radio(`TOC: Die Truppe wartet neben Pad ${m.from.pad.name}. Landen Sie dort zum Aufnehmen.`, 'TOC');
    this.changed();
  }

  buildWreck(m) {
    const g = this.game, w = g.world, wi = m.wreckInfo;
    m.wreck = new THREE.Mesh(merge(wreckParts(m.aircraft.kind)), vcMat);
    m.wreck.position.set(wi.x, w.height(wi.x, wi.z) - 0.1, wi.z);
    m.wreck.rotation.y = wi.r;
    g.scene.add(m.wreck);
    m.emitters.push(g.effects.wreckFire(wi.x, w.height(wi.x, wi.z), wi.z));
  }

  teamDamage() { return this.game.helis.reduce((s, h) => s + h.damageTaken, 0); }
  paxOf(h, m = this.current) { return m ? h.passengers.filter((p) => p.missionId === m.id).length : 0; }

  // ------------------------------------------------------------ Laufzeit
  boardRadius() {
    const m = this.current;
    return m && m.from.kind === 'fob' ? 42 : 75;
  }

  canBoard(h) {
    const m = this.current;
    if (!m || this.phase !== 'active' || !h || h.crashed || !h.onGround) return false;
    if (m.boarded >= m.count || this.game.heliLoad(h) >= HELI.capacity) return false;
    return dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) < this.boardRadius();
  }

  onBoard(u, h) {
    const m = this.current, g = this.game;
    if (!m) return;
    h.addPassenger({ type: u.paxType, missionId: m.id });
    m.boarded++;
    if (m.boarded === 1 && m.count > 1) g.radio(`Crew: Erster ist an Bord! Noch ${m.count - 1}.`, 'Crew');
    if (m.boarded >= m.count) {
      const to = m.to;
      const b = bearing(h.pos.x, h.pos.z, to.x, to.z);
      const what = m.type === 'medevac' ? 'Alle Verwundeten' : m.type === 'csar' ? 'Alle Überlebenden' : 'Alle Soldaten';
      g.radio(`Crew: ${what} an Bord – los, los, los! Kurs ${fmtBearing(b)} nach ${to.name}.`, 'Crew');
    } else if (g.heliLoad(h) >= HELI.capacity) g.radio('Crew: Kabine voll! Der Rest muss mit dem zweiten Hubschrauber mit.', 'Crew');
    this.changed();
  }

  // Ziel für einen Hubschrauber: mit Passagieren zum Absetzpunkt, sonst zur Aufnahme
  target(h = this.game.heli) {
    const m = this.current;
    if (!m || this.phase !== 'active') return null;
    if (m.boarded < m.count && this.game.heliLoad(h) < HELI.capacity) {
      if (this.paxOf(h) === 0) return 'from';
      // noch beim Einsteigen: am Aufnahmeort bleiben
      if (h.contact && dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) < this.boardRadius()) return 'from';
    }
    if (this.paxOf(h) > 0 || m.boarded >= m.count) return 'to';
    return 'from';
  }

  waypoint(h = this.game.heli) {
    const m = this.current;
    const t = this.target(h);
    if (!t) return null;
    if (t === 'from') {
      if (m.type === 'csar' && !m.revealed) return { x: m.approx.x, z: m.approx.z, y: this.game.world.height(m.approx.x, m.approx.z), label: 'Suchgebiet', radius: 400, approx: true };
      return { x: m.from.x, z: m.from.z, y: m.from.y, label: m.from.short, radius: m.from.kind === 'fob' ? 12 : 45 };
    }
    return { x: m.to.x, z: m.to.z, y: m.to.y, label: m.to.short, radius: m.to.kind === 'fob' ? 12 : 45 };
  }

  update(dt) {
    const g = this.game, m = this.current, helis = g.helis;
    // alte Einsätze aufräumen, wenn alle Hubschrauber weit genug weg sind
    for (let i = this.stale.length - 1; i >= 0; i--) {
      const s = this.stale[i];
      if (s.points.every((p) => helis.every((h) => dist2(p.x, p.z, h.pos.x, h.pos.z) > 1300))) { this.cleanup(s.m); this.stale.splice(i, 1); }
    }
    if (g.role === 'client') { this.updateMirror(); return; }
    if (this.nextTimer > 0) {
      this.nextTimer -= dt;
      if (this.nextTimer <= 0) this.generate();
    }
    if (!m || this.phase !== 'active') return;
    for (const h of helis) {
      if (h.crashed) continue;
      const end = this.target(h);
      const p = m[end];
      const d = dist2(h.pos.x, h.pos.z, p.x, p.z);
      // Rauch werfen bei Annäherung
      if (p.kind === 'site' && d < 1300 && !m.smokePopped[end] && (m.type !== 'csar' || end !== 'from' || m.revealed)) {
        m.smokePopped[end] = true;
        m.emitters.push(g.effects.smokeGrenade(p.x + 4, g.world.height(p.x + 4, p.z), p.z, m.smoke));
        const who = m.type === 'csar' ? m.aircraft.call : m.unit.split(',')[0];
        g.radio(`${who}: ${CALLSIGN}, wir hören Sie! Rauch ist geworfen – bestätigen Sie ${m.smoke}.`, who);
        setTimeout(() => g.radio(`${CALLSIGN}: Sehe ${m.smoke}en Rauch, wir kommen rein.`, CALLSIGN), 2500);
        this.changed();
      }
      if (m.hot && m.hotAt === end && !m.hotWarned && d < 1900) {
        m.hotWarned = true;
        g.radio(`${m.type === 'csar' ? m.aircraft.call : m.unit.split(',')[0]}: Achtung, die LZ ist HEISS! Feindfeuer aus Richtung ${m.enemyDir || 'Baumlinie'}!`, 'Funk', true);
      }
      if (m.type === 'csar' && !m.revealed && dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) < 950) {
        m.revealed = true;
        g.radio(`${m.aircraft.call}: Wir sehen einen Hubschrauber! Wir sind ${dirName(bearing(h.pos.x, h.pos.z, m.from.x, m.from.z))} von ihm auf der Lichtung!`, m.aircraft.call);
        this.changed();
      }
      // Absetzen
      if (end === 'to' && this.paxOf(h) > 0) {
        const near = h.onGround && dist2(h.pos.x, h.pos.z, m.to.x, m.to.z) < (m.to.kind === 'fob' ? 28 : 75);
        if (near && !h.unloading) {
          h.unloading = true;
          h.unloadT = 0.6;
          g.radio(m.to.kind === 'fob' && m.type !== 'transport' ? 'Sanitäter: Wir übernehmen! Bringt sie ins Lazarett!' : 'Crew: Absetzen – alle raus!', m.to.kind === 'fob' ? 'Sanitäter' : 'Crew');
        }
        if (!near) h.unloading = false;
        if (h.unloading) {
          h.unloadT -= dt;
          if (h.unloadT <= 0) { h.unloadT = 0.7; this.unloadOne(h); }
        }
      } else h.unloading = false;
    }
    if (m.delivered >= m.count) this.complete();
  }

  unloadOne(h) {
    const g = this.game, m = this.current;
    const idx = h.passengers.findIndex((p) => p.missionId === m.id);
    if (idx < 0) return;
    const p = h.passengers.splice(idx, 1)[0];
    h.updatePassengerDisplay();
    const from = h.doorPoint(m.delivered % 2 ? 'left' : 'right');
    const f = g.world.fob;
    let target, onArrive = null;
    if (m.to.kind === 'fob') {
      target = m.type === 'transport' ? { x: f.x - 100 + rand() * 20, z: f.z + 40 + rand() * 30 } : { x: f.hospitalDoor.x + rand.range(-1, 1), z: f.hospitalDoor.z };
    } else {
      const a = rand() * Math.PI * 2, r = 25 + rand() * 12;
      target = { x: m.to.x + Math.cos(a) * r, z: m.to.z + Math.sin(a) * r };
      const id = m.id, eng = m.hotAt === 'to';
      onArrive = (u) => {
        g.units.setPose(u, 1);
        Object.assign(u, { missionId: id, engage: eng, fireT: rand() * 2, burst: 0, shotT: 0 });
        g.units.friendlies.push(u);
      };
    }
    g.units.spawnWalker(p.type, from, target, onArrive);
    m.delivered++;
    if (m.type === 'medevac' || m.type === 'csar') g.stats.rescued++; else g.stats.transported++;
    this.changed();
  }

  complete() {
    const g = this.game, m = this.current;
    this.phase = 'done';
    const elapsed = g.time - m.acceptTime;
    const base = m.count * 100;
    const mult = (m.hot ? 1.5 : 1) * (m.type === 'csar' ? 1.3 : 1);
    const timeBonus = Math.max(0, Math.round(300 - elapsed));
    const dmg = this.teamDamage() - m.damage0;
    const dmgBonus = dmg < 1 ? 150 : 0;
    const score = Math.round(base * mult + timeBonus + dmgBonus);
    const what = m.type === 'medevac' ? `${m.count} Verwundete gerettet` : m.type === 'csar' ? `${m.count} ${m.count === 1 ? 'Pilot' : 'Besatzungsmitglieder'} gerettet` : `${m.count} Soldaten verbracht`;
    const result = {
      title: 'AUFTRAG ERFÜLLT',
      score,
      lines: [
        [what, `+${Math.round(base * mult)}`],
        m.hot ? ['Heiße LZ', '×1,5'] : null,
        ['Zeitbonus', `+${timeBonus}`],
        dmgBonus ? ['Ohne Schaden', `+${dmgBonus}`] : ['Schaden genommen', `${Math.round(dmg)} %`],
        ['Gesamt', `${score} Punkte`],
      ].filter(Boolean),
    };
    g.onMissionResult(result);
    if (g.net) g.net.send({ t: 'result', r: result });
    g.radio(m.type === 'transport' ? `TOC: Gut gemacht, ${CALLSIGN}. Auftrag erledigt.` : `Lazarett: Danke, ${CALLSIGN}! Ihr habt Leben gerettet.`, 'TOC');
    this.retire(m);
    this.nextTimer = 7;
    this.changed();
  }

  retire(m) {
    this.stale.push({ m, points: [m.from, m.to].filter((p) => p.kind === 'site') });
    this.current = null;
  }

  cleanup(m) {
    const g = this.game;
    g.units.clearMission(m.id);
    for (const e of m.emitters) g.effects.removeEmitter(e);
    if (m.wreck) { g.scene.remove(m.wreck); m.wreck.geometry.dispose(); }
  }

  // Ein Hubschrauber ist abgestürzt: seine Passagiere sind verloren
  onHeliLost(h) {
    const m = this.current;
    const lost = this.paxOf(h);
    h.passengers = [];
    h.updatePassengerDisplay();
    if (this.game.role === 'client') return;
    if (m && (lost > 0 || this.game.helis.every((x) => x.crashed))) {
      this.phase = 'failed';
      this.game.radio('TOC: Der Auftrag ist gescheitert. Neuer Auftrag folgt.', 'TOC', true);
      this.retire(m);
      this.nextTimer = 8;
      this.changed();
    }
  }

  // ------------------------------------------------------------ Netzwerk (Client-Spiegel)
  toNet() {
    const m = this.current;
    const skip = new Set(['wreck', 'emitters']);
    return {
      m: m ? JSON.parse(JSON.stringify(m, (k, v) => (skip.has(k) ? undefined : v))) : null,
      phase: this.phase, nextTimer: this.nextTimer,
    };
  }

  applyNet(d) {
    const g = this.game;
    const old = this.current;
    this.phase = d.phase;
    this.nextTimer = d.nextTimer;
    if (!d.m) {
      if (old) this.retire(old);
      g.hud.hideBriefing();
      return;
    }
    if (!old || old.id !== d.m.id) {
      if (old) this.retire(old);
      const m = Object.assign(d.m, { emitters: [], mirrorSmoke: {} });
      this.current = m;
      if (m.wreckInfo) this.buildWreck(m);
      if (this.phase === 'briefing') { g.hud.showBriefing(m, this.describe(m)); g.audio.radio(); }
    } else {
      const m = old;
      const keep = { emitters: m.emitters, wreck: m.wreck, mirrorSmoke: m.mirrorSmoke };
      Object.assign(m, d.m, keep);
      if (m.wreckInfo && !m.wreck) this.buildWreck(m);
      if (this.phase !== 'briefing') g.hud.hideBriefing();
    }
  }

  updateMirror() {
    const m = this.current;
    if (!m) return;
    for (const end of ['from', 'to']) {
      if (m.smokePopped[end] && !m.mirrorSmoke[end]) {
        m.mirrorSmoke[end] = true;
        const p = m[end];
        m.emitters.push(this.game.effects.smokeGrenade(p.x + 4, this.game.world.height(p.x + 4, p.z), p.z, m.smoke));
      }
    }
  }

  hudInfo(h = this.game.heli) {
    const m = this.current;
    if (!m) return { line: this.nextTimer > 0 || this.phase === 'done' ? 'Warte auf neuen Auftrag…' : '', step: '' };
    const one = m.count === 1;
    const n = m.type === 'medevac' ? (one ? 'Verwundeter' : 'Verwundete') : m.type === 'csar' ? (one ? 'Überlebender' : 'Überlebende') : one ? 'Soldat' : 'Soldaten';
    let step = '';
    const t = this.target(h);
    const left = m.count - m.boarded;
    if (this.phase === 'briefing') step = 'Neuer Auftrag – Briefing bestätigen';
    else if (t === 'from') {
      if (h.onGround && dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) < this.boardRadius()) step = `Einsteigen: ${m.boarded}/${m.count} – Position halten!`;
      else if (m.type === 'csar' && !m.revealed) step = 'Suchgebiet anfliegen – nach Rauchsäule des Wracks Ausschau halten';
      else if (m.from.kind === 'fob') step = `Auf Pad ${m.from.pad.name} landen – Soldaten aufnehmen`;
      else step = `Bei ${m.from.name} landen (${m.smoke}er Rauch) – ${left} ${left === 1 ? 'wartet' : 'warten'}`;
    } else if (t === 'to') {
      if (h.unloading) step = `Aussteigen: ${m.delivered}/${m.count} – am Boden bleiben`;
      else if (this.paxOf(h) === 0) step = `Alle aufgenommen – ${m.delivered}/${m.count} abgeliefert`;
      else step = m.to.kind === 'fob' ? `Zur FOB – auf Pad ${m.to.pad.name} landen${m.to.pad.name === 'MED' ? ' (rotes Kreuz)' : ''}` : `Nach ${m.to.name} fliegen und landen`;
    }
    return { line: `${m.title} · ${m.count} ${n} · ${m.hot ? 'HEISS' : 'KALT'}`, step, hot: m.hot };
  }
}
