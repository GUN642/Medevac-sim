// Zusätzliche Auftragsarten und Lagen für mehr Abwechslung:
//  - Löschwassereinsatz (Außenlastbehälter im Fluss füllen, über dem Brand entleeren)
//  - Fast-Rope / Abseilen (Team seilt sich im Schwebeflug ab, wo keine Landung möglich ist)
//  - Vermisstensuche (Suchgebiet tief absuchen, Person entdecken, landen und aufnehmen)
//  - Zusatzlagen: Zeitdruck (Urgent Surgical), Mörserbeschuss an der LZ, Flugabwehr auf der Route
// Die Funktionen werden aus missions.js aufgerufen (Missions-Instanz M, Auftrag m).
import * as THREE from './lib/three.module.min.js';
import { T } from './theme.js';
import { rand, clamp, bearing, dirName, fmtDist, fmtBearing, dist2 } from './util.js';
import { HALF } from './config.js';
import { SlingLoad, ROPE, SLING_MASS } from './sling.js';

const NATO = ['Alpha', 'Bravo', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'India', 'Juliett', 'Mike', 'November', 'Sierra', 'Uniform'];
const fmtClock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

// ===================================================================== Löschwassereinsatz
const FIRE_TXT = {
  vietnam: { title: 'LÖSCHWASSEREINSATZ', what: (n) => `Das Dorf ${n} brennt nach einem Mörserangriff`, unit: 'Distriktberater' },
  afghanistan: { title: 'LÖSCHWASSEREINSATZ', what: (n) => `Feldbrand bei ${n} – das Feuer bedroht die Gehöfte`, unit: 'PRT Kunduz' },
  mali: { title: 'LÖSCHWASSEREINSATZ', what: (n) => `Buschfeuer bei ${n} – der Wind treibt es auf das Dorf zu`, unit: 'Zivil-militärische Zusammenarbeit' },
  ukraine: { title: 'LÖSCHWASSEREINSATZ', what: (n) => `Ein Weizenfeld bei ${n} brennt nach Beschuss – das Feuer läuft auf das Dorf zu`, unit: 'Katastrophenschutz DSNS' },
};

