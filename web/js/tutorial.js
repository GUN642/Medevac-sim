// Tutorial im Hauptmenü: Bilder aus dem Spiel mit nummerierten Markierungen und Erklärungen (Deutsch/Englisch)
import { getLang } from './i18n.js';

// img: Bild in img/tutorial/, t: Titel, d: Text (je de/en). Nummern im Text beziehen sich auf die Markierungen im Bild.
export const SLIDES = [
  { img: 'menu', t: ['Willkommen bei Hot LZ', 'Welcome to Hot LZ'],
    d: ['Du fliegst Hubschrauber-Einsätze: Verwundete bergen, Truppen absetzen, Lasten tragen, Menschen von Dächern retten. Im Hauptmenü wählst du (1) Karte, (2) Hubschrauber, (3) Tag oder Nacht und (4) den Modus: freies Fliegen oder Karriere. Mit EINSATZ BEGINNEN geht es los.',
      'You fly helicopter missions: evacuate wounded, insert troops, carry loads, rescue people from rooftops. In the main menu choose (1) map, (2) helicopter, (3) day or night and (4) the mode: free flight or career. START MISSION gets you going.'] },
  { img: 'brief', t: ['Der Auftrag', 'The mission'],
    d: ['Jeder Auftrag beginnt mit einem Briefing: Art des Auftrags, Ort und Entfernung, Zahl der Personen, Lage an der Landezone (KALT = ruhig, HEISS = Feindbeschuss) und Markierung (Rauchfarbe). Mit AUFTRAG ANNEHMEN startest du. Danach führt dich die Anzeige oben Schritt für Schritt.',
      'Every mission starts with a briefing: type of mission, location and distance, number of people, situation at the landing zone (COLD = quiet, HOT = enemy fire) and marking (smoke colour). ACCEPT MISSION starts it. After that the display at the top guides you step by step.'] },
  { img: 'hud', t: ['Die Anzeigen', 'The display'],
    d: ['(1) Treibstoff und Struktur – unter 25 % tanken. (2) Auftrag und nächster Schritt. (3) Kompass mit Ziel (gelb) und Basis (blau). (4) Richtung und Entfernung zum Ziel. (5) Minikarte. (6) Höhe über Grund, Fahrt, Steig-/Sinkrate, Kurs, Kabine und Munition. (7) Funksprüche – sie werden auch vorgelesen. (8) Die Zielmarkierung im Gelände.',
      '(1) Fuel and airframe – refuel below 25 %. (2) Mission and next step. (3) Compass with target (yellow) and base (blue). (4) Direction and distance to the target. (5) Minimap. (6) Height above ground, speed, climb/sink rate, heading, cabin and ammo. (7) Radio calls – they are also read aloud. (8) The target marker in the terrain.'] },
  { img: 'touch', t: ['Fliegen mit Touch', 'Flying with touch'],
    d: ['(1) Linker Stick: hoch/runter = steigen/sinken (Kollektiv), links/rechts = Pedale (drehen). (2) Rechter Stick: neigen = vorwärts, rückwärts, seitwärts fliegen. Loslassen = der Flugassistent bremst und hält die Lage. (3) Knöpfe: Sitz wechseln, Kamera, Abstand, Karte, Auftrag, Besatzung, Pause. Tastatur: W/A/S/D neigen, Q/E drehen, Leertaste/Shift steigen/sinken. Controller: linker Stick neigen, Trigger steigen/sinken.',
      '(1) Left stick: up/down = climb/descend (collective), left/right = pedals (turn). (2) Right stick: tilt = fly forward, backward, sideways. Let go = the flight assistant brakes and holds attitude. (3) Buttons: change seat, camera, distance, map, mission, crew, pause. Keyboard: W/A/S/D tilt, Q/E turn, Space/Shift climb/descend. Controller: left stick tilt, triggers climb/descend.'] },
  { img: 'lz', t: ['Landen an der Landezone', 'Landing at the LZ'],
    d: ['Die Landezone (1) ist mit einer Raute markiert; die Truppe wirft Rauch in der gemeldeten Farbe, nachts blinkt ein Blitzlicht. Langsam anfliegen, über der Rauchsäule abbremsen und senkrecht aufsetzen – unter etwa 4 m/s Sinkrate und fast ohne Fahrt, sonst gibt es Schaden. Am Boden bleiben, bis alle eingestiegen sind (Anzeige oben). Schwierige LZs auf Gipfeln oder in Schluchten bringen mehr Punkte.',
      'The landing zone (1) is marked with a diamond; the troops throw smoke in the reported colour, at night a strobe flashes. Approach slowly, slow down over the smoke and touch down vertically – below about 4 m/s sink rate and almost without forward speed, otherwise you take damage. Stay on the ground until everyone has boarded (display at the top). Difficult LZs on peaks or in gorges give more points.'] },
  { img: 'cockpit', t: ['Cockpit und Außenansicht', 'Cockpit and outside view'],
    d: ['Mit KAMERA (Taste C) wechselst du zwischen Außenansicht und Cockpit. Im Cockpit siehst du das Instrumentenbrett; im Landeanflug neigt sich der Blick automatisch nach unten. ABSTAND (Mausrad, +/−) verändert die Entfernung der Außenkamera.',
      'CAMERA (key C) switches between outside view and cockpit. In the cockpit you see the instrument panel; on approach the view tilts down automatically. DISTANCE (mouse wheel, +/−) changes how far away the outside camera is.'] },
  { img: 'gunner', t: ['Bordschütze', 'Door gunner'],
    d: ['Mit SITZ (Taste 1–4, Tab) wechselst du auf den Platz des linken oder rechten Schützen bzw. auf die Heckrampe. Wischen zum Zielen, FEUER zum Schießen; der KI-Pilot fliegt solange weiter. Unbesetzte Plätze übernimmt die KI-Besatzung (CREW). Beim AH-64 und Tiger feuerst du als Pilot Raketen (Taste G, linken Stick kurz antippen).',
      'SEAT (keys 1–4, Tab) moves you to the left or right gunner position or onto the rear ramp. Swipe to aim, FIRE to shoot; the AI pilot keeps flying meanwhile. Empty positions are manned by the AI crew (CREW). In the AH-64 and Tiger you fire rockets as the pilot (key G, briefly tap the left stick).'] },
  { img: 'foot', t: ['Zu Fuß als Infanterist', 'On foot as infantry'],
    d: ['Mit ALS INFANTERIE BEGINNEN oder EIN/AUS am Boden steigst du aus. Gewehr mit Rotpunktvisier und 3x-Vergrößerer, MG, Pistole und an der FOB-Mauer Panzerfäuste. Mit ABHOLUNG (Taste G) rufst du einen Hubschrauber, der dich mitnimmt.',
      'START AS INFANTRY or BOARD/EXIT on the ground gets you out. Rifle with red dot and 3x magnifier, machine gun, pistol and – at the FOB wall – anti-tank launchers. PICKUP (key G) calls a helicopter to collect you.'] },
  { img: 'pol', t: ['Tanken, Reparieren, Munition', 'Refuel, repair, rearm'],
    d: ['Auf dem gelb umrandeten Pad POL neben dem Tankwagen (1) landen: Der Hubschrauber wird betankt, repariert und aufmunitioniert. Ist der Tank leer, fällt das Triebwerk aus – dann hilft nur noch eine Autorotation.',
      'Land on the yellow-bordered POL pad next to the fuel truck (1): the helicopter is refuelled, repaired and rearmed. If the tank runs dry the engine quits – then only an autorotation can save you.'] },
  { img: 'winch', t: ['Windenrettung', 'Hoist rescue'],
    d: ['Hochwasser-Karte: Personen sitzen auf Dächern fest. Über dem Dach 3–30 m hoch fast stillstehen – die Winde (1) sitzt rechts an der Tür. Die Personen werden einzeln hochgezogen; Position halten, bis alle an Bord sind. Vorsicht vor Stromleitungen und Kirchtürmen.',
      'Flood map: people are stuck on rooftops. Hover almost still 3–30 m above the roof – the hoist (1) is at the right-hand door. People are winched up one by one; hold position until everyone is aboard. Watch out for power lines and church towers.'] },
  { img: 'sling', t: ['Außenlast am Lasthaken', 'Sling load'],
    d: ['Über der Last (Netz, Sandsäcke oder Fahrzeug) 5–20 m hoch schweben, das Bodenpersonal hängt sie an. Die Last (1) hängt an einem 15-m-Seil, pendelt und macht den Hubschrauber schwerer – ruhig und unter 80 kt fliegen. Am Ziel langsam sinken, bis die Last aufsetzt; dann wird ausgeklinkt.',
      'Hover 5–20 m above the load (net, sandbags or vehicle) and the ground crew hooks it up. The load (1) hangs on a 15 m line, swings and makes the helicopter heavier – fly smoothly and below 80 kt. At the destination descend slowly until the load touches down; then it is released.'] },
  { img: 'auto', t: ['Autorotation und Wirbelring', 'Autorotation and vortex ring'],
    d: ['Fällt das Triebwerk aus (leerer Tank, Treffer oder Übung): sofort Kollektiv ganz runter, damit der Rotor Drehzahl hält (Anzeige ROTOR %). Mit etwa 60 kt gleiten, in 20–30 m die Nase hoch nehmen (Abfangen) und kurz vor dem Boden Kollektiv ziehen. Wirbelringstadium: Schnell sinken ohne Fahrt lässt den Hubschrauber durchsacken – Nase runter und Fahrt aufnehmen.',
      'If the engine quits (empty tank, hit or drill): lower the collective fully at once so the rotor keeps its RPM (ROTOR % display). Glide at about 60 kt, raise the nose at 20–30 m (flare) and pull the collective just above the ground. Vortex ring state: sinking fast without airspeed makes the helicopter settle – nose down and gain airspeed.'] },
  { img: 'storm', t: ['Wetter', 'Weather'],
    d: ['Das Wetter wechselt: Frühnebel, Dunst, tiefe Wolken, Regenschauer, Gewitter mit Blitzen und Sturmböen, in Norwegen Schneeschauer, in Mali Sandstürme. Die Funkzentrale warnt vorher. Bei schlechter Sicht tief und langsam fliegen; Böen versetzen den Hubschrauber, besonders beim Landen.',
      'The weather changes: morning fog, haze, low clouds, rain showers, thunderstorms with lightning and strong gusts, snow showers in Norway, sandstorms in Mali. The operations centre warns you in advance. In poor visibility fly low and slow; gusts push the helicopter around, especially when landing.'] },
  { img: 'nvg', t: ['Nachtflug', 'Night flying'],
    d: ['Nachts helfen Mond und Sterne nur wenig. Mit NVG (Taste N) schaltest du das Nachtsichtgerät ein: grünes Restlichtbild. Landezonen sind nachts mit Blitzlicht markiert; unter 60 m schaltet sich ohne Nachtsichtgerät der Landescheinwerfer ein.',
      'At night the moon and stars help only a little. NVG (key N) turns on the night vision goggles: green image intensifier picture. Landing zones are marked with strobes at night; below 60 m the landing light comes on when you are not using NVG.'] },
  { img: 'map', t: ['Karte und Luftunterstützung', 'Map and air support'],
    d: ['KARTE (Taste M) zeigt das ganze Einsatzgebiet mit Ziel, Basis, Landezonen und anderen Hubschraubern. Gegen starke Feindkräfte kannst du Luftunterstützung anfordern (Taste L): Jets oder Artillerie greifen Feinde in deiner Nähe an.',
      'MAP (key M) shows the whole area of operations with target, base, landing zones and other helicopters. Against strong enemy forces you can call air support (key L): jets or artillery attack enemies near you.'] },
  { img: 'career', t: ['Karriere', 'Career'],
    d: ['Im Modus KARRIERE fliegst du Einsatztage mit je vier Aufträgen. Punkte bringen Beförderungen, und jede Beförderung schaltet den nächsten Hubschrauber der Karte frei. Rang, Einsatztag und Auszeichnungen (1) stehen im Hauptmenü. Ein Absturz kostet Punkte, ein Einsatztag ohne Verlust bringt einen Bonus.',
      'In CAREER mode you fly duty days of four missions each. Points earn promotions, and every promotion unlocks the next helicopter of the map. Rank, duty day and awards (1) are shown in the main menu. A crash costs points, a duty day without losses earns a bonus.'] },
  { img: 'vr', t: ['VR-Brille (VITURE)', 'VR glasses (VITURE)'],
    d: ['In der Android-App läuft das Spiel direkt auf einer angesteckten XR-Brille, das Handy zeigt das Bild und dient als Touchfläche. Brille per Taste auf 3D schalten: das Spiel zeichnet automatisch zwei Halbbilder. In den Einstellungen Umsehen per Kopfbewegung einschalten; Taste O richtet den Blick neu aus.',
      'In the Android app the game runs directly on connected XR glasses; the phone shows the picture and works as a touchpad. Switch the glasses to 3D with their button: the game automatically draws two half images. Enable head tracking in the settings; key O recentres the view.'] },
  { img: 'mp', t: ['Mehrspieler im WLAN', 'Multiplayer over Wi-Fi'],
    d: ['In der Android-App können mehrere Spieler im selben WLAN zusammen fliegen: einer eröffnet das Spiel, die anderen treten bei. Jeder fliegt seinen eigenen Hubschrauber oder sitzt als Schütze bzw. Passagier bei einem anderen mit.',
      'In the Android app several players on the same Wi-Fi can fly together: one hosts the game, the others join. Everyone flies their own helicopter or rides along with someone else as a gunner or passenger.'] },
];

