package io.github.gun642.medevacsim;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Automatische Update-Prüfung: lädt version.json von GitHub Pages, vergleicht den versionCode,
 * lädt bei Bedarf die neue APK herunter und installiert sie über den PackageInstaller.
 */
public class UpdateManager {
    private static final String PREFS = "updates";
    private static final long AUTO_INTERVAL_MS = 60 * 1000L;

    private final Activity act;
    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean busy;
    private File pendingApk;
    private AlertDialog progressDialog;
    private ProgressBar progressBar;
    private TextView progressText;

    public UpdateManager(Activity act) {
        this.act = act;
    }

    /** Prüft auf Updates. manual=true zeigt auch "keine Updates"-Meldungen und Fehler. */
    public void check(final boolean manual) {
        if (busy) return;
        final SharedPreferences prefs = act.getSharedPreferences(PREFS, 0);
        if (!manual && System.currentTimeMillis() - prefs.getLong("lastAuto", 0) < AUTO_INTERVAL_MS) return;
        prefs.edit().putLong("lastAuto", System.currentTimeMillis()).apply();
        busy = true;
        new Thread(() -> {
            try {
                String base = BuildConfig.UPDATE_URL;
                JSONObject j = new JSONObject(new String(httpGet(base + "?t=" + System.currentTimeMillis()), "UTF-8"));
                final int code = j.getInt("versionCode");
                final String name = j.optString("versionName", String.valueOf(code));
                final String notes = j.optString("notes", "");
                final String apk = new URL(new URL(base), j.getString("apkUrl")).toString();
                final int skipped = prefs.getInt("skipped", -1);
                main.post(() -> {
                    busy = false;
                    if (code > BuildConfig.VERSION_CODE && (manual || code != skipped)) offer(code, name, notes, apk);
                    else if (manual) toast("Sie haben bereits die neueste Version (" + BuildConfig.VERSION_NAME + ").");
                });
            } catch (Exception e) {
                main.post(() -> {
                    busy = false;
                    if (manual) toast("Update-Prüfung fehlgeschlagen: " + e.getMessage());
                });
            }
        }).start();
    }

    private void offer(final int code, String name, String notes, final String apkUrl) {
        if (act.isFinishing()) return;
        String msg = "Version " + name + " ist verfügbar.\nInstalliert: " + BuildConfig.VERSION_NAME;
        if (notes != null && !notes.isEmpty()) msg += "\n\n" + notes;
        new AlertDialog.Builder(act)
                .setTitle("Update verfügbar")
                .setMessage(msg)
                .setCancelable(true)
                .setPositiveButton("Jetzt installieren", (d, w) -> download(apkUrl))
                .setNegativeButton("Später", null)
                .setNeutralButton("Überspringen", (d, w) ->
                        act.getSharedPreferences(PREFS, 0).edit().putInt("skipped", code).apply())
                .show();
    }