export const fire = {
  can(M) {
    const g = M.game, w = g.world;
    if (T.peaceful || !FIRE_TXT[T.id] || !g.helis.some((h) => h.spec.capacity > 0)) return null;
    for (let k = 0; k < 6; k++) {
      const water = w.findWater(rand, 1200, 5000, M.recentPts);
      if (!water) return null;
      for (let i = 0; i < 300; i++) {
        const a = rand() * Math.PI * 2, r = 450 + rand() * 1100;
        const x = water.x + Math.cos(a) * r, z = water.z + Math.sin(a) * r;
        if (Math.abs(x) > HALF - 300 || Math.abs(z) > HALF - 300) continue;
        if (w.height(x, z) < 3 || w.normal(x, z).y < 0.9 || dist2(x, z, w.fob.x, w.fob.z) < 1300) continue;
        if (M.isRecent(x, z)) continue;
        return { water, x, z };
      }
    }
    return null;
  },

  gen(M, m, plan) {
    const g = M.game, w = g.world, tx = FIRE_TXT[T.id];
    const vil = w.villages.slice().sort((a, b) => dist2(a.x, a.z, plan.x, plan.z) - dist2(b.x, b.z, plan.x, plan.z))[0];
    const near = vil && dist2(vil.x, vil.z, plan.x, plan.z) < 1200 ? vil.name : `Planquadrat ${w.gridRef(plan.x, plan.z)}`;
    const nm = `Brandstelle ${rand.pick(NATO)}`;
    const pad = w.fob.pads.troop;
    m.title = tx.title;
    m.unit = tx.unit;
    m.place = near;
    m.from = M.fobPoint(pad);
    m.to = { name: nm, short: nm, x: plan.x, z: plan.z, y: w.height(plan.x, plan.z), kind: 'fire', radius: 40 };
    m.water = { x: plan.water.x, z: plan.water.z, name: 'Wasserentnahme' };
    const n = rand.int(3, 4);
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = rand() * Math.PI * 2, r = 4 + rand() * 26; pts.push([Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)]); }
    m.fire = { hp: n, max: n, drops: 0, pts, growT: 150 };
    m.count = 1;
    m.noSmoke = true;
    m.hot = rand() < 0.2;
    m.hotAt = m.hot ? 'to' : null;
    m.sling = { kind: 'bucket', x: pad.x + 8, z: pad.z + 6, att: false, hookT: 0, relT: 0, dmg: 0, heli: -1, full: false, fillT: 0 };
  },

  describe(M, m, rows, { b, d }) {
    const w = M.game.world, tx = FIRE_TXT[T.id];
    rows.push(['Auftrag', 'Brandbekämpfung aus der Luft mit Außenlastbehälter („Bambi Bucket“)']);
    rows.push(['Lage', tx.what(m.place), 'hot']);
    rows.push(['Brandstelle', `${m.to.name} · Planquadrat ${w.gridRef(m.to.x, m.to.z)} · ${fmtBearing(bearing(w.fob.x, w.fob.z, m.to.x, m.to.z))} · ${fmtDist(dist2(w.fob.x, w.fob.z, m.to.x, m.to.z))}`]);
    rows.push(['Wasserentnahme', `Fluss/See bei Planquadrat ${w.gridRef(m.water.x, m.water.z)} · ${fmtDist(dist2(m.water.x, m.water.z, m.to.x, m.to.z))} vom Brand`]);
    rows.push(['Ablauf', `Behälter an Pad ${m.from.pad.name} anschlagen, über dem Wasser tief schweben bis er voll ist, über dem Brand unter 50 m – er öffnet automatisch. Ca. ${m.fire.max} Abwürfe nötig.`]);
    rows.push(['Hinweis', 'Das Feuer breitet sich aus, wenn Sie zu lange brauchen']);
    return `„${M.game.callsign}, hier ${m.unit}. ${tx.what(m.place)}. Wir brauchen Löschwasser aus der Luft – der Behälter steht bei Pad ${m.from.pad.name}.“`;
  },

  accept(M, m) {
    const g = M.game, S = m.sling, ref = Math.max(...g.helis.filter((x) => x.spec.capacity > 0).map((x) => x.spec.emptyMass));
    (M.slings || (M.slings = new Map())).set(m.id, new SlingLoad(g.scene, 'bucket', S.x, Math.max(g.world.height(S.x, S.z), 0), S.z, ref));
    fire.sync(M, m);
  },

  // Flammen passend zur verbleibenden Brandstärke
  sync(M, m) {
    const e = M.game.effects, F = m.fire;
    if (!F) return;
    const em = m.fireEm || (m.fireEm = []);
    const want = clamp(F.hp * 2 + 1, 0, F.pts.length);
    const y0 = (x, z) => Math.max(0, M.game.world.height(x, z));
    while (em.length < want && F.hp > 0) {
      const [dx, dz] = F.pts[em.length];
      const x = m.to.x + dx, z = m.to.z + dz;
      const f = e.wreckFire(x, y0(x, z), z);
      em.push(f);
      m.emitters.push(f);
    }
    while (em.length > (F.hp > 0 ? want : 0)) {
      const f = em.pop();
      e.removeEmitter(f);
      const i = m.emitters.indexOf(f);
      if (i >= 0) m.emitters.splice(i, 1);
    }
  },

  target(M, m) { return m.sling.att ? 'to' : 'from'; },

  waypoint(M, h, m) {
    const S = m.sling, L = M.slings && M.slings.get(m.id), w = M.game.world;
    if (!S.att && L) return { x: L.pos.x, z: L.pos.z, y: L.pos.y, label: 'Löschbehälter', radius: 8, winch: true, hoverY: L.pos.y + L.top + 11 };
    const top = L ? L.top : 1.5;
    if (!S.full) return { x: m.water.x, z: m.water.z, y: 0, label: 'Wasser', radius: 30, winch: true, hoverY: ROPE + top + 0.5 };
    const gy = Math.max(0, w.height(m.to.x, m.to.z));
    return { x: m.to.x, z: m.to.z, y: gy, label: m.to.short, radius: 35, winch: true, hoverY: gy + ROPE + top + 15 };
  },

  update(M, dt) {
    const g = M.game, m = M.current, S = m.sling, F = m.fire, L = M.slings && M.slings.get(m.id), w = g.world;
    M.updateSling(dt);
    if (M.phase !== 'active' || !L) return true;
    // Feuer breitet sich aus
    F.growT -= dt;
    if (F.growT <= 0) {
      F.growT = 120;
      if (F.hp < F.max + 2) { F.hp++; fire.sync(M, m); g.radio(`${m.unit}: Das Feuer breitet sich aus – beeilen Sie sich!`, m.unit, true); M.changed(); }
    }
    if (!S.att) return true;
    const h = g.helis[S.heli];
    if (!S.full) {
      // Behälter taucht ins Wasser
      if (w.height(L.pos.x, L.pos.z) < -0.6 && L.pos.y < 0.7) {
        if (S.fillT === 0) g.radio('Crew: Behälter ist im Wasser – füllt sich, Position halten!', 'Crew');
        S.fillT += dt;
        if (rand() < dt * 10) g.effects.puff(L.pos.x + rand.range(-1, 1), 0.3, L.pos.z + rand.range(-1, 1), 0.85, 0.9, 0.95, 2, 1.4, 1.2, 0.8);
        if (S.fillT > 2.2) {
          S.full = true; S.fillT = 0;
          L.mass = L.baseMass * (SLING_MASS.bucketFull / SLING_MASS.bucket);
          g.radio('Crew: Behälter voll – 3000 Liter am Haken. Langsam anheben!', 'Crew');
          M.changed();
        }
      } else S.fillT = Math.max(0, S.fillT - dt * 0.5);
      return true;
    }
    // Abwurf über dem Brand
    const gy = Math.max(0, w.height(L.pos.x, L.pos.z));
    if (dist2(L.pos.x, L.pos.z, m.to.x, m.to.z) < 38 && L.pos.y - gy < 50 && L.pos.y - gy > 2) {
      S.full = false;
      L.mass = L.baseMass;
      F.hp--; F.drops++;
      F.growT = Math.max(F.growT, 60);
      for (let i = 0; i < 40; i++) {
        const a = rand() * Math.PI * 2, r = rand() * 6;
        g.effects.puff(L.pos.x + Math.cos(a) * r, L.pos.y - rand() * 8, L.pos.z + Math.sin(a) * r, 0.82, 0.88, 0.95, 1, 2.2 + rand() * 2, 2.5, 1.6);
      }
      for (let i = 0; i < 8; i++) g.effects.puff(m.to.x + rand.range(-20, 20), gy + 1, m.to.z + rand.range(-20, 20), 0.75, 0.75, 0.75, 2, 5, 3, 3.5);
      fire.sync(M, m);
      if (F.hp <= 0) {
        g.radio(`${m.unit}: Feuer ist aus! Großartige Arbeit, ${g.callsign}!`, m.unit);
        if (h) h.extMass = 0;
        S.att = false;
        L.update(0, null, w);
        M.complete();
        return true;
      }
      g.radio(`Crew: Wasser marsch! Treffer – ${F.hp === 1 ? 'noch ein Brandherd' : `noch ${F.hp} Brandherde`}. Zurück zum Wasser!`, 'Crew');
      M.changed();
    }
    return true;
  },

  hud(M, h, m) {
    const S = m.sling, F = m.fire, L = M.slings && M.slings.get(m.id);
    const line = `${m.title} · Brandherde ${Math.max(0, F.hp)}`;
    if (M.phase === 'briefing') return { line, step: 'Neuer Auftrag – Briefing bestätigen', hot: true };
    if (M.phase !== 'active' || !L) return { line, step: '', hot: true };
    let step;
    if (!S.att) step = M.slingHint(h, m).replace('Last', 'Behälter').replace('der Last', 'dem Behälter');
    else if (!S.full) {
      const d = dist2(L.pos.x, L.pos.z, m.water.x, m.water.z);
      step = S.fillT > 0 ? `Behälter füllt sich … ${Math.min(100, Math.round(S.fillT / 2.2 * 100))} % – Position halten!`
        : d > 120 ? `Zum Wasser fliegen (${fmtDist(d)}) – Behälter dort eintauchen` : 'Tief über dem Wasser schweben, bis der Behälter eintaucht (Seil 15 m)';
    } else {
      const d = dist2(L.pos.x, L.pos.z, m.to.x, m.to.z);
      step = d > 60 ? `Zum Brand fliegen (${fmtDist(d)}) – ruhig, der volle Behälter pendelt` : 'Über das Feuer – unter 50 m öffnet der Behälter';
    }
    return { line, step, hot: true };
  },

  score(M, m) { return { base: 260 + m.fire.drops * 110, what: `Brand gelöscht (${m.fire.drops} Abwürfe)`, hard: true }; },
};

