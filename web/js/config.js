// Zentrale Spielkonstanten
export const WORLD_SIZE = 6000;          // Kantenlänge der Karte in Metern
export const HALF = WORLD_SIZE / 2;
export const GRID = 256;                 // Terrain-Raster (Zellen pro Kante)
export const CELL = WORLD_SIZE / GRID;
export const WATER_LEVEL = 0;
export const G = 9.81;

export const HELI = {
  emptyMass: 2400,       // kg
  fuelMassFull: 600,     // kg JP-4 bei 100 %
  paxMass: 95,           // kg pro Person inkl. Ausrüstung
  capacity: 10,          // Sitzplätze Kabine
  maxThrust: 4800 * G,   // N
  skidH: 1.6,            // Abstand Schwerpunkt -> Kufen-Unterkante
  rotorRadius: 7.3,
  maxPitch: 0.5,         // rad (~29°)
  maxRoll: 0.6,          // rad (~34°)
  climbRate: 9,          // m/s bei voll gezogenem Kollektiv (Assistent)
  sinkRate: 7,
  yawRate: 1.15,         // rad/s
};

export const FUEL = {
  idleBurn: 0.03,        // %/s am Boden / Leerlauf
  thrustBurn: 0.16,      // %/s zusätzlich bei Maximalschub
  refuelRate: 7,         // %/s am Tankwagen
  repairRate: 5,         // HP/s
};

export const GUN = {
  ammo: 1500,
  rpm: 550,
  muzzleVel: 853,
  range: 800,
};

export const FOB_POS = { x: 300, z: 1700 };
export const CALLSIGN = 'Dustoff 2-4';
export const FOB_NAME = 'FOB Eagle';
