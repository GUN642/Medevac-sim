package io.github.gun642.medevacsim;

import android.app.Activity;
import android.app.Presentation;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.hardware.display.DisplayManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Display;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;

/**
 * Spiel direkt auf der XR-Brille (zweites Display, wie in DEX reloaded) statt gespiegeltem Handybild.
 * Im 3D-Modus meldet die Brille 3840×1080: dann zeichnet das Spiel automatisch zwei Halbbilder in voller Breite.
 * Das Handy wird zur Touchfläche: Es zeigt eine Kopie des Brillenbilds (im 3D-Modus das linke Halbbild),
 * Berührungen gehen an die gleiche Stelle der WebView; Tasten und Controller ebenfalls.
 */
final class GlassDisplay {
    private static final String TAG = "HotLZGlass";
    private final Activity act;
    private final WebView web;
    private final FrameLayout phoneRoot;
    private final FrameLayout pad;
    private final ImageView shot;
    private Bitmap front, back;
    private boolean copying;
    private final DisplayManager dm;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private GamePresentation pres;
    private boolean enabled = true;
    volatile boolean stereo;
    private final Matrix m = new Matrix();

    GlassDisplay(Activity a, WebView w, FrameLayout root) {
        act = a; web = w; phoneRoot = root;
        dm = (DisplayManager) a.getSystemService(Context.DISPLAY_SERVICE);
        pad = new FrameLayout(a);
        pad.setBackgroundColor(Color.BLACK);
        TextView t = new TextView(a);
        t.setText("Hot LZ läuft auf der Brille.\nDieser Bildschirm ist die Touchfläche.");
        t.setTextColor(0x88E8F0D0);
        t.setTextSize(14);
        t.setGravity(Gravity.CENTER);
        pad.addView(t, new FrameLayout.LayoutParams(-1, -1));
        // Kopie des Brillenbilds, damit Menüs und Knöpfe auf dem Handy zu sehen sind
        shot = new ImageView(a);
        shot.setScaleType(ImageView.ScaleType.FIT_XY);
        pad.addView(shot, new FrameLayout.LayoutParams(-1, -1));
        pad.setOnTouchListener((v, e) -> forward(v, e));
        if (a instanceof MainActivity) ((MainActivity) a).mouse.attach(pad);
        dm.registerDisplayListener(listener, ui);
    }

    private final DisplayManager.DisplayListener listener = new DisplayManager.DisplayListener() {
        @Override public void onDisplayAdded(int id) { update(); }
        @Override public void onDisplayRemoved(int id) { update(); }
        @Override public void onDisplayChanged(int id) {
            // 2D/3D-Umschalten der Brille ändert die Auflösung: Presentation neu aufbauen
            if (pres != null && pres.getDisplay().getDisplayId() == id) {
                Display d = pres.getDisplay();
                if (d.getWidth() != pres.w || d.getHeight() != pres.h) { hide(); ui.postDelayed(GlassDisplay.this::update, 300); }
            }
        }
    };

    boolean active() { return pres != null; }
    View padView() { return pad; }

    // Brillenbild etwa 20-mal pro Sekunde auf das Handy kopieren
    private final Runnable copyLoop = new Runnable() {
        @Override public void run() {
            if (pres == null) return;
            ui.postDelayed(this, 50);
            if (Build.VERSION.SDK_INT < 26 || copying || pres.getWindow() == null) return;
            int pw = pad.getWidth(), ph = pad.getHeight();
            if (pw == 0 || ph == 0 || !pres.isShowing()) return;
            int bw = Math.max(320, pw / 2), bh = Math.max(180, ph / 2);
            if (back == null || back.getWidth() != bw || back.getHeight() != bh) back = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888);
            View dv = pres.getWindow().getDecorView();
            int ww = dv.getWidth(), wh = dv.getHeight();
            if (ww == 0 || wh == 0) return;
            Rect src = new Rect(0, 0, stereo ? ww / 2 : ww, wh);
            copying = true;
            final Bitmap target = back;
            try {
                PixelCopy.request(pres.getWindow(), src, target, (res) -> {
                    copying = false;
                    if (res != PixelCopy.SUCCESS || pres == null) return;
                    back = front;
                    front = target;
                    shot.setImageBitmap(front);
                }, ui);
            } catch (Throwable t) { copying = false; }
        }
    };

    void setEnabled(boolean on) { enabled = on; update(); }

    void update() {
        if (act.isFinishing()) return;
        Display d = null;
        try {
            Display[] ds = dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION);
            if (ds.length > 0) d = ds[0];
        } catch (Throwable ignored) { }
        if (!enabled || d == null) { hide(); return; }
        if (pres != null && pres.getDisplay().getDisplayId() == d.getDisplayId()) return;
        hide();
        try {
            GamePresentation p = new GamePresentation(act, d);
            p.setOnDismissListener((x) -> { if (pres == p) { pres = null; attachToPhone(); ui.postDelayed(this::update, 500); } });
            pres = p;
            p.show();
            ui.removeCallbacks(copyLoop);
            ui.postDelayed(copyLoop, 500);
        } catch (Throwable t) {
            Log.w(TAG, "Presentation fehlgeschlagen: " + t);
            pres = null;
            attachToPhone();
        }
    }

    void hide() {
        GamePresentation p = pres;
        pres = null;
        if (p != null) try { p.dismiss(); } catch (Throwable ignored) { }
        ui.removeCallbacks(copyLoop);
        shot.setImageDrawable(null);
        front = back = null;
        copying = false;
        attachToPhone();
    }

    void release() {
        try { dm.unregisterDisplayListener(listener); } catch (Throwable ignored) { }
        hide();
    }

    private void detach() {
        ViewGroup parent = (ViewGroup) web.getParent();
        if (parent != null) parent.removeView(web);
    }

    private void attachToPhone() {
        if (web.getParent() == phoneRoot) return;
        detach();
        if (pad.getParent() != null) ((ViewGroup) pad.getParent()).removeView(pad);
        phoneRoot.addView(web, new FrameLayout.LayoutParams(-1, -1));
        web.requestFocus();
    }

    /** Handy-Berührung auf die WebView auf der Brille umrechnen. */
    private boolean forward(View v, MotionEvent e) {
        if (pres == null || v.getWidth() == 0 || v.getHeight() == 0) return false;
        float sx = (float) web.getWidth() / v.getWidth() * (stereo ? 0.5f : 1f);
        float sy = (float) web.getHeight() / v.getHeight();
        MotionEvent c = MotionEvent.obtain(e);
        m.setScale(sx, sy);
        c.transform(m);
        web.dispatchTouchEvent(c);
        c.recycle();
        return true;
    }

    private class GamePresentation extends Presentation {
        int w, h;

        GamePresentation(Context outer, Display d) { super(outer, d); }

        @Override protected void onCreate(Bundle b) {
            super.onCreate(b);
            Display d = getDisplay();
            w = d.getWidth(); h = d.getHeight();
            if (getWindow() != null) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            FrameLayout f = new FrameLayout(getContext());
            f.setBackgroundColor(Color.BLACK);
            detach();
            f.addView(web, new FrameLayout.LayoutParams(-1, -1));
            setContentView(f);
            if (pad.getParent() == null) phoneRoot.addView(pad, new FrameLayout.LayoutParams(-1, -1));
            web.requestFocus();
        }
    }
}