// ===================================================================== Fast-Rope / Abseilen
const ROPE_TXT = {
  norway: { title: 'ABSEILEN – BERGRETTUNG', unit: 'Bergwacht Troms', who: 'Bergretter', why: 'Am Steilhang ist ein Lawinenkegel abgegangen – die Bergretter müssen sich zur Suchstelle abseilen.' },
  flood: { title: 'ABSEILEN – DEICHSICHERUNG', unit: 'THW Ortsverband Lindental', who: 'THW-Helfer', why: 'Ein Deichabschnitt ist nur noch aus der Luft erreichbar – Helfer sollen sich mit Sandsack-Material abseilen.' },
};

export const fastrope = {
  can(M) {
    const g = M.game, w = g.world;
    if (!g.helis.some((h) => h.spec.capacity >= 4)) return null;
    let best = null;
    for (let i = 0; i < 3000; i++) {
      const a = rand() * Math.PI * 2, r = 2200 + rand() * 3000;
      const x = w.fob.x + Math.cos(a) * r, z = w.fob.z + Math.sin(a) * r;
      if (Math.abs(x) > HALF - 300 || Math.abs(z) > HALF - 300) continue;
      const hh = w.height(x, z);
      if (hh < 2 || M.isRecent(x, z)) continue;
      const forest = w.inForest(x, z) > 0.5, steep = w.normal(x, z).y < 0.86;
      if (forest || steep) return { x, z, y: hh, forest, steep };
      if (!best) best = { x, z, y: hh };
    }
    return best;
  },

  gen(M, m, plan) {
    const g = M.game, w = g.world;
    const cap = Math.max(...g.helis.map((x) => x.spec.capacity));
    const pt = ROPE_TXT[T.id];
    const nm = `Abseilpunkt ${rand.pick(NATO)}`;
    m.title = pt ? pt.title : 'FAST-ROPE – ABSETZEN';
    m.unit = pt ? pt.unit : rand.pick(T.sofUnits);
    m.terrain = plan.forest ? (T.id === 'vietnam' ? 'dichter Dschungel' : 'dichter Wald') : plan.steep ? 'Steilhang' : 'unebenes Gelände';
    m.count = rand.int(4, Math.max(4, Math.min(cap, 8)));
    m.noSmoke = true;
    m.from = M.fobPoint(w.fob.pads.troop);
    m.to = { name: nm, short: nm, x: plan.x, z: plan.z, y: plan.y, kind: 'rope', radius: 30 };
    m.hot = !T.peaceful && rand() < 0.25;
    m.hotAt = m.hot ? 'to' : null;
  },

  describe(M, m, rows) {
    const g = M.game, w = g.world, pt = ROPE_TXT[T.id];
    const bp = bearing(w.fob.x, w.fob.z, m.to.x, m.to.z), dp = dist2(w.fob.x, w.fob.z, m.to.x, m.to.z);
    rows.push(['Auftrag', pt ? `${pt.who} im Schwebeflug abseilen` : 'Team im Schwebeflug per Fast-Rope absetzen']);
    rows.push(['Team', `${m.unit} · ${m.count} ${pt ? pt.who : 'Mann'}`]);
    rows.push(['Absetzpunkt', `${m.to.name} · Planquadrat ${w.gridRef(m.to.x, m.to.z)} · ${m.terrain}`]);
    rows.push(['Ziel', `${fmtBearing(bp)} (${dirName(bp)}) · ${fmtDist(dp)}`]);
    rows.push(['Vorgabe', 'Keine Landung möglich: in 8–30 m Höhe über Grund ruhig schweben (über den Baumkronen), bis alle am Seil unten sind']);
    if (!T.peaceful) rows.push(['Lage', m.hot ? 'Feind in der Nähe des Absetzpunkts!' : 'Feindlage unklar – zügig absetzen', m.hot ? 'hot' : 'cold']);
    return pt ? `„${g.callsign}, hier ${m.unit}. ${pt.why} ${m.count} Helfer warten an Pad ${m.from.pad.name}.“`
      : `„${g.callsign}, hier TOC. ${m.unit} muss bei ${m.to.name} abgesetzt werden – ${m.terrain}, Landung unmöglich. Fast-Rope! Aufnahme an Pad ${m.from.pad.name}.“`;
  },

  near(h, m) {
    const dd = dist2(h.pos.x, h.pos.z, m.to.x, m.to.z);
    return !h.contact && h.agl > 6 && h.agl < 34 && h.speed < 2.8 && dd < 32;
  },

  hint(h, m) {
    const dd = dist2(h.pos.x, h.pos.z, m.to.x, m.to.z);
    if (h.unloading) return `Abseilen: ${m.delivered}/${m.count} – Position halten!`;
    if (dd > 60) return `Nach ${m.to.name} fliegen – dort in 8–30 m Höhe schweben`;
    if (h.contact || h.agl <= 6) return 'Höher – das Seil braucht mindestens 8 m';
    if (h.agl >= 34) return 'Tiefer – höchstens 30 m über Grund';
    if (dd >= 32) return 'Genauer über den Absetzpunkt';
    return 'Langsamer – fast stillstehen';
  },

  score(M, m) { return { base: m.count * 125, what: `${m.count} ${ROPE_TXT[T.id] ? ROPE_TXT[T.id].who : 'Soldaten'} abgeseilt`, hard: true }; },
};

