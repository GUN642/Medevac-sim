// Sprachumschaltung Deutsch / Englisch.
// Das Spiel ist auf Deutsch geschrieben; bei Englisch werden alle angezeigten Texte zur Laufzeit übersetzt
// (DOM-Textknoten per MutationObserver, dazu tr() für Canvas-Texte und Dialoge).
// Schlüssel mit {0}, {1} … sind Vorlagen: die Platzhalter werden wieder übersetzt (z. B. Himmelsrichtungen).

let lang = 'de';
export const getLang = () => lang;

const EN = {
  // ------------------------------------------------------------ Menü / Oberfläche (index.html)
  'Hot LZ – Hubschrauber-Einsätze': 'Hot LZ – Helicopter Missions',
  'HUBSCHRAUBER-EINSÄTZE': 'HELICOPTER MISSIONS',
  'TREIBST.': 'FUEL', 'STRUKTUR': 'AIRFRAME', 'HÖHE': 'ALT', 'FAHRT': 'SPEED', 'STEIG': 'V/S', 'KURS': 'HDG',
  '▲ Steigen · ▼ Sinken': '▲ Climb · ▼ Descend', '◀ ▶ Pedale': '◀ ▶ Pedals',
  'Laufen (ganz außen: sprinten)': 'Move (push to edge: sprint)', 'Zyklisch (Neigen)': 'Cyclic (tilt)', 'Wischen zum Zielen': 'Swipe to aim',
  'SITZ': 'SEAT', 'KAMERA': 'CAMERA', 'ABSTAND': 'DISTANCE', 'KARTE': 'MAP', 'AUFTRAG': 'MISSION', 'ABHOLUNG': 'PICKUP',
  'RAKETE': 'ROCKET', 'CREW': 'CREW', 'WAFFE': 'WEAPON', 'LADEN': 'RELOAD', 'ZOOM': 'ZOOM', 'DUCKEN': 'CROUCH',
  'ANSICHT': 'VIEW', 'FEUER': 'FIRE', 'EIN/AUS': 'BOARD/EXIT', 'Lade …': 'Loading …',
  'EINSATZ BEGINNEN': 'START MISSION', 'ALS INFANTERIE BEGINNEN': 'START AS INFANTRY',
  'FORTSETZEN': 'RESUME', 'STEUERUNG': 'CONTROLS', 'MEHRSPIELER (LAN)': 'MULTIPLAYER (LAN)', 'EINSTELLUNGEN': 'SETTINGS',
  'NACH UPDATES SUCHEN': 'CHECK FOR UPDATES', 'ANDROID-APP (APK)': 'ANDROID APP (APK)', 'AUFTRAG ANNEHMEN': 'ACCEPT MISSION',
  'Antippen': 'Tap', 'PAUSE': 'PAUSE', 'HAUPTMENÜ': 'MAIN MENU', 'SPIEL BEENDEN': 'QUIT GAME',
  'Mehrspieler: Das Spiel läuft weiter, Ihr Hubschrauber schwebt solange auf der Stelle.': 'Multiplayer: the game keeps running, your helicopter hovers in place meanwhile.',
  'MEHRSPIELER IM LOKALEN NETZWERK': 'MULTIPLAYER ON THE LOCAL NETWORK',
  'Der LAN-Mehrspieler funktioniert in der': 'LAN multiplayer works in the', 'Android-App': 'Android app',
  '(Handy, Tablet, Android TV). Alle Geräte müssen im selben WLAN sein.': '(phone, tablet, Android TV). All devices must be on the same Wi-Fi.',
  'Browser können aus Sicherheitsgründen keine direkten Netzwerkverbindungen öffnen. Zum Ausprobieren auf einem PC: Seite mit': 'For security reasons, browsers cannot open direct network connections. To try it on a PC: open the page with',
  'in zwei Tabs öffnen.': 'in two tabs.', 'Ihr Name': 'Your name', 'Zweiter Hubschrauber': 'Second helicopter', 'keiner': 'none',
  'SPIEL ERÖFFNEN': 'HOST GAME', 'Gefundene Spiele': 'Games found', 'Oder IP-Adresse': 'Or IP address', 'VERBINDEN': 'CONNECT',
  'Einer eröffnet das Spiel, die anderen treten bei. Neue Mitspieler können jederzeit dazukommen.': 'One player hosts, the others join. New players can join at any time.',
  'Zusammen fliegen: einer ist Pilot, die anderen sitzen an den Bord-MGs. Freie Plätze übernimmt die KI.': 'Fly together: one is the pilot, the others man the door guns. The AI takes any free seats.',
  'Mit dem zweiten Hubschrauber fliegen zwei Piloten gemeinsam. Über': 'With the second helicopter, two pilots fly together. Via',
  '(Taste X, Controller ⊖) wechseln Sie den Platz – auch in die andere Maschine, wenn beide nebeneinander gelandet sind.': '(key X, controller ⊖) you change seats – even into the other aircraft when both have landed side by side.',
  'Gäste-WLANs mit „Client-Isolation“ verhindern die Verbindung.': 'Guest Wi-Fi networks with “client isolation” prevent the connection.',
  'ZURÜCK': 'BACK', 'BESATZUNG': 'CREW', 'SCHLIESSEN': 'CLOSE', 'JA, BEENDEN': 'YES, QUIT', 'ABBRECHEN': 'CANCEL',
  'VERBINDUNG GETRENNT': 'CONNECTION LOST', 'Die Verbindung zum Host wurde unterbrochen.': 'The connection to the host was lost.',
  'ZUM HAUPTMENÜ': 'TO MAIN MENU', 'Karte schließen: M / Ⓧ / Antippen': 'Close map: M / Ⓧ / tap',
  'Tastatur / Maus': 'Keyboard / mouse', 'Switch-Controller': 'Switch controller', 'Touch': 'Touch',
  'Maus ↑ / ↓ · W / S': 'Mouse ↑ / ↓ · W / S',
  'Vorwärts / rückwärts (Nase senken = beschleunigen). Erst ins Bild klicken.': 'Forward / backward (nose down = accelerate). Click into the view first.',
  'Maus ← / → · Q / E': 'Mouse ← / → · Q / E', 'Drehen (Pedale)': 'Turn (pedals)',
  'Seitlich neigen (im Vorwärtsflug: Kurve)': 'Bank sideways (in forward flight: turn)', 'Leertaste / R': 'Space / R',
  'Kollektiv: steigen': 'Collective: climb', 'Kollektiv: sinken / landen': 'Collective: descend / land',
  'Sitz: Pilot / linker Schütze / rechter Schütze': 'Seat: pilot / left gunner / right gunner', 'Maus (Schütze)': 'Mouse (gunner)',
  'Zielen (Klick sperrt den Zeiger) · Linksklick feuern · Rechtsklick Zoom': 'Aim (click locks the pointer) · left click fire · right click zoom',
  'Zu Fuß': 'On foot',
  'WASD laufen · Maus zielen · Linksklick feuern · Rechtsklick zoomen · Shift sprinten · Leertaste springen · C ducken · R nachladen · 1–5 / Mausrad Waffe · V Ego-Perspektive (Rechtsklick = über Kimme und Korn zielen) · E ein-/aussteigen · G Hubschrauber rufen': 'WASD move · mouse aim · left click fire · right click zoom · Shift sprint · Space jump · C crouch · R reload · 1–5 / mouse wheel weapon · V first person (right click = aim down sights) · E board/exit · G call helicopter',
  'Rechte Maustaste halten': 'Hold right mouse button',
  'Kamera schwenken · Mausrad Zoom · Esc gibt die Maus frei': 'Pan camera · mouse wheel zoom · Esc releases the mouse',
  'Besatzung / Platz wechseln (Mehrspieler)': 'Crew / change seat (multiplayer)', 'Außenansicht / Cockpit': 'Outside view / cockpit',
  'Karte': 'Map', 'Aktuellen Auftrag anzeigen': 'Show current mission', 'Auftrag annehmen': 'Accept mission', 'Pause': 'Pause',
  'Linker Stick': 'Left stick', 'Zyklisch (neigen / beschleunigen)': 'Cyclic (tilt / accelerate)', 'Rechter Stick ↕': 'Right stick ↕',
  'Kollektiv: steigen / sinken': 'Collective: climb / descend', 'Rechter Stick ↔': 'Right stick ↔', 'Pedale – drehen': 'Pedals – turn',
  'Steigen / Sinken (als Schütze: ZR feuern, ZL Zoom)': 'Climb / descend (as gunner: ZR fire, ZL zoom)',
  'Sitz wechseln (Pilot ↔ Schützen)': 'Change seat (pilot ↔ gunners)', 'Steuerkreuz': 'D-pad',
  '↑ Pilot · ← linker · → rechter Schütze · ↓ Auftrag': '↑ pilot · ← left · → right gunner · ↓ mission',
  'Bestätigen / Auftrag annehmen': 'Confirm / accept mission', 'Kamera wechseln': 'Change camera',
  'Pause / Besatzung (Platz wechseln, aussteigen)': 'Pause / crew (change seat, exit)',
  'Linker Stick laufen (L3 sprinten) · rechter Stick zielen · ZR feuern · ZL zoomen · L/R oder ← Waffe · Ⓨ nachladen · → ducken · R3 Visier 3x · ↑ Ego-Perspektive · Ⓐ ein-/aussteigen · Ⓧ oder ↓ Hubschrauber rufen': 'Left stick move (L3 sprint) · right stick aim · ZR fire · ZL zoom · L/R or ← weapon · Ⓨ reload · → crouch · R3 3x magnifier · ↑ first person · Ⓐ board/exit · Ⓧ or ↓ call helicopter',
  'Den Switch Pro Controller oder die Joy-Cons per Bluetooth mit PC, TV-Box oder Handy koppeln. Nach dem Koppeln einmal eine Taste drücken, damit der Browser den Controller erkennt.': 'Pair the Switch Pro Controller or the Joy-Cons via Bluetooth with your PC, TV box or phone. After pairing, press any button once so the browser detects the controller.',
  'Linker Daumen': 'Left thumb', '↑↓ Steigen / Sinken · ←→ Pedale': '↑↓ climb / descend · ←→ pedals', 'Rechter Daumen': 'Right thumb',
  'Zyklisch: neigen / beschleunigen': 'Cyclic: tilt / accelerate', 'Pilot → linker Schütze → rechter Schütze': 'Pilot → left gunner → right gunner',
  'Als Schütze': 'As gunner', 'FEUER halten und mit demselben Finger ziehen zum Zielen (oder rechts wischen)': 'Hold FIRE and drag with the same finger to aim (or swipe on the right)',
  'Links laufen, rechts wischen oder FEUER ziehen zum Zielen · WAFFE · LADEN · ZOOM · DUCKEN · ANSICHT · EIN/AUS · ABHOLUNG': 'Move on the left, swipe on the right or drag FIRE to aim · WEAPON · RELOAD · ZOOM · CROUCH · VIEW · BOARD/EXIT · PICKUP',
  'KAMERA · KARTE · AUFTRAG': 'CAMERA · MAP · MISSION', 'Ansicht wechseln · Karte · Briefing zeigen': 'Change view · map · show briefing',
  "So geht's": 'How to play', 'Der': 'The', 'Flugassistent': 'flight assistant',
  'hält Höhe und bremst automatisch ab, wenn Sie den Stick loslassen.': 'holds altitude and brakes automatically when you release the stick.',
  'Fliegen Sie zum gelben Wegpunkt. Richtung und Entfernung stehen oben am Kompass.': 'Fly to the yellow waypoint. Bearing and distance are shown at the compass on top.',
  'Landen Sie sanft (Steigrate < 800 ft/min) in der Landezone beim farbigen Rauch. Die Soldaten steigen selbst ein.': 'Land gently (sink rate < 800 ft/min) in the landing zone at the colored smoke. The soldiers board by themselves.',
  'In': 'In', 'heißen LZs': 'hot LZs', 'schießen die Bordschützen selbstständig auf erkannte Feinde (Mündungsfeuer, grüne Leuchtspur).': 'the door gunners engage spotted enemies on their own (muzzle flashes, green tracers).',
  'Behalten Sie den': 'Keep an eye on your', 'Treibstoff': 'fuel', 'im Blick: Auf Pad': ': on pad',
  '(gelber Rand, Tankwagen) wird getankt, repariert und Munition aufgefüllt.': '(yellow border, fuel truck) you refuel, repair and rearm.',
  'Verwundete und gerettete Piloten auf Pad': 'Deliver wounded and rescued pilots to pad', '(rotes Kreuz) abliefern.': '(red cross).',
  'Infanterie:': 'Infantry:',
  'Über CREW → „Aussteigen“ oder „Als Infanterie beginnen“ spielen Sie einen Soldaten. Steigen Sie als Passagier ein – ist kein Mensch am Steuer, fliegt der KI-Pilot den Auftrag und setzt Sie an der LZ ab. Mit „Abholung“ (G) holt er Sie wieder.': 'Via CREW → “Exit” or “Start as infantry” you play a soldier. Board as a passenger – if no human is flying, the AI pilot flies the mission and drops you at the LZ. “Pickup” (G) brings him back for you.',
  'Waffen zu Fuß – Vietnam: M16A1, M60, M79, Ithaca 37, M1911 · Afghanistan: M4A1, M249, M320, Mossberg 590, M9. Munition und Gesundheit füllen sich in der FOB auf.': 'Weapons on foot – Vietnam: M16A1, M60, M79, Ithaca 37, M1911 · Afghanistan: M4A1, M249, M320, Mossberg 590, M9. Ammo and health refill at the FOB.',
  'Nachtflug': 'Night flying',
  ': Im Hauptmenü ZEIT: NACHT wählen. Nachtsichtgerät mit N (Controller: linker Stick drücken, zu Fuß Steuerkreuz oben; Touch NVG). Landezonen sind nachts mit Blitzlicht markiert, der Landescheinwerfer geht unter 60 m automatisch an (mit NVG aus).': ': choose TIME: NIGHT in the main menu. Night vision with N (controller: press left stick, on foot D-pad up; touch NVG). Landing zones are marked with strobes at night, the landing light switches on automatically below 60 m (off with NVG).',
  '(Taste L, Controller ⊖ → CREW, Touch CREW): AH-64E, F-16C oder A-10C (Vietnam: F-4 Napalm) greifen Feinde im Umkreis von ca. 700 m um Ihre Position an. Danach braucht jede Maschine 2–2,5 Minuten Pause.': '(key L, controller ⊖ → CREW, touch CREW): AH-64E, F-16C or A-10C (Vietnam: F-4 napalm) attack enemies within about 700 m of your position. Afterwards each aircraft needs a 2–2.5 minute break.',
  ': Pilot feuert Raketen (G, Controller R, Touch: linken Stick kurz antippen oder RAKETE), der Waffensystemoffizier die 30-mm-Kanone. Mit dem Apache gibt es Luftnahunterstützungs-Aufträge.': ': the pilot fires rockets (G, controller R, touch: briefly tap the left stick or ROCKET), the gunner (CPG) the 30 mm cannon. The Apache gets close air support missions.',
  'EOTech-Rotpunktvisier': 'EOTech red dot sight',
  'auf M4 und M249: Vergrößerer 3x mit B (Controller: rechten Stick drücken, Touch 3x) auf- und wegklappen.': 'on M4 and M249: flip the 3x magnifier in and out with B (controller: press right stick, touch 3x).',
  'Karte und Hubschrauber': 'Map and helicopter',
  'wählen Sie im Hauptmenü: Vietnam 1968 mit der UH-1D oder Afghanistan 2010 mit UH-60 Black Hawk, CH-47 Chinook oder CH-53GS. In Afghanistan wirbeln die Rotoren beim Landen viel Staub auf (Brownout) und Böen schütteln den Hubschrauber.': 'are chosen in the main menu: Vietnam 1968 with the UH-1D or Afghanistan 2010 with UH-60 Black Hawk, CH-47 Chinook or CH-53GS. In Afghanistan the rotors kick up a lot of dust when landing (brownout) and gusts shake the helicopter.',
  'Grafikqualität': 'Graphics quality', 'Niedrig (Handy)': 'Low (phone)', 'Mittel': 'Medium', 'Hoch': 'High',
  'Wird nach dem Neuladen aktiv.': 'Takes effect after reloading.', 'JETZT NEU LADEN': 'RELOAD NOW',
  'Ansicht zu Fuß': 'View on foot', 'Schulterkamera (3. Person)': 'Shoulder camera (3rd person)', 'Ego-Perspektive (Kimme und Korn)': 'First person (iron sights)',
  'Zielhilfe (Controller/Touch)': 'Aim assist (controller/touch)', 'Aus': 'Off', 'Leicht': 'Easy', 'Stark': 'Strong',
  'Lautstärke': 'Volume', 'Ziel-Empfindlichkeit': 'Aim sensitivity', 'Zielen: Y-Achse invertieren': 'Aim: invert Y axis',
  'Zielen: X-Achse invertieren': 'Aim: invert X axis', 'Pilot: Maussteuerung (Maus = Steuerknüppel: ←→ rollen, ↑↓ vor/zurück)': 'Pilot: mouse flying (mouse = cyclic stick: ←→ roll, ↑↓ forward/back)',
  'Maussteuerung: vor/zurück umkehren': 'Mouse flying: invert forward/back', 'Feindstärke': 'Enemy strength', 'Normal': 'Normal', 'Schwer': 'Hard',
  'FPS anzeigen': 'Show FPS',
  'BOOTSTRUPP – HELOCAST': 'BOAT TEAM – HELOCAST', 'Bootstrupp mit Schlauchboot im Fluss absetzen (Helocast)': 'Drop a boat team with an inflatable boat into the river (helocast)',
  'Über dem Wasser schweben: unter 4 m Höhe, fast im Stillstand – das Team springt mit dem Boot ab. Nicht wassern!': 'Hover over the water: below 4 m, almost stationary – the team jumps out with the boat. Do not touch down on the water!',
  'Feind am Ufer möglich!': 'Enemy possible on the bank!', 'Ufer vermutlich frei': 'Bank probably clear', 'Schwierige LZ': 'Difficult LZ',
  'Crew: Boot raus – Team springt!': 'Crew: boat out – team is jumping!', 'Tiefer – unter 4 m über dem Wasser schweben': 'Lower – hover below 4 m above the water',
  'Langsamer – fast stillstehen': 'Slower – almost stationary', 'Position halten – Team springt ab …': 'Hold position – team is jumping …',
  'Hochwasser 2021': 'Flood 2021', 'HOCHWASSER 2021': 'FLOOD 2021', 'HOCHWASSER · KATASTROPHENHILFE': 'FLOOD · DISASTER RELIEF', 'Einsatzbasis Hohenfeld': 'Hohenfeld operating base',
  'Lindental': 'Linden Valley', 'Sikorsky CH-53GS (Rettungswinde)': 'Sikorsky CH-53GS (rescue hoist)', 'WINDENRETTUNG': 'HOIST RESCUE', 'LAGEERKUNDUNG': 'DAMAGE ASSESSMENT',
  'Rettung mit der Winde von einem Hausdach': 'Hoist rescue from a rooftop', 'Personen': 'people', 'Person': 'person', 'eine Person': 'one person', 'Alle Personen': 'Everyone',
  'Über dem Dach schweben (3–30 m über dem First, fast im Stillstand) – die Winde sitzt rechts an der Tür, die Personen werden einzeln hochgezogen': 'Hover above the roof (3–30 m above the ridge, almost stationary) – the hoist is on the right at the door, people are lifted one at a time',
  'Auf Hochspannungsleitungen und Kirchtürme achten!': 'Watch out for power lines and church towers!', 'Windenbediener: Winde läuft – Retter geht runter!': 'Hoist operator: hoist running – rescuer going down!',
  'Dieser Hubschrauber hat keine Winde': 'This helicopter has no hoist', 'Näher ans Dach – die Winde ist rechts an der Tür': 'Closer to the roof – the hoist is on the right at the door',
  'Höher – mindestens 3 m über dem First': 'Higher – at least 3 m above the ridge', 'Tiefer – höchstens 30 m über dem Dach': 'Lower – at most 30 m above the roof', 'Windenrettung': 'Hoist rescue',
  'Versorgungsflug (Trinkwasser, Sandsäcke, Medikamente)': 'Supply flight (drinking water, sandbags, medicine)', 'Lageerkundung – drei Orte überfliegen und Schäden melden': 'Damage assessment – overfly three places and report damage',
  'Schadenslage unklar': 'Damage situation unclear', 'Landeplatz trocken und frei': 'Landing site dry and clear', 'Landeplätze trocken und frei': 'Landing sites dry and clear',
  'Im Katastropheneinsatz bleibt die Besatzung an Bord.': 'In disaster relief the crew stays on board.', 'STROMLEITUNG – ABSTAND HALTEN!': 'POWER LINE – KEEP CLEAR!',
  'In die Hochspannungsleitung geflogen!': 'Flew into a power line!', 'Mit einem Gebäude kollidiert!': 'Collided with a building!', 'In die Bäume gestürzt!': 'Crashed into the trees!',
  'THW-Ortsverband Lindenau': 'THW Lindenau local unit', 'DRK-Bereitschaft Mühlbach': 'Mühlbach Red Cross unit', 'Rettungsleitstelle Lindental': 'Linden Valley emergency dispatch',
  'Polizei Lindental': 'Linden Valley police', 'Wasserwacht Steinbach': 'Steinbach water rescue', 'Ortsbürgermeister Rosenau': 'Mayor of Rosenau',
  'DLRG-Strömungsretter Altenbrück': 'DLRG swiftwater rescuers Altenbrück', 'Wasserwacht-Bootstrupp 3': 'Water rescue boat team 3', 'THW-Fachgruppe Wassergefahren': 'THW water hazards team',
  'Feuerwehr-Bootstrupp Lindenau': 'Lindenau fire brigade boat team', 'die Ministerpräsidentin': 'the state premier', 'Lageerkundung': 'situation assessment', 'der Landrat': 'the district administrator',
  'Krisenstabssitzung': 'crisis team meeting', 'ein Baufachberater des THW': 'a THW structural engineer', 'Begutachtung der Brücken': 'bridge inspection',
  'Hochwasser 2021': 'Flood 2021', '(Katastrophenhilfe, ohne Feinde): mit CH-53GS oder H145M LUH SAR Menschen von Hausdächern retten – über dem Dach schweben (3–30 m über dem First, fast im Stillstand), die Winde rechts an der Tür zieht sie einzeln hoch. Dazu Bootstrupps absetzen, Versorgungsflüge und Lageerkundung. Achtung: Hochspannungsleitungen quer über dem Tal, Kirchtürme, Dauerregen und Böen.': '(disaster relief, no enemies): rescue people from rooftops with the CH-53GS or H145M LUH SAR – hover above the roof (3–30 m above the ridge, almost stationary) and the hoist at the right door lifts them up one at a time. Also boat team drops, supply flights and damage assessment. Watch out: power lines across the valley, church towers, constant rain and gusts.',
  'Pilot: Steuerung durch Neigen des Handys (Gyro)': 'Pilot: control by tilting the phone (gyro)', 'Gyro-Empfindlichkeit': 'Gyro sensitivity',
  'Gyro: vor/zurück umkehren': 'Gyro: invert forward/back', 'GYRO NEU AUSRICHTEN (aktuelle Haltung = neutral)': 'RECENTER GYRO (current position = neutral)', 'GYRO 0': 'GYRO 0', 'Gyro (Einstellungen)': 'Gyro (settings)', 'Handy neigen = zyklisch steuern, GYRO 0 richtet neu aus – die Sticks funktionieren weiterhin': 'Tilt the phone = cyclic, GYRO 0 recenters – the sticks keep working',
  'Gyro neu ausgerichtet – aktuelle Haltung ist neutral.': 'Gyro recentered – current position is neutral.',
  'Mali 2017': 'Mali 2017', 'MALI 2017': 'MALI 2017', 'MALI 2017 · MINUSMA': 'MALI 2017 · MINUSMA', 'NH90 TTH (Sanitätshubschrauber)': 'NH90 TTH (medevac)', 'Eurocopter Tiger': 'Eurocopter Tiger',
  'Waffensystemoffizier': 'Gunner (CPG)', 'Dschihadisten': 'jihadists', 'Dornbuschsavanne': 'the thorn bush savanna', 'Akazien': 'acacias', 'In die Akazien gestürzt!': 'Crashed into the acacias!',
  'KSK-Kommandotrupp 3': 'KSK commando team 3', 'Kampfschwimmer-Zug 1': 'Combat swimmer platoon 1', 'Fernspäher-Trupp Gao': 'Gao long-range recon team', 'Spezialpioniere Bootstrupp': 'Special engineers boat team',
  'der Kommandeur der MINUSMA-Truppen': 'the MINUSMA force commander', 'der Gouverneur von Gao': 'the governor of Gao', 'Sicherheitskonferenz': 'security conference', 'die Verteidigungsministerin': 'the defence minister', 'Truppenbesuch': 'troop visit',
  'Aufklärungskompanie Gao': 'Gao reconnaissance company', 'Gefechtsverband Mali, 2. Zug': 'Task force Mali, 2nd platoon', 'MINUSMA Niederlande, Patrouille 3': 'MINUSMA Netherlands, patrol 3', 'Feldjäger Gao': 'Gao military police',
  'MINUSMA Bangladesch, Kompanie B': 'MINUSMA Bangladesh, B company', 'Objektschutz Camp Castor': 'Camp Castor force protection', 'Pioniere Gao, Bautrupp 2': 'Gao engineers, team 2', 'Sanitätszug Gao': 'Gao medical platoon',
  'KONVOI-BEGLEITSCHUTZ': 'CONVOY ESCORT', 'Begleitschutz aus der Luft für einen Versorgungskonvoi': 'Air escort for a supply convoy', 'Konvoi': 'Convoy', 'Strecke': 'Route',
  'Hinterhalte entlang der Route gemeldet': 'Ambushes reported along the route', 'Über dem Konvoi bleiben, vorausfliegen, Hinterhalte niederkämpfen – unter Beschuss hält der Konvoi an': 'Stay over the convoy, scout ahead, destroy ambushes – the convoy stops under fire',
  'Zum Konvoi fliegen – er fährt los, sobald Sie über ihm sind': 'Fly to the convoy – it moves out once you are overhead', 'Konvoi wartet – Luftsicherung fehlt, zurück zum Konvoi!': 'Convoy waiting – no air cover, get back to the convoy!',
  'Begleitschutz': 'Escort', 'TOC: Der Konvoi ist vernichtet. Der Auftrag ist gescheitert.': 'TOC: The convoy has been destroyed. The mission has failed.', 'Konvoi: Fahrzeug getroffen und ausgefallen!': 'Convoy: vehicle hit and disabled!',
  'SANDSTURM – SICHT EINGESCHRÄNKT': 'SANDSTORM – LIMITED VISIBILITY', 'TOC: Sandsturm zieht auf – Sicht bald unter 200 m, Böen! Tief und langsam fliegen oder landen.': 'TOC: Sandstorm approaching – visibility soon below 200 m, gusts! Fly low and slow or land.',
  'TOC: Der Sandsturm ist durchgezogen, die Sicht wird besser.': 'TOC: The sandstorm has passed, visibility is improving.',
  'Tafelberg – Landung an der Abbruchkante, Fallwinde': 'mesa – landing at the cliff edge, downdrafts',
  '(Camp Castor, Gao): Sahel mit roter Erde, Tafelbergen und dem breiten Niger mit Inseln. Hubschrauber NH90 (Sanitätsversion mit MG3), Tiger (Pilot: Raketen, Waffensystemoffizier: 30-mm-Kanone), CH-47 und CH-53. Neu: Konvoi-Begleitschutz – über dem Konvoi bleiben, Hinterhalte niederkämpfen, unter Beschuss hält er an. Etwa alle 10 Minuten zieht ein Sandsturm durch: Sicht unter 200 m und starke Böen.': '(Camp Castor, Gao): Sahel with red earth, mesas and the wide Niger with islands. Helicopters NH90 (medevac version with MG3), Tiger (pilot: rockets, gunner: 30 mm cannon), CH-47 and CH-53. New: convoy escort – stay over the convoy and destroy ambushes, it halts under fire. About every 10 minutes a sandstorm passes through: visibility below 200 m and strong gusts.',
  'Norwegen – Arktis-Übung': 'Norway – Arctic exercise', 'NORWEGEN – ARKTIS-ÜBUNG': 'NORWAY – ARCTIC EXERCISE', 'NORWEGEN · ARKTIS-ÜBUNG': 'NORWAY · ARCTIC EXERCISE', 'Nordnorwegen': 'Northern Norway',
  'Flugplatz Bardufoss': 'Bardufoss air station', 'NH90 Sea Lion (Marineflieger)': 'NH90 Sea Lion (naval aviation)', 'Übungsgegner': 'exercise opponents', 'Fichten': 'spruces', 'In die Fichten gestürzt!': 'Crashed into the spruces!',
  'KSK-Kommandotrupp Arktis': 'KSK arctic commando team', 'Kampfschwimmer Eckernförde': 'Eckernförde combat swimmers', 'Norwegisches FSK-Team': 'Norwegian FSK team', 'Seebataillon Boardingteam': 'Sea battalion boarding team',
  'der Inspekteur des Heeres': 'the Chief of the Army', 'Übungsbeobachtung': 'exercise observation', 'der norwegische Verteidigungschef': 'the Norwegian chief of defence', 'ein Schiedsrichter der Übung': 'an exercise umpire', 'Auswertung': 'debriefing',
  'Gebirgsjägerbataillon 233, 2. Kompanie': 'Mountain infantry battalion 233, 2nd company', 'Brigade Nord, Telemark-Bataillon': 'Brigade North, Telemark battalion', 'Niederländische Marines, 21 Raiding Squadron': 'Dutch Marines, 21 Raiding Squadron',
  'Seebataillon, Bordeinsatzkompanie': 'Sea battalion, boarding company', 'Sanitätsregiment 3': 'Medical regiment 3', 'Gebirgspioniere 8': 'Mountain engineers 8',
  'MEDEVAC VON SEE': 'MEDEVAC FROM SEA', 'VERLEGUNG AUF DIE FREGATTE': 'TRANSFER TO THE FRIGATE', 'Verletzte von der Fregatte zum Sanitätsbereich fliegen': 'Fly casualties from the frigate to the medical area',
  'Truppen von der Basis auf die Fregatte verlegen': 'Move troops from the base to the frigate', 'Landeplatz': 'Landing site', 'Flugdeck': 'Flight deck',
  'Schiffsdeck – das Deck hebt und senkt sich, im ruhigen Moment aufsetzen': 'ship deck – the deck rises and falls, touch down in a calm moment',
  'TOC: Die Sonne ist untergegangen – Nachtflugbetrieb. Nachtsichtgerät mit N.': 'TOC: The sun has set – night flying operations. Night vision with N.', 'TOC: Es wird hell – Tagflugbetrieb.': 'TOC: Daylight is coming – day flying operations.',
  '(Flugplatz Bardufoss, ohne Gegner): Fjorde, verschneite Gipfel, Steilküsten und Schären. Hubschrauber CH-53GS, NH90 Sea Lion und H145M. Neu: Landungen auf dem Flugdeck der Fregatte „Sachsen“, das sich mit dem Seegang hebt und senkt; Whiteout beim Landen im Schnee; kurze Tage – etwa alle 15 Minuten wird es Abend und für ein paar Minuten Nacht (Nachtsichtgerät mit N).': '(Bardufoss air station, no opponents): fjords, snowy peaks, steep coasts and skerries. Helicopters CH-53GS, NH90 Sea Lion and H145M. New: landings on the flight deck of the frigate “Sachsen”, which rises and falls with the swell; whiteout when landing in snow; short days – about every 15 minutes evening falls and it is night for a few minutes (night vision with N).',
  'Tafelberg Hombori': 'Hombori mesa', 'Tafelberg Tin-Tarhat': 'Tin-Tarhat mesa', 'HLZ Geröllhang': 'HLZ Scree Slope', 'HLZ Felsband': 'HLZ Rock Ledge', 'HLZ Plateauflanke': 'HLZ Plateau Flank',
  'VR-Brille: 3D-Bild nebeneinander erzwingen (Side-by-Side, z. B. bei gespiegeltem Bild)': 'VR glasses: force side-by-side 3D image (e.g. with a mirrored screen)',
  'VR-Brille: Spiel direkt auf der Brille zeigen (Handy wird Touchfläche; 3D-Bild automatisch, wenn die Brille im 3D-Modus ist)': 'VR glasses: show the game directly on the glasses (phone becomes a touchpad; 3D image automatically when the glasses are in 3D mode)', 'VR-Brille: Umsehen per Kopfbewegung (Head-Tracking)': 'VR glasses: look around with head movement (head tracking)',
  'BLICK NEU AUSRICHTEN (Kopf geradeaus)': 'RECENTER VIEW (head straight ahead)', 'Blick neu ausgerichtet – aktuelle Kopfhaltung ist geradeaus.': 'View recentered – current head position is straight ahead.', 'VR-Brille: Blick neu ausrichten': 'VR glasses: recenter view',
  'VR-Brille (Einstellungen)': 'VR glasses (settings)', '3D-Bild nebeneinander für XR-Brillen im 3D-Modus; mit Head-Tracking umsehen (Pilot) bzw. zielen (Schütze), O richtet den Blick neu aus': 'Side-by-side 3D image for XR glasses in 3D mode; with head tracking look around (pilot) or aim (gunner), O recenters the view',
  'Kopfbewegung: links/rechts umkehren': 'Head movement: invert left/right', 'Kopfbewegung: hoch/runter umkehren': 'Head movement: invert up/down', 'XR-Brille erkannt – Umsehen per Kopfbewegung in den Einstellungen einschalten.': 'XR glasses detected – enable looking around with head movement in the settings.',
  'Eigene Belegung': 'Custom bindings', 'Einstellungen → Tastenbelegung: alle Tasten und Maustasten frei belegbar': 'Settings → key bindings: every key and mouse button can be remapped',
  'TASTENBELEGUNG (TASTATUR / MAUS)': 'KEY BINDINGS (KEYBOARD / MOUSE)', 'TASTENBELEGUNG': 'KEY BINDINGS', 'STANDARD WIEDERHERSTELLEN': 'RESTORE DEFAULTS',
  'Feld anklicken, dann die neue Taste oder Maustaste drücken. Entf / ⌫ löscht die Belegung, Esc bricht ab.': 'Click a field, then press the new key or mouse button. Del / ⌫ clears the binding, Esc cancels.',
  'Taste drücken …': 'Press a key …', 'Fliegen': 'Flying', 'Allgemein': 'General',
  'Nase senken / vorwärts': 'Nose down / forward', 'Nase heben / rückwärts': 'Nose up / backward', 'Nach links neigen': 'Bank left', 'Nach rechts neigen': 'Bank right',
  'Pedal links (drehen)': 'Left pedal (turn)', 'Pedal rechts (drehen)': 'Right pedal (turn)', 'Kollektiv: sinken': 'Collective: descend', 'Raketen (Apache)': 'Rockets (Apache)',
  'Kamera näher': 'Camera closer', 'Kamera weiter weg': 'Camera farther', 'Feuern (Schütze)': 'Fire (gunner)', 'Zoom (Schütze)': 'Zoom (gunner)',
  'Vorwärts': 'Forward', 'Rückwärts': 'Backward', 'Links': 'Left', 'Rechts': 'Right', 'Sprinten': 'Sprint', 'Springen': 'Jump', 'Feuern': 'Fire',
  'Zielen / Zoom': 'Aim / zoom', 'Nachladen': 'Reload', 'Ducken': 'Crouch', 'Ego-Perspektive / Schulterkamera': 'First person / shoulder camera',
  '3x-Vergrößerer': '3x magnifier', 'Ein-/Aussteigen, aufnehmen': 'Board/exit, pick up', 'Hubschrauber rufen': 'Call helicopter', 'Nächste Waffe': 'Next weapon', 'Vorige Waffe': 'Previous weapon',
  'Sitz Pilot / Waffe 1': 'Pilot seat / weapon 1', 'Sitz linker Schütze / Waffe 2': 'Left gunner seat / weapon 2', 'Sitz rechter Schütze / Waffe 3': 'Right gunner seat / weapon 3',
  'Sitz Heckschütze / Waffe 4': 'Ramp gunner seat / weapon 4', 'Waffe 5': 'Weapon 5', 'Nächster Sitz': 'Next seat', 'Auftrag anzeigen': 'Show mission', 'Besatzung': 'Crew',
  'Nachtsichtgerät': 'Night vision', 'Bestätigen': 'Confirm', 'Pause (Esc immer)': 'Pause (Esc always)', 'Steuerung': 'Controls',
  'Leertaste': 'Space', 'Shift links': 'Left Shift', 'Shift rechts': 'Right Shift', 'Strg links': 'Left Ctrl', 'Strg rechts': 'Right Ctrl', 'Alt links': 'Left Alt',
  'Feststell': 'Caps Lock', 'Bild ↑': 'Page ↑', 'Bild ↓': 'Page ↓', 'Linke Maustaste': 'Left mouse button', 'Mittlere Maustaste': 'Middle mouse button',
  'Rechte Maustaste': 'Right mouse button', 'Maus zurück': 'Mouse back', 'Maus vor': 'Mouse forward',
  'Außenansicht: Abstand zum Hubschrauber': 'Outside view: distance to the helicopter', '+ / − · Mausrad': '+ / − · mouse wheel', 'R3 (Pilot)': 'R3 (pilot)',

  // ------------------------------------------------------------ HUD
  'Der Auftrag ist gescheitert.': 'The mission has failed.', 'NEUER HUBSCHRAUBER': 'NEW HELICOPTER', 'ABGESTÜRZT': 'CRASHED', 'GEFALLEN': 'KILLED IN ACTION',
  'TRIEBWERK AUS': 'ENGINE OFF', 'KABINE': 'CABIN', 'RAKETEN': 'ROCKETS', 'GESUNDHEIT': 'HEALTH', '3x AN': '3x ON', '· 3x aus': '· 3x off',
  'LÄDT …': 'RELOADING …', 'GEDUCKT': 'CROUCHED', 'STEHEND': 'STANDING', '· ZIELEN': '· AIMING', 'PILOT': 'PILOT',
  'SCHÜTZE LINKS': 'LEFT GUNNER', 'SCHÜTZE RECHTS': 'RIGHT GUNNER', 'HECKSCHÜTZE': 'RAMP GUNNER', 'PASSAGIER': 'PASSENGER', 'INFANTERIE': 'INFANTRY',
  '· KI-Pilot fliegt': '· AI pilot flying', '· Pilot:': '· Pilot:', 'ZIEL': 'TARGET', 'Sie': 'You', 'Pilot': 'Pilot',
  'Schütze links': 'Left gunner', 'Schütze rechts': 'Right gunner', 'Heckschütze': 'Ramp gunner', 'abgestürzt': 'crashed', 'in der Luft': 'airborne',
  'frei (KI-Pilot)': 'free (AI pilot)', 'frei (KI-Schütze)': 'free (AI gunner)', 'Kabine': 'Cabin', 'Passagier': 'Passenger', 'Aussteigen': 'Exit',
  'zu Fuß (nur am Boden)': 'on foot (only on the ground)', 'Luftunterstützung': 'Air support',
  'wirkt auf Feinde im Umkreis von ca. 700 m um Ihre Position · Taste L': 'hits enemies within about 700 m of your position · key L',
  'im Einsatz': 'on mission',
  'Sie sind zu Fuß unterwegs. Einsteigen: an einen gelandeten Hubschrauber herangehen und E / Ⓐ drücken oder hier einen Platz wählen.': 'You are on foot. To board: walk up to a landed helicopter and press E / Ⓐ, or pick a seat here.',
  'Umsteigen in den anderen Hubschrauber: beide Maschinen nebeneinander landen (unter 150 m).': 'To switch to the other helicopter: land both aircraft side by side (within 150 m).',
  'KI-Pilot': 'AI pilot', 'zu Fuß': 'on foot', 'Abholung': 'Pickup', 'Außenansicht': 'Outside view', 'Cockpit': 'Cockpit',

  // ------------------------------------------------------------ Laden / Menü (main.js)
  'Erzeuge Gelände …': 'Generating terrain …', 'Effekte …': 'Effects …', 'Bereite FOB vor …': 'Preparing FOB …',
  'Der KI-Pilot fliegt den Auftrag': 'The AI pilot is flying the mission', 'Der KI-Pilot fliegt den Auftrag.': 'The AI pilot is flying the mission.',
  'das linke': 'the left', 'das rechte': 'the right', 'das': 'the', 'auf der Heckrampe': 'on the rear ramp',
  'Diesen Hubschrauber gibt es nicht.': 'This helicopter does not exist.', 'Aussteigen geht nur am Boden – erst landen.': 'You can only exit on the ground – land first.',
  'Die Kabine ist voll.': 'The cabin is full.', 'Einsteigen geht nur, wenn der Hubschrauber gelandet ist.': 'You can only board once the helicopter has landed.',
  'Zum Einsteigen näher an den Hubschrauber gehen.': 'Move closer to the helicopter to board.',
  'Umsteigen geht nur, wenn der andere Hubschrauber gelandet ist.': 'You can only switch once the other helicopter has landed.',
  'Erst landen – dann können Sie umsteigen.': 'Land first – then you can switch.',
  'Zum Umsteigen müssen beide Hubschrauber nebeneinander landen (unter 150 m).': 'To switch, both helicopters must land side by side (within 150 m).',
  'Sie tragen schon die volle Anzahl Panzerfäuste.': 'You are already carrying the maximum number of launchers.',
  'Raketen leer – auf Pad POL nachladen.': 'Rockets empty – reload on pad POL.', 'Nachtsichtgerät gibt es nur bei Nacht.': 'Night vision is only available at night.',
  'Nachtsichtgerät an': 'Night vision on', 'Nachtsichtgerät aus': 'Night vision off', 'Ihr Mitspieler': 'Your teammate',
  'Sanitäter! Sie sind gefallen.': 'Medic! You have been killed.', 'Neuer Einsatz zu Fuß – Sie stehen in der FOB bei Pad H1.': 'New deployment on foot – you are at the FOB next to pad H1.',
  'Webversion (lokal)': 'Web version (local)', 'MEDEVAC': 'MEDEVAC', 'NACHT': 'NIGHT', 'TAG': 'DAY',
  'MEHRSPIELER BEENDEN': 'END MULTIPLAYER', 'MEHRSPIELER VERLASSEN': 'LEAVE MULTIPLAYER',
  'Mehrspieler-Spiel beenden? Alle Mitspieler werden getrennt.': 'End the multiplayer game? All players will be disconnected.',
  'Mehrspieler-Spiel verlassen?': 'Leave the multiplayer game?', 'Laufendes Spiel beenden?': 'Quit the current game?',
  '2 Hubschrauber': '2 helicopters', '· Karte wird gewechselt': '· map will change', 'Suche nach Spielen im Netzwerk …': 'Searching for games on the network …',
  'Wir werden beschossen!': 'We are taking fire!', 'Treffer im Heck!': 'Hit in the tail!', 'Feuer von unten!': 'Fire from below!',
  'Die schießen auf uns!': "They're shooting at us!", 'Hab ihn!': 'Got him!', 'Einer weniger!': 'One less!', 'Ziel ausgeschaltet!': 'Target down!',
  'Treffer – der ist erledigt!': "Hit – he's done!", 'Schütze': 'Gunner', 'Crew': 'Crew', 'TOC': 'TOC', 'Funk': 'Radio', 'Waffe': 'Weapon',
  '3x-Vergrößerer aufgeklappt': '3x magnifier flipped up', '3x-Vergrößerer weggeklappt': '3x magnifier flipped away', 'Gefallen': 'Killed in action',
  'Sie wurden im Gefecht getroffen.': 'You were hit in combat.', 'ZURÜCK IN DIE FOB': 'BACK TO THE FOB', 'Triebwerk wieder gestartet.': 'Engine restarted.',
  'Betankt, repariert und aufmunitioniert – startklar!': 'Refueled, repaired and rearmed – ready to go!',
  'Tankwart: Schlauch ist dran – wir füllen auf!': "Fuel crew: hose is connected – filling up!",
  'SCHWER VERWUNDET – IN DECKUNG!': 'BADLY WOUNDED – TAKE COVER!', 'TREFFER!': 'HIT!',
  'Hubschrauber noch in der Luft – warten bis er gelandet ist': 'Helicopter still airborne – wait until it has landed',
  'Nachladen …': 'Reloading …', 'Keine Munition – in der FOB auffüllen oder Waffe wechseln': 'No ammo – resupply at the FOB or switch weapons',
  'TRIEBWERK AUS – AUTOROTATION': 'ENGINE OFF – AUTOROTATE', 'TREIBSTOFF KRITISCH': 'FUEL CRITICAL', 'TREIBSTOFF NIEDRIG – TANKEN': 'FUEL LOW – REFUEL',
  'BINGO FUEL – SOFORT ZUR FOB': 'BINGO FUEL – RETURN TO FOB NOW', 'TANKLECK': 'FUEL LEAK', 'STRUKTUR KRITISCH': 'AIRFRAME CRITICAL',
  'ROTOR IN DEN BÄUMEN – STEIGEN!': 'ROTOR IN THE TREES – CLIMB!', 'TREFFER – BESCHUSS!': 'HIT – TAKING FIRE!', 'SINKRATE – ZIEHEN!': 'SINK RATE – PULL UP!',
  'EINSATZGEBIET VERLASSEN – UMKEHREN': 'LEAVING AREA OF OPERATIONS – TURN BACK',
  'Zum Tanken auf Pad POL (gelber Rand, neben dem Tankwagen) landen': 'Land on pad POL (yellow border, next to the fuel truck) to refuel',
  'Kabine voll!': 'Cabin full!', 'Raketen: R · Kanone: KI-Waffensystemoffizier': 'Rockets: R · cannon: AI gunner (CPG)',
  'Raketen: linken Stick kurz antippen (oder RAKETE)': 'Rockets: briefly tap the left stick (or ROCKET)', 'Raketen: G · Kanone schießt der Waffensystemoffizier': 'Rockets: G · the gunner (CPG) fires the cannon',
  'Linksklick ins Bild: Maussteuerung (Maus = Steuerknüppel: ←→ rollen, ↑↓ vor/zurück)': 'Left click into the view: mouse flying (mouse = cyclic stick: ←→ roll, ↑↓ forward/back)',
  'FOB WIRD ANGEGRIFFEN': 'FOB UNDER ATTACK', 'Autsch! Das war eine harte Landung!': 'Ouch! That was a hard landing!',
  'TRIEBWERK AUS! Treibstoff leer – Autorotation einleiten!': 'ENGINE OUT! Out of fuel – enter autorotation!',
  'Wir verlieren Treibstoff – Tank getroffen!': "We're losing fuel – tank hit!", 'Gelände zu steil – wir rutschen!': "Ground too steep – we're sliding!",
  'Wir stehen im Wasser!': "We're standing in the water!",
  'Abgeschossen!': 'Shot down!', 'Hubschrauber zerstört!': 'Helicopter destroyed!', 'Notwasserung im Fluss!': 'Ditched in the river!',
  'Absturz – zu harte Landung!': 'Crash – landing too hard!', 'Abgestürzt!': 'Crashed!', 'In den Dschungel gestürzt!': 'Crashed into the jungle!',
  'In die Pappeln gestürzt!': 'Crashed into the poplars!', 'Linker Schütze': 'Left gunner', 'Rechter Schütze': 'Right gunner', 'Boeing CH-47F „Chinook“ (Luftwaffe)': 'Boeing CH-47F “Chinook” (German Air Force)',
  'Verbunden – warte auf den Host …': 'Connected – waiting for the host …', 'Verbindung fehlgeschlagen.': 'Connection failed.',

  // ------------------------------------------------------------ Luftunterstützung
  'kreist 75 s über Ihrer Position, Kanone und Raketen': 'orbits your position for 75 s, cannon and rockets',
  'lasergelenkte 250-kg-Bombe (GBU-12)': 'laser-guided 500 lb bomb (GBU-12)', 'zwei Tiefflug-Angriffe mit der 30-mm-Kanone': 'two low-level gun runs with the 30 mm cannon',
  'Napalm-Abwurf entlang der Feindstellung': 'napalm drop along the enemy position', 'DANGER CLOSE – in Deckung gehen!': 'DANGER CLOSE – take cover!',
  'übernehme Ihren Sektor': 'taking over your sector', 'Kanonenangriff': 'gun run', 'Napalm': 'napalm', 'eine GBU-12': 'one GBU-12',

  // ------------------------------------------------------------ Aufträge
  'grün': 'green', 'gelb': 'yellow', 'rot': 'red', 'violett': 'violet',
  'Gelber': 'Yellow', 'Roter': 'Red', 'Grüner': 'Green', 'Violetter': 'Violet',
  'TRUPPENTRANSPORT': 'TROOP TRANSPORT', 'Verstärkung': 'reinforcements', 'Ablösung': 'relief', 'Umgruppierung': 'regrouping',
  'SPEZIALKRÄFTE – INFILTRATION': 'SPECIAL FORCES – INFILTRATION', 'SPEZIALKRÄFTE – EXFILTRATION': 'SPECIAL FORCES – EXFILTRATION',
  'NACHSCHUB': 'RESUPPLY', 'VIP-TRANSPORT': 'VIP TRANSPORT', 'AUFKLÄRUNG': 'RECONNAISSANCE', 'LUFTNAHUNTERSTÜTZUNG': 'CLOSE AIR SUPPORT',
  'HEISS – Feindkontakt!': 'HOT – enemy contact!', 'KALT – keine Feindberührung': 'COLD – no enemy contact', 'Auftrag': 'Task',
  'Verwundetenbergung (Dustoff)': 'Casualty evacuation (Dustoff)', 'Aufnahme': 'Pickup', 'Richtung / Entfernung': 'Bearing / distance',
  'Verwundete': 'Casualties', 'LZ-Status': 'LZ status', 'Markierung': 'Marking', 'Ablieferung': 'Drop-off',
  'einen Verwundeten': 'one casualty', 'Tragefall': 'litter case', 'Tragefälle': 'litter cases', '(Tragefall)': '(litter case)',
  'Wir stehen unter Beschuss!': 'We are under fire!', 'Die Lage ist ruhig.': 'The situation is quiet.',
  'Punkt A – Aufnahme': 'Point A – pickup', 'Punkt B – Absetzen': 'Point B – drop-off', 'Soldaten': 'Soldiers', 'Punkt A': 'point A', 'Punkt B': 'point B',
  'KALT – beide LZs ruhig': 'COLD – both LZs quiet', 'Rechnen Sie mit Feindfeuer!': 'Expect enemy fire!',
  'Spezialkräfte verdeckt absetzen': 'Covert special forces insertion', 'Spezialkräfte herausholen': 'Special forces extraction', 'Team': 'Team',
  'Absetzpunkt': 'Insertion point', 'Aufnahmepunkt': 'Extraction point', 'Lage': 'Situation',
  'Feind am Absetzpunkt möglich!': 'Enemy possible at the insertion point!', 'Feind in der Gegend – tief und unauffällig anfliegen': 'Enemy in the area – approach low and quiet',
  'Team entdeckt – Feind verfolgt es!': 'Team compromised – enemy in pursuit!', 'Team wartet versteckt': 'Team waiting in hiding',
  'keine – das Team zeigt sich erst bei der Landung': 'none – the team only shows itself when you land',
  'Wir sind aufgeflogen und werden verfolgt!': "We've been compromised and are being pursued!", 'Auftrag erfüllt.': 'Mission complete.',
  'Nachschubflug (Munition, Wasser, Verpflegung)': 'Resupply flight (ammo, water, rations)', 'Ladung': 'Cargo', 'Ziel': 'Destination',
  'HEISS – Außenposten unter Feuer!': 'HOT – outpost under fire!', 'KALT': 'COLD', 'HEISS': 'HOT', 'Wir liegen unter Feuer!': "We're under fire!",
  'Personentransport (VIP)': 'Passenger transport (VIP)', 'Fluggast': 'Passenger', 'Hinweis': 'Note',
  'Ruhig fliegen und sanft landen – Bonus ohne Schaden': 'Fly smoothly and land gently – bonus without damage',
  'Bewaffnete Aufklärung – drei Punkte überfliegen': 'Armed reconnaissance – overfly three points', 'Vorgabe': 'Requirement',
  'Jeden Punkt unter 180 m über Grund in max. 180 m Abstand überfliegen': 'Overfly each point below 180 m AGL within 180 m',
  'Feindbewegungen gemeldet': 'Enemy movement reported', 'Luftnahunterstützung – Truppe im Gefecht (TIC)': 'Close air support – troops in contact (TIC)',
  'Einsatzort': 'Location', 'Eigene Truppe': 'Friendly forces', 'Feind im Umkreis von 500 m niederkämpfen': 'Destroy the enemy within 500 m',
  'Bergung abgeschossener Besatzung': 'Rescue of a downed crew', 'Maschine': 'Aircraft', 'Absturzort (ca.)': 'Crash site (approx.)', 'Besatzung': 'Crew',
  'HEISS – Feind in der Nähe!': 'HOT – enemy nearby!', 'KALT – unklar, Vorsicht': 'COLD – unclear, be careful',
  'Pilot ist': 'The pilot is', 'Besatzung ist': 'The crew is',
  'Alle Verwundeten': 'All casualties', 'Alle Überlebenden': 'All survivors', 'Alle Soldaten': 'All soldiers',
  'Crew: Kabine voll! Der Rest muss mit dem zweiten Hubschrauber mit.': 'Crew: cabin full! The rest has to go with the second helicopter.',
  'Suchgebiet': 'Search area', 'keine Feindbewegung.': 'no enemy movement.',
  'Sanitäter: Wir übernehmen! Bringt sie ins Lazarett!': 'Medic: we take over! Get them to the hospital!', 'Crew: Absetzen – alle raus!': 'Crew: drop-off – everybody out!',
  'Sanitäter': 'Medic', 'Lazarett': 'Hospital', 'Besatzungsmitglieder': 'crew members', 'AUFTRAG ERFÜLLT': 'MISSION COMPLETE', 'Heiße LZ': 'Hot LZ',
  'Zeitbonus': 'Time bonus', 'Ohne Schaden': 'No damage', 'Schaden genommen': 'Damage taken', 'Gesamt': 'Total',
  'TOC: Der Auftrag ist gescheitert. Neuer Auftrag folgt.': 'TOC: The mission has failed. A new mission will follow.',
  'Warte auf neuen Auftrag…': 'Waiting for a new mission…', 'Neuer Auftrag – Briefing bestätigen': 'New mission – confirm briefing',
  'Kiste': 'crate', 'Kisten': 'crates', 'Personen': 'persons', 'Spezialkräfte': 'special forces', 'Verwundeter': 'casualty',
  'Überlebender': 'survivor', 'Überlebende': 'survivors', 'Soldat': 'soldier', 'wartet': 'waiting', 'warten': 'waiting',
  'Suchgebiet anfliegen – nach Rauchsäule des Wracks Ausschau halten': 'Fly to the search area – look for the smoke column of the wreck',
  '(rotes Kreuz)': '(red cross)',
  'TOC: Angriff abgewehrt! Gute Arbeit – die FOB ist sicher.': 'TOC: Attack repelled! Good work – the FOB is secure.',
  'FOB VERTEIDIGT': 'FOB DEFENDED', 'Angreifer ausgeschaltet': 'Attackers neutralized', 'TOC: Der Feind zieht sich zurück – letzte Angreifer stellen!': 'TOC: The enemy is retreating – hunt down the last attackers!',

  // ------------------------------------------------------------ Waffen, Ränge, Richtungen
  'Sturmgewehr': 'assault rifle', 'Maschinengewehr': 'machine gun', 'Granatwerfer': 'grenade launcher', 'Schrotflinte': 'shotgun',
  'Pistole': 'pistol', 'Panzerfaust': 'anti-tank launcher', 'leichtes MG': 'light machine gun',
  'Norden': 'north', 'Nordosten': 'northeast', 'Osten': 'east', 'Südosten': 'southeast', 'Süden': 'south', 'Südwesten': 'southwest', 'Westen': 'west', 'Nordwesten': 'northwest',
  'NO': 'NE', 'O': 'E', 'SO': 'SE',

  // ------------------------------------------------------------ Einsatzgebiete / Einheiten
  'Baumlinie': 'the tree line', 'Dschungel': 'jungle', 'Bäume': 'trees', 'Lehmmauern': 'the mud walls', 'Ortschaft': 'village', 'Pappeln': 'poplars',
  'Lagebesprechung': 'briefing', 'Frontbesuch': 'visit to the front', 'Gefechtsstandverlegung': 'command post relocation',
  'ein Kongressabgeordneter': 'a congressman', 'Oberst Moore': 'Colonel Moore', 'der Distriktgouverneur': 'the district governor',
  'Shura mit den Dorfältesten': 'shura with the village elders', 'der Regionalkommandeur': 'the regional commander', 'ein Polizeichef': 'a police chief',
  'Waffensystemoffizier (CPG)': 'Gunner (CPG)', 'Heckschütze (Rampe)': 'Ramp gunner', 'SEAL-Zug Bravo': 'SEAL Platoon Bravo',
  'KSK-Kommandotrupp 2': 'KSK Commando Team 2', 'Ranger-Zug Alpha': 'Ranger Platoon Alpha',
  'Bravo 6, 2/7. Kavallerie': 'Bravo 6, 2/7 Cavalry', 'Charlie 3, 1/5. Kavallerie': 'Charlie 3, 1/5 Cavalry', 'Alpha 2, 2/12. Infanterie': 'Alpha 2, 2/12 Infantry',
  'Delta 6, 1/8. Kavallerie': 'Delta 6, 1/8 Cavalry', 'Tiger 4, Fernspäher-Team': 'Tiger 4, LRRP team', 'Echo 1, 173. Luftlandebrigade': 'Echo 1, 173rd Airborne Brigade',
  'Raider 2, 1/327. Infanterie': 'Raider 2, 1/327 Infantry', 'Mustang 5, 3/21. Infanterie': 'Mustang 5, 3/21 Infantry',
  'Wolf 2-1, 2/508. Fallschirmjäger': 'Wolf 2-1, 2/508 Parachute Infantry', 'Gator 3, 1/6. Marines': 'Gator 3, 1/6 Marines', 'Kilo 1-3, 3/7. Marines': 'Kilo 1-3, 3/7 Marines',
  'Spartan 6, 2/87. Infanterie': 'Spartan 6, 2/87 Infantry', 'Falke 2, Ausbildungs- und Schutzbataillon': 'Falke 2, Training and Protection Battalion',
  'Viking 4, Fernspäher': 'Viking 4, long-range recon', 'Taurus 2, 1/320. Feldartillerie': 'Taurus 2, 1/320 Field Artillery',
  'Bell UH-1D „Huey“': 'Bell UH-1D “Huey”', 'Sikorsky UH-60 „Black Hawk“': 'Sikorsky UH-60 “Black Hawk”', 'Boeing CH-47F „Chinook“': 'Boeing CH-47F “Chinook”',
  'Boeing AH-64E „Apache Guardian“': 'Boeing AH-64E “Apache Guardian”',
};

