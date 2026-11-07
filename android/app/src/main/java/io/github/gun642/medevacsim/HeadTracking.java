package io.github.gun642.medevacsim;

import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import java.util.Locale;

/**
 * Brücke für Head-Tracking von XR-Brillen (z. B. VITURE) in das Spiel.
 * Ein Brillen-SDK ruft {@link #push(float, float, float)} mit der Kopfhaltung (Bogenmaß) auf,
 * das Spiel empfängt die Werte über window.HotLZ_setHead(yaw, pitch, roll).
 * Senderate wird auf ca. 60 Hz begrenzt.
 */
public final class HeadTracking {
    private static WebView web;
    private static final Handler ui = new Handler(Looper.getMainLooper());
    private static long last;

    private HeadTracking() {}

    static void attach(WebView w) { web = w; }

    /** Kopfhaltung übergeben: Gieren (links +), Nicken (hoch +), Rollen – jeweils in Bogenmaß. */
    public static void push(float yaw, float pitch, float roll) {
        final WebView w = web;
        long now = System.nanoTime();
        if (w == null || now - last < 15_000_000L) return;
        last = now;
        final String js = String.format(Locale.ROOT, "window.HotLZ_setHead&&window.HotLZ_setHead(%.5f,%.5f,%.5f)", yaw, pitch, roll);
        ui.post(() -> w.evaluateJavascript(js, null));
    }
}
