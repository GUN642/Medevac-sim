# Signaturschlüssel

`legacy-release.jks` ist der **alte, öffentlich bekannte** Schlüssel (Passwort stand im Repo).
Er wird nur noch für die Schlüsselrotation (APK Signature Scheme v3) gebraucht: Die CI signiert
jedes Release mit „alt → neu“, damit bereits installierte Apps das Update ohne Neuinstallation
annehmen. Updates, die nur mit dem alten Schlüssel signiert sind, lehnen Geräte ab Android 9
danach ab.

Der **neue** Schlüssel liegt nicht im Repository, sondern ausschließlich als Secrets in der
GitHub-Umgebung `release` (Settings → Environments → release):

- `ANDROID_KEYSTORE_BASE64` – Keystore-Datei, base64-kodiert
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
