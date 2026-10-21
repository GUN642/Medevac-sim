# Dustoff – UH-1D Medevac Vietnam

Ein Hubschraubersimulator im Browser: Als Pilot einer **Bell UH-1D „Huey“** fliegen Sie 1968 in Vietnam
Rettungs- und Transporteinsätze von der **FOB Eagle** aus. Läuft auf GitHub Pages, als Android-App (APK mit
automatischer Update-Funktion) und lässt sich per Touchscreen, Nintendo-Switch-Controller oder Tastatur/Maus steuern.

**Spielen:** https://gun642.github.io/Medevac-sim/
**Android-APK:** https://gun642.github.io/Medevac-sim/apk/medevac-sim.apk

## Spielablauf

1. Sie starten auf Pad **H1** der FOB und erhalten per Funk ein **Briefing**:
   Auftragsart, Ziel-LZ, **Richtung und Entfernung**, Anzahl Verwundete/Soldaten, **LZ heiß oder kalt**, Rauchfarbe.
2. Fliegen Sie zum gelben Wegpunkt (Kompass oben, Pfeil mit Kurs/Entfernung, Minikarte, Lichtsäule im Gelände).
3. Bei Annäherung werfen die Truppen **farbigen Rauch**. Landen Sie sanft im Ring – die Soldaten steigen selbst ein
   (Tragen werden von Kameraden zum Hubschrauber gebracht).
4. In einer **heißen LZ** schießen Vietcong/NVA aus der Baumlinie (grüne Leuchtspur). Ihre beiden **Bordschützen**
   eröffnen mit dem **M60** selbstständig das Feuer auf erkannte Feinde. Optional übernehmen Sie selbst ein MG –
   der Kopilot hält dann die Maschine in der Schwebe.
5. Zurück zur FOB: Verwundete auf Pad **MED** (rotes Kreuz) abliefern. Danach folgt der nächste Auftrag.

### Auftragsarten

| Auftrag | Beschreibung |
| --- | --- |
| **MEDEVAC** | Verwundete (liegend auf Tragen und gehfähig) aus einer LZ zum Lazarett fliegen |
| **Truppentransport** | X Soldaten von Punkt A nach Punkt B (FOB → LZ, LZ → FOB oder LZ → LZ) |
| **CSAR** | Ein Flugzeug/Hubschrauber (F-4, A-1, O-1, UH-1) wurde abgeschossen. Suchgebiet anfliegen, Rauchsäule des Wracks finden, Besatzung bergen |

### Treibstoff, Schaden, Munition

Die **Tankanzeige** links zeigt Füllstand und geschätzte Restflugzeit. Unter 25 % erscheint eine Warnung, bei
„BINGO FUEL“ reicht der Sprit gerade noch zurück zur FOB. Auf Pad **POL** (gelber Rand, neben dem Tankwagen)
wird getankt, repariert und Munition aufgefüllt. Bei leerem Tank fällt das Triebwerk aus – Autorotation!

## Steuerung

| | Tastatur / Maus | Switch-Controller | Touch |
| --- | --- | --- | --- |
| Vor / zurück (Zyklisch) | **Maus ↑/↓** oder W/S | Linker Stick ↕ | Rechter Daumen ↕ |
| Drehen (Pedale) | **Maus ←/→** oder Q/E | Rechter Stick ↔ | Linker Daumen ↔ |
| Seitlich neigen | A/D oder ←/→ | Linker Stick ↔ | Rechter Daumen ↔ |
| Kollektiv (steigen/sinken) | Leertaste/R · Shift/F | Rechter Stick ↕ oder ZR/ZL | Linker Daumen ↕ |
| Sitz Pilot / Schütze L / R | 1 / 2 / 3, Tab | L / R, Steuerkreuz | Taste SITZ |
| Besatzung / Platz wechseln | X | ⊖ | Taste CREW |
| Schütze: zielen / feuern | Maus / Linksklick (Rechtsklick Zoom) | Stick / ZR (ZL Zoom) | Wischen / FEUER |
| Kamera · Karte · Pause | C · M · Esc | Ⓨ · Ⓧ · ⊕ | Tasten am Rand |
| Auftrag annehmen | Enter | Ⓐ | Antippen |

Für die Maussteuerung einmal ins Bild klicken (Esc gibt die Maus wieder frei). Mit gedrückter rechter Maustaste
schwenkt die Kamera. Der **Flugassistent** hält bei losgelassenem Stick Höhe und Position und bremst die Sinkrate
kurz vor dem Aufsetzen.

## Infanterie

Über **„Als Infanterie beginnen“** im Hauptmenü oder **CREW → Aussteigen** (am Boden) spielen Sie einen Soldaten:

- **Einsteigen:** an einen gelandeten Hubschrauber herangehen und **E** (Controller Ⓐ, Touch EIN/AUS) drücken – Sie sitzen
  als Passagier in der Kabine. Über CREW lassen sich auch Pilot- oder Schützenplätze übernehmen.
