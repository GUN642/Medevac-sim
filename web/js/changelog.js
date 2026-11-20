// Änderungsprotokoll („Was ist neu?“) – neueste Einträge zuerst.
// Bei jedem Update oben einen Eintrag ergänzen: id muss eindeutig sein und neuer als alle bisherigen sortieren.
// Nach einem Update wird alles angezeigt, was seit dem zuletzt gesehenen Eintrag neu ist.

import { getLang } from './i18n.js';

export const CHANGELOG = [
  {
    id: '2026-11-20', date: '20.11.2026',
    de: [
      'Neu: „Was ist neu?“ – nach jedem Update erscheint diese Übersicht automatisch; im Hauptmenü jederzeit unter NEUIGKEITEN.',
    ],
    en: [
      'New: “What’s new?” – this overview now appears automatically after every update; available any time from the main menu under WHAT’S NEW.',
    ],
  },
  {
    id: '2026-11-19', date: '19.11.2026',
    de: [
      'Vietnam: Bordmusik über Knopf ♫ MUSIK bzw. Taste J – „Walkürenritt“ (Wagner) ist eingebaut, zusätzlich lässt sich eine eigene Musikdatei laden (Einstellungen → Bordmusik Vietnam).',
      'Berggipfel sind runder und natürlicher statt nadelspitz (Vietnam, Afghanistan, Norwegen, Hochwasser).',
      'CH-47: dicke Luftbetankungssonde nach Vorbild der MH-47G und Rettungswinde über der rechten vorderen Tür.',
    ],
    en: [
      'Vietnam: on-board music via the ♫ MUSIC button or key J – “Ride of the Valkyries” (Wagner) is built in, and you can load your own music file (Settings → On-board music Vietnam).',
      'Mountain peaks are rounder and more natural instead of needle-sharp (Vietnam, Afghanistan, Norway, Flood).',
      'CH-47: thick aerial refuelling probe modelled on the MH-47G and a rescue hoist above the front right door.',
    ],
  },
  {
    id: '2026-11-14', date: '14.11.2026',
    de: [
      'Grafik deutlich realistischer: filmische Farbabstimmung, Luftperspektive, natürlichere Baumkronen, verwitterte Oberflächen.',
      'Felsen und Büsche als Bodenbedeckung – weniger Steine, weiter sichtbar und weich eingeblendet.',
      'Detailliertere Gebäude und Fahrzeuge auf allen Karten.',
      'Neue Grafikstufe „Sehr niedrig“ für Android TV und schwache Geräte (auf Android TV automatisch).',
      'Cockpitsicht: Kopf höher und deutlich weitwinkliger für bessere Sicht nach draußen.',
      'Keine Löschflüge mehr auf den Kriegsschauplätzen.',
    ],
    en: [
      'Much more realistic graphics: cinematic colour grading, aerial perspective, more natural tree crowns, weathered surfaces.',
      'Rocks and bushes as ground cover – fewer rocks, visible further away and faded in smoothly.',
      'More detailed buildings and vehicles on all maps.',
      'New graphics level “Very low” for Android TV and weak devices (automatic on Android TV).',
      'Cockpit view: higher head position and much wider angle for a better view outside.',
      'No more firefighting flights in the war theatres.',
    ],
  },
  {
    id: '2026-11-13', date: '13.11.2026',
    de: [
      'Vietnam: neue Hubschrauber AH-1G Cobra, UH-1C Gunship und UH-34D der Marines.',
      'Mehrspieler: Sprechfunk (Sprechtaste FUNK bzw. Feststelltaste) und Text-Chat (Taste K).',
      'Ukraine: Flugabwehr über 150 ft mit automatischen Flares.',
    ],
    en: [
      'Vietnam: new helicopters AH-1G Cobra, UH-1C Gunship and the Marines’ UH-34D.',
      'Multiplayer: voice radio (push-to-talk RADIO button or Caps Lock) and text chat (key K).',
      'Ukraine: air defence above 150 ft with automatic flares.',
    ],
  },
  {
    id: '2026-11-12', date: '12.11.2026',
    de: [
      'Neue Karte Ukraine 2023 mit Mi-8, Mi-24, Drohnen- und Artilleriebeschuss, Scharfschützen, F-16 und Su-25.',
      'Mehr Abwechslung: Fast-Rope, Vermisstensuche, neue Außenlasten und Zusatzlagen.',
      'Stärkerer Brownout bei Landungen in der Wüste, aber nur im Schwebe- und Landeanflug.',
      'Überarbeitete CH-53GS und CH-47 nach Bauplänen.',
    ],
    en: [
      'New map Ukraine 2023 with Mi-8, Mi-24, drone and artillery fire, snipers, F-16 and Su-25.',
      'More variety: fast-rope, search for missing persons, new sling loads and extra situations.',
      'Stronger brownout when landing in the desert, but only while hovering and on approach.',
      'Reworked CH-53GS and CH-47 based on blueprints.',
    ],
  },
  {
    id: '2026-11-11', date: '10.–11.11.2026',
    de: [
      'Mehrspieler im Browser per Spielcode.',
      'Fahrbare Fahrzeuge an der FOB mit Dach-MG, MG-Stellungen und Konvoi-Angriffe.',
      'Maus in der Android-App (Laptop/Nexdock): Zeiger einfangen, schießen, umsehen.',
    ],
    en: [
      'Multiplayer in the browser via game code.',
      'Drivable vehicles at the FOB with roof MG, MG positions and convoy attacks.',
      'Mouse in the Android app (laptop/Nexdock): pointer capture, shooting, looking around.',
    ],
  },
  {
    id: '2026-11-09', date: '07.–09.11.2026',
    de: [
      'Neue Karten Mali 2017 (NH90, Tiger, Sandsturm) und Norwegen – Arktis-Übung (Fregatte, Whiteout).',
      'Bebildertes Tutorial, Karriere-Modus, Wetterwechsel auf allen Karten.',
      'Autorotation, Wirbelringstadium, Außenlasten, Instrumentenbrett im Cockpit.',
      'VR-/XR-Brillen: 3D-Bild und Head-Tracking.',
    ],
    en: [
      'New maps Mali 2017 (NH90, Tiger, sandstorm) and Norway – Arctic exercise (frigate, whiteout).',
      'Illustrated tutorial, career mode, weather changes on all maps.',
      'Autorotation, vortex ring state, sling loads, instrument panel in the cockpit.',
      'VR/XR glasses: 3D image and head tracking.',
    ],
  },
];

export const LATEST = CHANGELOG[0].id;
const KEY = 'dustoff.changelogSeen';

export function seenId() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
export function markSeen() { try { localStorage.setItem(KEY, LATEST); } catch (e) { /* privat */ } }

// Einträge neuer als der zuletzt gesehene (ohne Merker, z. B. erstes Update mit dieser Funktion: die zwei neuesten)
export function unseen() {
  const s = seenId();
  return s ? CHANGELOG.filter((e) => e.id > s) : CHANGELOG.slice(0, 2);
}

const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function renderChangelog(el, entries, isUpdate) {
  const en = getLang() !== 'de';
  const head = isUpdate ? (en ? 'Updated – here is what changed:' : 'Aktualisiert – das hat sich getan:') : '';
  el.innerHTML = (head ? `<p class="cl-head">${head}</p>` : '') + entries.map((e) =>
    `<div class="cl-entry"><h3>${e.date}</h3><ul>${(en ? e.en : e.de).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('');
}
