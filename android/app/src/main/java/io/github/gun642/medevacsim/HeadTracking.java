package io.github.gun642.medevacsim;

import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;

import com.viture.sdk.ArCallback;
import com.viture.sdk.ArManager;
import com.viture.sdk.Constants;

import java.nio.ByteBuffer;
import java.util.Locale;

/**
 * Head-Tracking von XR-Brillen in das Spiel.
 * VITURE-Brillen (SDK 1.0.7): Die IMU liefert Euler-Winkel (Grad, Big-Endian-Floats: Rollen, Nicken, Gieren),
 * die als Bogenmaß an window.HotLZ_setHead(yaw, pitch, roll) gehen (begrenzt auf ca. 60 Hz).
 * Ohne Brille oder auf Geräten ohne Unterstützung bleibt alles ruhig.
 */
public final class HeadTracking {
    private static final String TAG = "HotLZHead";
    private static WebView web;
    private static final Handler ui = new Handler(Looper.getMainLooper());
    private static long last;
    private static ArManager ar;
    private static ArCallback cb;
    private static boolean ok;

    private HeadTracking() {}

    static void attach(WebView w) { web = w; }

    /** VITURE-SDK starten (Android 8+). Fehler werden abgefangen – das Spiel läuft auch ohne. */
    static void start(Context ctx) {
        if (Build.VERSION.SDK_INT < 26 || ar != null) return;
        try {
            ar = ArManager.getInstance(ctx.getApplicationContext());
            ok = ar.init() == Constants.ERROR_INIT_SUCCESS;
            cb = new ArCallback() {
                @Override
                public void onEvent(int msgId, byte[] event, long ts) {
                    if (msgId == Constants.EVENT_ID_INIT && event != null) {
                        int v = 0;
                        for (int i = 0; i < event.length && i < 4; i++) v |= (event[i] & 0xFF) << (8 * i);
                        ok = v == Constants.ERROR_INIT_SUCCESS;
                        if (ok) safeImuOn(true);
                    }
                }

                @Override
                public void onImu(long ts, byte[] imu) {
                    if (imu == null || imu.length < 12) return;
                    ByteBuffer b = ByteBuffer.wrap(imu);   // Big-Endian
                    float roll = b.getFloat(0), pitch = b.getFloat(4), yaw = b.getFloat(8);
                    final float d = (float) (Math.PI / 180.0);
                    push(yaw * d, pitch * d, roll * d);
                }
            };
            ar.registerCallback(cb);
            if (ok) safeImuOn(true);
        } catch (Throwable t) {
            Log.w(TAG, "VITURE-SDK nicht verfügbar: " + t);
            ar = null;
        }
    }

    private static void safeImuOn(boolean on) {
        try { if (ar != null) ar.setImuOn(on); } catch (Throwable t) { Log.w(TAG, "IMU: " + t); }
    }

    static void resume() {
        // Brille erst nach dem Start angesteckt: erneut verbinden
        try { if (ar != null && !ok) ok = ar.init() == Constants.ERROR_INIT_SUCCESS; } catch (Throwable t) { Log.w(TAG, "Init: " + t); }
        if (ok) safeImuOn(true);
    }
    static void pause() { if (ok) safeImuOn(false); }

    static void stop() {
        try { if (ar != null) { if (cb != null) ar.unregisterCallback(cb); ar.release(); } } catch (Throwable t) { Log.w(TAG, "Release: " + t); }
        ar = null; ok = false;
    }

    /** 3D-Modus der Brille (Side-by-Side 3840×1080) ein- oder ausschalten. */
    static boolean set3D(boolean on) {
        try { return ar != null && ok && ar.set3D(on) == Constants.ERR_SET_SUCCESS; } catch (Throwable t) { Log.w(TAG, "3D: " + t); return false; }
    }

    static boolean connected() { return ok; }

    /** Kopfhaltung übergeben: Gieren, Nicken, Rollen – jeweils in Bogenmaß. */
    public static void push(float yaw, float pitch, float roll) {
        final WebView w = web;
        long now = System.nanoTime();
        if (w == null || now - last < 15_000_000L) return;
        last = now;
        final String js = String.format(Locale.ROOT, "window.HotLZ_setHead&&window.HotLZ_setHead(%.5f,%.5f,%.5f)", yaw, pitch, roll);
        ui.post(() -> w.evaluateJavascript(js, null));
    }
}