// Vorlagen mit Platzhaltern
const EN_T = {
  '{0} ist noch nicht wieder verfügbar – in {1} s.': '{0} is not available yet – {1} s left.',
  '{0} ist bereits im Einsatz.': '{0} is already on station.',
  // ------------------------------------------------------------ Autorotation, Wirbelring, Außenlast, Wetter, Karriere, Sprachausgabe
  'Realistische Flugphysik: Wirbelringstadium und Triebwerksausfall bei Treffern': 'Realistic flight physics: vortex ring state and engine failure from hits',
  'Funksprüche vorlesen (Sprachausgabe)': 'Read radio calls aloud (text to speech)',
  'Wetterwechsel (Nebel, Schauer, Gewitter, Schnee)': 'Changing weather (fog, showers, thunderstorms, snow)',
  'MODUS: KARRIERE': 'MODE: CAREER', 'MODUS: FREIES FLIEGEN': 'MODE: FREE FLIGHT',
  'TRIEBWERK AUS – AUTOROTATION · ROTOR {0} %': 'ENGINE OUT – AUTOROTATION · ROTOR {0} %',
  'ROTORDREHZAHL NIEDRIG – KOLLEKTIV RUNTER': 'LOW ROTOR RPM – LOWER COLLECTIVE', 'ROTORDREHZAHL HOCH – KOLLEKTIV ETWAS ZIEHEN': 'HIGH ROTOR RPM – RAISE COLLECTIVE A LITTLE',
  'WIRBELRINGSTADIUM – FAHRT AUFNEHMEN!': 'VORTEX RING STATE – GAIN AIRSPEED!',
  'GEWITTER – STURMBÖEN': 'THUNDERSTORM – STRONG GUSTS', 'SCHNEESCHAUER – SICHT EINGESCHRÄNKT': 'SNOW SHOWERS – LIMITED VISIBILITY', 'NEBEL – SICHT EINGESCHRÄNKT': 'FOG – LIMITED VISIBILITY',
  'TRIEBWERK AUS! Treibstoff leer – Autorotation einleiten! Kollektiv runter, Fahrt halten, kurz vor dem Boden abfangen.': 'ENGINE OUT! Fuel exhausted – enter autorotation! Collective down, keep airspeed, flare just above the ground.',
  'TRIEBWERK GETROFFEN – ES IST AUS! Autorotation: Kollektiv runter, Fahrt halten, kurz vor dem Boden abfangen!': "ENGINE HIT – IT'S OUT! Autorotation: collective down, keep airspeed, flare just above the ground!",
  'Ausbilder: Triebwerksausfall simuliert! Kollektiv runter, Rotordrehzahl halten, auf der Landefläche autorotieren.': 'Instructor: simulated engine failure! Collective down, hold rotor RPM, autorotate onto the training area.',
  'Triebwerk wieder angelassen – Drehzahl kommt, wir können weiter.': 'Engine restarted – RPM coming up, we can continue.',
  'Wirbelringstadium! Wir sacken durch – Nase runter, Fahrt aufnehmen!': "Vortex ring state! We're settling – nose down, gain airspeed!",
  'Ausbilder': 'Instructor', 'Kommandeur': 'Commander', 'Lastenhaken': 'Cargo hook',
  'AUSSENLAST': 'SLING LOAD', 'BERGUNG – AUSSENLAST': 'RECOVERY – SLING LOAD', 'NOTVERFAHREN – AUTOROTATION': 'EMERGENCY PROCEDURE – AUTOROTATION',
  '{0} · Last am Haken': '{0} · load on hook', '{0} · Last aufnehmen': '{0} · pick up load', '{0} · Übung': '{0} · training',
  'Außenlast am Lasthaken: {0}': 'Sling load on the cargo hook: {0}',
  'Netz mit Nachschubkisten': 'net with supply crates', 'Big Bags mit Sandsäcken für den Deich': 'big bags of sandbags for the dike', 'liegengebliebenes Fahrzeug bergen': 'recover a broken-down vehicle',
  'Last aufnehmen': 'Pick up load', 'Absetzen': 'Drop-off', 'Vorgabe': 'Instructions', 'Übungsfläche': 'Training area', 'Ablauf': 'Sequence', 'Verfahren': 'Procedure', 'Bewertung': 'Scoring',
  'Über der Last schweben (5–20 m), Bodenpersonal hängt an – Seil {0} m. Ruhig fliegen (unter 80 kt), Last pendelt. Am Ziel langsam sinken, bis die Last aufsetzt.': 'Hover over the load (5–20 m), the ground crew hooks it up – {0} m line. Fly smoothly (below 80 kt), the load swings. At the destination descend slowly until the load touches down.',
  'Übung: Notlandung ohne Triebwerk (Autorotation)': 'Training: forced landing without engine (autorotation)',
  'Über der Übungsfläche auf mindestens 300 m (1000 ft) über Grund steigen, mit Fahrt anfliegen – der Ausbilder nimmt das Triebwerk weg': 'Climb to at least 300 m (1000 ft) above ground over the training area and approach with airspeed – the instructor will cut the engine',
  'Kollektiv sofort runter (Rotordrehzahl halten), mit ca. 60 kt gleiten, in 20–30 m Höhe Nase hoch (Abfangen), kurz vor dem Boden Kollektiv ziehen': 'Collective down immediately (keep rotor RPM), glide at about 60 kt, raise the nose at 20–30 m (flare), pull collective just above the ground',
  'Aufsetzpunkt (Nähe zur Mitte) und Sinkrate beim Aufsetzen': 'Touchdown point (distance from the center) and sink rate at touchdown',
  'Anschlagen … {0} % – Position halten!': 'Hooking up … {0} % – hold position!',
  'Zur Last bei {0} fliegen – darüber schweben': 'Fly to the load at {0} – hover over it', 'Genau über die Last – Haken sitzt unter dem Rumpf': 'Right over the load – the hook is under the fuselage',
  'Höher – mindestens 5 m über der Last': 'Higher – at least 5 m above the load', 'Tiefer – höchstens 20 m über der Last': 'Lower – at most 20 m above the load',
  'Last nach {0} fliegen – ruhig, unter 80 kt (Seil {1} m)': 'Fly the load to {0} – smoothly, below 80 kt ({1} m line)',
  'Last liegt außerhalb – wieder anheben und genauer absetzen': 'Load is outside the area – lift it again and set it down more precisely',
  'Last steht – Position halten …': 'Load is down – hold position …', 'Langsam sinken, bis die Last aufsetzt': 'Descend slowly until the load touches down',
  'Kampfhubschrauber haben keinen Lasthaken': 'Attack helicopters have no cargo hook',
  'Bodenpersonal: Position gut – wir hängen an, halten!': 'Ground crew: position good – hooking up, hold!',
  'Bodenpersonal: Last ist angeschlagen – langsam anheben!': 'Ground crew: load is hooked – lift slowly!',
  'Lastenhaken: Last steht – ausgeklinkt!': 'Cargo hook: load is down – released!',
  'Crew: Last pendelt stark – langsamer!': 'Crew: load is swinging hard – slow down!',
  'Lastenhaken: Die Last ist hart aufgeschlagen – zerstört!': 'Cargo hook: the load hit hard – destroyed!', 'Lastenhaken: Last hart aufgesetzt – vorsichtiger!': 'Cargo hook: hard set-down – be careful!',
  'Zur {0} fliegen': 'Fly to {0}', 'Steigen: {0} / 1000 ft über Grund': 'Climb: {0} / 1000 ft above ground', 'Mit Fahrt über die Übungsfläche – gleich kommt der Ausfall': 'Keep airspeed over the training area – the failure is coming',
  'Autorotation: Kollektiv runter, Rotor {0} % – Übungsfläche anfliegen': 'Autorotation: collective down, rotor {0} % – head for the training area',
  'Abfangen: Nase hoch, Fahrt abbauen!': 'Flare: nose up, bleed off airspeed!', 'Jetzt Kollektiv ziehen – weich aufsetzen!': 'Pull collective now – touch down softly!',
  'Fahrzeug geborgen': 'Vehicle recovered', 'Sandsäcke am Deich abgesetzt': 'Sandbags delivered to the dike', 'Nachschub als Außenlast geliefert': 'Supplies delivered as sling load',
  'Autorotation: {0} m neben der Mitte, {1} m/s beim Aufsetzen': 'Autorotation: {0} m from the center, {1} m/s at touchdown',
  'Einsatztag {0}': 'Duty day {0}', 'Auftrag {0}/{1}': 'Mission {0}/{1}', 'Einsatztag {0} beendet': 'Duty day {0} complete', 'Ohne Verluste': 'No losses',
  'Auszeichnung': 'Award', 'BEFÖRDERT': 'PROMOTED', 'Nächster Rang': 'Next rank', '{0} ab {1} Punkten ({2})': '{0} at {1} points ({2})',
  'KARRIERE: {0}': 'CAREER: {0}', 'Einsatztag {0} ({1}/{2})': 'Duty day {0} ({1}/{2})', '{0} Auszeichnungen': '{0} awards', '{0} Auszeichnung': '{0} award',
  'Erster Einsatz': 'First mission', 'Air Medal (10 Einsätze)': 'Air Medal (10 missions)', 'Air Medal mit Eichenlaub (25 Einsätze)': 'Air Medal with oak leaf cluster (25 missions)',
  'Lebensretter (25 gerettet)': 'Lifesaver (25 rescued)', 'Schutzengel (100 gerettet)': 'Guardian angel (100 rescued)',
  'Distinguished Flying Cross (heiße LZ ohne Schaden)': 'Distinguished Flying Cross (hot LZ without damage)', 'Goldene Kufe (Autorotation butterweich)': 'Golden skid (butter-smooth autorotation)',
  'Lastenträger (5 Außenlasten)': 'Heavy lifter (5 sling loads)', 'Allwetterpilot (Auftrag bei Gewitter, Schnee oder Nebel)': 'All-weather pilot (mission in thunderstorm, snow or fog)',
  'Nachtfalke (5 Nachteinsätze)': 'Night hawk (5 night missions)', 'Dienstzeitabzeichen (5 Einsatztage)': 'Service badge (5 duty days)', 'Sicherheitspreis (Einsatztag ohne Verlust)': 'Safety award (duty day without loss)',
  'Frühnebel im Tal – Sicht teils unter 1 km. Tief und langsam fliegen.': 'Morning fog in the valley – visibility partly below 1 km. Fly low and slow.',
  'Dunst zieht auf, die Fernsicht nimmt ab.': 'Haze is moving in, long-range visibility is dropping.',
  'Tiefe Wolken, Untergrenze sinkt – auf Sicht bleiben.': 'Low clouds, the ceiling is dropping – stay visual.',
  'Regenschauer im Einsatzgebiet, Sicht eingeschränkt, leichte Böen.': 'Rain showers in the area of operations, limited visibility, light gusts.',
  'Wetterwarnung! Gewitterfront mit Starkregen und Sturmböen – Blitzschlag möglich.': 'Weather warning! Thunderstorm front with heavy rain and strong gusts – lightning possible.',
  'Gewitter in der Nähe – kräftige Böen, Blitze. Abstand zu den Zellen halten.': 'Thunderstorms nearby – strong gusts, lightning. Keep clear of the cells.',
  'Starkwind mit Böen aus West – bei Landungen mit Abdrift rechnen.': 'Strong winds gusting from the west – expect drift when landing.',
  'Schneeschauer! Sicht stark eingeschränkt, Whiteout-Gefahr bei Landungen.': 'Snow showers! Visibility severely limited, whiteout risk when landing.',
  'Das Wetter klart auf, Sicht wieder gut.': 'The weather is clearing, visibility good again.',
  'Kommandeur: Glückwunsch, {0} – Sie sind ab sofort {1}!{2}': 'Commander: congratulations, {0} – you are now {1}!{2}',
  ' Neu für Sie freigegeben: {0}.': ' Newly cleared for you: {0}.', 'Kommandeur: Für Ihren Einsatz erhalten Sie: {0}.': 'Commander: for your service you receive: {0}.',
  'TOC: Einsatztag {0} beendet – gute Arbeit. Kurze Ruhezeit, dann beginnt Einsatztag {1}.': 'TOC: duty day {0} complete – good work. Short rest, then duty day {1} begins.',
  'TOC: {0} – Auftrag gescheitert. Neuer Auftrag folgt.': 'TOC: {0} – mission failed. New mission follows.',
  'Außenlast zerstört': 'Sling load destroyed', 'Hubschrauber mit Außenlast verloren': 'Helicopter with sling load lost', 'Hubschrauber mit Außenlast abgestürzt': 'Helicopter with sling load crashed',
  'Instrumententafel': 'Instrument panel',
  '{0}: Aussteigen{1} · {2} km/h': '{0}: get out{1} · {2} km/h', ' · {0}: ans MG': ' · {0}: man the MG', '{0}: Aussteigen · {1}: ans Steuer{2}': '{0}: get out · {1}: take the wheel{2}',
  '{0}: {1} fahren': '{0}: drive the {1}', 'AM STEUER · {0} km/h': 'DRIVING · {0} km/h', 'MG auf {0}': 'MG on the {0}',
  'Sie fahren den {0}.{1} E/Ⓐ zum Aussteigen.': 'You are driving the {0}.{1} E/Ⓐ to get out.', ' WAFFE/Tab: ans MG.': ' WEAPON/Tab: man the MG.',
  'Sie bedienen das {0}. WAFFE/Tab: ans Steuer, E/Ⓐ zum Aussteigen.': 'You are manning the {0}. WEAPON/Tab: take the wheel, E/Ⓐ to get out.',
  'MG verlassen': 'leave MG', '{0}: MG verlassen{1}': '{0}: leave MG{1}', ' · Nachladen …': ' · reloading …',
  '{0}: Auf das Fahrzeug – MG bedienen': '{0}: climb on the vehicle – man the MG', '{0}: {1} besetzen': '{0}: man {1}',
  'MG-Stellung {0}': 'MG position {0}', 'Dachlafette': 'roof mount', 'schweres MG': 'heavy machine gun', 'AM MG': 'ON THE MG',
  'Sie bedienen das MG auf dem Fahrzeug – Konvoi fährt mit Ihnen. E/Ⓐ zum Absitzen.': 'You are manning the MG on the vehicle – the convoy rolls with you. E/Ⓐ to dismount.',
  'Sie besetzen die {0}. E/Ⓐ zum Verlassen.': 'You man {0}. E/Ⓐ to leave.',
  '{0}: MG ist besetzt – Konvoi rollt!': '{0}: MG is manned – convoy rolling!',
  'TOC: Alle Feindfahrzeuge vernichtet – Fahrzeugangriff abgewehrt!': 'TOC: all enemy vehicles destroyed – vehicle attack repelled!',
  'FAHRZEUGANGRIFF ABGEWEHRT': 'VEHICLE ATTACK REPELLED', 'Fahrzeuge zerstört': 'Vehicles destroyed',
  'TOC: ALARM! {0} Feindfahrzeuge mit schweren MGs greifen die {1} aus Richtung {2} an! Panzerfäuste an der Mauer aufnehmen, MG-Stellungen besetzen!': 'TOC: ALERT! {0} enemy vehicles with heavy MGs are attacking {1} from the {2}! Grab the launchers at the wall, man the MG positions!',
  'Übungsfläche {0}': 'Training area {0}',
  '„{0}, hier Ausbilder. Heute üben wir den Triebwerksausfall. Fliegen Sie zur {1} und steigen Sie auf 1000 Fuß.“': '"{0}, this is the instructor. Today we practise an engine failure. Fly to {1} and climb to 1000 feet."',
  '„{0}, hier {1}. Ein Fahrzeug ist bei {2} liegengeblieben – bitte als Außenlast zur {3} bringen.“': '"{0}, this is {1}. A vehicle has broken down at {2} – please bring it to {3} as a sling load."',
  '„{0}, hier {1}. Der Posten bei {2} braucht dringend Nachschub – Last steht auf Pad {3} bereit.“': '"{0}, this is {1}. The post at {2} urgently needs supplies – the load is ready on pad {3}."',
  '„{0}, hier {1}. Der Deich bei {2} braucht dringend Sandsäcke – Last steht auf Pad {3} bereit.“': '"{0}, this is {1}. The dike at {2} urgently needs sandbags – the load is ready on pad {3}."',
  'Außenlast': 'Sling load',
  'Ausbilder: {0} – {1}. Triebwerk wird gleich wieder angelassen.': 'Instructor: {0} – {1}. The engine will be restarted shortly.',
  'Butterweich aufgesetzt': 'Butter-smooth touchdown', 'Sauber aufgesetzt': 'Clean touchdown', 'Das war hart': 'That was hard',
  'genau auf der Übungsfläche': 'right on the training area', '{0} m neben der Mitte': '{0} m from the center', 'weit neben der Übungsfläche': 'well off the training area',

  '{0}: Keine Feindkräfte in Ihrer Nähe aufgeklärt – Anforderung abgebrochen.': '{0}: no enemy forces spotted near you – request cancelled.',
  '{0}: {1}, verstanden – {2}. Ziel {3} m {4} von Ihnen, Eintreffen in ca. 15 Sekunden.{5}': '{0}: {1}, copy – {2}. Target {3} m {4} of you, time on target about 15 seconds.{5}',
  '{0}: Bombe ausgeklinkt – 10 Sekunden!': '{0}: bomb away – 10 seconds!', '{0}: Einschlag! Gute Wirkung im Ziel.': '{0}: impact! Good effect on target.',
  '{0}: Napalm ausgeklinkt!': '{0}: napalm away!', '{0}: Erster Anflug abgeschlossen, komme zurück für den zweiten.': '{0}: first pass complete, coming around for the second.',
  '{0}: Munition für diesen Einsatz verschossen. Hog verlässt das Gebiet.': '{0}: Winchester for this sortie. Hog is leaving the area.',
  '{0}: Auf Station. Halten Sie die Köpfe unten.': '{0}: on station. Keep your heads down.',
  '{0}: Treibstoff und Munition knapp – kehren zur FOB zurück.': '{0}: low on fuel and ammo – returning to the FOB.',
  '{0}: Munition leer!': '{0}: out of ammo!', '{0}: Magazinwechsel!': '{0}: changing ammo can!',
  '{0} · {1} % Treibstoff · Kabine {2}/{3}': '{0} · {1} % fuel · cabin {2}/{3}', 'wieder bereit in {0} s': 'ready again in {0} s', 'FOB {0}': 'FOB {0}',
  'Sie sind Waffensystemoffizier: {0}-Kanone, Zoom mit Rechtsklick / ZL. {1}.': 'You are the gunner (CPG): {0} cannon, zoom with right click / ZL. {1}.',
  'Sie bedienen {0} {1}{2}. {3}.': 'You man {0} {1}{2}. {3}.', '{0} fliegt': '{0} is flying', '{0} fliegt.': '{0} is flying.',
  'Sie sitzen in der Kabine von {0} #{1}. {2} Aussteigen: E / Ⓐ – nur am Boden.': 'You are in the cabin of {0} #{1}. {2} Exit: E / Ⓐ – only on the ground.',
  'Spieler {0}': 'Player {0}', 'Diesen Platz gibt es im {0} nicht.': 'The {0} has no such seat.',
  'Der {0} hat keine Kabine – nur Pilot und Waffensystemoffizier.': 'The {0} has no cabin – only pilot and gunner (CPG).',
  'Der Platz {0} ist besetzt ({1}).': 'The seat {0} is taken ({1}).',
  '{0} aufgenommen – {1} Schuss. Wirksam gegen Fahrzeuge.': '{0} picked up – {1} rounds. Effective against vehicles.',
  'Anforderung {0} gesendet …': 'Request for {0} sent …', 'Ersatzmaschine startet von der {0}.': 'Replacement aircraft launching from {0}.',
  'Alle Hubschrauber sind bemannt – {0} #{1} wurde angefunkt und holt Sie bei {2} ab.': 'All helicopters are crewed – {0} #{1} has been called and will pick you up at {2}.',
  'TOC: {0} braucht Abholung bei {1} (Planquadrat {2}).': 'TOC: {0} needs pickup at {1} (grid {2}).',
  'Verstanden – {0} #{1} holt Sie bei {2} ab ({3} m von Ihnen).': 'Copy – {0} #{1} will pick you up at {2} ({3} m from you).',
  'App-Version {0}': 'App version {0}', 'Version {0}': 'Version {0}', 'Wechsle nach {0} …': 'Switching to {0} …',
  '· {0} PLÄTZE': '· {0} SEATS', '{0} · {1} PLÄTZE · {2}': '{0} · {1} SEATS · {2}', 'KARTE: {0}': 'MAP: {0}', 'HUBSCHRAUBER: {0}': 'HELICOPTER: {0}', 'ZEIT: {0}': 'TIME: {0}',
  '· {0} Punkte · {1} Einsätze · {2} gerettet · {3} transportiert': '· {0} points · {1} missions · {2} rescued · {3} transported',
  '{0}, hier TOC {1}. Willkommen in {2}. Halten Sie sich bereit.': '{0}, this is TOC {1}. Welcome to {2}. Stand by.',
  'Eigene IP: {0}': 'My IP: {0}', '{0} · {1} Spieler · {2}': '{0} · {1} players · {2}',
  'Spiel konnte nicht eröffnet werden: {0}': 'Could not host the game: {0}',
  'Mehrspieler-Spiel eröffnet ({0}). Mitspieler im selben WLAN können jetzt beitreten.': 'Multiplayer game hosted ({0}). Players on the same Wi-Fi can join now.',
  'Verbinde mit {0} …': 'Connecting to {0} …', 'Verbunden mit {0}. Sie sind {1} in {2} #{3}.': 'Connected to {0}. You are {1} in {2} #{3}.',
  'MAYDAY, MAYDAY! {0}{1} stürzt ab!': 'MAYDAY, MAYDAY! {0}{1} is going down!',
  'TOC: Eine Ersatzmaschine steht auf Pad {0} bereit.': 'TOC: A replacement aircraft is ready on pad {0}.',
  '{0}: kein Rotpunktvisier – mit ZL über Kimme und Korn zielen.': '{0}: no red dot – aim down the iron sights with ZL.',
  'BETANKUNG {0} % · REPARATUR {1} % · MUNITION': 'REFUELING {0} % · REPAIR {1} % · AMMO',
  '{0}: Panzerfaust aufnehmen': '{0}: pick up launcher', '{0}: In {1} #{2} einsteigen': '{0}: board {1} #{2}', '{0}: Aussteigen': '{0}: exit',
  'Abholung {0}': 'Pickup {0}', 'Fehler beim Start: {0}': 'Startup error: {0}',
  '{0} – Pad {1}': '{0} – pad {1}', 'Pad {0}': 'Pad {0}', 'Absetzpunkt {0}': 'Insertion point {0}', 'Punkt {0}': 'Point {0}',
  '{0} · Planquadrat {1}': '{0} · grid {1}', '{0} ({1} liegend, {2} gehfähig)': '{0} ({1} litter, {2} walking)', '{0} Rauch': '{0} smoke',
  '{0} – Lazarett (Pad MED)': '{0} – hospital (pad MED)', '{0} Verwundete': '{0} casualties', ', davon {0} {1}': ', {0} of them {1}',
  '„{0}, hier {1}. Wir haben {2}{3}. {4} Erbitten sofortige Evakuierung bei {5}.“': '“{0}, this is {1}. We have {2}{3}. {4} Request immediate evacuation at {5}.”',
  'Truppentransport ({0})': 'Troop transport ({0})', '{0} · {1} · {2} ab A': '{0} · {1} · {2} from A', 'HEISS bei {0}!': 'HOT at {0}!',
  '„{0}, hier TOC {1}. {2} Soldaten von {3} nach {4} verbringen.{5}“': '“{0}, this is TOC {1}. Move {2} soldiers from {3} to {4}.{5}”',
  '{0} · {1} Mann': '{0} · {1} men',
  '„{0}, hier TOC. {1} muss verdeckt bei {2} abgesetzt werden. Aufnahme bei {3}, Pad H1. Keine Rauchzeichen.“': '“{0}, this is TOC. {1} needs a covert insertion at {2}. Pickup at {3}, pad H1. No smoke.”',
  '„{0}, hier {1}. {2} Erbitten Exfil bei {3}, Planquadrat {4}.“': '“{0}, this is {1}. {2} Request exfil at {3}, grid {4}.”',
  '{0} Kisten – Aufnahme {1}, Pad H1': '{0} crates – pickup {1}, pad H1',
  '„{0}, hier {1}. Uns gehen Munition und Wasser aus. Bitte {2} Kisten Nachschub.{3}“': '“{0}, this is {1}. We are running out of ammo and water. Request {2} crates of supplies.{3}”',
  '{0} mit Begleitschutz – {1}': '{0} with escort – {1}', '{0}, Pad H1': '{0}, pad H1',
  '„{0}, hier TOC. {1} muss zur {2} nach {3}. Bitte ohne Umwege und sanft.“': '“{0}, this is TOC. {1} has to go to {3} for a {2}. Direct and smooth, please.”',
  '„{0}, hier TOC. Klären Sie {1} auf und melden Sie Feindbewegungen.“': '“{0}, this is TOC. Reconnoiter {1} and report enemy movement.”',
  'ca. {0} {1}, auch Fahrzeuge möglich': 'about {0} {1}, vehicles possible', '{0} Rauch markiert die eigene Stellung': '{0} smoke marks the friendly position',
  '„{0}, hier {1}. Wir liegen bei {2} unter schwerem Feuer, ca. {3} {4}. Erbitten sofortige Luftunterstützung!“': '“{0}, this is {1}. We are under heavy fire at {2}, about {3} {4}. Request immediate air support!”',
  '{0} („{1}“)': '{0} (“{1}”)', 'Planquadrat {0} – Suchradius 400 m': 'Grid {0} – search radius 400 m', '{0} ({1}) · ca. {2}': '{0} ({1}) · approx. {2}',
  '{0} Überlebende': '{0} survivors', '{0} Rauch, sobald sie Sie hören': '{0} smoke once they hear you', '{0} – Pad MED': '{0} – pad MED',
  '„Mayday, Mayday! {0} ist runter! {1} am Boden. Achten Sie auf die Rauchsäule des Wracks.“': '“Mayday, Mayday! {0} is down! {1} on the ground. Look for the smoke column of the wreck.”',
  'Treibstoff knapp ({0} %, benötigt ca. {1} %) – vorher am Tankwagen (POL) tanken!': 'Fuel low ({0} %, about {1} % needed) – refuel at the fuel truck (POL) first!',
  'AUFTRAG #{0} – {1}': 'MISSION #{0} – {1}',
  'TOC: Die Truppe wartet neben Pad {0}. Landen Sie dort zum Aufnehmen.': 'TOC: The troops are waiting next to pad {0}. Land there to pick them up.',
  'Crew: Erster ist an Bord! Noch {0}.': 'Crew: first one is aboard! {0} to go.', '3 Punkte aufgeklärt, {0} Feinde gemeldet': '3 points reconnoitered, {0} enemies reported',
  '{0} Kisten Nachschub geliefert': '{0} crates of supplies delivered', '{0} sicher abgesetzt': '{0} dropped off safely', '{0} unentdeckt abgesetzt': '{0} inserted undetected',
  '{0} herausgeholt': '{0} extracted', '{0} Feinde bekämpft': '{0} enemies engaged',
  'Crew: {0} an Bord – los, los, los! Kurs {1} nach {2}.': 'Crew: {0} aboard – go, go, go! Heading {1} to {2}.',
  'ca. {0} Feinde gesichtet!': 'about {0} enemies spotted!', '{0}: {1} aufgeklärt – {2}': '{0}: {1} reconnoitered – {2}',
  '{0}: Wir hören Sie – IR-Blitzer ist an.': '{0}: we hear you – IR strobe is on.',
  '{0}: {1}, wir hören Sie! Rauch ist geworfen – bestätigen Sie {2}.': '{0}: {1}, we hear you! Smoke is out – confirm {2}.',
  '{0}: Sehe {1}en Rauch, wir kommen rein.': '{0}: I see {1} smoke, coming in.',
  '{0}: Achtung, die LZ ist HEISS! Feindfeuer aus Richtung {1}!': '{0}: Caution, the LZ is HOT! Enemy fire from {1}!',
  '{0}: Wir sehen einen Hubschrauber! Wir sind {1} von ihm auf der Lichtung!': '{0}: We see a helicopter! We are {1} of it in the clearing!',
  '{0} Verwundete gerettet': '{0} casualties rescued', '{0} {1} gerettet': '{0} {1} rescued', '{0} Soldaten verbracht': '{0} soldiers transported', '{0} Punkte': '{0} points',
  '{0}: Feind zieht sich zurück – danke für die Unterstützung, {1}!': '{0}: Enemy is withdrawing – thanks for the support, {1}!',
  'TOC: Gut gemacht, {0}. Auftrag erledigt.': 'TOC: Well done, {0}. Mission complete.', 'Lazarett: Danke, {0}! Ihr habt Leben gerettet.': 'Hospital: Thank you, {0}! You saved lives.',
  'Feind bei {0} bekämpfen – noch ca. {1} (eigene Truppe: {2}er Rauch)': 'Engage the enemy at {0} – about {1} left (friendlies: {2} smoke)',
  '{0} · {1} · HEISS': '{0} · {1} · HOT', 'Punkt {0}/3: {1} tief überfliegen (unter 180 m über Grund)': 'Point {0}/3: overfly {1} low (below 180 m AGL)',
  '{0} · {1}/3 Punkte': '{0} · {1}/3 points', 'Einsteigen: {0}/{1} – Position halten!': 'Boarding: {0}/{1} – hold position!',
  'Auf Pad {0} landen – Soldaten aufnehmen': 'Land on pad {0} – pick up the soldiers', 'Bei {0} landen ({1}er Rauch) – {2} {3}': 'Land at {0} ({1} smoke) – {2} {3}',
  'Aussteigen: {0}/{1} – am Boden bleiben': 'Unloading: {0}/{1} – stay on the ground', 'Alle aufgenommen – {0}/{1} abgeliefert': 'All aboard – {0}/{1} delivered',
  'Zur FOB – auf Pad {0} landen{1}': 'To the FOB – land on pad {0}{1}', 'Nach {0} fliegen und landen': 'Fly to {0} and land',
  '{0} · {1} {2} · HEISS': '{0} · {1} {2} · HOT', '{0} · {1} {2} · KALT': '{0} · {1} {2} · COLD',
  '{0} ({1}) · {2}': '{0} ({1}) · {2}', '{0} (Tragefall)': '{0} (litter case)', '{0}, davon {1} {2}': '{0}, {1} of them {2}',
  'Feuerwehr {0}': '{0} fire brigade', '{0} · {1} {2}': '{0} · {1} {2}', 'Helfer': 'helpers', 'Retter': 'rescuers', '{0}, Hausdach': '{0}, rooftop', '{0}, Dach': '{0}, roof', '{0} auf dem Dach eingeschlossen': '{0} trapped on the roof',
  '{0} – Behandlungsplatz (Pad MED)': '{0} – casualty collection point (pad MED)', '{0} Personen': '{0} people',
  'Nach {0} fliegen – über dem Dach schweben': 'Fly to {0} – hover above the roof', 'Windenbetrieb: {0}/{1} – Person wird hochgezogen': 'Hoisting: {0}/{1} – person coming up',
  'Windenbetrieb: {0}/{1} – Position halten!': 'Hoisting: {0}/{1} – hold position!', 'Zur Einsatzbasis – auf Pad {0} landen{1}': 'To the base – land on pad {0}{1}',
  '{0}: {1} erkundet – Lagebild übermittelt.': '{0}: {1} assessed – situation report sent.',
  '„{0}, hier {1}. In {2} sitzt eine Person auf einem Dach fest, das Wasser steigt weiter. Mit den Booten kommen wir nicht hin – erbitten Windenrettung!“': '“{0}, this is {1}. In {2} one person is stranded on a roof and the water keeps rising. We can’t reach them by boat – request hoist rescue!”',
  '„{0}, hier {1}. In {2} sitzen {3} Personen auf einem Dach fest, das Wasser steigt weiter. Mit den Booten kommen wir nicht hin – erbitten Windenrettung!“': '“{0}, this is {1}. In {2} {3} people are stranded on a roof and the water keeps rising. We can’t reach them by boat – request hoist rescue!”',
  '„{0}, hier {1}. Wir sind vom Hochwasser abgeschnitten. Bitte {2} Kisten Trinkwasser, Sandsäcke und Medikamente.“': '“{0}, this is {1}. We are cut off by the flood. Please bring {2} crates of drinking water, sandbags and medicine.”',
  '„{0}, hier Krisenstab. Erkunden Sie {1} und melden Sie die Schadenslage.“': '“{0}, this is the crisis team. Assess {1} and report the damage.”',
  '„{0}, hier {1}. {2} Helfer von {3} nach {4} fliegen.“': '“{0}, this is {1}. Fly {2} helpers from {3} to {4}.”',
  '{0} Fahrzeuge (Dingo, Fuchs, Tanklastwagen)': '{0} vehicles (Dingo, Fuchs, fuel truck)', 'ca. {0} über Land': 'approx. {0} overland', '{0}, Ausfahrt': '{0}, exit gate',
  '„{0}, hier {1}. Unser Konvoi mit {2} Fahrzeugen steht abmarschbereit am {3}. Erbitten Begleitschutz bis {4}.“': '“{0}, this is {1}. Our convoy of {2} vehicles is ready to move at {3}. Request escort to {4}.”',
  '{0}: Konvoi ist bereit. Wir rollen an, sobald Sie über uns sind.': '{0}: Convoy is ready. We move out once you are overhead.', '{0}: Luftsicherung ist da – Konvoi rollt!': '{0}: Air cover is here – convoy moving!',
  '{0}: Feuerüberfall! Konvoi hält – Feind {1} von uns!': '{0}: Ambush! Convoy halting – enemy to our {1}!', '{0}: Feind niedergekämpft – Konvoi fährt weiter.': '{0}: Enemy suppressed – convoy moving on.',
  '{0}: Konvoi ist in {1} angekommen. Danke für die Begleitung!': '{0}: Convoy has arrived at {1}. Thanks for the escort!', '{0} von {1} Fahrzeugen sicher angekommen': '{0} of {1} vehicles arrived safely',
  'Hinterhalt! {0} Feinde bekämpfen – der Konvoi hält': 'Ambush! Engage {0} enemies – the convoy is halted', 'Konvoi nach {0} begleiten – noch {1}': 'Escort the convoy to {0} – {1} to go', '{0} · {1}/{2} Fahrzeuge': '{0} · {1}/{2} vehicles',
  'Fregatte „Sachsen“, Flugdeck': 'Frigate “Sachsen”, flight deck', '{0} von der Basis': '{0} from the base', 'Auf dem Flugdeck der Fregatte landen – {0} {1}': 'Land on the frigate’s flight deck – {0} {1}',
  '„{0}, hier Fregatte „Sachsen“. Wir haben einen Verletzten an Bord, Unfall an Deck. Flugdeck ist frei, Seegang mäßig.“': '“{0}, this is frigate “Sachsen”. We have one casualty aboard, accident on deck. Flight deck is clear, moderate sea.”',
  '„{0}, hier Fregatte „Sachsen“. Wir haben {1} Verletzte an Bord, Unfall an Deck. Flugdeck ist frei, Seegang mäßig.“': '“{0}, this is frigate “Sachsen”. We have {1} casualties aboard, accident on deck. Flight deck is clear, moderate sea.”',
  '„{0}, hier {1}. {2} Soldaten des Seebataillons auf die Fregatte „Sachsen“ verlegen. Achten Sie auf das schwankende Deck.“': '“{0}, this is {1}. Move {2} soldiers of the sea battalion to the frigate “Sachsen”. Mind the moving deck.”',
  '{0} · {1} Mann + Boot': '{0} · {1} men + boat', 'Flusspunkt {0}': 'River point {0}', '{0}: {1}': '{0}: {1}',
  '„{0}, hier TOC. {1} wird mit Schlauchboot bei {2} im Fluss abgesetzt. Aufnahme {3}, Pad H1. Tief und langsam über dem Wasser schweben – nicht wassern!“': '“{0}, this is TOC. {1} will be dropped into the river with an inflatable boat at {2}. Pickup {3}, pad H1. Hover low and slow over the water – do not ditch!”',
  'Gipfel-LZ – kleine Landefläche, Fallwinde, steile Hänge': 'mountaintop LZ – small landing area, downdrafts, steep slopes',
  'enges Flusstal – hohe Hänge, wenig Platz': 'narrow river valley – high slopes, little room',
  'Hang-LZ – schmaler Absatz am Steilhang, Rotor frei halten': 'slope LZ – narrow ledge on a steep hillside, keep the rotor clear',
  'Wadi – enges Trockental zwischen Böschungen, starker Staub': 'wadi – narrow dry riverbed between banks, heavy dust',
  'Nach {0} fliegen – über dem Wasser schweben, nicht wassern': 'Fly to {0} – hover over the water, do not ditch',
  '{0} ist dem Einsatz beigetreten.': '{0} has joined the mission.', '{0} hat den Einsatz verlassen.': '{0} has left the mission.',
  'TOC: ALARM! Feindangriff auf die {0} aus Richtung {1}! Etwa {2} Mann – alle verfügbaren Kräfte zur Verteidigung!': 'TOC: ALERT! Enemy attack on {0} from the {1}! About {2} fighters – all available forces to the defense!',
  'Feindangriff aus Richtung {0}': 'Enemy attack from the {0}',
};

