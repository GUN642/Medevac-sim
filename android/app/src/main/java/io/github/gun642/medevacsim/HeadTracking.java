package io.github.gun642.medevacsim;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
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
 * Neue VITURE-Brillen (Pro 2 u. a., Protokoll V2): direkt über USB (VitureV2), Lage als Quaternion.
 * Alte VITURE-Brillen (One/Pro/Lite, SDK 1.0.7): Die IMU liefert Euler-Winkel (Grad, Big-Endian-Floats: Rollen, Nicken, Gieren).
 * Beides geht als Bogenmaß an window.HotLZ_setHead(yaw, pitch, roll) (begrenzt auf ca. 60 Hz).
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
    private static final String ACTION_PERMISSION = "io.github.gun642.medevacsim.USB_PERMISSION";
    private static Context app;
    private static UsbManager usb;
    private static VitureV2 v2;
    private static boolean asked;
    private static BroadcastReceiver receiver;
    // Lage der V2-Brille: Bezug (Neutralstellung) und aktuelle Lage als Quaternion (w, x, y, z)
    private static final float[] ref = new float[4], rel = new float[4];
    private static boolean hasRef;
    private static volatile boolean recenterReq;

    private HeadTracking() {}

    static void attach(WebView w) { web = w; }

    /** Head-Tracking starten. Fehler werden abgefangen – das Spiel läuft auch ohne Brille. */
    static void start(Context ctx) {
        if (app != null) return;
        app = ctx.getApplicationContext();
        try {
            usb = (UsbManager) app.getSystemService(Context.USB_SERVICE);
            if (usb != null) {
                v2 = new VitureV2(usb, HeadTracking::onPose);
                receiver = new BroadcastReceiver() {
                    @Override public void onReceive(Context c, Intent i) {
                        String a = i.getAction();
                        if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(a)) {
                            if (findV2() == null) { v2.stop(); asked = false; }
                        } else checkUsb(ACTION_PERMISSION.equals(a));
                    }
                };
                IntentFilter f = new IntentFilter(ACTION_PERMISSION);
                f.addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED);
                f.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
                if (Build.VERSION.SDK_INT >= 33) app.registerReceiver(receiver, f, Context.RECEIVER_EXPORTED);
                else app.registerReceiver(receiver, f);
            }
        } catch (Throwable t) { Log.w(TAG, "USB nicht verfügbar: " + t); }
        checkUsb(false);
    }

    private static UsbDevice findV2() {
        try { for (UsbDevice d : usb.getDeviceList().values()) if (VitureV2.isV2(d)) return d; } catch (Throwable ignored) { }
        return null;
    }

    /** Angesteckte Brille prüfen: neue Modelle direkt über USB, sonst das SDK für die alten. */
    private static void checkUsb(boolean fromPermission) {
        UsbDevice d = usb != null && v2 != null ? findV2() : null;
        if (d == null) { startSdk(); return; }
        if (ar != null) stopSdk();                  // altes SDK gibt die Brille frei
        try {
            if (usb.hasPermission(d)) { v2.start(d); return; }
            if (fromPermission || asked) return;      // abgelehnt: erst nach erneutem Anstecken wieder fragen
            asked = true;
            Intent i = new Intent(ACTION_PERMISSION).setPackage(app.getPackageName());
            int fl = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
            usb.requestPermission(d, PendingIntent.getBroadcast(app, 0, i, fl));
        } catch (Throwable t) { Log.w(TAG, "V2: " + t); }
    }

    /** Lage der V2-Brille in Gieren/Nicken/Rollen relativ zur Neutralstellung umrechnen. */
    private static void onPose(float w, float x, float y, float z) {
        synchronized (ref) {
            if (recenterReq || !hasRef) { ref[0] = w; ref[1] = x; ref[2] = y; ref[3] = z; hasRef = true; recenterReq = false; }
            // rel = conj(ref) * q
            float aw = ref[0], ax = -ref[1], ay = -ref[2], az = -ref[3];
            rel[0] = aw * w - ax * x - ay * y - az * z;
            rel[1] = aw * x + ax * w + ay * z - az * y;
            rel[2] = aw * y - ax * z + ay * w + az * x;
            rel[3] = aw * z + ax * y - ay * x + az * w;
        }
        // Achsen der Brille wie in DEX reloaded: hoch = +Y, rechts = +X, vorn = hoch × rechts = −Z
        float[] f = rot(rel, 0, 0, -1), u = rot(rel, 0, 1, 0);
        float yawRight = (float) Math.atan2(f[0], -f[2]);
        float pitchUp = (float) Math.asin(Math.max(-1f, Math.min(1f, f[1])));
        float rollRight = (float) Math.atan2(u[0], u[1]);
        // Spiel: positives Gieren = nach links, positives Rollen = gegen den Uhrzeigersinn
        push(-yawRight, pitchUp, -rollRight);
    }

    private static float[] rot(float[] q, float vx, float vy, float vz) {
        float w = q[0], x = q[1], y = q[2], z = q[3];
        float tx = 2f * (y * vz - z * vy), ty = 2f * (z * vx - x * vz), tz = 2f * (x * vy - y * vx);
        return new float[] { vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx) };
    }

    /** Neutralstellung auf die aktuelle Kopfhaltung setzen (V2-Brille); true, wenn die V2-Brille das übernimmt. */
    static boolean recenter() {
        if (v2 == null || !v2.running()) return false;
        recenterReq = true;
        return true;
    }

    private static void stopSdk() {
        try { if (ar != null) { if (cb != null) ar.unregisterCallback(cb); ar.release(); } } catch (Throwable t) { Log.w(TAG, "Release: " + t); }
        ar = null; ok = false;
    }

    /** VITURE-SDK für alte Brillen starten (Android 8+). */
    private static void startSdk() {
        if (Build.VERSION.SDK_INT < 26 || ar != null || app == null) return;
        Context ctx = app;
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
        checkUsb(false);
        if (v2 != null && v2.running()) return;
        // Brille erst nach dem Start angesteckt: erneut verbinden
        try { if (ar != null && !ok) ok = ar.init() == Constants.ERROR_INIT_SUCCESS; } catch (Throwable t) { Log.w(TAG, "Init: " + t); }
        if (ok) safeImuOn(true);
    }
    static void pause() { if (ok) safeImuOn(false); if (v2 != null) v2.stop(); }

    static void stop() {
        stopSdk();
        if (v2 != null) v2.stop();
        try { if (receiver != null) app.unregisterReceiver(receiver); } catch (Throwable ignored) { }
        receiver = null; app = null; v2 = null; asked = false;
    }

    /** 3D-Modus der Brille (Side-by-Side 3840×1080) ein- oder ausschalten. */
    static boolean set3D(boolean on) {
        try { return ar != null && ok && ar.set3D(on) == Constants.ERR_SET_SUCCESS; } catch (Throwable t) { Log.w(TAG, "3D: " + t); return false; }
    }

    static boolean connected() { return ok || (v2 != null && v2.running()); }

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
