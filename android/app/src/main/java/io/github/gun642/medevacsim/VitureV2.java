package io.github.gun642.medevacsim;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.SystemClock;
import android.util.Log;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Kopfausrichtung neuer VITURE-Brillen (Pro 2 u. a., Protokoll V2) direkt über USB-HID, ohne Hersteller-SDK.
 * Protokoll nach viture-v2 von Holger Bartnick (MIT), PROTOCOL.md; Vorgehen wie in DEX reloaded (VitureImu.kt).
 * Rahmen little-endian: Präambel 0x0010, MsgID, Nutzlastlänge, Prüfsumme (Bytesumme), Nutzlast.
 * 0x0301 [Strom, Rate] schaltet den Datenstrom, 0x7308 liefert die Lage als Quaternion (w, x, y, z ab Byte 8).
 */
final class VitureV2 {
    private static final String TAG = "HotLZV2";
    static final int VENDOR_ID = 0x35CA;
    private static final int MSG_IMU_CTRL = 0x0301;
    private static final int MSG_POSE = 0x7308;
    private static final byte STREAM_POSE = 1, RATE_240 = 3;

    interface Listener { void onPose(float w, float x, float y, float z); }

    private final UsbManager usb;
    private final Listener listener;
    private volatile Thread thread;
    volatile long samples;

    VitureV2(UsbManager usb, Listener l) { this.usb = usb; this.listener = l; }

    /** VITURE-Brille mit nur einer HID-Schnittstelle = Protokoll V2 (die alten Modelle haben zwei). */
    static boolean isV2(UsbDevice d) {
        if (d == null || d.getVendorId() != VENDOR_ID) return false;
        int hid = 0;
        for (int i = 0; i < d.getInterfaceCount(); i++) if (d.getInterface(i).getInterfaceClass() == UsbConstants.USB_CLASS_HID) hid++;
        return hid == 1 || d.getProductId() == 0x1301;
    }

    boolean running() { Thread t = thread; return t != null && t.isAlive(); }

    void start(UsbDevice dev) {
        if (running()) return;
        Thread t = new Thread(() -> run(dev), "viture-v2");
        thread = t;
        t.start();
    }

    void stop() {
        Thread t = thread;
        thread = null;
        if (t != null) t.interrupt();
    }

    private void run(UsbDevice dev) {
        Thread me = Thread.currentThread();
        UsbDeviceConnection conn = null;
        UsbInterface intf = null;
        try {
            conn = usb.openDevice(dev);
            if (conn == null) throw new IllegalStateException("openDevice lieferte null");
            for (int i = 0; i < dev.getInterfaceCount() && intf == null; i++)
                if (dev.getInterface(i).getInterfaceClass() == UsbConstants.USB_CLASS_HID) intf = dev.getInterface(i);
            if (intf == null) throw new IllegalStateException("Kein HID-Interface");
            if (!conn.claimInterface(intf, true)) throw new IllegalStateException("claimInterface fehlgeschlagen");
            UsbEndpoint in = null, out = null;
            for (int i = 0; i < intf.getEndpointCount(); i++) {
                UsbEndpoint ep = intf.getEndpoint(i);
                if (ep.getDirection() == UsbConstants.USB_DIR_IN) in = ep; else out = ep;
            }
            if (in == null || out == null) throw new IllegalStateException("Endpunkte fehlen");
            send(conn, out, frame(MSG_IMU_CTRL, new byte[] { STREAM_POSE, RATE_240 }));
            byte[] buf = new byte[Math.max(64, in.getMaxPacketSize())];
            long lastData = SystemClock.elapsedRealtime(), lastCmd = lastData;
            while (!me.isInterrupted() && thread == me) {
                int n = conn.bulkTransfer(in, buf, buf.length, 200);
                long now = SystemClock.elapsedRealtime();
                if (n > 0 && parse(buf, n)) lastData = now;
                // kommen keine Daten, den Datenstrom erneut anfordern
                if (now - lastData > 2000 && now - lastCmd > 2000) {
                    send(conn, out, frame(MSG_IMU_CTRL, new byte[] { STREAM_POSE, RATE_240 }));
                    lastCmd = now;
                }
            }
            try { send(conn, out, frame(MSG_IMU_CTRL, new byte[] { 0, 0 })); } catch (Throwable ignored) { }
        } catch (Throwable e) {
            Log.w(TAG, "IMU-Fehler: " + e);
        } finally {
            if (conn != null) {
                try { if (intf != null) conn.releaseInterface(intf); } catch (Throwable ignored) { }
                conn.close();
            }
            if (thread == me) thread = null;
        }
    }

    private static void send(UsbDeviceConnection c, UsbEndpoint ep, byte[] data) {
        if (c.bulkTransfer(ep, data, data.length, 500) < 0) Log.w(TAG, "Senden fehlgeschlagen");
    }

    /** Wertet alle Rahmen im Puffer aus; true, wenn eine Lage dabei war. */
    private boolean parse(byte[] buf, int len) {
        ByteBuffer bb = ByteBuffer.wrap(buf, 0, len).order(ByteOrder.LITTLE_ENDIAN);
        int pos = 0;
        boolean got = false;
        while (pos + 8 <= len) {
            if ((bb.getShort(pos) & 0xFFFF) != 0x0010) break;
            int msg = bb.getShort(pos + 2) & 0xFFFF, plen = bb.getShort(pos + 4) & 0xFFFF, p = pos + 8;
            if (p + plen > len) break;
            if (msg == MSG_POSE && plen >= 24) {
                float w = bb.getFloat(p + 8), x = bb.getFloat(p + 12), y = bb.getFloat(p + 16), z = bb.getFloat(p + 20);
                if (Float.isFinite(w) && Float.isFinite(x) && Float.isFinite(y) && Float.isFinite(z)) {
                    samples++;
                    got = true;
                    listener.onPose(w, x, y, z);
                }
            }
            if (plen == 0 && msg == 0) break;
            pos = p + plen;
        }
        return got;
    }

    private static byte[] frame(int msgId, byte[] payload) {
        int sum = 0;
        for (byte b : payload) sum += b & 0xFF;
        ByteBuffer o = ByteBuffer.allocate(8 + payload.length).order(ByteOrder.LITTLE_ENDIAN);
        o.putShort((short) 0x0010).putShort((short) msgId).putShort((short) payload.length).putShort((short) (sum & 0xFFFF)).put(payload);
        return o.array();
    }
}