    private void download(final String apkUrl) {
        showProgress();
        busy = true;
        new Thread(() -> {
            final File out = new File(act.getCacheDir(), "update.apk");
            try {
                HttpURLConnection c = open(apkUrl);
                int total = c.getContentLength();
                try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(out)) {
                    byte[] buf = new byte[64 * 1024];
                    long done = 0;
                    int n, lastPct = -1;
                    while ((n = in.read(buf)) > 0) {
                        os.write(buf, 0, n);
                        done += n;
                        final int pct = total > 0 ? (int) (done * 100 / total) : -1;
                        if (pct != lastPct) {
                            lastPct = pct;
                            final long d = done;
                            main.post(() -> setProgress(pct, d));
                        }
                    }
                } finally {
                    c.disconnect();
                }
                main.post(() -> {
                    busy = false;
                    hideProgress();
                    install(out);
                });
            } catch (Exception e) {
                main.post(() -> {
                    busy = false;
                    hideProgress();
                    toast("Download fehlgeschlagen: " + e.getMessage());
                });
            }
        }).start();
    }

    private void install(File apk) {
        if (Build.VERSION.SDK_INT >= 26 && !act.getPackageManager().canRequestPackageInstalls()) {
            pendingApk = apk;
            new AlertDialog.Builder(act)
                    .setTitle("Installation erlauben")
                    .setMessage("Damit sich Dustoff selbst aktualisieren kann, erlauben Sie bitte im nächsten Bildschirm „Apps aus dieser Quelle installieren“. Danach geht es automatisch weiter.")
                    .setPositiveButton("Einstellungen öffnen", (d, w) -> {
                        try {
                            act.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                    Uri.parse("package:" + act.getPackageName())));
                        } catch (Exception e) {
                            toast("Einstellungen konnten nicht geöffnet werden.");
                        }
                    })
                    .setNegativeButton("Abbrechen", (d, w) -> pendingApk = null)
                    .show();
            return;
        }
        installWithSession(apk);
    }

    /** Wird aus MainActivity.onResume aufgerufen (Rückkehr aus den Einstellungen). */
    public void onResume() {
        if (pendingApk == null) return;
        if (Build.VERSION.SDK_INT < 26 || act.getPackageManager().canRequestPackageInstalls()) {
            File f = pendingApk;
            pendingApk = null;
            installWithSession(f);
        }
    }

    private void installWithSession(final File apk) {
        new Thread(() -> {
            try {
                PackageInstaller pi = act.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params =
                        new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(act.getPackageName());
                if (Build.VERSION.SDK_INT >= 31) {
                    // Ab Android 12 ohne Rückfrage, wenn die App sich selbst aktualisiert
                    params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
                }
                int id = pi.createSession(params);
                try (PackageInstaller.Session session = pi.openSession(id)) {
                    try (InputStream in = new FileInputStream(apk);
                         OutputStream out = session.openWrite("update.apk", 0, apk.length())) {
                        byte[] buf = new byte[64 * 1024];
                        int n;
                        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                        session.fsync(out);
                    }
                    Intent cb = new Intent(act, InstallReceiver.class);
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
                    PendingIntent pIntent = PendingIntent.getBroadcast(act, id, cb, flags);
                    session.commit(pIntent.getIntentSender());
                }
                main.post(() -> toast("Update wird installiert …"));
            } catch (Exception e) {
                main.post(() -> toast("Installation fehlgeschlagen: " + e.getMessage()));
            }
        }).start();
    }

    // ------------------------------------------------------------------ Hilfen
    private static HttpURLConnection open(String url) throws IOException {
        String u = url;
        for (int i = 0; i < 6; i++) {
            HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("Cache-Control", "no-cache");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) {
                String loc = c.getHeaderField("Location");
                c.disconnect();
                if (loc == null) throw new IOException("Weiterleitung ohne Ziel");
                u = new URL(new URL(u), loc).toString();
                continue;
            }
            if (code != 200) {
                c.disconnect();
                throw new IOException("HTTP " + code);
            }
            return c;
        }
        throw new IOException("Zu viele Weiterleitungen");
    }

    private static byte[] httpGet(String url) throws IOException {
        HttpURLConnection c = open(url);
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            return bos.toByteArray();
        } finally {
            c.disconnect();
        }
    }

    private void showProgress() {
        LinearLayout box = new LinearLayout(act);
        box.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (20 * act.getResources().getDisplayMetrics().density);
        box.setPadding(pad, pad, pad, pad);
        progressBar = new ProgressBar(act, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setIndeterminate(true);
        progressText = new TextView(act);
        progressText.setText("Lade Update …");
        box.addView(progressText);
        box.addView(progressBar);
        progressDialog = new AlertDialog.Builder(act).setTitle("Update wird geladen").setView(box).setCancelable(false).show();
    }

    private void setProgress(int pct, long bytes) {
        if (progressBar == null) return;
        if (pct >= 0) {
            progressBar.setIndeterminate(false);
            progressBar.setProgress(pct);
            progressText.setText("Lade Update … " + pct + " %");
        } else {
            progressText.setText("Lade Update … " + (bytes / 1024) + " KB");
        }
    }

    private void hideProgress() {
        if (progressDialog != null && progressDialog.isShowing()) progressDialog.dismiss();
        progressDialog = null;
        progressBar = null;
    }

    private void toast(String s) {
        Toast.makeText(act, s, Toast.LENGTH_LONG).show();
    }
}