// ===================================================================== Vermisstensuche
const SEARCH_TXT = {
  vietnam: { unit: 'LRRP-Team „Ranger 2“', who: (n) => (n > 1 ? 'zwei versprengte Fernspäher' : 'ein versprengter Fernspäher'), why: 'Funkkontakt seit der Nacht abgerissen' },
  afghanistan: { unit: 'Fernspähtrupp „Falke“', who: (n) => (n > 1 ? 'zwei Soldaten einer Patrouille' : 'ein Soldat einer Patrouille'), why: 'nach einem Hinterhalt im Gelände versprengt' },
  ukraine: { unit: 'Sanitätszug Lada', who: (n) => (n > 1 ? 'zwei verwundete Soldaten eines Spähtrupps' : 'ein verwundeter Späher'), why: 'nach einem Drohnenangriff im Waldstreifen versteckt' },
  mali: { unit: 'Patrouille Gao Süd', who: (n) => (n > 1 ? 'zwei Blauhelme' : 'ein Blauhelm'), why: 'Fahrzeug liegengeblieben, zu Fuß unterwegs' },
  norway: { unit: 'Hovedredningssentralen', who: (n) => (n > 1 ? 'zwei Skitourengeher' : 'ein Skitourengeher'), why: 'seit gestern Abend überfällig' },
  flood: { unit: 'Feuerwehr-Einsatzleitung', who: (n) => (n > 1 ? 'zwei Feuerwehrleute' : 'ein Anwohner'), why: 'von der Flutwelle abgeschnitten' },
};

