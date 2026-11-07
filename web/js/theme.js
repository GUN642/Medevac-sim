// Einsatzgebiete (Karten) und Hubschraubertypen
import { G } from './config.js';
import { rand } from './util.js';

// ---------------------------------------------------------------- Hubschraubertypen
// Werte sind spielerisch abgestimmt: Schub/Masse ähnlich, Unterschiede bei Wendigkeit, Steigrate, Kabine
export const HELI_TYPES = {
  uh1d: {
    id: 'uh1d', model: 'huey', name: 'Bell UH-1D „Huey“', short: 'UH-1D', callsign: 'Dustoff 2-4',
    emptyMass: 2400, fuelMassFull: 600, paxMass: 95, capacity: 10, maxThrust: 4800 * G,
    skidH: 1.6, rotorRadius: 7.3, rotorTop: 2.6, maxPitch: 0.5, maxRoll: 0.6, climbRate: 9, sinkRate: 7, yawRate: 1.15,
    agility: 1, burn: 1, drag: 1, gun: { name: 'M60', rpm: 550, ammo: 800, muzzleVel: 853, range: 800 },
    rotorAudio: 1, rotorCut: 1, camDist: 24, shadow: 9, door: 'side', numbers: ['66-16024', '67-17633'],
  },
  uh60: {
    id: 'uh60', model: 'blackhawk', name: 'Sikorsky UH-60 „Black Hawk“', short: 'UH-60', callsign: 'Dustoff 3-1',
    emptyMass: 5200, fuelMassFull: 1100, paxMass: 100, capacity: 11, maxThrust: 9900 * G,
    skidH: 1.55, rotorRadius: 8.2, rotorTop: 2.4, maxPitch: 0.52, maxRoll: 0.65, climbRate: 11, sinkRate: 8, yawRate: 1.3,
    vmax: 125, agility: 1.15, burn: 1.05, drag: 0.85, gun: { name: 'M240H', rpm: 750, ammo: 800, muzzleVel: 853, range: 850 },
    rotorAudio: 1.45, rotorCut: 1.1, camDist: 26, shadow: 10, door: 'side', numbers: ['08-20112', '09-20214'],
  },
  ch47: {
    id: 'ch47', model: 'chinook', name: 'Boeing CH-47F „Chinook“ (Luftwaffe)', short: 'CH-47', callsign: 'Big Windy 2-5',
    emptyMass: 10600, fuelMassFull: 3100, paxMass: 100, capacity: 33, maxThrust: 26000 * G,
    skidH: 1.75, rotorRadius: 9.1, rotorTop: 3.4, maxPitch: 0.6, maxRoll: 0.65, climbRate: 13, sinkRate: 8, yawRate: 1.3,
    vmax: 125, agility: 1.15, burn: 0.95, drag: 0.8, armor: 0.55, gun: { name: 'M134 Minigun', rpm: 3000, ammo: 4000, muzzleVel: 850, range: 900, minigun: true, tracerEvery: 5, soundEvery: 3 },
    rotorAudio: 0.8, rotorCut: 0.75, camDist: 38, shadow: 16, seats: ['pilot', 'left', 'right', 'ramp'], seatNames: { ramp: 'Heckschütze (Rampe)' },
    door: 'ramp', rampZ: 8.9, numbers: ['82+01', '82+07'],
  },
  ah64: {
    id: 'ah64', model: 'apache', name: 'Boeing AH-64E „Apache Guardian“', short: 'AH-64E', callsign: 'Ugly 5-1',
    emptyMass: 5900, fuelMassFull: 1100, paxMass: 100, capacity: 0, maxThrust: 10600 * G,
    skidH: 1.55, rotorRadius: 7.3, rotorTop: 2.9, maxPitch: 0.55, maxRoll: 0.7, climbRate: 12, sinkRate: 8, yawRate: 1.45,
    vmax: 145, agility: 1.3, burn: 1.0, drag: 0.8,
    gun: { name: 'M230 30 mm', rpm: 625, ammo: 1200, muzzleVel: 805, range: 1600, he: true, turret: true, arc: { yaw: 1.9, pmin: -1.05, pmax: 0.25 } },
    armor: 0.3, rockets: 38, seats: ['pilot', 'left'], seatNames: { left: 'Waffensystemoffizier (CPG)' },
    rotorAudio: 1.4, rotorCut: 1.1, camDist: 24, shadow: 10, door: 'side', numbers: ['09-05601', '10-09012'],
  },
  ch53: {
    id: 'ch53', model: 'ch53', name: 'Sikorsky CH-53GS', short: 'CH-53GS', callsign: 'Nazgul 61',
    emptyMass: 10900, fuelMassFull: 2900, paxMass: 100, capacity: 36, maxThrust: 26000 * G,
    skidH: 1.65, rotorRadius: 11, rotorTop: 3.0, maxPitch: 0.6, maxRoll: 0.65, climbRate: 13, sinkRate: 8, yawRate: 1.3,
    vmax: 127, vlimit: 130, agility: 1.15, burn: 0.9, drag: 0.9, armor: 0.5, gun: { name: 'M3M .50', rpm: 1050, ammo: 400, mags: 2, muzzleVel: 890, range: 1300, heavy: true, tracerEvery: 3 },
    seats: ['pilot', 'left', 'right', 'ramp'], seatNames: { ramp: 'Heckschütze (Rampe)' },
    rotorAudio: 1.7, rotorCut: 0.9, camDist: 40, shadow: 18, door: 'ramp', rampZ: 7.2, numbers: ['85+12', '84+05'],
  },
  nh90: {
    id: 'nh90', model: 'nh90', name: 'NH90 TTH (Sanitätshubschrauber)', short: 'NH90', callsign: 'MedEvac 2-1',
    emptyMass: 6400, fuelMassFull: 1600, paxMass: 100, capacity: 12, maxThrust: 12800 * G,
    skidH: 1.65, rotorRadius: 8.15, rotorTop: 2.7, maxPitch: 0.52, maxRoll: 0.66, climbRate: 11, sinkRate: 8, yawRate: 1.35,
    vmax: 135, agility: 1.25, burn: 1.0, drag: 0.8, armor: 0.7,
    gun: { name: 'MG3', rpm: 1100, ammo: 300, mags: 2, muzzleVel: 820, range: 800, tracerEvery: 4 },
    rotorAudio: 1.5, rotorCut: 1.15, camDist: 26, shadow: 10, door: 'side', numbers: ['79+21', '79+35'],
  },
  tiger: {
    id: 'tiger', model: 'tiger', name: 'Eurocopter Tiger', short: 'Tiger', callsign: 'Gecko 1-1',
    emptyMass: 3900, fuelMassFull: 1000, paxMass: 100, capacity: 0, maxThrust: 7300 * G,
    skidH: 1.5, rotorRadius: 6.5, rotorTop: 2.3, maxPitch: 0.56, maxRoll: 0.72, climbRate: 12, sinkRate: 8, yawRate: 1.5,
    vmax: 145, agility: 1.4, burn: 0.9, drag: 0.75,
    gun: { name: '30-mm-Kanone', rpm: 750, ammo: 450, muzzleVel: 1000, range: 1500, he: true, turret: true, arc: { yaw: 1.7, pmin: -1.0, pmax: 0.25 } },
    armor: 0.35, rockets: 38, seats: ['pilot', 'left'], seatNames: { left: 'Waffensystemoffizier' },
    rotorAudio: 1.5, rotorCut: 1.15, camDist: 21, shadow: 9, door: 'side', numbers: ['74+38', '74+62'],
  },
  h145: {
    id: 'h145', model: 'h145', name: 'Airbus H145M LUH SAR', short: 'H145M', callsign: 'SAR 41',
    emptyMass: 2000, fuelMassFull: 560, paxMass: 95, capacity: 6, maxThrust: 3900 * G,
    skidH: 1.3, rotorRadius: 5.5, rotorTop: 1.95, maxPitch: 0.5, maxRoll: 0.66, climbRate: 11, sinkRate: 8, yawRate: 1.55,
    vmax: 118, vlimit: 120, agility: 1.4, burn: 0.8, drag: 0.8, armor: 1,
    gun: { name: '–', rpm: 1, ammo: 0, muzzleVel: 800, range: 10 }, noGuns: true, hoist: true,
    seats: ['pilot'], rotorAudio: 1.8, rotorCut: 1.3, camDist: 17, shadow: 7, door: 'side', numbers: ['77+05', '77+12'],
  },
};
// NH90 der Marine (Übung in Norwegen): ohne Bordwaffen, mit Winde
HELI_TYPES.nh90s = {
  ...HELI_TYPES.nh90, id: 'nh90s', name: 'NH90 Sea Lion (Marineflieger)', short: 'NH90 Sea Lion', callsign: 'Sea Lion 2-1',
  gun: { name: '–', rpm: 1, ammo: 0, muzzleVel: 800, range: 10 }, noGuns: true, hoist: true, seats: ['pilot'], numbers: ['79+51', '79+53'],
};
// CH-53GS im Katastropheneinsatz: ohne Bordwaffen, mit Rettungswinde
HELI_TYPES.ch53f = {
  ...HELI_TYPES.ch53, id: 'ch53f', name: 'Sikorsky CH-53GS (Rettungswinde)', gun: { name: '–', rpm: 1, ammo: 0, muzzleVel: 800, range: 10 },
  noGuns: true, hoist: true, seats: ['pilot'], seatNames: {},
};