export class Tutorial {
  constructor(game) {
    this.g = game;
    this.i = 0;
    this.el = document.getElementById('tutorial');
    const $ = (id) => document.getElementById(id);
    $('tut-prev').addEventListener('click', (e) => { e.preventDefault(); this.go(-1); });
    $('tut-next').addEventListener('click', (e) => { e.preventDefault(); if (this.i >= SLIDES.length - 1) this.close(); else this.go(1); });
    // Wischen auf dem Bild
    let sx = null;
    const img = $('tut-img');
    img.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    img.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 40) this.go(dx < 0 ? 1 : -1); });
    document.addEventListener('keydown', (e) => {
      if (this.el.classList.contains('hidden')) return;
      if (e.code === 'ArrowRight') { this.go(1); e.preventDefault(); }
      if (e.code === 'ArrowLeft') { this.go(-1); e.preventDefault(); }
    });
  }

  open(i = 0) { this.i = i; this.render(); this.el.classList.remove('hidden'); this.g.focusFirst(this.el); }
  close() { this.el.classList.add('hidden'); }
  go(d) { this.i = Math.max(0, Math.min(SLIDES.length - 1, this.i + d)); this.render(); }

  render() {
    const s = SLIDES[this.i], en = getLang() === 'en' ? 1 : 0;
    const $ = (id) => document.getElementById(id);
    $('tut-img').src = `img/tutorial/${s.img}.jpg`;
    $('tut-title').textContent = s.t[en];
    $('tut-text').textContent = s.d[en];
    $('tut-page').textContent = `${this.i + 1} / ${SLIDES.length}`;
    $('tut-prev').disabled = this.i === 0;
    $('tut-next').textContent = this.i >= SLIDES.length - 1 ? (en ? 'DONE' : 'FERTIG') : (en ? 'NEXT ▶' : 'WEITER ▶');
    $('tut-prev').textContent = en ? '◀ BACK' : '◀ ZURÜCK';
    // nächstes Bild vorladen
    const n = SLIDES[this.i + 1];
    if (n) (new Image()).src = `img/tutorial/${n.img}.jpg`;
  }
}