export const search = {
  can(M) {
    const w = M.game.world;
    const c = w.findClearing(rand, 2000, 5300, M.recentPts);
    return c || null;
  },

  gen(M, m, c) {
    const g = M.game, w = g.world, tx = SEARCH_TXT[T.id] || SEARCH_TXT.vietnam;
    const a = rand() * Math.PI * 2, d = 150 + rand() * 280;
    m.title = 'VERMISSTENSUCHE';
    m.unit = tx.unit;
    m.count = rand() < 0.35 ? 2 : 1;
    m.litters = rand() < 0.5 ? 1 : 0;
    m.walking = m.count - m.litters;
    m.from = { name: 'Fundort', short: 'Vermisste', x: c.x, z: c.z, y: c.y, kind: 'site', site: { r: 20, name: 'Fundort' }, radius: 45, remote: true };
    m.to = M.fobPoint(w.fob.pads.med);
    m.approx = { x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d };
    m.searchR = 550;
    m.revealed = false;
    m.noSmoke = false;
    m.hot = !T.peaceful && rand() < 0.3;
    m.hotAt = m.hot ? 'from' : null;
  },

  describe(M, m, rows, { b, d }) {
    const g = M.game, w = g.world, tx = SEARCH_TXT[T.id] || SEARCH_TXT.vietnam;
    rows.push(['Auftrag', 'Vermisste Personen suchen, aufnehmen und versorgen']);
    rows.push(['Vermisst', `${tx.who(m.count)} – ${tx.why}`]);
    rows.push(['Suchgebiet', `Planquadrat ${w.gridRef(m.approx.x, m.approx.z)} · Radius ${m.searchR} m`]);
    rows.push(['Richtung / Entfernung', `${fmtBearing(b)} (${dirName(b)}) · ca. ${fmtDist(d)}`]);
    rows.push(['Vorgabe', 'Das Gebiet in Bahnen absuchen – tief (unter 150 m) und langsam. Wer Sie sieht, wirft Rauch bzw. nachts ein Blitzlicht.']);
    if (m.litters) rows.push(['Zustand', 'Eine Person vermutlich verletzt (Trage)']);
    if (!T.peaceful) rows.push(['Lage', m.hot ? 'Feind sucht ebenfalls nach ihnen!' : 'unklar – Vorsicht', m.hot ? 'hot' : 'cold']);
    rows.push(['Ablieferung', `${T.fobName} – Pad MED`]);
    return `„${g.callsign}, hier ${m.unit}. ${m.count > 1 ? 'Vermisst werden' : 'Vermisst wird'} ${tx.who(m.count)} – ${tx.why}. Letzte bekannte Position Planquadrat ${w.gridRef(m.approx.x, m.approx.z)}. Bitte absuchen!“`;
  },

  // Entdeckt, wenn tief und nah genug (nachts sieht man das Blitzlicht weiter)
  spot(M, h, m) {
    const night = M.game.nightSys.night;
    const r = night ? 380 : 170;
    return dist2(h.pos.x, h.pos.z, m.from.x, m.from.z) < r && h.agl < (night ? 300 : 160);
  },

  score(M, m) { return { base: m.count * 170, what: `${m.count === 1 ? 'Vermisste Person' : 'Beide Vermissten'} gefunden und gerettet`, hard: true }; },
};