const exact = new Map(Object.entries(EN));
const pats = Object.entries(EN_T).map(([de, en]) => {
  const parts = de.split(/(\{\d\})/);
  const order = [];
  const src = parts.map((p) => { const m = p.match(/^\{(\d)\}$/); if (m) { order.push(+m[1]); return '([\\s\\S]*?)'; } return p.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&'); }).join('');
  return { re: new RegExp('^' + src + '$'), order, en, lit: de.replace(/\{\d\}/g, '').length };
}).sort((a, b) => b.lit - a.lit);

const cache = new Map();
function trCore(s, depth) {
  if (exact.has(s)) return exact.get(s);
  if (depth > 3 || !/[A-Za-zÄÖÜäöüß]/.test(s)) return s;
  for (const p of pats) {
    const m = p.re.exec(s);
    if (!m) continue;
    const vals = [];
    p.order.forEach((idx, k) => { vals[idx] = trPiece(m[k + 1], depth + 1); });
    return p.en.replace(/\{(\d)\}/g, (x, i) => vals[+i] ?? '');
  }
  // Aufzählungen („A, B und C“) Stück für Stück
  if (s.includes(', ')) {
    const parts = s.split(', '), outp = parts.map((x) => trPiece(x, depth + 1));
    if (outp.some((x, i) => x !== parts[i])) return outp.join(', ');
  }
  return s;
}
function trPiece(s, depth = 0) {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  if (!m[2]) return s;
  return m[1] + trCore(m[2], depth) + m[3];
}

// Übersetzt einen deutschen Text (bei Deutsch unverändert)
export function tr(s) {
  if (lang === 'de' || typeof s !== 'string' || !s) return s;
  let r = cache.get(s);
  if (r === undefined) {
    r = trPiece(s);
    if (cache.size > 4000) cache.clear();
    cache.set(s, r);
  }
  return r;
}

// ---------------------------------------------------------------- DOM
const orig = new WeakMap();   // Textknoten -> deutscher Originaltext
const done = new WeakMap();   // Textknoten -> zuletzt gesetzte Übersetzung
const ATTRS = ['placeholder', 'title', 'aria-label'];

function doText(n) {
  const cur = n.data;
  if (done.get(n) === cur) return;           // schon übersetzt (eigene Änderung)
  orig.set(n, cur);
  const out = tr(cur);
  done.set(n, out);
  if (out !== cur) n.data = out;
}
function doEl(el) {
  for (const a of ATTRS) {
    if (!el.hasAttribute || !el.hasAttribute(a)) continue;
    const key = 'i18n' + a;
    const cur = el.getAttribute(a);
    if (el[key + 'Out'] === cur) continue;
    el[key] = cur;
    const out = tr(cur);
    el[key + 'Out'] = out;
    if (out !== cur) el.setAttribute(a, out);
  }
}
function walk(root) {
  if (root.nodeType === 3) { doText(root); return; }
  if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
  doEl(root);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = it.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
}
// Alles auf Deutsch zurücksetzen (für den Sprachwechsel)
function restore(root) {
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = it.nextNode())) {
    if (n.nodeType === 3) {
      if (orig.has(n) && done.get(n) === n.data) n.data = orig.get(n);
      done.delete(n);
    } else for (const a of ATTRS) {
      const key = 'i18n' + a;
      if (n[key] !== undefined && n[key + 'Out'] === n.getAttribute(a)) n.setAttribute(a, n[key]);
      n[key + 'Out'] = undefined;
    }
  }
}

