package io.github.gun642.medevacsim;

import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.WebView;

import java.util.Locale;

/**
 * Maus einfangen (Pointer Capture, Android 8+): Die WebView kennt kein Pointer Lock, daher fängt die App
 * die Maus bzw. das Touchpad (z. B. Nexdock) selbst ein und gibt relative Bewegung, Tasten und Mausrad
 * gebündelt an window.HotLZ_mouse(dx, dy, buttons, wheel) weiter. Zeiger ist dabei unsichtbar.
 */
final class MouseCapture {
    private final WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private float dx, dy, wheel, lastX = Float.NaN, lastY = Float.NaN;
    private int buttons;
    private boolean scheduled, sentButtons = true;
    private View target;

    MouseCapture(WebView web) { this.web = web; }

    static boolean supported() { return Build.VERSION.SDK_INT >= 26; }

    /** Listener an eine View hängen (WebView bzw. Handy-Touchfläche im Brillenbetrieb). */
    void attach(View v) {
        if (Build.VERSION.SDK_INT < 26) return;
        v.setFocusable(true);
        v.setFocusableInTouchMode(true);
        v.setOnCapturedPointerListener((view, ev) -> { onEvent(ev); return true; });
    }

    /** Einfangen an der View, die gerade den Fokus haben kann; true wenn möglich. */
    boolean capture(View v, boolean on) {
        if (Build.VERSION.SDK_INT < 26) return false;
        if (on) {
            target = v;
            v.requestFocus();
            v.requestPointerCapture();
        } else if (target != null) {
            target.releasePointerCapture();
            target = null;
        }
        return true;
    }

    void onEvent(MotionEvent ev) {
        if (Build.VERSION.SDK_INT < 26) return;
        boolean touchpad = (ev.getSource() & InputDevice.SOURCE_TOUCHPAD) == InputDevice.SOURCE_TOUCHPAD;
        int act = ev.getActionMasked();
        if (act == MotionEvent.ACTION_SCROLL) {
            wheel += ev.getAxisValue(MotionEvent.AXIS_VSCROLL);
        } else if (touchpad) {
            // Touchpad liefert absolute Fingerpositionen: Differenzen bilden
            float x = ev.getX(), y = ev.getY();
            if (act == MotionEvent.ACTION_DOWN || Float.isNaN(lastX)) { lastX = x; lastY = y; }
            else if (act == MotionEvent.ACTION_MOVE) { dx += (x - lastX); dy += (y - lastY); lastX = x; lastY = y; }
            if (act == MotionEvent.ACTION_UP || act == MotionEvent.ACTION_CANCEL) { lastX = Float.NaN; lastY = Float.NaN; }
        } else {
            // Maus: relative Bewegung, auch gebündelte Zwischenwerte
            for (int h = 0; h < ev.getHistorySize(); h++) { dx += ev.getHistoricalX(h); dy += ev.getHistoricalY(h); }
            dx += ev.getX(); dy += ev.getY();
        }
        int b = ev.getButtonState();
        if (b != buttons) { buttons = b; sentButtons = false; }
        if (!scheduled) { scheduled = true; ui.postDelayed(this::flush, 8); }
    }

    private void flush() {
        scheduled = false;
        if (dx == 0 && dy == 0 && wheel == 0 && sentButtons) return;
        String js = String.format(Locale.ROOT, "window.HotLZ_mouse&&window.HotLZ_mouse(%.2f,%.2f,%d,%.2f)", dx, dy, buttons, wheel);
        dx = 0; dy = 0; wheel = 0; sentButtons = true;
        web.evaluateJavascript(js, null);
    }

    /** Einfangen beendet (Fokusverlust, Esc vom System): Spiel informieren. */
    void lost(boolean has) {
        web.evaluateJavascript("window.HotLZ_mouseLock&&window.HotLZ_mouseLock(" + has + ")", null);
        if (!has) { buttons = 0; target = null; }
    }
}