export const EXTRA = { fire, fastrope, search };

// ===================================================================== Zusatzlagen
export function genMods(M, m) {
  const g = M.game, w = g.world;
  m.mods = {};
  // Zeitdruck: dringend operationsbedürftig
  if (['medevac', 'csar', 'search', 'winch'].includes(m.type) && rand() < 0.35) {
    const d = dist2(g.heli.pos.x, g.heli.pos.z, (m.approx || m.from).x, (m.approx || m.from).z) + dist2(m.from.x, m.from.z, m.to.x, m.to.z);
    m.mods.urgent = Math.round((d / 34 + (m.type === 'search' ? 330 : 170)) / 30) * 30;
  }
  if (T.peaceful) return;
  // Mörserbeschuss an der heißen LZ
  if (m.hot && m.hotAt && m[m.hotAt].kind === 'site' && !['cas', 'convoy', 'recon'].includes(m.type) && rand() < 0.4) m.mods.mortar = true;
  // Flugabwehrstellung auf dem Weg
  if (!['cas', 'convoy', 'auto'].includes(m.type) && rand() < 0.25) {
    const far = m.to.kind === 'fob' ? (m.approx || m.from) : m.to;
    for (let k = 0; k < 30; k++) {
      const t = 0.35 + rand() * 0.35, side = rand() < 0.5 ? -1 : 1, off = 180 + rand() * 260;
      const dx = far.x - w.fob.x, dz = far.z - w.fob.z, L = Math.hypot(dx, dz) || 1;
      const x = w.fob.x + dx * t - (dz / L) * off * side, z = w.fob.z + dz * t + (dx / L) * off * side;
      if (Math.abs(x) > HALF - 200 || Math.abs(z) > HALF - 200 || w.height(x, z) < 2 || dist2(x, z, w.fob.x, w.fob.z) < 1200) continue;
      m.mods.aaa = { x: Math.round(x), z: Math.round(z) };
      break;
    }
  }
}

