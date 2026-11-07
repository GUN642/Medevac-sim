// Frei belegbare Tasten und Maustasten (Tastatur/Maus)
// Jede Belegung hat bis zu zwei Tasten. Codes: KeyboardEvent.code bzw. 'Mouse0' (links), 'Mouse1' (Mitte), 'Mouse2' (rechts), 'Mouse3'/'Mouse4' (Seitentasten)

export const BIND_DEFS = [
  { g: 'Fliegen' },
  { id: 'fly-fwd', label: 'Nase senken / vorwärts', def: ['KeyW', 'ArrowUp'], held: true },
  { id: 'fly-back', label: 'Nase heben / rückwärts', def: ['KeyS', 'ArrowDown'], held: true },
  { id: 'fly-left', label: 'Nach links neigen', def: ['KeyA', 'ArrowLeft'], held: true },
  { id: 'fly-right', label: 'Nach rechts neigen', def: ['KeyD', 'ArrowRight'], held: true },
  { id: 'yaw-left', label: 'Pedal links (drehen)', def: ['KeyQ'], held: true },
  { id: 'yaw-right', label: 'Pedal rechts (drehen)', def: ['KeyE'], held: true },
  { id: 'coll-up', label: 'Kollektiv: steigen', def: ['Space', 'KeyR'], held: true },
  { id: 'coll-down', label: 'Kollektiv: sinken', def: ['ShiftLeft', 'KeyF'], held: true },
  { id: 'rocket', label: 'Raketen (Apache)', def: ['KeyG'] },
  { id: 'camera', label: 'Außenansicht / Cockpit', def: ['KeyC'] },
  { id: 'cam-in', label: 'Kamera näher', def: ['Equal', 'NumpadAdd'] },
  { id: 'cam-out', label: 'Kamera weiter weg', def: ['Minus', 'NumpadSubtract'] },
  { g: 'Schütze' },
  { id: 'gun-fire', label: 'Feuern (Schütze)', def: ['Mouse0', 'Space'], held: true },
  { id: 'gun-zoom', label: 'Zoom (Schütze)', def: ['Mouse2'], held: true },
  { g: 'Zu Fuß' },
  { id: 'walk-fwd', label: 'Vorwärts', def: ['KeyW'], held: true },
  { id: 'walk-back', label: 'Rückwärts', def: ['KeyS'], held: true },
  { id: 'walk-left', label: 'Links', def: ['KeyA'], held: true },
  { id: 'walk-right', label: 'Rechts', def: ['KeyD'], held: true },
  { id: 'sprint', label: 'Sprinten', def: ['ShiftLeft'], held: true },
  { id: 'jump', label: 'Springen', def: ['Space'], held: true },
  { id: 'fire', label: 'Feuern', def: ['Mouse0'], held: true },
  { id: 'aim', label: 'Zielen / Zoom', def: ['Mouse2'], held: true },
  { id: 'reload', label: 'Nachladen', def: ['KeyR'] },
  { id: 'crouch', label: 'Ducken', def: ['KeyC'] },
  { id: 'view', label: 'Ego-Perspektive / Schulterkamera', def: ['KeyV'] },
  { id: 'magnifier', label: '3x-Vergrößerer', def: ['KeyB'] },
  { id: 'use', label: 'Ein-/Aussteigen, aufnehmen', def: ['KeyE'] },
  { id: 'pickup', label: 'Hubschrauber rufen', def: ['KeyG'] },
  { id: 'wnext', label: 'Nächste Waffe', def: [] },
  { id: 'wprev', label: 'Vorige Waffe', def: [] },
  { g: 'Allgemein' },
  { id: 'seat-pilot', label: 'Sitz Pilot / Waffe 1', def: ['Digit1'] },
  { id: 'seat-left', label: 'Sitz linker Schütze / Waffe 2', def: ['Digit2'] },
  { id: 'seat-right', label: 'Sitz rechter Schütze / Waffe 3', def: ['Digit3'] },
  { id: 'num4', label: 'Sitz Heckschütze / Waffe 4', def: ['Digit4'] },
  { id: 'num5', label: 'Waffe 5', def: ['Digit5'] },
  { id: 'seat-next', label: 'Nächster Sitz', def: ['Tab'] },
  { id: 'map', label: 'Karte', def: ['KeyM'] },
  { id: 'radio', label: 'Auftrag anzeigen', def: ['KeyT'] },
  { id: 'crew', label: 'Besatzung', def: ['KeyX'] },
  { id: 'airsupport', label: 'Luftunterstützung', def: ['KeyL'] },
  { id: 'nvg', label: 'Nachtsichtgerät', def: ['KeyN'] },
  { id: 'confirm', label: 'Bestätigen', def: ['Enter', 'NumpadEnter'] },
  { id: 'pause', label: 'Pause (Esc immer)', def: ['KeyP'] },
  { id: 'help', label: 'Steuerung', def: ['KeyH'] },
  { id: 'head-cal', label: 'VR-Brille: Blick neu ausrichten', def: ['KeyO'] },
];

// Gruppe -> wann die Belegung gilt
let grp = '';
for (const b of BIND_DEFS) { if (b.g) grp = b.g; else b.group = grp; }
export const BINDS = BIND_DEFS.filter((b) => b.id);
export function bindActive(b, mode) {
  if (b.group === 'Zu Fuß') return mode === 'foot';
  if (b.group === 'Fliegen' || b.group === 'Schütze') return mode !== 'foot';
  return true;
}

// Belegung = Standard + eigene Änderungen aus den Einstellungen
export function resolveBinds(settings) {
  const own = (settings && settings.binds) || {};
  const out = {};
  for (const b of BINDS) out[b.id] = Array.isArray(own[b.id]) ? own[b.id].slice(0, 2) : b.def.slice(0, 2);
  return out;
}

const NAMES = {
  Space: 'Leertaste', ShiftLeft: 'Shift links', ShiftRight: 'Shift rechts', ControlLeft: 'Strg links', ControlRight: 'Strg rechts',
  AltLeft: 'Alt links', AltRight: 'Alt Gr', Enter: 'Enter', NumpadEnter: 'Num Enter', Tab: 'Tab', Escape: 'Esc', Backspace: '⌫',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Equal: '´ / =', Minus: 'ß / −', NumpadAdd: 'Num +', NumpadSubtract: 'Num −',
  BracketRight: '+', Slash: '-', CapsLock: 'Feststell', PageUp: 'Bild ↑', PageDown: 'Bild ↓',
  Mouse0: 'Linke Maustaste', Mouse1: 'Mittlere Maustaste', Mouse2: 'Rechte Maustaste', Mouse3: 'Maus zurück', Mouse4: 'Maus vor',
};
export function keyName(code) {
  if (!code) return '–';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