- **Zum Einsatzort fliegen lassen:** Sitzt niemand am Steuer, fliegt der **KI-Pilot** den aktuellen Auftrag, nimmt die
  Truppe auf, bremst ab etwa 300 m vor der LZ ab und landet. Dort mit E aussteigen und mitkämpfen.
- **Ego-Perspektive:** In den Einstellungen („Ansicht zu Fuß“) oder mit **V** (Controller ↑, Touch ANSICHT) schaltet man zwischen Schulter- und Ego-Ansicht; mit Rechtsklick (ZL, Touch ZOOM)
  zielen Sie dann über **Kimme und Korn** der jeweiligen Waffe.
- **Abholung:** Mit **G** (Controller Ⓧ oder ↓, Touch ABHOLUNG) fliegt ein freier Hubschrauber zur nächsten Lichtung und holt Sie ab.
- **Waffen:** M16A1, M60, M79-Granatwerfer, Ithaca-37-Schrotflinte, M1911 (Tasten 1–5 / Mausrad, Controller L/R, Touch WAFFE).
  Rechte Maustaste (ZL, Touch ZOOM) zielt mit Zoom. In der FOB füllen sich Munition und Gesundheit wieder auf.

| | Tastatur / Maus | Switch-Controller | Touch |
| --- | --- | --- | --- |
| Laufen / Sprinten | WASD / Shift | Linker Stick / L3 | Linker Daumen (ganz außen: sprinten) |
| Zielen / Zoom | Maus / rechte Maustaste | Rechter Stick / ZL | Wischen oder FEUER ziehen / ZOOM |
| Feuern / Nachladen | Linksklick / R | ZR / Ⓨ | FEUER / LADEN |
| Ducken / Springen | C / Leertaste | R3 / – | DUCKEN |

## Mehrspieler im lokalen Netzwerk

Alle Geräte mit der **Android-App** im selben WLAN (Handys, Tablets, Android TV) können zusammen spielen:

1. Im Hauptmenü **Mehrspieler (LAN)** wählen und Namen eintragen.
2. Ein Gerät tippt **Spiel eröffnen** (optional mit zweitem Hubschrauber). Die anderen sehen das Spiel in der
   Liste und treten bei – auch mitten im Einsatz. Notfalls die IP-Adresse des Hosts eintragen.
3. **Zusammen spielen:** Mitspieler können auch als Infanterie mitfliegen oder am Boden kämpfen.
4. **Zusammen fliegen:** Einer ist Pilot, die anderen übernehmen die M60 links/rechts. Freie Plätze besetzt die KI
   (freier Pilotensitz = der KI-Pilot fliegt den Auftrag, sobald ein Mensch an Bord ist).
5. **Zwei Hubschrauber:** Beide Maschinen arbeiten am selben Auftrag – Verwundete können auf beide verteilt werden.
   Über **CREW** (Taste X, Controller ⊖) wechselt man den Platz; in den anderen Hubschrauber umsteigen geht, wenn
   beide nebeneinander (unter 150 m) gelandet sind.

Der Host berechnet Aufträge, Bodentruppen und Feinde; jeder Pilot berechnet die Flugphysik seines Hubschraubers
selbst. Gäste-WLANs mit „Client-Isolation“ verhindern die Verbindung. Browser können keine direkten
Netzwerkverbindungen aufbauen – zum Ausprobieren am PC das Spiel mit `?net=test` in zwei Tabs öffnen.

## Technik

- `web/` – das komplette Spiel (Three.js r169, lokal eingebunden, kein Build-Schritt nötig).
  Lokal starten: `cd web && python3 -m http.server 8000` → http://localhost:8000
- `android/` – Android-Hülle (WebView, Vollbild, Querformat, Controller-Unterstützung) mit Update-Manager.
- `.github/workflows/build-deploy.yml` – baut bei jedem Push die APK, erzeugt `version.json`
  und veröffentlicht Spiel + APK auf GitHub Pages.

### Einmalige Einrichtung von GitHub Pages

*Settings → Pages → Build and deployment → Source: **GitHub Actions*** auswählen. Danach veröffentlicht jeder
Push auf den Standard-Branch automatisch die neue Version.

### Automatische Updates der Android-App

Die App lädt beim Start `version.json` von GitHub Pages. Ist der dort angegebene `versionCode`
(= GitHub-Actions-Laufnummer) größer als der installierte, bietet die App das Update an, lädt die APK herunter
und installiert sie über den Android-PackageInstaller. Beim ersten Update fragt Android einmalig nach der
Erlaubnis „Apps aus dieser Quelle installieren“; ab Android 12 laufen weitere Updates meist ohne Rückfrage.
Im Hauptmenü gibt es zusätzlich „Nach Updates suchen“.

**Signatur:** Updates funktionieren nur, wenn jede APK mit demselben Schlüssel signiert ist. Standardmäßig nutzt
die CI den Keystore `android/keystore/release.jks` aus dem Repository (Passwort `dustoff1968`) – bequem, aber
öffentlich. Für einen privaten Schlüssel die Secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` und `ANDROID_KEY_PASSWORD` anlegen. Achtung: Nach einem Schlüsselwechsel muss die App einmal
deinstalliert und neu installiert werden.