export function describeMods(M, m, rows) {
  const w = M.game.world, md = m.mods || {};
  let extra = '';
  if (md.urgent) { rows.push(['Dringlichkeit', `URGENT SURGICAL – innerhalb von ${fmtClock(md.urgent)} min ins Lazarett`, 'hot']); extra += ' Es eilt – jede Minute zählt!'; }
  if (md.mortar) { rows.push(['Mörser', 'Der Feind schießt sich mit Mörsern auf die LZ ein – kurz am Boden bleiben!', 'hot']); }
  if (md.aaa) { rows.push(['Flugabwehr', `Schweres MG/Flak gemeldet bei Planquadrat ${w.gridRef(md.aaa.x, md.aaa.z)} – weiträumig umfliegen oder bekämpfen`, 'hot']); extra += ` Achtung, Flugabwehr bei Planquadrat ${w.gridRef(md.aaa.x, md.aaa.z)}!`; }
  return extra;
}

export function acceptMods(M, m) {
  const md = m.mods || {}, U = M.game.units;
  if (md.aaa) {
    const list = U.spawnEnemies(md.aaa.x, md.aaa.z, 3 + Math.floor(rand() * 2), { missionId: m.id, rMin: 4, rMax: 30, heavy: true, nearFob: true });
    for (const e of list) { e.range = e.heavy ? 1150 : 700; e.reveal = 1e6; }
  }
  m.mortarT = 6;
  m.mortarN = 0;
}

export function updateMods(M, dt) {
  const g = M.game, m = M.current;
  if (!m || M.phase !== 'active' || !m.mods) return;
  const md = m.mods;
  if (md.urgent && !m.lateWarned && g.time - m.acceptTime > md.urgent && m.delivered < m.count) {
    m.lateWarned = true;
    g.radio('Lazarett: Das Zeitfenster ist überschritten – der Zustand verschlechtert sich, trotzdem schnell herbringen!', 'Lazarett', true);
  }
  if (md.mortar && m.hotAt && m.delivered < m.count) {
    const p = m[m.hotAt];
    const close = g.helis.filter((h) => !h.crashed && dist2(h.pos.x, h.pos.z, p.x, p.z) < 280 && h.agl < 45);
    if (!close.length) return;
    m.mortarT -= dt;
    if (m.mortarT > 0) return;
    m.mortarT = 4.5 + rand() * 3.5;
    if (m.mortarN === 0) g.radio(`${m.unit.split(',')[0]}: MÖRSER! Die schießen sich auf die LZ ein – schnell rein, schnell raus!`, 'Funk', true);
    const R = Math.max(9, 75 - m.mortarN * 8);
    m.mortarN++;
    const h0 = close[0], a = rand() * Math.PI * 2, r = rand() * R;
    const x = (m.mortarN > 2 ? h0.pos.x : p.x) + Math.cos(a) * r, z = (m.mortarN > 2 ? h0.pos.z : p.z) + Math.sin(a) * r;
    const y = Math.max(0, g.world.height(x, z));
    g.effects.explosion(x, y, z, 0.9);
    g.audio.boom(g.camera.position.distanceTo(new THREE.Vector3(x, y, z)));
    for (const h of g.helis) {
      if (h.crashed) continue;
      const d = Math.hypot(h.pos.x - x, h.pos.y - y, h.pos.z - z);
      if (d < 16) g.damageHeli(h, (16 - d) * 1.1, null);
    }
  }
}

// Punkte-Multiplikatoren und Ergebniszeilen der Zusatzlagen
export function scoreMods(M, m, elapsed) {
  const md = m.mods || {}, out = { mult: 1, lines: [] };
  if (md.urgent) {
    if (elapsed <= md.urgent) { out.mult *= 1.25; out.lines.push(['Rechtzeitig im Lazarett', '×1,25']); }
    else { out.mult *= 0.75; out.lines.push(['Zeitfenster überschritten', '×0,75']); }
  }
  if (md.mortar) { out.mult *= 1.2; out.lines.push(['Unter Mörserfeuer', '×1,2']); }
  if (md.aaa) { out.mult *= 1.1; out.lines.push(['Flugabwehr auf der Route', '×1,1']); }
  return out;
}

export function hudMods(M, m) {
  const md = m && m.mods;
  if (!md || !md.urgent || M.phase !== 'active') return '';
  const left = md.urgent - (M.game.time - m.acceptTime);
  return left > 0 ? ` · ⏱ ${fmtClock(left)}` : ' · ⏱ ÜBERFÄLLIG';
}
