// Auftragserzeugung und -ablauf: MEDEVAC, Truppentransport, CSAR
import * as THREE from './lib/three.module.min.js';
import { T, figFor } from './theme.js';
import { wreckAfg, dingoParts, mrapParts, fuelTruckAfg } from './afgModels.js';
import { rand, clamp, bearing, dirName, fmtDist, fmtBearing, dist2 } from './util.js';
import { wreckParts, merge, vcMat, P, Figure } from './models.js';
import { SlingLoad, ROPE } from './sling.js';

const NATO = ['Kilo', 'Lima', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Tango', 'Victor', 'Whiskey', 'Yankee', 'Zulu', 'Hotel'];
// Aufträge, bei denen Soldaten/Personen/Ladung transportiert werden (nicht Verwundete)
const LIFT = ['transport', 'insert', 'exfil', 'resupply', 'vip', 'boat', 'convoy', 'sling', 'auto'];
const TYPE_WEIGHTS = [['medevac', 30], ['transport', 13], ['csar', 11], ['insert', 10], ['exfil', 10], ['resupply', 10], ['recon', 8], ['vip', 8], ['boat', 8], ['sling', 9], ['auto', 5]];
const SMOKES = ['gelb', 'rot', 'grün', 'violett'];
const SMOKE_ADJ = { gelb: 'Gelber', rot: 'Roter', grün: 'Grüner', violett: 'Violetter' };

export class Missions {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.phase = 'none';
    this.count = 0;
    this.nextTimer = -1;
    this.stale = [];
    this.boats = [];
    this.roofs = new Map();
    this.convoys = new Map();
    this.lastSite = null;
    this.recentPts = [];    // zuletzt angeflogene Orte (nicht gleich wieder dorthin)
    this.recentTypes = [];  // zuletzt vergebene Auftragsarten
    this.unloadT = 0;
  }

  fobPoint(pad) {
    const f = this.game.world.fob;
    return { name: `${T.fobName} – Pad ${pad.name}`, short: `Pad ${pad.name}`, x: pad.x, z: pad.z, y: f.y, kind: 'fob', pad, radius: 16 };
  }
  sitePoint(site) {
    return { name: site.name, short: site.name, x: site.x, z: site.z, y: site.y, kind: 'site', site, radius: 65 };
  }

  // Ort war kürzlich schon Einsatzort?
  isRecent(x, z, d = 550) { return this.recentPts.some((p) => dist2(p.x, p.z, x, z) < d); }
  remember(p) {
    if (!p || p.kind === 'fob') return;
    this.recentPts.push({ x: p.x, z: p.z });
    if (this.recentPts.length > 10) this.recentPts.shift();
  }

  // Überflutetes Haus für eine Windenrettung
  pickRoof() {
    const w = this.game.world;
    const c = (w.houses || []).filter((h) => !h.church && h.ground < -0.8 && dist2(h.x, h.z, w.fob.x, w.fob.z) > 2400 && !this.isRecent(h.x, h.z, 450));
    return c.length ? rand.pick(c) : null;
  }

  // Landezone wählen: keine der letzten Einsatzorte, schwierige LZs (Gipfel, Sattel, Schlucht, Wadi) bevorzugt
  pickSite(exclude = [], preferHard = 0.45) {
    const w = this.game.world;
    const maxD = 3900 + this.count * 300;
    const ok = (s) => s !== this.lastSite && !exclude.includes(s) && !this.isRecent(s.x, s.z);
    let cands = w.sites.filter((s) => ok(s) && dist2(s.x, s.z, w.fob.x, w.fob.z) < maxD);
    if (cands.length < 3) cands = w.sites.filter(ok);
    if (!cands.length) {
      // alle Orte kürzlich benutzt: den am längsten nicht angeflogenen (weitesten von den letzten Orten) nehmen
      const far = (s) => Math.min(...this.recentPts.map((p) => dist2(p.x, p.z, s.x, s.z)));
      cands = w.sites.filter((s) => s !== this.lastSite && !exclude.includes(s)).sort((a, b) => far(b) - far(a)).slice(0, 4);
    }
    const hard = cands.filter((s) => s.hard);
    const s = hard.length && rand() < preferHard ? rand.pick(hard) : rand.pick(cands);
    this.lastSite = s;
    return s;
  }

  // ------------------------------------------------------------ Erzeugen
  generate() {
    const g = this.game, w = g.world;
    this.count++;
    const r = rand();
    // Nur Kampfhubschrauber (keine Kabine): Luftnahunterstützung; mit Apache im Verband gelegentlich
    const noCabin = g.helis.every((h) => h.spec.capacity === 0);
    const anyGunship = g.helis.some((h) => h.spec.capacity === 0);
    let type = T.peaceful ? 'winch' : 'medevac';
    if (this.count > 1) {
      // nicht dieselbe Auftragsart wie bei den letzten beiden Aufträgen
      const pool = (T.missionWeights || TYPE_WEIGHTS).filter(([t]) => !this.recentTypes.slice(-2).includes(t));
      let x = r * pool.reduce((a, t) => a + t[1], 0);
      for (const [t, wgt] of pool) { if ((x -= wgt) <= 0) { type = t; break; } }
    }
    if (noCabin || (anyGunship && rand() < 0.3)) type = (T.missionWeights || []).some(([t]) => t === 'convoy') && rand() < 0.5 ? 'convoy' : 'cas';
    // Bootstrupp: nur wenn es in Reichweite breites Wasser gibt
    const water = type === 'boat' ? w.findWater(rand, 2500, 5600, this.recentPts) : null;
    if (type === 'boat' && !water) type = 'medevac';
    // Windenrettung: ein überflutetes Haus, auf dessen Dach Menschen ausharren
    const roof = type === 'winch' ? this.pickRoof() : null;
    if (type === 'winch' && !roof) type = 'medevac';
    if (type === 'ship' && !w.ship) type = 'medevac';
    // Außenlast nur mit Transporthubschrauber, Autorotationsübung nur mit menschlichem Piloten
    if (type === 'sling' && !g.helis.some((x) => x.spec.capacity > 0)) type = 'medevac';
    if (type === 'auto' && !g.crews.some((c) => c && c.pilot != null)) type = 'medevac';
    const hotChance = clamp(0.3 + this.count * 0.05, 0.3, 0.7);
    const m = {
      id: 'M' + this.count + '_' + Math.floor(rand() * 1e6), num: this.count, type,
      smoke: rand.pick(SMOKES), unit: rand.pick(T.units), boarded: 0, delivered: 0,
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
      const cap = Math.max(...g.helis.map((x) => x.spec.capacity));
      m.count = cap > 12 ? rand.int(8, Math.min(cap, 16 + this.count * 2)) : rand.int(4, Math.min(cap, 10));
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
        const cands = w.sites.filter((s) => s !== a && dist2(s.x, s.z, a.x, a.z) > 1500 && dist2(s.x, s.z, a.x, a.z) < 3500);
        b = cands.length ? rand.pick(cands) : this.pickSite([a]);
        m.from = this.sitePoint(a);
        m.to = this.sitePoint(b);
        m.variant = 'Umgruppierung';
        m.hot = rand() < hotChance * 0.7;
        m.hotAt = m.hot ? (rand() < 0.5 ? 'from' : 'to') : null;
      }
    } else if (type === 'insert' || type === 'exfil') {
      const cap = Math.max(...g.helis.map((x) => x.spec.capacity));
      const hardFree = w.sites.filter((s) => s.hard && !this.isRecent(s.x, s.z));
      const c = hardFree.length && rand() < 0.55 ? null : w.findClearing(rand, 3000, 5600, this.recentPts);
      const site = c ? null : this.pickSite([], 0.85);
      const pt = c ? { name: `Absetzpunkt ${rand.pick(NATO)}`, x: c.x, z: c.z, y: c.y } : site;
      const p = { name: pt.name, short: pt.name, x: pt.x, z: pt.z, y: pt.y, kind: 'site', site: pt, radius: 45, remote: !!c };
      m.unit = rand.pick(T.sofUnits);
      m.count = rand.int(4, Math.max(4, Math.min(cap, 8)));
      m.noSmoke = true;
      if (type === 'insert') {
        m.title = 'SPEZIALKRÄFTE – INFILTRATION';
        m.from = this.fobPoint(w.fob.pads.troop);
        m.to = p;
        m.hot = rand() < 0.15;
        m.hotAt = m.hot ? 'to' : null;
      } else {
        m.title = 'SPEZIALKRÄFTE – EXFILTRATION';
        m.from = p;
        m.to = this.fobPoint(w.fob.pads.troop);
        m.hot = rand() < 0.75;
        m.hotAt = m.hot ? 'from' : null;
      }
    } else if (type === 'ship') {
      // Fregatte im Fjord: Verwundete abholen oder Truppen an Bord bringen
      const cap = Math.max(...g.helis.map((x) => x.spec.capacity));
      const pad = w.ship.pad;
      const pt = { name: pad.name, short: 'Flugdeck', x: pad.x, z: pad.z, y: w.ship.deck, kind: 'ship', site: { r: 10, hard: 'ship' }, radius: 20 };
      m.noSmoke = true;
      if (rand() < 0.55) {
        m.variant = 'med'; m.title = 'MEDEVAC VON SEE';
        m.from = pt; m.to = this.fobPoint(w.fob.pads.med);
        m.count = rand.int(1, 3); m.litters = m.count; m.walking = 0;
      } else {
        m.variant = 'troop'; m.title = 'VERLEGUNG AUF DIE FREGATTE';
        m.from = this.fobPoint(w.fob.pads.troop); m.to = pt;
        m.count = rand.int(4, Math.max(4, Math.min(cap, 10)));
      }
    } else if (type === 'convoy') {
      const site = this.pickSite();
      m.title = 'KONVOI-BEGLEITSCHUTZ';
      m.count = rand.int(4, 6);
      m.route = this.makeRoute(site);
      const r0 = m.route[0];
      m.from = { name: `${T.fobName}, Ausfahrt`, short: 'Konvoi', x: r0.x, z: r0.z, y: w.height(r0.x, r0.z), kind: 'convoy' };
      m.to = this.sitePoint(site);
      m.hot = false; m.hotAt = null;
    } else if (type === 'sling') {
      const kind = T.id === 'flood' ? 'bags' : T.peaceful ? 'net' : rand() < 0.45 ? 'jeep' : 'net';
      const site = this.pickSite();
      const pad = w.fob.pads.troop;
      if (kind === 'jeep') {
        m.title = 'BERGUNG – AUSSENLAST';
        m.from = this.sitePoint(site);
        m.to = this.fobPoint(pad);
        m.hot = rand() < hotChance * 0.5;
        m.hotAt = m.hot ? 'from' : null;
      } else {
        m.title = 'AUSSENLAST';
        m.from = this.fobPoint(pad);
        m.to = this.sitePoint(site);
        m.hot = rand() < hotChance * 0.4;
        m.hotAt = m.hot ? 'to' : null;
      }
      m.count = 1;
      m.sling = { kind, x: m.from.x + (kind === 'jeep' ? 6 : 0), z: m.from.z + (kind === 'jeep' ? 6 : 0), att: false, hookT: 0, relT: 0, dmg: 0, heli: -1 };
    } else if (type === 'auto') {
      const c = w.findClearing(rand, 700, 2600, this.recentPts);
      const nm = `Übungsfläche ${rand.pick(NATO)}`;
      const p = c ? { name: nm, short: nm, x: c.x, z: c.z, y: c.y, kind: 'drill', radius: 150 } : { ...this.sitePoint(this.pickSite()), kind: 'drill', radius: 150 };
      m.title = 'NOTVERFAHREN – AUTOROTATION';
      m.unit = 'Ausbilder';
      m.from = p; m.to = p;
      m.count = 1;
      m.noSmoke = true;
      m.hot = false; m.hotAt = null;
      m.drill = { stage: 'climb', heli: -1 };
    } else if (type === 'winch') {
      const cap = Math.max(...g.helis.map((x) => x.spec.capacity));
      m.title = 'WINDENRETTUNG';
      m.unit = `Feuerwehr ${roof.village}`;
      m.count = rand.int(1, Math.max(1, Math.min(4, cap)));
      m.noSmoke = true;
      m.from = { name: `${roof.village}, Hausdach`, short: `${roof.village}, Dach`, x: roof.x, z: roof.z, y: roof.ridge, kind: 'roof', roof: { x: roof.x, z: roof.z, ridge: roof.ridge, rot: roof.rot, village: roof.village }, radius: 12 };
      m.to = this.fobPoint(w.fob.pads.med);
      m.winch = { len: 0, phase: 'down', heli: -1 };
    } else if (type === 'boat') {
      const cap = Math.max(...g.helis.map((x) => x.spec.capacity));
      const nm = `Flusspunkt ${rand.pick(NATO)}`;
      m.title = 'BOOTSTRUPP – HELOCAST';
      m.unit = rand.pick(T.sofUnits);
      m.count = rand.int(4, Math.max(4, Math.min(cap, 6)));
      m.noSmoke = true;
      m.from = this.fobPoint(w.fob.pads.troop);
      m.to = { name: nm, short: nm, x: water.x, z: water.z, y: 0, kind: 'water', radius: 30 };
      m.hot = rand() < 0.25;
      m.hotAt = m.hot ? 'to' : null;
    } else if (type === 'resupply') {
      const cap = Math.max(...g.helis.map((x) => x.spec.capacity));
      const posts = w.sites.filter((s) => s.post);
      const site = posts.length && rand() < 0.8 ? rand.pick(posts) : this.pickSite();
      m.title = 'NACHSCHUB';
      m.from = this.fobPoint(w.fob.pads.troop);
      m.to = this.sitePoint(site);
      m.count = rand.int(4, Math.max(4, Math.min(cap, 10)));
      m.hot = rand() < hotChance * 0.6;
      m.hotAt = m.hot ? 'to' : null;
    } else if (type === 'vip') {
      m.title = 'VIP-TRANSPORT';
      m.vip = rand.pick(T.vips);
      m.from = this.fobPoint(w.fob.pads.troop);
      m.to = this.sitePoint(this.pickSite());
      m.count = 3;
      m.hot = rand() < 0.15;
      m.hotAt = m.hot ? 'to' : null;
    } else if (type === 'recon') {
      m.title = 'AUFKLÄRUNG';
      const pts = [];
      const cand = w.villages.filter((v) => dist2(v.x, v.z, w.fob.x, w.fob.z) > 2500);
      for (let k = 0; k < 3; k++) {
        let q = cand.length && rand() < 0.5 ? rand.pick(cand.filter((v) => !pts.some((p) => p.name === v.name)) || cand) : null;
        if (!q) { const c = w.findClearing(rand, 3000, 5600, pts.concat(this.recentPts)); if (c) q = { name: `Punkt ${rand.pick(NATO)}`, ...c }; }
        if (!q) q = this.pickSite();
        pts.push({ name: q.name, short: q.name, x: q.x, z: q.z, y: q.y ?? w.height(q.x, q.z), kind: 'recon', radius: 150 });
      }
      m.points = pts;
      m.idx = 0;
      m.from = pts[0];
      m.to = pts[2];
      m.count = 3;
      m.hot = rand() < 0.6;
      m.hotAt = null;
    } else if (type === 'cas') {
      const site = this.pickSite();
      m.title = 'LUFTNAHUNTERSTÜTZUNG';
      m.from = this.sitePoint(site);
      m.to = m.from;
      m.hot = true;
      m.hotAt = 'from';
      m.count = 14 + Math.floor(rand() * 8) + Math.min(10, this.count);
    } else {
      const ac = rand.pick(T.aircraft);
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
    if (T.peaceful) { m.hot = false; m.hotAt = null; if (type === 'recon') m.title = 'LAGEERKUNDUNG'; }
    // merken, damit die nächsten Aufträge woanders hinführen
    this.recentTypes.push(type);
    if (this.recentTypes.length > 4) this.recentTypes.shift();
    for (const p of m.points || [m.from, m.to]) this.remember(p);
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
    const hotTxt = T.peaceful ? 'Landeplatz trocken und frei' : m.hot ? 'HEISS – Feindkontakt!' : 'KALT – keine Feindberührung';
    if (m.type === 'medevac') {
      rows.push(['Auftrag', 'Verwundetenbergung (Dustoff)']);
      rows.push(['Aufnahme', `${m.from.name} · Planquadrat ${w.gridRef(m.from.x, m.from.z)}`]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(b)} (${dirName(b)}) · ${fmtDist(d)}`]);
      rows.push(['Verwundete', `${m.count} (${m.litters} liegend, ${m.walking} gehfähig)`]);
      rows.push(['LZ-Status', hotTxt, m.hot ? 'hot' : 'cold']);
      rows.push(['Markierung', `${SMOKE_ADJ[m.smoke]} Rauch`]);
      rows.push(['Ablieferung', `${T.fobName} – Lazarett (Pad MED)`]);
      radio = `„${g.callsign}, hier ${m.unit}. Wir haben ${m.count === 1 ? 'einen Verwundeten' : m.count + ' Verwundete'}${m.litters && m.count > 1 ? `, davon ${m.litters} ${m.litters === 1 ? 'Tragefall' : 'Tragefälle'}` : m.litters ? ' (Tragefall)' : ''}. ${m.hot ? 'Wir stehen unter Beschuss!' : 'Die Lage ist ruhig.'} Erbitten sofortige Evakuierung bei ${m.from.name}.“`;
    } else if (m.type === 'transport') {
      const b2 = bearing(m.from.x, m.from.z, m.to.x, m.to.z), d2 = dist2(m.from.x, m.from.z, m.to.x, m.to.z);
      rows.push(['Auftrag', `Truppentransport (${m.variant})`]);
      rows.push(['Punkt A – Aufnahme', m.from.name]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(b)} (${dirName(b)}) · ${fmtDist(d)}`]);
      rows.push(['Punkt B – Absetzen', `${m.to.name} · ${fmtBearing(b2)} · ${fmtDist(d2)} ab A`]);
      rows.push(['Soldaten', `${m.count}`]);
      rows.push(['LZ-Status', T.peaceful ? 'Landeplätze trocken und frei' : m.hot ? `HEISS bei ${m.hotAt === 'from' ? 'Punkt A' : 'Punkt B'}!` : 'KALT – beide LZs ruhig', m.hot ? 'hot' : 'cold']);
      if (m.to.kind === 'site' || m.from.kind === 'site') rows.push(['Markierung', `${SMOKE_ADJ[m.smoke]} Rauch`]);
      radio = T.peaceful ? `„${g.callsign}, hier ${T.fobName}. ${m.count} Helfer von ${m.from.short} nach ${m.to.short} fliegen.“` : `„${g.callsign}, hier TOC ${T.fobName}. ${m.count} Soldaten von ${m.from.short} nach ${m.to.short} verbringen.${m.hot ? ' Rechnen Sie mit Feindfeuer!' : ''}“`;
    } else if (m.type === 'insert' || m.type === 'exfil') {
      const p = m.type === 'insert' ? m.to : m.from;
      const bp = bearing(h.pos.x, h.pos.z, p.x, p.z), dp = dist2(h.pos.x, h.pos.z, p.x, p.z);
      rows.push(['Auftrag', m.type === 'insert' ? 'Spezialkräfte verdeckt absetzen' : 'Spezialkräfte herausholen']);
      rows.push(['Team', `${m.unit} · ${m.count} Mann`]);
      rows.push([m.type === 'insert' ? 'Absetzpunkt' : 'Aufnahmepunkt', `${p.name} · Planquadrat ${w.gridRef(p.x, p.z)}`]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(bp)} (${dirName(bp)}) · ${fmtDist(dp)}`]);
      rows.push(['Lage', m.type === 'insert' ? (m.hot ? 'Feind am Absetzpunkt möglich!' : 'Feind in der Gegend – tief und unauffällig anfliegen') : m.hot ? 'Team entdeckt – Feind verfolgt es!' : 'Team wartet versteckt', m.hot ? 'hot' : 'cold']);
      rows.push(['Markierung', 'keine – das Team zeigt sich erst bei der Landung']);
      radio = m.type === 'insert'
        ? `„${g.callsign}, hier TOC. ${m.unit} muss verdeckt bei ${p.name} abgesetzt werden. Aufnahme bei ${T.fobName}, Pad H1. Keine Rauchzeichen.“`
        : `„${g.callsign}, hier ${m.unit}. ${m.hot ? 'Wir sind aufgeflogen und werden verfolgt!' : 'Auftrag erfüllt.'} Erbitten Exfil bei ${p.name}, Planquadrat ${w.gridRef(p.x, p.z)}.“`;
    } else if (m.type === 'ship') {
      const sp = m.variant === 'med' ? m.from : m.to;
      const bs = bearing(w.fob.x, w.fob.z, sp.x, sp.z);
      rows.push(['Auftrag', m.variant === 'med' ? 'Verletzte von der Fregatte zum Sanitätsbereich fliegen' : 'Truppen von der Basis auf die Fregatte verlegen']);
      rows.push(['Landeplatz', `${sp.name} · Planquadrat ${w.gridRef(sp.x, sp.z)}`]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(bs)} (${dirName(bs)}) · ${fmtDist(dist2(w.fob.x, w.fob.z, sp.x, sp.z))} von der Basis`]);
      rows.push([m.variant === 'med' ? 'Verwundete' : 'Soldaten', `${m.count}`]);
      if (m.variant === 'med') rows.push(['Ablieferung', `${T.fobName} – Pad MED`]);
      radio = m.variant === 'med'
        ? `„${g.callsign}, hier Fregatte „Sachsen“. Wir haben ${m.count === 1 ? 'einen Verletzten' : m.count + ' Verletzte'} an Bord, Unfall an Deck. Flugdeck ist frei, Seegang mäßig.“`
        : `„${g.callsign}, hier ${T.fobName}. ${m.count} Soldaten des Seebataillons auf die Fregatte „Sachsen“ verlegen. Achten Sie auf das schwankende Deck.“`;
    } else if (m.type === 'convoy') {
      const len = m.route[m.route.length - 1].s;
      rows.push(['Auftrag', 'Begleitschutz aus der Luft für einen Versorgungskonvoi']);
      rows.push(['Konvoi', `${m.count} Fahrzeuge (Dingo, Fuchs, Tanklastwagen)`]);
      rows.push(['Ziel', `${m.to.name} · Planquadrat ${w.gridRef(m.to.x, m.to.z)}`]);
      rows.push(['Strecke', `ca. ${fmtDist(len)} über Land`]);
      rows.push(['Lage', 'Hinterhalte entlang der Route gemeldet', 'hot']);
      rows.push(['Vorgabe', 'Über dem Konvoi bleiben, vorausfliegen, Hinterhalte niederkämpfen – unter Beschuss hält der Konvoi an']);
      radio = `„${g.callsign}, hier ${m.unit}. Unser Konvoi mit ${m.count} Fahrzeugen steht abmarschbereit am ${T.fobName}. Erbitten Begleitschutz bis ${m.to.name}.“`;
    } else if (m.type === 'sling') {
      const what = { net: 'Netz mit Nachschubkisten', bags: 'Big Bags mit Sandsäcken für den Deich', jeep: 'liegengebliebenes Fahrzeug bergen' }[m.sling.kind];
      rows.push(['Auftrag', `Außenlast am Lasthaken: ${what}`]);
      rows.push(['Last aufnehmen', `${m.from.name}${m.from.kind === 'site' ? ` · Planquadrat ${w.gridRef(m.from.x, m.from.z)}` : ''}`]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(b)} (${dirName(b)}) · ${fmtDist(d)}`]);
      rows.push(['Absetzen', m.to.name]);
      rows.push(['Vorgabe', `Über der Last schweben (5–20 m), Bodenpersonal hängt an – Seil ${ROPE} m. Ruhig fliegen (unter 80 kt), Last pendelt. Am Ziel langsam sinken, bis die Last aufsetzt.`]);
      if (!T.peaceful) rows.push(['LZ-Status', hotTxt, m.hot ? 'hot' : 'cold']);
      radio = m.sling.kind === 'jeep'
        ? `„${g.callsign}, hier ${m.unit}. Ein Fahrzeug ist bei ${m.from.name} liegengeblieben – bitte als Außenlast zur ${T.fobName} bringen.“`
        : `„${g.callsign}, hier ${T.peaceful ? 'TOC' : m.unit}. ${m.sling.kind === 'bags' ? 'Der Deich' : 'Der Posten'} bei ${m.to.name} braucht dringend ${m.sling.kind === 'bags' ? 'Sandsäcke' : 'Nachschub'} – Last steht auf Pad ${m.from.pad.name} bereit.“`;
    } else if (m.type === 'auto') {
      rows.push(['Auftrag', 'Übung: Notlandung ohne Triebwerk (Autorotation)']);
      rows.push(['Übungsfläche', `${m.from.name} · Planquadrat ${w.gridRef(m.from.x, m.from.z)}`]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(b)} (${dirName(b)}) · ${fmtDist(d)}`]);
      rows.push(['Ablauf', 'Über der Übungsfläche auf mindestens 300 m (1000 ft) über Grund steigen, mit Fahrt anfliegen – der Ausbilder nimmt das Triebwerk weg']);
      rows.push(['Verfahren', 'Kollektiv sofort runter (Rotordrehzahl halten), mit ca. 60 kt gleiten, in 20–30 m Höhe Nase hoch (Abfangen), kurz vor dem Boden Kollektiv ziehen']);
      rows.push(['Bewertung', 'Aufsetzpunkt (Nähe zur Mitte) und Sinkrate beim Aufsetzen']);
      radio = `„${g.callsign}, hier Ausbilder. Heute üben wir den Triebwerksausfall. Fliegen Sie zur ${m.from.name} und steigen Sie auf 1000 Fuß.“`;
    } else if (m.type === 'winch') {
      rows.push(['Auftrag', 'Rettung mit der Winde von einem Hausdach']);
      rows.push(['Einsatzort', `${m.from.name} · Planquadrat ${w.gridRef(m.from.x, m.from.z)}`]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(b)} (${dirName(b)}) · ${fmtDist(d)}`]);
      rows.push(['Personen', `${m.count} auf dem Dach eingeschlossen`]);
      rows.push(['Vorgabe', 'Über dem Dach schweben (3–30 m über dem First, fast im Stillstand) – die Winde sitzt rechts an der Tür, die Personen werden einzeln hochgezogen']);
      rows.push(['Ablieferung', `${T.fobName} – Behandlungsplatz (Pad MED)`]);
      rows.push(['Hinweis', 'Auf Hochspannungsleitungen und Kirchtürme achten!', 'hot']);
      radio = `„${g.callsign}, hier ${m.unit}. In ${m.from.roof.village} ${m.count === 1 ? 'sitzt eine Person' : 'sitzen ' + m.count + ' Personen'} auf einem Dach fest, das Wasser steigt weiter. Mit den Booten kommen wir nicht hin – erbitten Windenrettung!“`;
    } else if (m.type === 'boat') {
      const bp = bearing(w.fob.x, w.fob.z, m.to.x, m.to.z), dp = dist2(w.fob.x, w.fob.z, m.to.x, m.to.z);
      rows.push(['Auftrag', 'Bootstrupp mit Schlauchboot im Fluss absetzen (Helocast)']);
      rows.push(['Team', `${m.unit} · ${m.count} Mann + Boot`]);
      rows.push(['Absetzpunkt', `${m.to.name} · Planquadrat ${w.gridRef(m.to.x, m.to.z)}`]);
      rows.push(['Ziel', `${fmtBearing(bp)} (${dirName(bp)}) · ${fmtDist(dp)}`]);
      rows.push(['Vorgabe', 'Über dem Wasser schweben: unter 4 m Höhe, fast im Stillstand – das Team springt mit dem Boot ab. Nicht wassern!']);
      rows.push(['Lage', m.hot ? 'Feind am Ufer möglich!' : 'Ufer vermutlich frei', m.hot ? 'hot' : 'cold']);
      radio = `„${g.callsign}, hier TOC. ${m.unit} wird mit Schlauchboot bei ${m.to.name} im Fluss abgesetzt. Aufnahme ${T.fobName}, Pad H1. Tief und langsam über dem Wasser schweben – nicht wassern!“`;
    } else if (m.type === 'resupply') {
      rows.push(['Auftrag', T.peaceful ? 'Versorgungsflug (Trinkwasser, Sandsäcke, Medikamente)' : 'Nachschubflug (Munition, Wasser, Verpflegung)']);
      rows.push(['Ladung', `${m.count} Kisten – Aufnahme ${T.fobName}, Pad H1`]);
      rows.push(['Ziel', `${m.to.name} · ${fmtBearing(bearing(w.fob.x, w.fob.z, m.to.x, m.to.z))} · ${fmtDist(dist2(w.fob.x, w.fob.z, m.to.x, m.to.z))}`]);
      rows.push(['LZ-Status', m.hot ? 'HEISS – Außenposten unter Feuer!' : 'KALT', m.hot ? 'hot' : 'cold']);
      rows.push(['Markierung', `${SMOKE_ADJ[m.smoke]} Rauch`]);
      radio = T.peaceful ? `„${g.callsign}, hier ${m.to.name}. Wir sind vom Hochwasser abgeschnitten. Bitte ${m.count} Kisten Trinkwasser, Sandsäcke und Medikamente.“` : `„${g.callsign}, hier ${m.to.name}. Uns gehen Munition und Wasser aus. Bitte ${m.count} Kisten Nachschub.${m.hot ? ' Wir liegen unter Feuer!' : ''}“`;
    } else if (m.type === 'vip') {
      rows.push(['Auftrag', 'Personentransport (VIP)']);
      rows.push(['Fluggast', `${m.vip.who} mit Begleitschutz – ${m.vip.why}`]);
      rows.push(['Aufnahme', `${T.fobName}, Pad H1`]);
      rows.push(['Ziel', `${m.to.name} · ${fmtBearing(bearing(w.fob.x, w.fob.z, m.to.x, m.to.z))} · ${fmtDist(dist2(w.fob.x, w.fob.z, m.to.x, m.to.z))}`]);
      rows.push(['Hinweis', 'Ruhig fliegen und sanft landen – Bonus ohne Schaden']);
      radio = `„${g.callsign}, hier TOC. ${m.vip.who} muss zur ${m.vip.why} nach ${m.to.name}. Bitte ohne Umwege und sanft.“`;
    } else if (m.type === 'recon') {
      rows.push(['Auftrag', T.peaceful ? 'Lageerkundung – drei Orte überfliegen und Schäden melden' : 'Bewaffnete Aufklärung – drei Punkte überfliegen']);
      m.points.forEach((p, i) => rows.push([`Punkt ${i + 1}`, `${p.name} · Planquadrat ${w.gridRef(p.x, p.z)}`]));
      rows.push(['Vorgabe', 'Jeden Punkt unter 180 m über Grund in max. 180 m Abstand überfliegen']);
      rows.push(['Lage', T.peaceful ? 'Schadenslage unklar' : m.hot ? 'Feindbewegungen gemeldet' : 'unklar', m.hot ? 'hot' : 'cold']);
      radio = T.peaceful ? `„${g.callsign}, hier Krisenstab. Erkunden Sie ${m.points.map((p) => p.name).join(', ')} und melden Sie die Schadenslage.“` : `„${g.callsign}, hier TOC. Klären Sie ${m.points.map((p) => p.name).join(', ')} auf und melden Sie Feindbewegungen.“`;
    } else if (m.type === 'cas') {
      rows.push(['Auftrag', 'Luftnahunterstützung – Truppe im Gefecht (TIC)']);
      rows.push(['Einsatzort', `${m.from.name} · Planquadrat ${w.gridRef(m.from.x, m.from.z)}`]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(b)} (${dirName(b)}) · ${fmtDist(d)}`]);
      rows.push(['Feindstärke', `ca. ${m.count} ${T.enemyName}, auch Fahrzeuge möglich`, 'hot']);
      rows.push(['Eigene Truppe', `${SMOKE_ADJ[m.smoke]} Rauch markiert die eigene Stellung`]);
      rows.push(['Ziel', 'Feind im Umkreis von 500 m niederkämpfen']);
      radio = `„${g.callsign}, hier ${m.unit}. Wir liegen bei ${m.from.name} unter schwerem Feuer, ca. ${m.count} ${T.enemyName}. Erbitten sofortige Luftunterstützung!“`;
    } else {
      rows.push(['Auftrag', 'Bergung abgeschossener Besatzung']);
      rows.push(['Maschine', `${m.aircraft.name} („${m.aircraft.call}“)`]);
      rows.push(['Absturzort (ca.)', `Planquadrat ${w.gridRef(m.approx.x, m.approx.z)} – Suchradius 400 m`]);
      rows.push(['Richtung / Entfernung', `${fmtBearing(b)} (${dirName(b)}) · ca. ${fmtDist(d)}`]);
      rows.push(['Besatzung', `${m.count} Überlebende`]);
      rows.push(['LZ-Status', m.hot ? 'HEISS – Feind in der Nähe!' : 'KALT – unklar, Vorsicht', m.hot ? 'hot' : 'cold']);
      rows.push(['Markierung', `${SMOKE_ADJ[m.smoke]} Rauch, sobald sie Sie hören`]);
      rows.push(['Ablieferung', `${T.fobName} – Pad MED`]);
      radio = `„Mayday, Mayday! ${m.aircraft.call} ist runter! ${m.count === 1 ? 'Pilot ist' : 'Besatzung ist'} am Boden. Achten Sie auf die Rauchsäule des Wracks.“`;
    }
    // Schwierige Landezonen
    for (const p of [m.from, m.to]) {
      const hs = p && p.site && p.site.hard;
      const txt0 = { ship: 'Schiffsdeck – das Deck hebt und senkt sich, im ruhigen Moment aufsetzen' };
      const txt = { ...txt0, peak: 'Gipfel-LZ – kleine Landefläche, Fallwinde, steile Hänge', valley: 'enges Flusstal – hohe Hänge, wenig Platz', ridge: 'Hang-LZ – schmaler Absatz am Steilhang, Rotor frei halten', wadi: 'Wadi – enges Trockental zwischen Böschungen, starker Staub', mesa: 'Tafelberg – Landung an der Abbruchkante, Fallwinde' };
      if (hs) rows.push(['Schwierige LZ', `${p.name}: ${txt[hs]}`, 'hot']);
    }
    const need = this.fuelNeeded(m);
    if (g.heli.fuel < need) rows.push(['Hinweis', `Treibstoff knapp (${Math.round(g.heli.fuel)} %, benötigt ca. ${Math.round(need)} %) – vorher am Tankwagen (POL) tanken!`, 'hot']);
    return { title: `AUFTRAG #${m.num} – ${m.title}`, rows, radio, hot: m.hot };
  }

  // grobe Schätzung des Treibstoffbedarfs in %
  fuelNeeded(m) {
    const h = this.game.heli;
    const d = dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) + dist2(m.from.x, m.from.z, m.to.x, m.to.z) + (m.to.kind !== 'fob' ? dist2(m.to.x, m.to.z, this.game.world.fob.x, this.game.world.fob.z) : 0);
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
    if (m.type === 'medevac' || (m.type === 'ship' && m.variant === 'med')) { for (let i = 0; i < m.litters; i++) kinds.push('litter'); for (let i = 0; i < m.walking; i++) kinds.push('walking'); }
    else if (m.type === 'csar') for (let i = 0; i < m.count; i++) kinds.push('pilot');
    else if (m.type === 'insert' || m.type === 'exfil' || m.type === 'boat') for (let i = 0; i < m.count; i++) kinds.push('sof');
    else if (m.type === 'resupply') for (let i = 0; i < m.count; i++) kinds.push('cargo');
    else if (m.type === 'vip') kinds.push('vip', 'troop', 'troop');
    else if (!['cas', 'recon', 'winch', 'convoy', 'sling', 'auto'].includes(m.type)) for (let i = 0; i < m.count; i++) kinds.push('troop');
    kinds.forEach((k, i) => {
      let x, z;
      if (m.from.kind === 'fob') { x = m.from.x + 17 + (i % 3) * 1.6; z = m.from.z - 4 + Math.floor(i / 3) * 1.8; }
      else { const a = rand() * Math.PI * 2, r = 4 + rand() * Math.min(12, ((m.from.site && m.from.site.r) || 45) * 0.5); x = m.from.x + Math.cos(a) * r; z = m.from.z + Math.sin(a) * r; }
      U.spawnPassenger(k, x, z, m.id);
    });
    if (m.type === 'winch') this.spawnRoof(m);
    if (m.type === 'convoy') this.spawnConvoy(m);
    if (m.type === 'sling') {
      const S = m.sling, ref = Math.max(...g.helis.filter((x) => x.spec.capacity > 0).map((x) => x.spec.emptyMass));
      (this.slings || (this.slings = new Map())).set(m.id, new SlingLoad(g.scene, S.kind, S.x, Math.max(w.height(S.x, S.z), 0), S.z, ref));
    }
    // Verteidiger
    for (const end of ['from', 'to']) {
      const p = m[end];
      if (p.kind !== 'site' || p.remote) continue;
      if (m.type === 'csar') continue;
      const def = U.spawnDefenders(p.site && p.site.hard ? { ...p, hard: p.site.hard, r: p.site.r } : p, p.site && p.site.hard ? 2 + Math.floor(rand() * 2) : 4 + Math.floor(rand() * 4), m.id);
      if (m.hotAt === end) for (const d of def) d.engage = true;
    }
    // Feind
    if (m.hot) {
      const p = m[m.hotAt];
      const n = m.type === 'cas' ? m.count : 12 + Math.floor(rand() * 8) + Math.min(8, Math.floor(this.count / 2)) + (g.helis.length > 1 ? 5 : 0);
      const en = U.spawnEnemies(p.x, p.z, n, { missionId: m.id, heavy: m.type === 'cas' || rand() < 0.3 + this.count * 0.02 });
      if (m.type === 'cas') m.count = en.length;
      if (U.spawnVehicles && (m.type === 'cas' || rand() < 0.35)) U.spawnVehicles(p.x, p.z, m.type === 'cas' ? 1 + Math.floor(rand() * 3) : 1, { missionId: m.id });
      let sx = 0, sz = 0;
      for (const e of en) { sx += e.x; sz += e.z; }
      m.enemyDir = dirName(bearing(p.x, p.z, sx / en.length, sz / en.length));
    }
    // Exfil: der Feind verfolgt das Team und rückt auf den Aufnahmepunkt vor
    if (m.type === 'exfil' && m.hot) {
      const p = m.from;
      for (const e of U.spawnEnemies(p.x, p.z, 10 + Math.floor(rand() * 6), { missionId: m.id, rMin: 450, rMax: 650, heavy: true })) {
        const a = Math.atan2(e.z - p.z, e.x - p.x) + rand.range(-0.3, 0.3), rr = 90 + rand() * 60;
        e.advance = { x: p.x + Math.cos(a) * rr, z: p.z + Math.sin(a) * rr };
        e.range = e.heavy ? 900 : 520;
      }
    }
    // Aufklärung: an manchen Punkten Feind
    if (m.type === 'recon') {
      for (const p of m.points) if (m.hot && rand() < 0.7) U.spawnEnemies(p.x, p.z, 5 + Math.floor(rand() * 6), { missionId: m.id, rMin: 40, rMax: 200, heavy: rand() < 0.4 });
      if (m.hot && U.spawnVehicles) U.spawnVehicles(m.points[1].x, m.points[1].z, 1, { missionId: m.id, rMin: 50, rMax: 200, roam: true });
    }
    // Auch an „kalten“ LZs lauern ein paar Späher weiter draußen
    for (const end of ['from', 'to']) {
      const p = m[end];
      if (p.kind !== 'site' || m.hotAt === end) continue;
      if (m.type === 'insert' && end === 'to') { U.spawnEnemies(p.x, p.z, 3 + Math.floor(rand() * 3), { missionId: m.id, rMin: 500, rMax: 800 }); continue; }
      U.spawnEnemies(p.x, p.z, 2 + Math.floor(rand() * 3), { missionId: m.id, rMin: 260, rMax: 420 });
    }
    // Wrack
    if (m.type === 'csar') {
      const a = rand() * Math.PI * 2;
      m.wreckInfo = { x: m.from.x + Math.cos(a) * 30, z: m.from.z + Math.sin(a) * 30, r: rand() * 6 };
      this.buildWreck(m);
    }
    g.radio(this.describe(m).radio, m.unit);
    if (m.from.kind === 'fob' && m.type !== 'sling') g.radio(`TOC: Die Truppe wartet neben Pad ${m.from.pad.name}. Landen Sie dort zum Aufnehmen.`, 'TOC');
    this.changed();
  }

  buildWreck(m) {
    const g = this.game, w = g.world, wi = m.wreckInfo;
    m.wreck = new THREE.Mesh(merge(T.id !== 'vietnam' ? wreckAfg(m.aircraft.kind) : wreckParts(m.aircraft.kind)), vcMat);
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
    if (m.boarded >= m.count || this.game.heliLoad(h) >= h.spec.capacity) return false;
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
      const what = m.type === 'ship' && m.variant === 'med' ? `${m.count} Verwundete gerettet` : m.type === 'convoy' ? `${alive} von ${m.count} Fahrzeugen sicher angekommen` : m.type === 'winch' ? 'Alle Personen' : m.type === 'recon' ? `3 Punkte aufgeklärt, ${m.found || 0} Feinde gemeldet` : m.type === 'resupply' ? `${m.count} Kisten Nachschub geliefert` : m.type === 'vip' ? `${m.vip.who} sicher abgesetzt` : m.type === 'insert' ? `${m.unit} unentdeckt abgesetzt` : m.type === 'exfil' ? `${m.unit} herausgeholt` : m.type === 'cas' ? `${m.killed || m.count} Feinde bekämpft` : m.type === 'medevac' ? 'Alle Verwundeten' : m.type === 'csar' ? 'Alle Überlebenden' : 'Alle Soldaten';
      g.radio(`Crew: ${what} an Bord – los, los, los! Kurs ${fmtBearing(b)} nach ${to.name}.`, 'Crew');
    } else if (g.heliLoad(h) >= h.spec.capacity) g.radio('Crew: Kabine voll! Der Rest muss mit dem zweiten Hubschrauber mit.', 'Crew');
    this.changed();
  }

  // Ziel für einen Hubschrauber: mit Passagieren zum Absetzpunkt, sonst zur Aufnahme
  target(h = this.game.heli) {
    const m = this.current;
    if (!m || this.phase !== 'active') return null;
    if (m.type === 'sling') return m.sling.att ? 'to' : 'from';
    if (m.type === 'auto') return 'from';
    if (m.boarded < m.count && this.game.heliLoad(h) < h.spec.capacity) {
      if (this.paxOf(h) === 0 || m.from.kind === 'roof') return 'from';
      // noch beim Einsteigen: am Aufnahmeort bleiben
      if (h.contact && dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) < this.boardRadius()) return 'from';
    }
    if (this.paxOf(h) > 0 || m.boarded >= m.count) return 'to';
    return 'from';
  }

  waypoint(h = this.game.heli) {
    const m = this.current;
    if (m && m.type === 'convoy' && this.phase === 'active') {
      const C = this.convoys.get(m.id), L = C && this.convoyLead(C);
      if (L) return { x: L.obj.position.x, z: L.obj.position.z, y: L.obj.position.y, label: 'Konvoi', radius: 200, convoy: true };
    }
    const t = this.target(h);
    if (!t) return null;
    if (m.type === 'sling') {
      const L = this.slings && this.slings.get(m.id);
      if (t === 'from' && L) return { x: L.pos.x, z: L.pos.z, y: L.pos.y, label: 'Außenlast', radius: 8, winch: true, hoverY: L.pos.y + L.top + 11 };
      const gy = Math.max(this.game.world.height(m.to.x, m.to.z), 0);
      return { x: m.to.x, z: m.to.z, y: m.to.y, label: m.to.short, radius: 25, winch: true, hoverY: gy + ROPE + (L ? L.top : 1.5) + 1.2 };
    }
    if (m.type === 'auto') return { x: m.from.x, z: m.from.z, y: m.from.y, label: m.from.short, radius: 150 };
    if (t === 'from') {
      if (m.type === 'csar' && !m.revealed) return { x: m.approx.x, z: m.approx.z, y: this.game.world.height(m.approx.x, m.approx.z), label: 'Suchgebiet', radius: 400, approx: true };
      if (m.from.kind === 'roof') return { x: m.from.x, z: m.from.z, y: m.from.y, label: m.from.short, radius: 12, winch: true, hoverY: m.from.y + 12 };
      return { x: m.from.x, z: m.from.z, y: m.from.y, label: m.from.short, radius: m.from.kind === 'fob' ? 12 : m.from.kind === 'recon' ? 150 : 45 };
    }
    return { x: m.to.x, z: m.to.z, y: m.to.y, label: m.to.short, radius: m.to.kind === 'fob' ? 12 : 45, water: m.to.kind === 'water' };
  }

  update(dt) {
    const g = this.game, m = this.current, helis = g.helis;
    this.updateBoats(dt);
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
    if (m.type === 'recon') {
      for (const h of helis) {
        const p = m.points[m.idx];
        if (h.crashed || !p) continue;
        if (dist2(h.pos.x, h.pos.z, p.x, p.z) < 180 && h.agl < 180) {
          const seen = g.units.enemies.filter((e) => e.alive && e.missionId === m.id && dist2(e.x, e.z, p.x, p.z) < 350).length;
          for (const e of g.units.enemies) if (e.alive && dist2(e.x, e.z, p.x, p.z) < 350) e.reveal = Math.max(e.reveal, 20);
          g.radio(T.peaceful ? `${g.callsign}: ${p.name} erkundet – Lagebild übermittelt.` : `${g.callsign}: ${p.name} aufgeklärt – ${seen ? `ca. ${seen} Feinde gesichtet!` : 'keine Feindbewegung.'}`, g.callsign, !!seen);
          m.found = (m.found || 0) + seen;
          m.idx++;
          if (m.idx >= m.points.length) { this.complete(); return; }
          m.from = m.points[m.idx];
          this.changed();
        }
      }
      return;
    }
    if (m.type === 'cas') {
      const alive = g.units.enemies.filter((e) => e.alive && e.missionId === m.id && dist2(e.x, e.z, m.from.x, m.from.z) < 500).length;
      m.killed = Math.max(0, (m.total || (m.total = g.units.enemies.filter((e) => e.missionId === m.id).length)) - alive);
      if (alive <= 2) { this.complete(); return; }
      if (m.killed !== m.lastKilled) { m.lastKilled = m.killed; this.changed(); }
    }
    if (m.type === 'convoy') { this.updateConvoy(dt); return; }
    if (m.type === 'winch') this.updateWinch(dt);
    if (m.type === 'sling') { this.updateSling(dt); if (this.phase !== 'active') return; }
    if (m.type === 'auto') { this.updateDrill(dt); return; }
    for (const h of helis) {
      if (h.crashed) continue;
      const end = this.target(h);
      const p = m[end];
      const d = dist2(h.pos.x, h.pos.z, p.x, p.z);
      // Rauch werfen bei Annäherung
      // Nachts markieren alle Truppen (auch Spezialkräfte) mit Blitzlicht
      if (g.nightSys.night && (p.kind === 'site' || p.kind === 'water' || p.kind === 'roof' || p.kind === 'ship') && d < 1500 && !(m.strobe || {})[end] && (m.type !== 'csar' || end !== 'from' || m.revealed)) {
        (m.strobe = m.strobe || {})[end] = true;
        m.emitters.push(g.effects.strobe(p.x + (p.kind === 'roof' || p.kind === 'ship' ? 0 : 3), p.kind === 'roof' || p.kind === 'ship' ? p.y + 0.3 : Math.max(0.3, g.world.height(p.x + 3, p.z)), p.z));
        if (m.noSmoke) g.radio(`${m.unit.split(',')[0]}: Wir hören Sie – IR-Blitzer ist an.`, m.unit.split(',')[0]);
        this.changed();
      }
      if (p.kind === 'site' && d < 1300 && !m.smokePopped[end] && !m.noSmoke && (m.type !== 'csar' || end !== 'from' || m.revealed)) {
        m.smokePopped[end] = true;
        m.emitters.push(g.effects.smokeGrenade(p.x + 4, g.world.height(p.x + 4, p.z), p.z, m.smoke));
        const who = m.type === 'csar' ? m.aircraft.call : m.unit.split(',')[0];
        g.radio(`${who}: ${g.callsign}, wir hören Sie! Rauch ist geworfen – bestätigen Sie ${m.smoke}.`, who);
        setTimeout(() => g.radio(`${g.callsign}: Sehe ${m.smoke}en Rauch, wir kommen rein.`, g.callsign), 2500);
        this.changed();
      }
      if (m.hot && m.hotAt === end && !m.hotWarned && d < 1900) {
        m.hotWarned = true;
        g.radio(`${m.type === 'csar' ? m.aircraft.call : m.unit.split(',')[0]}: Achtung, die LZ ist HEISS! Feindfeuer aus Richtung ${m.enemyDir || T.enemyFrom}!`, 'Funk', true);
      }
      if (m.type === 'csar' && !m.revealed && dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) < 950) {
        m.revealed = true;
        g.radio(`${m.aircraft.call}: Wir sehen einen Hubschrauber! Wir sind ${dirName(bearing(h.pos.x, h.pos.z, m.from.x, m.from.z))} von ihm auf der Lichtung!`, m.aircraft.call);
        this.changed();
      }
      // Absetzen
      if (end === 'to' && this.paxOf(h) > 0) {
        const dd = dist2(h.pos.x, h.pos.z, m.to.x, m.to.z);
        // Bootstrupp: tief und langsam über dem Wasser schweben statt landen
        const near = m.to.kind === 'water' ? !h.contact && h.agl < 4.5 && h.speed < 2.6 && dd < 40 : h.onGround && dd < (m.to.kind === 'fob' ? 28 : 75);
        if (near && !h.unloading) {
          h.unloading = true;
          h.unloadT = 0.6;
          g.radio(m.to.kind === 'water' ? 'Crew: Boot raus – Team springt!' : m.to.kind === 'fob' && m.type !== 'transport' ? 'Sanitäter: Wir übernehmen! Bringt sie ins Lazarett!' : 'Crew: Absetzen – alle raus!', m.to.kind === 'fob' ? 'Sanitäter' : 'Crew');
        }
        if (!near) h.unloading = false;
        if (h.unloading) {
          h.unloadT -= dt;
          if (h.unloadT <= 0) { h.unloadT = h.spec.door === 'ramp' ? 0.3 : 0.7; this.unloadOne(h); } // über die Heckrampe geht es schneller
        }
      } else h.unloading = false;
    }
    if (m.delivered >= m.count) this.complete();
  }

  // ------------------------------------------------------------ Konvoi-Begleitschutz
  // Route von der FOB zur Ziel-LZ: leicht geschwungen, um Wasser herum
  makeRoute(site) {
    const w = this.game.world, f = w.fob;
    const dx = site.x - f.x, dz = site.z - f.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const px = -uz, pz = ux, ph = rand() * 6, amp = 120 + rand() * 160;
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const along = 260 + (L - 300) * t;
      let off = Math.sin(t * Math.PI * 2 + ph) * amp * Math.sin(t * Math.PI);
      let x = f.x + ux * along + px * off, z = f.z + uz * along + pz * off;
      for (let k = 0; k < 12 && w.height(x, z) < 1.2; k++) { off += 60; x = f.x + ux * along + px * off; z = f.z + uz * along + pz * off; }
      pts.push({ x, z, s: 0 });
    }
    for (let i = 1; i < pts.length; i++) pts[i].s = pts[i - 1].s + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    return pts;
  }

  routeAt(route, s) {
    const S = clamp(s, 0, route[route.length - 1].s);
    let i = 1;
    while (i < route.length - 1 && route[i].s < S) i++;
    const a = route[i - 1], b = route[i], t = (S - a.s) / Math.max(1e-6, b.s - a.s);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(-(b.x - a.x), -(b.z - a.z)) };
  }

  spawnConvoy(m) {
    const g = this.game, U = g.units, R = m.route, len = R[R.length - 1].s;
    const vehs = [];
    for (let i = 0; i < m.count; i++) {
      const parts = i === m.count - 1 && m.count > 4 ? fuelTruckAfg() : i % 2 ? mrapParts() : dingoParts();
      const obj = new THREE.Mesh(merge(parts), vcMat);
      obj.castShadow = true;
      g.scene.add(obj);
      vehs.push({ obj, s: (m.count - 1 - i) * 26, hp: 100, dead: false });
    }
    const C = { vehs, len, v: 0, started: false, threat: 0, noCover: false, wasThreat: false };
    this.convoys.set(m.id, C);
    this.placeConvoy(C, m);
    // Hinterhalte entlang der Route (seitlich versetzt), zum Teil mit Technicals
    for (const f of [0.3 + rand() * 0.1, 0.62 + rand() * 0.12]) {
      const p = this.routeAt(R, len * f), side = rand() < 0.5 ? -1 : 1, off = 170 + rand() * 90;
      const ax = p.x + Math.cos(p.yaw) * off * side, az = p.z - Math.sin(p.yaw) * off * side;
      U.spawnEnemies(ax, az, 7 + Math.floor(rand() * 5) + Math.min(5, Math.floor(this.count / 3)), { missionId: m.id, rMin: 0, rMax: 60, heavy: rand() < 0.5 });
      if (U.spawnVehicles && rand() < 0.5) U.spawnVehicles(ax, az, 1, { missionId: m.id, rMin: 20, rMax: 80 });
    }
    g.radio(`${m.unit}: Konvoi ist bereit. Wir rollen an, sobald Sie über uns sind.`, m.unit);
  }

  placeConvoy(C, m) {
    const w = this.game.world;
    for (const v of C.vehs) {
      const p = this.routeAt(m.route, v.s);
      v.obj.position.set(p.x, w.height(p.x, p.z), p.z);
      if (!v.dead) v.obj.rotation.y = p.yaw;
    }
  }

  convoyLead(C) { let L = null; for (const v of C.vehs) if (!v.dead && (!L || v.s > L.s)) L = v; return L; }
  convoyAlive(m) { const C = this.convoys.get(m.id); return C ? C.vehs.filter((v) => !v.dead).length : m.count; }

  clearConvoy(id) {
    const C = this.convoys.get(id);
    if (!C) return;
    for (const v of C.vehs) this.game.scene.remove(v.obj);
    this.convoys.delete(id);
  }

  updateConvoy(dt) {
    const g = this.game, m = this.current, C = this.convoys.get(m.id);
    if (!C) return;
    const L = this.convoyLead(C);
    if (!L) {
      this.phase = 'failed';
      g.radio('TOC: Der Konvoi ist vernichtet. Der Auftrag ist gescheitert.', 'TOC', true);
      this.retire(m); this.nextTimer = 8; this.changed();
      return;
    }
    const lp = L.obj.position;
    const cover = g.helis.some((h) => !h.crashed && Math.hypot(h.pos.x - lp.x, h.pos.z - lp.z) < (C.started ? 1600 : 900));
    if (!C.started && cover) { C.started = true; g.radio(`${m.unit}: Luftsicherung ist da – Konvoi rollt!`, m.unit); this.changed(); }
    // Feind in Reichweite der Fahrzeuge?
    const foes = g.units.enemies.filter((e) => e.alive && e.missionId === m.id);
    let threat = 0;
    for (const e of foes) if (C.vehs.some((v) => !v.dead && Math.hypot(e.x - v.obj.position.x, e.z - v.obj.position.z) < 430)) threat++;
    C.threat = threat;
    C.noCover = C.started && !cover;
    if (threat && !C.wasThreat) g.radio(`${m.unit}: Feuerüberfall! Konvoi hält – Feind ${dirName(bearing(lp.x, lp.z, foes[0].x, foes[0].z))} von uns!`, m.unit, true);
    if (!threat && C.wasThreat) g.radio(`${m.unit}: Feind niedergekämpft – Konvoi fährt weiter.`, m.unit);
    C.wasThreat = threat > 0;
    m.killed = g.units.enemies.filter((e) => e.missionId === m.id && !e.alive).length;
    // Fahren oder halten
    const vt = C.started && !threat && !C.noCover ? 8 : 0;
    C.v += clamp(vt - C.v, -4 * dt, 1.5 * dt);
    for (const v of C.vehs) if (!v.dead) v.s = Math.min(C.len, v.s + C.v * dt);
    this.placeConvoy(C, m);
    // Feind schießt auf die Fahrzeuge
    for (const e of foes) {
      e.cvT = (e.cvT ?? rand() * 3) - dt;
      if (e.cvT > 0) continue;
      e.cvT = 1.6 + rand() * 2.4;
      let tv = null, td = 430;
      for (const v of C.vehs) { if (v.dead) continue; const d = Math.hypot(e.x - v.obj.position.x, e.z - v.obj.position.z); if (d < td) { td = d; tv = v; } }
      if (!tv) continue;
      e.reveal = 7;
      const a = new THREE.Vector3(e.x, e.y + 1.4, e.z), b = tv.obj.position.clone().add(new THREE.Vector3(rand.range(-2, 2), 1.5, rand.range(-2, 2)));
      const hit = rand() < 0.35;
      if (!hit) b.add(new THREE.Vector3(rand.range(-6, 6), rand.range(0, 3), rand.range(-6, 6)));
      g.groundShot(a, b, e.heavy ? 2 : 1, true, hit ? () => this.hitVehicle(tv, e.heavy ? 14 : 6 + rand() * 5) : null);
    }
    if (L.s >= C.len - 1) {
      g.radio(`${m.unit}: Konvoi ist in ${m.to.name} angekommen. Danke für die Begleitung!`, m.unit);
      this.complete();
    }
  }

  hitVehicle(v, dmg) {
    if (v.dead) return;
    v.hp -= dmg;
    if (v.hp > 0) return;
    v.dead = true;
    const p = v.obj.position;
    this.game.effects.explosion(p.x, p.y + 1, p.z, 1.1);
    v.obj.material = this._wreckMat || (this._wreckMat = new THREE.MeshLambertMaterial({ color: 0x2a2624 }));
    this.game.radio('Konvoi: Fahrzeug getroffen und ausgefallen!', 'Funk', true);
    this.changed();
  }

  // ------------------------------------------------------------ Windenrettung
  // ------------------------------------------------------------ Außenlast
  slingHook(h, L) {
    const hook = L.hookPos(h, this._sv || (this._sv = new THREE.Vector3()));
    const top = L.topPos(this._st || (this._st = new THREE.Vector3()));
    const dxz = Math.hypot(hook.x - top.x, hook.z - top.z), above = hook.y - top.y;
    return { dxz, above, ok: !h.crashed && !h.contact && dxz < 4.5 && above > 4 && above < ROPE + 5 && h.speed < 3 };
  }

  updateSling(dt) {
    const g = this.game, m = this.current, S = m.sling, L = this.slings && this.slings.get(m.id);
    if (!L) return;
    let h = S.heli >= 0 ? g.helis[S.heli] : null;
    if (h && h.crashed) h = null;
    if (!S.att) {
      // Anschlagen: Hubschrauber über der Last schweben lassen, Bodenpersonal hängt an
      let best = null;
      for (const x of g.helis) {
        if (x.crashed || x.spec.capacity === 0) continue;
        const i = this.slingHook(x, L);
        if (i.ok) { best = x; break; }
      }
      if (best) {
        S.hookT += dt;
        if (!S.hookMsg) { S.hookMsg = true; g.radio('Bodenpersonal: Position gut – wir hängen an, halten!', 'Lastenhaken'); }
        if (S.hookT > 2.5) {
          S.att = true; S.heli = best.index; h = best;
          g.radio('Bodenpersonal: Last ist angeschlagen – langsam anheben!', 'Lastenhaken');
          this.changed();
        }
      } else S.hookT = Math.max(0, S.hookT - dt);
    }
    const impact = L.update(dt, S.att ? h : null, g.world);
    if (h) h.extMass = S.att && L.taut && !L.grounded ? L.mass : 0;
    if (impact > 6 && S.att) {
      S.dmg += (impact - 6) * 12;
      g.radio(impact > 12 ? 'Lastenhaken: Die Last ist hart aufgeschlagen – zerstört!' : 'Lastenhaken: Last hart aufgesetzt – vorsichtiger!', 'Crew', impact > 12);
      if (impact > 12) S.dmg = 100;
    }
    if (S.dmg >= 100) { this.slingFail('Außenlast zerstört'); return; }
    // Absetzen: Last liegt am Ziel, Seil locker
    if (S.att) {
      const dd = dist2(L.pos.x, L.pos.z, m.to.x, m.to.z);
      if (L.grounded && dd < 35 && L.groundT > 1.2) {
        S.att = false; S.done = true;
        if (h) h.extMass = 0;
        L.update(0, null, g.world);
        g.radio('Lastenhaken: Last steht – ausgeklinkt!', 'Crew');
        m.delivered = 1;
        this.complete();
        return;
      }
      if (!h) { this.slingFail('Hubschrauber mit Außenlast verloren'); return; }
      // zu schnell: Last schlägt aus
      if (h.speed > 46 && !S.warnFast) { S.warnFast = true; g.radio('Crew: Last pendelt stark – langsamer!', 'Crew', true); }
      if (h.speed < 35) S.warnFast = false;
    }
  }

  slingFail(why) {
    const g = this.game, m = this.current;
    const h = m.sling.heli >= 0 ? g.helis[m.sling.heli] : null;
    if (h) h.extMass = 0;
    m.sling.att = false;
    this.phase = 'failed';
    g.radio(`TOC: ${why} – Auftrag gescheitert. Neuer Auftrag folgt.`, 'TOC', true);
    this.retire(m);
    this.nextTimer = 8;
    this.changed();
  }

  slingHint(h, m) {
    const S = m.sling, L = this.slings && this.slings.get(m.id);
    if (!L) return '';
    if (!S.att) {
      if (h.spec.capacity === 0) return 'Kampfhubschrauber haben keinen Lasthaken';
      if (dist2(h.pos.x, h.pos.z, L.pos.x, L.pos.z) > 60) return `Zur Last bei ${m.from.short} fliegen – darüber schweben`;
      const i = this.slingHook(h, L);
      if (i.ok) return `Anschlagen … ${Math.min(100, Math.round(S.hookT / 2.5 * 100))} % – Position halten!`;
      if (i.dxz >= 4.5) return 'Genau über die Last – Haken sitzt unter dem Rumpf';
      if (i.above <= 4) return 'Höher – mindestens 5 m über der Last';
      if (i.above >= ROPE + 5) return 'Tiefer – höchstens 20 m über der Last';
      return 'Langsamer – fast stillstehen';
    }
    const dd = dist2(L.pos.x, L.pos.z, m.to.x, m.to.z);
    if (dd > 60) return `Last nach ${m.to.short} fliegen – ruhig, unter 80 kt (Seil ${ROPE} m)`;
    if (L.grounded && dd >= 35) return 'Last liegt außerhalb – wieder anheben und genauer absetzen';
    return L.grounded ? 'Last steht – Position halten …' : 'Langsam sinken, bis die Last aufsetzt';
  }

  // ------------------------------------------------------------ Autorotationsübung
  updateDrill(dt) {
    const g = this.game, m = this.current, D = m.drill;
    if (D.stage === 'climb') {
      for (const h of g.helis) {
        if (h.crashed || !h.engineOn || g.crews[h.index].pilot == null) continue;
        if (dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) < 1300 && h.agl > 290 && h.speed > 12) {
          D.stage = 'auto'; D.heli = h.index; D.t = g.time;
          if (g.owns(h.index)) h.failEngine('drill');
          this.changed();
          break;
        }
      }
      return;
    }
    const h = g.helis[D.heli];
    if (!h || h.crashed) return;
    if (D.stage === 'auto' && h.onGround) {
      D.stage = 'done';
      const dd = dist2(h.pos.x, h.pos.z, m.from.x, m.from.z);
      const vy = -(h.touchVy || 0);
      D.dist = Math.round(dd); D.vy = Math.round(vy * 10) / 10;
      g.radio(`Ausbilder: ${vy < 2 ? 'Butterweich aufgesetzt' : vy < 4.2 ? 'Sauber aufgesetzt' : 'Das war hart'} – ${dd < 60 ? 'genau auf der Übungsfläche' : dd < 300 ? `${Math.round(dd)} m neben der Mitte` : 'weit neben der Übungsfläche'}. Triebwerk wird gleich wieder angelassen.`, 'Ausbilder');
      m.delivered = 1;
      this.complete();
    }
  }

  drillHint(h, m) {
    const D = m.drill;
    if (D.stage === 'climb') {
      const dd = dist2(h.pos.x, h.pos.z, m.from.x, m.from.z);
      if (dd > 1300) return `Zur ${m.from.short} fliegen`;
      if (h.agl <= 290) return `Steigen: ${Math.round(h.agl * 3.28)} / 1000 ft über Grund`;
      return 'Mit Fahrt über die Übungsfläche – gleich kommt der Ausfall';
    }
    if (h.engineOn) return 'Übung läuft …';
    if (h.agl > 40) return `Autorotation: Kollektiv runter, Rotor ${Math.round(h.rpm * 100)} % – Übungsfläche anfliegen`;
    if (h.agl > 8) return 'Abfangen: Nase hoch, Fahrt abbauen!';
    return 'Jetzt Kollektiv ziehen – weich aufsetzen!';
  }

  hoistInfo(h, m) {
    const r = m.from.roof;
    const hp = h.model.group.localToWorld((this._hv || (this._hv = new THREE.Vector3())).copy(h.model.hoist || new THREE.Vector3(1.4, 0.8, -1)));
    const dxz = Math.hypot(hp.x - r.x, hp.z - r.z), above = hp.y - r.ridge;
    return { hp, dxz, above, ok: !h.crashed && !h.contact && dxz < 7 && above > 3 && above < 32 && h.speed < 2.5 };
  }

  spawnRoof(m) {
    const r = m.from.roof, g = this.game;
    const dx = Math.sin(r.rot), dz = Math.cos(r.rot);
    const figs = [];
    for (let i = 0; i < m.count; i++) {
      const f = new Figure(figFor('civ'));
      const o = (i - (m.count - 1) / 2) * 1.5;
      f.group.position.set(r.x + dx * o, r.ridge - 0.15, r.z + dz * o);
      f.group.rotation.y = Math.random() * Math.PI * 2;
      f.base = f.group.rotation.y;
      g.scene.add(f.group);
      figs.push(f);
    }
    this.roofs.set(m.id, { figs, hang: null });
  }

  clearRoof(id) {
    const R = this.roofs.get(id);
    if (!R) return;
    for (const f of R.figs) this.game.scene.remove(f.group);
    if (R.hang) this.game.scene.remove(R.hang.group);
    this.roofs.delete(id);
    if (this.cable) this.cable.visible = false;
  }

  drawCable(a, len) {
    if (!this.cable) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      this.cable = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x111111 }));
      this.cable.frustumCulled = false;
      this.game.scene.add(this.cable);
    }
    this.cable.visible = !!a && len > 0.05;
    if (!this.cable.visible) return;
    const p = this.cable.geometry.attributes.position;
    p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, a.x, a.y - len, a.z);
    p.needsUpdate = true;
  }

  updateWinch(dt) {
    const g = this.game, m = this.current, W = m.winch, R = this.roofs.get(m.id);
    if (!R) return;
    const t = performance.now() / 1000;
    R.figs.forEach((f, i) => { f.group.rotation.y = f.base + Math.sin(t * 2 + i) * 0.6; });   // winken, Ausschau halten
    // Hubschrauber mit Winde, der dem Dach am nächsten ist
    let h = null, bd = 1e9;
    for (const x of g.helis) {
      if (x.crashed || !x.spec.hoist || g.heliLoad(x) >= x.spec.capacity) continue;
      const d = dist2(x.pos.x, x.pos.z, m.from.x, m.from.z);
      if (d < bd) { bd = d; h = x; }
    }
    if (!h || (bd > 90 && W.phase === 'down')) { W.len = Math.max(0, W.len - 3 * dt); this.drawCable(null, 0); return; }
    const info = this.hoistInfo(h, m);
    if (W.phase === 'down') {
      if (m.boarded >= m.count) { this.drawCable(null, 0); return; }
      if (info.ok) {
        if (!W.started) { W.started = true; g.radio('Windenbediener: Winde läuft – Retter geht runter!', 'Crew'); }
        W.len += 2.6 * dt;
        if (W.len >= info.above - 0.2 && R.figs.length) { W.phase = 'up'; R.hang = R.figs.pop(); }
      } else W.len = Math.max(0, W.len - 1.5 * dt);
    } else {
      W.len -= 1.8 * dt;
      if (W.len <= 0.4) {
        W.phase = 'down'; W.len = 0;
        if (R.hang) { g.scene.remove(R.hang.group); R.hang = null; }
        this.onBoard({ paxType: 'civ' }, h);
      }
    }
    this.drawCable(info.hp, W.len);
    if (R.hang) {
      R.hang.group.position.set(info.hp.x, info.hp.y - W.len - 1.55, info.hp.z);
      R.hang.group.rotation.y += dt * 0.8;
    }
  }

  winchHint(h, m) {
    if (!h.spec.hoist) return 'Dieser Hubschrauber hat keine Winde';
    if (dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) > 60) return `Nach ${m.from.short} fliegen – über dem Dach schweben`;
    const i = this.hoistInfo(h, m);
    if (m.winch && m.winch.phase === 'up') return `Windenbetrieb: ${m.boarded}/${m.count} – Person wird hochgezogen`;
    if (i.ok) return `Windenbetrieb: ${m.boarded}/${m.count} – Position halten!`;
    if (i.dxz >= 7) return 'Näher ans Dach – die Winde ist rechts an der Tür';
    if (i.above <= 3) return 'Höher – mindestens 3 m über dem First';
    if (i.above >= 32) return 'Tiefer – höchstens 30 m über dem Dach';
    return 'Langsamer – fast stillstehen';
  }

  unloadOne(h) {
    const g = this.game, m = this.current;
    const idx = h.passengers.findIndex((p) => p.missionId === m.id);
    if (idx < 0) return;
    const p = h.passengers.splice(idx, 1)[0];
    h.updatePassengerDisplay();
    if (m.to.kind === 'water') {
      // Team springt ins Wasser und steigt ins Boot
      const b = this.boatFor(m, h);
      const e = g.effects;
      e.puff(h.pos.x + rand.range(-2, 2), 0.3, h.pos.z + rand.range(-2, 2), 0.86, 0.9, 0.92, 8, 2.2, 2.5, 1.1);
      if (b.figs < 6) {
        const fg = new Figure(T.sof || 'sof');
        fg.group.position.set((b.figs % 2 ? 0.55 : -0.55), 0.25, 1.2 - Math.floor(b.figs / 2) * 1.0);
        fg.sit(1.2, -0.2);
        b.obj.add(fg.group);
        b.figs++;
      }
      m.delivered++;
      g.stats.transported++;
      if (m.delivered >= m.count) b.go = true;
      this.changed();
      return;
    }
    const from = h.doorPoint(m.delivered % 2 ? 'left' : 'right');
    const f = g.world.fob;
    let target, onArrive = null;
    if (m.to.kind === 'fob') {
      target = LIFT.includes(m.type) ? { x: f.x - 100 + rand() * 20, z: f.z + 40 + rand() * 30 } : { x: f.hospitalDoor.x + rand.range(-1, 1), z: f.hospitalDoor.z };
    } else {
      const a = rand() * Math.PI * 2, r = m.type === 'insert' ? 70 + rand() * 30 : m.to.kind === 'ship' ? 2 + rand() * 4 : 25 + rand() * 12;
      target = { x: m.to.x + Math.cos(a) * r, z: m.to.z + Math.sin(a) * r };
      const id = m.id, eng = m.hotAt === 'to';
      // Spezialkräfte verschwinden im Gelände, Kistenträger und VIP gehen in den Außenposten
      if (['insert', 'resupply', 'vip'].includes(m.type)) onArrive = (u) => g.units.removeUnit(u);
      else onArrive = (u) => {
        g.units.setPose(u, 1);
        Object.assign(u, { missionId: id, engage: eng, fireT: rand() * 2, burst: 0, shotT: 0 });
        g.units.friendlies.push(u);
      };
    }
    g.units.spawnWalker(p.type, from, target, onArrive);
    m.delivered++;
    if (m.type === 'medevac' || m.type === 'csar' || m.type === 'winch' || (m.type === 'ship' && m.variant === 'med')) g.stats.rescued++; else g.stats.transported++;
    this.changed();
  }

  // Schlauchboot neben dem Hubschrauber auf dem Wasser
  boatFor(m, h) {
    if (m.boat) return m.boat;
    const parts = [
      P(new THREE.BoxGeometry(1.5, 0.35, 4.6), 0x2b2e2f, [0, 0.05, 0]),
      P(new THREE.CylinderGeometry(0.32, 0.32, 4.4, 12), 0x1d2022, [-0.95, 0.2, 0], [Math.PI / 2, 0, 0]),
      P(new THREE.CylinderGeometry(0.32, 0.32, 4.4, 12), 0x1d2022, [0.95, 0.2, 0], [Math.PI / 2, 0, 0]),
      P(new THREE.SphereGeometry(0.62, 12, 8), 0x1d2022, [0, 0.2, -2.2]),
      P(new THREE.BoxGeometry(0.45, 0.8, 0.4), 0x111213, [0, 0.45, 2.45]),
    ];
    const obj = new THREE.Group();
    obj.add(new THREE.Mesh(merge(parts), vcMat));
    obj.position.set(h.pos.x - h.fwd.x * 3, 0.1, h.pos.z - h.fwd.z * 3);
    obj.rotation.y = h.yaw;
    this.game.scene.add(obj);
    m.boat = { obj, figs: 0, go: false, t: 0 };
    this.boats.push(m.boat);
    return m.boat;
  }

  // Boote fahren nach dem Absetzen flussab und verschwinden
  updateBoats(dt) {
    const w = this.game.world;
    for (let i = this.boats.length - 1; i >= 0; i--) {
      const b = this.boats[i], o = b.obj;
      o.position.y = 0.1 + Math.sin(performance.now() / 400 + i) * 0.05;
      if (!b.go) continue;
      b.t += dt;
      const sp = Math.min(8, b.t * 2);
      // Kurs halten, solange voraus Wasser ist, sonst den Fluss entlang drehen
      let best = o.rotation.y, bestScore = -1;
      for (let k = -4; k <= 4; k++) {
        const a = o.rotation.y + k * 0.25;
        const ok = [12, 25, 40].filter((r) => w.height(o.position.x - Math.sin(a) * r, o.position.z - Math.cos(a) * r) < -0.6).length;
        const score = ok * 10 - Math.abs(k);
        if (score > bestScore) { bestScore = score; best = a; }
      }
      o.rotation.y += clamp(best - o.rotation.y, -dt * 0.8, dt * 0.8);
      o.position.x -= Math.sin(o.rotation.y) * sp * dt;
      o.position.z -= Math.cos(o.rotation.y) * sp * dt;
      if (b.t > 0.5 && rand() < dt * 8) this.game.effects.puff(o.position.x + Math.sin(o.rotation.y) * 2.6, 0.2, o.position.z + Math.cos(o.rotation.y) * 2.6, 0.9, 0.93, 0.95, 1, 1.0, 0.5, 0.8);
      if (b.t > 120) { this.game.scene.remove(o); this.boats.splice(i, 1); }
    }
  }

  complete() {
    const g = this.game, m = this.current;
    this.phase = 'done';
    const elapsed = g.time - m.acceptTime;
    const alive = m.type === 'convoy' ? this.convoyAlive(m) : 0;
    const D = m.drill;
    const drillPts = D ? Math.max(0, 300 - (D.dist || 0) * 1.5) + (D.vy < 2 ? 250 : D.vy < 4.2 ? 120 : 0) : 0;
    const base = m.type === 'auto' ? Math.round(350 + drillPts) : m.type === 'sling' ? (m.sling.kind === 'jeep' ? 650 : 480) * (1 - (m.sling.dmg || 0) / 200) : m.type === 'convoy' ? alive * 130 + (m.killed || 0) * 15 : m.type === 'winch' ? m.count * 160 : m.type === 'cas' ? (m.killed || m.count) * 45 : m.type === 'recon' ? 450 + (m.found || 0) * 20 : m.type === 'vip' ? 500 : m.type === 'resupply' ? m.count * 60 : m.count * 100;
    const hardLZ = m.type === 'boat' || m.type === 'winch' || m.type === 'convoy' || [m.from, m.to].some((p) => p && p.site && p.site.hard);
    const mult = (m.hot ? 1.5 : 1) * (m.type === 'csar' ? 1.3 : 1) * (hardLZ ? 1.3 : 1);
    const timeBonus = Math.max(0, Math.round(300 - elapsed));
    const dmg = this.teamDamage() - m.damage0;
    const dmgBonus = dmg < 1 ? 150 : 0;
    const score = Math.round(base * mult + timeBonus + dmgBonus);
    const what = m.type === 'auto' ? `Autorotation: ${D.dist ?? '–'} m neben der Mitte, ${D.vy ?? '–'} m/s beim Aufsetzen` : m.type === 'sling' ? (m.sling.kind === 'jeep' ? 'Fahrzeug geborgen' : m.sling.kind === 'bags' ? 'Sandsäcke am Deich abgesetzt' : 'Nachschub als Außenlast geliefert') + (m.sling.dmg ? ` (Last ${Math.round(m.sling.dmg)} % beschädigt)` : '') : m.type === 'winch' ? `${m.count} ${m.count === 1 ? 'Person' : 'Personen'} gerettet` : m.type === 'medevac' ? `${m.count} Verwundete gerettet` : m.type === 'csar' ? `${m.count} ${m.count === 1 ? 'Pilot' : 'Besatzungsmitglieder'} gerettet` : `${m.count} Soldaten verbracht`;
    const result = {
      title: 'AUFTRAG ERFÜLLT',
      score,
      lines: [
        [what, `+${Math.round(base * mult)}`],
        m.hot ? ['Heiße LZ', '×1,5'] : null,
        hardLZ ? [m.type === 'winch' ? 'Windenrettung' : m.type === 'convoy' ? 'Begleitschutz' : 'Schwierige LZ', '×1,3'] : null,
        ['Zeitbonus', `+${timeBonus}`],
        dmgBonus ? ['Ohne Schaden', `+${dmgBonus}`] : ['Schaden genommen', `${Math.round(dmg)} %`],
        ['Gesamt', `${score} Punkte`],
      ].filter(Boolean),
    };
    g.onMissionResult(result, m, { dmg });
    if (g.net) g.net.send({ t: 'result', r: result });
    if (m.type === 'cas') g.radio(`${m.unit.split(',')[0]}: Feind zieht sich zurück – danke für die Unterstützung, ${g.callsign}!`, m.unit.split(',')[0]);
    else g.radio(LIFT.includes(m.type) || m.type === 'recon' || (m.type === 'ship' && m.variant === 'troop') ? `TOC: Gut gemacht, ${g.callsign}. Auftrag erledigt.` : `Lazarett: Danke, ${g.callsign}! Ihr habt Leben gerettet.`, 'TOC');
    this.retire(m);
    this.nextTimer = g.career && g.career.on && g.career.st.shiftN === 0 ? 25 : 7;   // nach einem Einsatztag kurze Ruhezeit
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
    this.clearRoof(m.id);
    this.clearConvoy(m.id);
    const L = this.slings && this.slings.get(m.id);
    if (L) { L.dispose(g.scene); this.slings.delete(m.id); }
  }

  // Ein Hubschrauber ist abgestürzt: seine Passagiere sind verloren
  onHeliLost(h) {
    const m = this.current;
    const lost = this.paxOf(h);
    h.passengers = [];
    h.updatePassengerDisplay();
    if (this.game.role === 'client') return;
    if (m && m.type === 'sling' && m.sling.att && m.sling.heli === h.index && this.phase === 'active') { this.slingFail('Hubschrauber mit Außenlast abgestürzt'); return; }
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
    const skip = new Set(['wreck', 'emitters', 'boat']);
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
      const keep = { emitters: m.emitters, wreck: m.wreck, mirrorSmoke: m.mirrorSmoke, mirrorStrobe: m.mirrorStrobe };
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
      if (m.strobe && m.strobe[end] && !(m.mirrorStrobe = m.mirrorStrobe || {})[end]) {
        m.mirrorStrobe[end] = true;
        const p = m[end];
        m.emitters.push(this.game.effects.strobe(p.x + 3, this.game.world.height(p.x + 3, p.z), p.z));
      }
    }
  }

  hudInfo(h = this.game.heli) {
    const m = this.current;
    if (!m) return { line: this.nextTimer > 0 || this.phase === 'done' ? 'Warte auf neuen Auftrag…' : '', step: '' };
    const one = m.count === 1;
    if (m.type === 'cas') {
      const left = Math.max(0, (m.total || m.count) - (m.killed || 0));
      const step = this.phase === 'briefing' ? 'Neuer Auftrag – Briefing bestätigen' : `Feind bei ${m.from.name} bekämpfen – noch ca. ${left} (eigene Truppe: ${m.smoke}er Rauch)`;
      return { line: `${m.title} · ${m.from.name} · HEISS`, step, hot: true };
    }
    if (m.type === 'convoy') {
      const C = this.convoys.get(m.id);
      const alive = this.convoyAlive(m);
      let step = 'Neuer Auftrag – Briefing bestätigen';
      if (this.phase === 'active' && C) {
        const L = this.convoyLead(C);
        step = !C.started ? 'Zum Konvoi fliegen – er fährt los, sobald Sie über ihm sind'
          : C.threat ? `Hinterhalt! ${C.threat} Feinde bekämpfen – der Konvoi hält`
          : C.noCover ? 'Konvoi wartet – Luftsicherung fehlt, zurück zum Konvoi!'
          : `Konvoi nach ${m.to.name} begleiten – noch ${fmtDist(Math.max(0, C.len - (L ? L.s : 0)))}`;
      }
      return { line: `${m.title} · ${alive}/${m.count} Fahrzeuge`, step, hot: !!(C && C.threat) };
    }
    if (m.type === 'recon') {
      const p = m.points[Math.min(m.idx, 2)];
      const step = this.phase === 'briefing' ? 'Neuer Auftrag – Briefing bestätigen' : `Punkt ${m.idx + 1}/3: ${p.name} tief überfliegen (unter 180 m über Grund)`;
      return { line: `${m.title} · ${m.idx}/3 Punkte`, step, hot: m.hot };
    }
    const n = m.type === 'ship' ? (m.variant === 'med' ? (one ? 'Verwundeter' : 'Verwundete') : 'Soldaten') : m.type === 'winch' ? (one ? 'Person' : 'Personen') : m.type === 'resupply' ? (one ? 'Kiste' : 'Kisten') : m.type === 'vip' ? 'Personen' : m.type === 'insert' || m.type === 'exfil' || m.type === 'boat' ? (T.peaceful ? 'Retter' : 'Spezialkräfte') : T.peaceful && m.type === 'transport' ? 'Helfer' : m.type === 'medevac' ? (one ? 'Verwundeter' : 'Verwundete') : m.type === 'csar' ? (one ? 'Überlebender' : 'Überlebende') : one ? 'Soldat' : 'Soldaten';
    let step = '';
    const t = this.target(h);
    const left = m.count - m.boarded;
    if (m.type === 'sling' || m.type === 'auto') {
      const st = this.phase === 'briefing' ? 'Neuer Auftrag – Briefing bestätigen' : this.phase !== 'active' ? '' : m.type === 'sling' ? this.slingHint(h, m) : this.drillHint(h, m);
      return { line: m.type === 'sling' ? `${m.title} · ${m.sling.att ? 'Last am Haken' : 'Last aufnehmen'}` : `${m.title} · Übung`, step: st, hot: m.hot };
    }
    if (this.phase === 'briefing') step = 'Neuer Auftrag – Briefing bestätigen';
    else if (t === 'from') {
      if (m.from.kind === 'roof') step = this.winchHint(h, m);
      else if (h.onGround && dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) < this.boardRadius()) step = `Einsteigen: ${m.boarded}/${m.count} – Position halten!`;
      else if (m.type === 'csar' && !m.revealed) step = 'Suchgebiet anfliegen – nach Rauchsäule des Wracks Ausschau halten';
      else if (m.from.kind === 'fob') step = `Auf Pad ${m.from.pad.name} landen – Soldaten aufnehmen`;
      else if (m.from.kind === 'ship') step = `Auf dem Flugdeck der Fregatte landen – ${left} ${left === 1 ? 'wartet' : 'warten'}`;
      else step = `Bei ${m.from.name} landen (${m.smoke}er Rauch) – ${left} ${left === 1 ? 'wartet' : 'warten'}`;
    } else if (t === 'to') {
      if (h.unloading) step = m.to.kind === 'water' ? `Absprung: ${m.delivered}/${m.count} – Position halten!` : `Aussteigen: ${m.delivered}/${m.count} – am Boden bleiben`;
      else if (this.paxOf(h) === 0) step = `Alle aufgenommen – ${m.delivered}/${m.count} abgeliefert`;
      else if (m.to.kind === 'water') {
        const dd = dist2(h.pos.x, h.pos.z, m.to.x, m.to.z);
        step = dd > 60 ? `Nach ${m.to.name} fliegen – über dem Wasser schweben, nicht wassern` : h.agl >= 4.5 ? 'Tiefer – unter 4 m über dem Wasser schweben' : h.speed >= 2.6 ? 'Langsamer – fast stillstehen' : 'Position halten – Team springt ab …';
      } else step = m.to.kind === 'fob' ? `${T.peaceful ? 'Zur Einsatzbasis' : 'Zur FOB'} – auf Pad ${m.to.pad.name} landen${m.to.pad.name === 'MED' ? ' (rotes Kreuz)' : ''}` : `Nach ${m.to.name} fliegen und landen`;
    }
    return { line: T.peaceful ? `${m.title} · ${m.count} ${n}` : `${m.title} · ${m.count} ${n} · ${m.hot ? 'HEISS' : 'KALT'}`, step, hot: m.hot };
  }
}