// ---------------------------------------------------------------- Einsatzgebiete
export const THEMES = {
  vietnam: {
    id: 'vietnam', name: 'Vietnam 1968', country: 'Vietnam', sub: 'VIETNAM 1968',
    fobName: 'FOB Eagle', helis: ['uh1d'],
    enemyName: 'Vietcong', enemyFrom: 'Baumlinie', enemyCover: 'Dschungel', trees: 'Bäume', crashTrees: 'In den Dschungel gestürzt!',
    friend: () => (rand() < 0.25 ? 'us2' : 'us'), enemy: (heavy) => (heavy || rand() < 0.4 ? 'nva' : 'vc'),
    wounded: 'wounded', crew: 'crew', player: 'player', pilot: 'pilot', sof: 'lrrp', vip: 'vipV',
    sofUnits: ['LRRP-Team Kilo 2', 'MACV-SOG RT Idaho', 'Ranger-Team Charlie', 'SEAL-Zug Bravo'],
    vips: [{ who: 'General Westmoreland', why: 'Lagebesprechung' }, { who: 'ein Kongressabgeordneter', why: 'Frontbesuch' }, { who: 'Oberst Moore', why: 'Gefechtsstandverlegung' }],
    units: [
      'Bravo 6, 2/7. Kavallerie', 'Charlie 3, 1/5. Kavallerie', 'Alpha 2, 2/12. Infanterie', 'Delta 6, 1/8. Kavallerie',
      'Tiger 4, Fernspäher-Team', 'Echo 1, 173. Luftlandebrigade', 'Raider 2, 1/327. Infanterie', 'Mustang 5, 3/21. Infanterie',
    ],
    aircraft: [
      { kind: 'f4', name: 'F-4 Phantom', crew: 2, call: 'Gunfighter 2' },
      { kind: 'o1', name: 'O-1 Bird Dog', crew: 2, call: 'Bird Dog 1-4' },
      { kind: 'huey', name: 'UH-1H Huey', crew: 4, call: 'Gladiator 2-6' },
      { kind: 'a1', name: 'A-1 Skyraider', crew: 1, call: 'Sandy 3' },
    ],
    sky: { top: 0x5d8fc4, horizon: 0xc4cbbd, fog: 0xc4cbbd, fogDensity: 0.0005, hemiSky: 0xd9e3ea, hemiGround: 0x46522f, hemi: 1.25, sun: 0xfff0d6, sunI: 2.4, clouds: 40 },
    dust: 1, gusts: 0,
  },
  afghanistan: {
    id: 'afghanistan', name: 'Afghanistan 2010', country: 'Afghanistan', sub: 'AFGHANISTAN 2010',
    fobName: 'FOB Kunduz', helis: ['uh60', 'ch47', 'ch53', 'ah64'],
    enemyName: 'Taliban', enemyFrom: 'Lehmmauern', enemyCover: 'Ortschaft', trees: 'Pappeln', crashTrees: 'In die Pappeln gestürzt!',
    friend: () => (rand() < 0.5 ? (rand() < 0.3 ? 'isaf2' : 'isaf') : 'bw'), enemy: (heavy) => (heavy || rand() < 0.45 ? 'tal2' : 'tal'),
    wounded: 'woundedA', crew: 'crewA', player: 'playerA', pilot: 'pilotA', sof: 'sof', vip: 'vipA',
    sofUnits: ['KSK-Kommandotrupp 2', 'ODA 3125', 'SEAL Team 4 Golf', 'Ranger-Zug Alpha'],
    vips: [{ who: 'der Distriktgouverneur', why: 'Shura mit den Dorfältesten' }, { who: 'der Regionalkommandeur', why: 'Frontbesuch' }, { who: 'ein Polizeichef', why: 'Lagebesprechung' }],
    units: [
      'Wolf 2-1, 2/508. Fallschirmjäger', 'Gator 3, 1/6. Marines', 'Kilo 1-3, 3/7. Marines', 'Spartan 6, 2/87. Infanterie',
      'Falke 2, Ausbildungs- und Schutzbataillon', 'Leopard 1-1, QRF Kunduz', 'Viking 4, Fernspäher', 'Taurus 2, 1/320. Feldartillerie',
    ],
    aircraft: [
      { kind: 'ah64', name: 'AH-64D Apache', crew: 2, call: 'Ugly 5-1' },
      { kind: 'f15', name: 'F-15E Strike Eagle', crew: 2, call: 'Dude 0-3' },
      { kind: 'tornado', name: 'Tornado RECCE', crew: 2, call: 'Tiger 3-2' },
      { kind: 'uh60w', name: 'UH-60 Black Hawk', crew: 4, call: 'Knighthawk 2-2' },
    ],
    sky: { top: 0x6d93c0, horizon: 0xd9ccb0, fog: 0xd6c8a8, fogDensity: 0.00058, hemiSky: 0xeae4d6, hemiGround: 0x8a6e4a, hemi: 1.15, sun: 0xfff2dc, sunI: 2.8, clouds: 8 },
    dust: 2.4, gusts: 1,
  },
  mali: {
    id: 'mali', name: 'Mali 2017', country: 'Mali', sub: 'MALI 2017 · MINUSMA', fobName: 'Camp Castor', helis: ['nh90', 'tiger', 'ch47', 'ch53'],
    missionWeights: [['medevac', 24], ['convoy', 18], ['transport', 10], ['csar', 8], ['insert', 7], ['exfil', 7], ['resupply', 9], ['boat', 10], ['recon', 7]],
    enemyName: 'Dschihadisten', enemyFrom: 'Dornbuschsavanne', enemyCover: 'Ortschaft', trees: 'Akazien', crashTrees: 'In die Akazien gestürzt!',
    friend: () => (rand() < 0.6 ? 'bw' : rand() < 0.5 ? 'un' : 'un2'), enemy: (heavy) => (heavy || rand() < 0.4 ? 'jih2' : 'jih'),
    wounded: 'woundedA', crew: 'crewA', player: 'playerA', pilot: 'pilotA', sof: 'sof', vip: 'vipF',
    sofUnits: ['KSK-Kommandotrupp 3', 'Kampfschwimmer-Zug 1', 'Fernspäher-Trupp Gao', 'Spezialpioniere Bootstrupp'],
    vips: [{ who: 'der Kommandeur der MINUSMA-Truppen', why: 'Lagebesprechung' }, { who: 'der Gouverneur von Gao', why: 'Sicherheitskonferenz' }, { who: 'die Verteidigungsministerin', why: 'Truppenbesuch' }],
    units: [
      'Aufklärungskompanie Gao', 'Gefechtsverband Mali, 2. Zug', 'MINUSMA Niederlande, Patrouille 3', 'Feldjäger Gao',
      'MINUSMA Bangladesch, Kompanie B', 'Objektschutz Camp Castor', 'Pioniere Gao, Bautrupp 2', 'Sanitätszug Gao',
    ],
    aircraft: [
      { kind: 'ah64', name: 'Tiger', crew: 2, call: 'Gecko 2-1' }, { kind: 'uh60w', name: 'NH90', crew: 4, call: 'MedEvac 3-2' },
      { kind: 'f15', name: 'Mirage 2000D', crew: 2, call: 'Rapace 1-2' },
    ],
    sky: { top: 0x7aa2cc, horizon: 0xe3cfa8, fog: 0xdcc39c, fogDensity: 0.00055, hemiSky: 0xf2e6d2, hemiGround: 0x9a5a38, hemi: 1.15, sun: 0xfff0d8, sunI: 2.9, clouds: 6 },
    dust: 2.6, gusts: 0.8, storms: true,
  },
  norway: {
    id: 'norway', name: 'Norwegen – Arktis-Übung', country: 'Nordnorwegen', sub: 'NORWEGEN · ARKTIS-ÜBUNG', fobName: 'Flugplatz Bardufoss',
    helis: ['ch53f', 'nh90s', 'h145'], peaceful: true, snow: true, daylight: true,
    missionWeights: [['medevac', 22], ['ship', 24], ['transport', 12], ['resupply', 10], ['insert', 8], ['exfil', 8], ['csar', 6], ['recon', 5], ['vip', 5]],
    enemyName: 'Übungsgegner', enemyFrom: 'Norden', enemyCover: 'Wald', trees: 'Fichten', crashTrees: 'In die Fichten gestürzt!',
    friend: () => (rand() < 0.55 ? 'bwW' : 'noW'), enemy: () => 'noW',
    wounded: 'woundedW', crew: 'crewA', player: 'playerA', pilot: 'pilotA', sof: 'sofW', vip: 'vipF',
    sofUnits: ['KSK-Kommandotrupp Arktis', 'Kampfschwimmer Eckernförde', 'Norwegisches FSK-Team', 'Seebataillon Boardingteam'],
    vips: [{ who: 'der Inspekteur des Heeres', why: 'Übungsbeobachtung' }, { who: 'der norwegische Verteidigungschef', why: 'Lagebesprechung' }, { who: 'ein Schiedsrichter der Übung', why: 'Auswertung' }],
    units: [
      'Gebirgsjägerbataillon 233, 2. Kompanie', 'Brigade Nord, Telemark-Bataillon', 'US Marines, 2/6', 'Niederländische Marines, 21 Raiding Squadron',
      'Seebataillon, Bordeinsatzkompanie', 'Royal Marines, 45 Commando', 'Sanitätsregiment 3', 'Gebirgspioniere 8',
    ],
    aircraft: [{ kind: 'f15', name: 'F-35A', crew: 1, call: 'Viking 1-1' }, { kind: 'uh60w', name: 'Bell 412', crew: 3, call: 'Snow 2-2' }],
    sky: { top: 0x6f93c4, horizon: 0xd8e0ea, fog: 0xd4dde6, fogDensity: 0.00045, hemiSky: 0xeef4ff, hemiGround: 0x8a96a8, hemi: 1.3, sun: 0xffe2c0, sunI: 2.2, clouds: 30 },
    dust: 2.4, dustCol: [0.94, 0.96, 0.99], gusts: 0.6,
  },
  flood: {
    id: 'flood', name: 'Hochwasser 2021', country: 'Lindental', sub: 'HOCHWASSER · KATASTROPHENHILFE',
    fobName: 'Einsatzbasis Hohenfeld', helis: ['ch53f', 'h145'], peaceful: true,
    missionWeights: [['winch', 40], ['medevac', 14], ['resupply', 13], ['boat', 12], ['transport', 9], ['recon', 7], ['vip', 5]],
    enemyName: 'Unbekannte', enemyFrom: 'Norden', enemyCover: 'Ortschaft', trees: 'Bäume', crashTrees: 'In die Bäume gestürzt!',
    friend: () => (rand() < 0.5 ? 'thw' : 'fw'), enemy: () => 'civ',
    wounded: 'woundedF', crew: 'crewF', player: 'crewF', pilot: 'crewF', sof: 'dlrg', vip: 'vipF',
    sofUnits: ['DLRG-Strömungsretter Altenbrück', 'Wasserwacht-Bootstrupp 3', 'THW-Fachgruppe Wassergefahren', 'Feuerwehr-Bootstrupp Lindenau'],
    vips: [{ who: 'die Ministerpräsidentin', why: 'Lageerkundung' }, { who: 'der Landrat', why: 'Krisenstabssitzung' }, { who: 'ein Baufachberater des THW', why: 'Begutachtung der Brücken' }],
    units: [
      'Feuerwehr Altenbrück', 'THW-Ortsverband Lindenau', 'DRK-Bereitschaft Mühlbach', 'Rettungsleitstelle Lindental',
      'Polizei Lindental', 'Feuerwehr Kirchheim', 'Wasserwacht Steinbach', 'Ortsbürgermeister Rosenau',
    ],
    aircraft: [{ kind: 'huey', name: 'H135 Christoph 23', crew: 3, call: 'Christoph 23' }],
    sky: { top: 0x7d9ab8, horizon: 0xc9d0d4, fog: 0xc4cbcf, fogDensity: 0.0007, hemiSky: 0xdde3e8, hemiGround: 0x4a5640, hemi: 1.45, sun: 0xfff3e0, sunI: 2.0, clouds: 55 },
    dust: 0, gusts: 0.7,
  },
};

export const T = Object.assign({}, THEMES.vietnam);
export function setTheme(id) {
  Object.assign(T, THEMES[id] || THEMES.vietnam);
  return T;
}
export function themeOf(id) { return THEMES[id] ? id : 'vietnam'; }
export function heliTypeFor(themeId, type) {
  const list = (THEMES[themeId] || THEMES.vietnam).helis;
  return list.includes(type) ? type : list[0];
}

// Logischer Passagiertyp ('wounded' | 'pilot' | 'us') -> Figurtyp des Einsatzgebiets
export function figFor(kind) {
  if (kind === 'wounded') return T.wounded;
  if (kind === 'pilot') return T.pilot;
  if (kind === 'sof') return T.sof;
  if (kind === 'vip') return T.vip;
  if (kind === 'cargo') return 'cargo';
  if (kind === 'civ') return rand.pick(['civ', 'civ2', 'civ3']);
  if (T.peaceful || T.id === 'mali') return T.friend();
  return T.id === 'afghanistan' ? (rand() < 0.5 ? 'isaf' : 'bw') : kind === 'us2' ? 'us2' : 'us';
}
