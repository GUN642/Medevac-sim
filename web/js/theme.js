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
    rotorAudio: 0.8, rotorCut: 0.75, camDist: 38, shadow: 16, door: 'ramp', rampZ: 8.9, numbers: ['82+01', '82+07'],
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
    id: 'ch53', model: 'ch53', name: 'Sikorsky CH-53GS', short: 'CH-53GS', callsign: 'Hummel 1-2',
    emptyMass: 10900, fuelMassFull: 2900, paxMass: 100, capacity: 36, maxThrust: 26000 * G,
    skidH: 1.65, rotorRadius: 11, rotorTop: 3.0, maxPitch: 0.6, maxRoll: 0.65, climbRate: 13, sinkRate: 8, yawRate: 1.3,
    vmax: 127, vlimit: 130, agility: 1.15, burn: 0.9, drag: 0.9, armor: 0.5, gun: { name: 'M3M .50', rpm: 1050, ammo: 400, mags: 2, muzzleVel: 890, range: 1300, heavy: true, tracerEvery: 3 },
    seats: ['pilot', 'left', 'right', 'ramp'], seatNames: { ramp: 'Heckschütze (Rampe)' },
    rotorAudio: 1.7, rotorCut: 0.9, camDist: 40, shadow: 18, door: 'ramp', rampZ: 7.2, numbers: ['84+05', '85+11'],
  },
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
  return T.id === 'afghanistan' ? (rand() < 0.5 ? 'isaf' : 'bw') : kind === 'us2' ? 'us2' : 'us';
}