let observer = null;
export function setLang(l) {
  const next = l === 'en' ? 'en' : 'de';
  if (observer) restore(document.body);
  lang = next;
  cache.clear();
  document.documentElement.lang = lang;
  document.title = lang === 'en' ? 'Hot LZ – Helicopter Missions' : 'Hot LZ – Hubschrauber-Einsätze';
  if (lang === 'en') {
    walk(document.body);
    if (!observer) {
      observer = new MutationObserver((list) => {
        if (lang === 'de') return;
        for (const m of list) {
          // Kopie der Anzeigen für das rechte Auge (VR) ist schon übersetzt
          if (m.target.id === 'vr-mirror' || (m.target.parentElement && m.target.parentElement.closest('#vr-mirror'))) continue;
          if (m.type === 'characterData') doText(m.target);
          else if (m.type === 'attributes') doEl(m.target);
          else for (const n of m.addedNodes) walk(n);
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
  }
}

// Standard: Gerätesprache (Deutsch oder sonst Englisch)
export function defaultLang() {
  const l = (navigator.language || 'de').toLowerCase();
  return l.startsWith('de') ? 'de' : 'en';
}

// Bestätigungsdialoge mit übersetzen
const _confirm = window.confirm.bind(window);
window.confirm = (m) => _confirm(tr(m));
const _alert = window.alert.bind(window);
window.alert = (m) => _alert(tr(m));
