// Auftragserzeugung und -ablauf: MEDEVAC, Truppentransport, CSAR
import * as THREE from './lib/three.module.min.js';
import { T, figFor } from './theme.js';
import { wreckAfg } from './afgModels.js';
import { rand, clamp, bearing, dirName, fmtDist, fmtBearing, dist2 } from './util.js';
import { wreckParts, merge, vcMat, P, Figure } from './models.js';

const NATO = ['Kilo', 'Lima', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Tango', 'Victor', 'Whiskey', 'Yankee', 'Zulu', 'Hotel'];
// Aufträge, bei denen Soldaten/Personen/Ladung transportiert werden (nicht Verwundete)
const LIFT = ['transport', 'insert', 'exfil', 'resupply', 'vip', 'boat'];
const TYPE_WEIGHTS = [['medevac', 30], ['transport', 13], ['csar', 11], ['insert', 10], ['exfil', 10], ['resupply', 10], ['recon', 8], ['vip', 8], ['boat', 8]];
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
    if (noCabin || (anyGunship && rand() < 0.3)) type = 'cas';
    // Bootstrupp: nur wenn es in Reichweite breites Wasser gibt
    const water = type === 'boat' ? w.findWater(rand, 2500, 5600, this.recentPts) : null;
    if (type === 'boat' && !water) type = 'medevac';
    // Windenrettung: ein überflutetes Haus, auf dessen Dach Menschen ausharren
    const roof = type === 'winch' ? this.pickRoof() : null;
    if (type === 'winch' && !roof) type = 'medevac';
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
      const txt = { peak: 'Gipfel-LZ – kleine Landefläche, Fallwinde, steile Hänge', valley: 'enges Flusstal – hohe Hänge, wenig Platz', ridge: 'Hang-LZ – schmaler Absatz am Steilhang, Rotor frei halten', wadi: 'Wadi – enges Trockental zwischen Böschungen, starker Staub' };
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
    if (m.type === 'medevac') { for (let i = 0; i < m.litters; i++) kinds.push('litter'); for (let i = 0; i < m.walking; i++) kinds.push('walking'); }
    else if (m.type === 'csar') for (let i = 0; i < m.count; i++) kinds.push('pilot');
    else if (m.type === 'insert' || m.type === 'exfil' || m.type === 'boat') for (let i = 0; i < m.count; i++) kinds.push('sof');
    else if (m.type === 'resupply') for (let i = 0; i < m.count; i++) kinds.push('cargo');
    else if (m.type === 'vip') kinds.push('vip', 'troop', 'troop');
    else if (m.type !== 'cas' && m.type !== 'recon' && m.type !== 'winch') for (let i = 0; i < m.count; i++) kinds.push('troop');
    kinds.forEach((k, i) => {
      let x, z;
      if (m.from.kind === 'fob') { x = m.from.x + 17 + (i % 3) * 1.6; z = m.from.z - 4 + Math.floor(i / 3) * 1.8; }
      else { const a = rand() * Math.PI * 2, r = 4 + rand() * Math.min(12, ((m.from.site && m.from.site.r) || 45) * 0.5); x = m.from.x + Math.cos(a) * r; z = m.from.z + Math.sin(a) * r; }
      U.spawnPassenger(k, x, z, m.id);
    });
    if (m.type === 'winch') this.spawnRoof(m);
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
    if (m.from.kind === 'fob') g.radio(`TOC: Die Truppe wartet neben Pad ${m.from.pad.name}. Landen Sie dort zum Aufnehmen.`, 'TOC');
    this.changed();
  }

  buildWreck(m) {
    const g = this.game, w = g.world, wi = m.wreckInfo;
    m.wreck = new THREE.Mesh(merge(T.id === 'afghanistan' ? wreckAfg(m.aircraft.kind) : wreckParts(m.aircraft.kind)), vcMat);
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
      const what = m.type === 'winch' ? 'Alle Personen' : m.type === 'recon' ? `3 Punkte aufgeklärt, ${m.found || 0} Feinde gemeldet` : m.type === 'resupply' ? `${m.count} Kisten Nachschub geliefert` : m.type === 'vip' ? `${m.vip.who} sicher abgesetzt` : m.type === 'insert' ? `${m.unit} unentdeckt abgesetzt` : m.type === 'exfil' ? `${m.unit} herausgeholt` : m.type === 'cas' ? `${m.killed || m.count} Feinde bekämpft` : m.type === 'medevac' ? 'Alle Verwundeten' : m.type === 'csar' ? 'Alle Überlebenden' : 'Alle Soldaten';
      g.radio(`Crew: ${what} an Bord – los, los, los! Kurs ${fmtBearing(b)} nach ${to.name}.`, 'Crew');
    } else if (g.heliLoad(h) >= h.spec.capacity) g.radio('Crew: Kabine voll! Der Rest muss mit dem zweiten Hubschrauber mit.', 'Crew');
    this.changed();
  }

  // Ziel für einen Hubschrauber: mit Passagieren zum Absetzpunkt, sonst zur Aufnahme
  target(h = this.game.heli) {
    const m = this.current;
    if (!m || this.phase !== 'active') return null;
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
    const t = this.target(h);
    if (!t) return null;
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
    if (m.type === 'winch') this.updateWinch(dt);
    for (const h of helis) {
      if (h.crashed) continue;
      const end = this.target(h);
      const p = m[end];
      const d = dist2(h.pos.x, h.pos.z, p.x, p.z);
      // Rauch werfen bei Annäherung
      // Nachts markieren alle Truppen (auch Spezialkräfte) mit Blitzlicht
      if (g.nightSys.night && (p.kind === 'site' || p.kind === 'water' || p.kind === 'roof') && d < 1500 && !(m.strobe || {})[end] && (m.type !== 'csar' || end !== 'from' || m.revealed)) {
        (m.strobe = m.strobe || {})[end] = true;
        m.emitters.push(g.effects.strobe(p.x + (p.kind === 'roof' ? 0 : 3), p.kind === 'roof' ? p.y + 0.3 : Math.max(0.3, g.world.height(p.x + 3, p.z)), p.z));
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

  // ------------------------------------------------------------ Windenrettung
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
      const a = rand() * Math.PI * 2, r = m.type === 'insert' ? 70 + rand() * 30 : 25 + rand() * 12;
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
    if (m.type === 'medevac' || m.type === 'csar' || m.type === 'winch') g.stats.rescued++; else g.stats.transported++;
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
    const base = m.type === 'winch' ? m.count * 160 : m.type === 'cas' ? (m.killed || m.count) * 45 : m.type === 'recon' ? 450 + (m.found || 0) * 20 : m.type === 'vip' ? 500 : m.type === 'resupply' ? m.count * 60 : m.count * 100;
    const hardLZ = m.type === 'boat' || m.type === 'winch' || [m.from, m.to].some((p) => p && p.site && p.site.hard);
    const mult = (m.hot ? 1.5 : 1) * (m.type === 'csar' ? 1.3 : 1) * (hardLZ ? 1.3 : 1);
    const timeBonus = Math.max(0, Math.round(300 - elapsed));
    const dmg = this.teamDamage() - m.damage0;
    const dmgBonus = dmg < 1 ? 150 : 0;
    const score = Math.round(base * mult + timeBonus + dmgBonus);
    const what = m.type === 'winch' ? `${m.count} ${m.count === 1 ? 'Person' : 'Personen'} gerettet` : m.type === 'medevac' ? `${m.count} Verwundete gerettet` : m.type === 'csar' ? `${m.count} ${m.count === 1 ? 'Pilot' : 'Besatzungsmitglieder'} gerettet` : `${m.count} Soldaten verbracht`;
    const result = {
      title: 'AUFTRAG ERFÜLLT',
      score,
      lines: [
        [what, `+${Math.round(base * mult)}`],
        m.hot ? ['Heiße LZ', '×1,5'] : null,
        hardLZ ? [m.type === 'winch' ? 'Windenrettung' : 'Schwierige LZ', '×1,3'] : null,
        ['Zeitbonus', `+${timeBonus}`],
        dmgBonus ? ['Ohne Schaden', `+${dmgBonus}`] : ['Schaden genommen', `${Math.round(dmg)} %`],
        ['Gesamt', `${score} Punkte`],
      ].filter(Boolean),
    };
    g.onMissionResult(result);
    if (g.net) g.net.send({ t: 'result', r: result });
    if (m.type === 'cas') g.radio(`${m.unit.split(',')[0]}: Feind zieht sich zurück – danke für die Unterstützung, ${g.callsign}!`, m.unit.split(',')[0]);
    else g.radio(LIFT.includes(m.type) || m.type === 'recon' ? `TOC: Gut gemacht, ${g.callsign}. Auftrag erledigt.` : `Lazarett: Danke, ${g.callsign}! Ihr habt Leben gerettet.`, 'TOC');
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
    this.clearRoof(m.id);
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
    if (m.type === 'recon') {
      const p = m.points[Math.min(m.idx, 2)];
      const step = this.phase === 'briefing' ? 'Neuer Auftrag – Briefing bestätigen' : `Punkt ${m.idx + 1}/3: ${p.name} tief überfliegen (unter 180 m über Grund)`;
      return { line: `${m.title} · ${m.idx}/3 Punkte`, step, hot: m.hot };
    }
    const n = m.type === 'winch' ? (one ? 'Person' : 'Personen') : m.type === 'resupply' ? (one ? 'Kiste' : 'Kisten') : m.type === 'vip' ? 'Personen' : m.type === 'insert' || m.type === 'exfil' || m.type === 'boat' ? (T.peaceful ? 'Retter' : 'Spezialkräfte') : T.peaceful && m.type === 'transport' ? 'Helfer' : m.type === 'medevac' ? (one ? 'Verwundeter' : 'Verwundete') : m.type === 'csar' ? (one ? 'Überlebender' : 'Überlebende') : one ? 'Soldat' : 'Soldaten';
    let step = '';
    const t = this.target(h);
    const left = m.count - m.boarded;
    if (this.phase === 'briefing') step = 'Neuer Auftrag – Briefing bestätigen';
    else if (t === 'from') {
      if (m.from.kind === 'roof') step = this.winchHint(h, m);
      else if (h.onGround && dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) < this.boardRadius()) step = `Einsteigen: ${m.boarded}/${m.count} – Position halten!`;
      else if (m.type === 'csar' && !m.revealed) step = 'Suchgebiet anfliegen – nach Rauchsäule des Wracks Ausschau halten';
      else if (m.from.kind === 'fob') step = `Auf Pad ${m.from.pad.name} landen – Soldaten aufnehmen`;
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
