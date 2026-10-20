package io.github.gun642.medevacsim;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.LinkedBlockingQueue;

/**
 * LAN-Mehrspieler-Transport (reines Java, ohne Android-Abhängigkeiten).
 *
 * - Host: TCP-Server auf {@link #TCP_PORT}; meldet sich jede Sekunde per UDP-Broadcast
 *   auf {@link #UDP_PORT} ("DUST1 <port> <json>").
 * - Client: sucht per UDP nach Hosts und verbindet sich per TCP.
 * - Nachrichten sind JSON-Objekte, eine pro Zeile. Das Spiel holt eingegangene Nachrichten
 *   mit {@link #poll()} ab (Zeilen "peerId\tjson"); Peer 0 ist beim Client der Host.
 */
public class LanNet {
    public static final int TCP_PORT = 47790, UDP_PORT = 47791;
    private static final String POISON = "\u0000";

    private final ConcurrentLinkedQueue<String> inbox = new ConcurrentLinkedQueue<String>();
    private final Map<Integer, Conn> conns = new ConcurrentHashMap<Integer, Conn>();
    private final Map<String, String> hosts = new ConcurrentHashMap<String, String>();
    private final Map<String, Long> seen = new ConcurrentHashMap<String, Long>();
    private volatile ServerSocket server;
    private volatile DatagramSocket scanSock;
    private volatile boolean hosting, scanning;
    private volatile String beaconInfo = "{}";
    private volatile int port = TCP_PORT;
    private int nextId = 1;

    /** Eine TCP-Verbindung mit eigenem Lese- und Schreib-Thread. */
    private class Conn {
        final int id;
        final Socket s;
        final LinkedBlockingQueue<String> out = new LinkedBlockingQueue<String>();
        volatile boolean open = true;

        Conn(int id, Socket s) throws Exception {
            this.id = id;
            this.s = s;
            s.setTcpNoDelay(true);
            s.setKeepAlive(true);
            final BufferedReader r = new BufferedReader(new InputStreamReader(s.getInputStream(), "UTF-8"), 1 << 16);
            final BufferedWriter w = new BufferedWriter(new OutputStreamWriter(s.getOutputStream(), "UTF-8"), 1 << 16);
            new Thread(new Runnable() {
                public void run() {
                    try {
                        String line;
                        while (open && (line = r.readLine()) != null) {
                            if (line.length() > 1 && line.length() < 1000000 && line.charAt(0) == '{') push(Conn.this.id, line);
                        }
                    } catch (Exception ignored) {
                    } finally { close(true); }
                }
            }, "dustoff-read-" + id).start();
            new Thread(new Runnable() {
                public void run() {
                    try {
                        while (open) {
                            String m = out.take();
                            if (m == POISON) break;
                            w.write(m);
                            w.write('\n');
                            if (out.isEmpty()) w.flush();
                        }
                    } catch (Exception ignored) {
                    } finally { close(true); }
                }
            }, "dustoff-write-" + id).start();
        }

        void send(String m) { if (open) out.offer(m); }

        void close(boolean notify) {
            if (!open) return;
            open = false;
            out.offer(POISON);
            try { s.close(); } catch (Exception ignored) { }
            conns.remove(id);
            if (notify) push(id, "{\"t\":\"_leave\"}");
        }
    }

    private void push(int id, String json) { inbox.add(id + "\t" + json); }

    // ------------------------------------------------------------------ Host
    /** Startet den Server; liefert "ok:<ip>:<port>" oder "err:<grund>". */
    public synchronized String host(String info) {
        stop();
        beaconInfo = info;
        ServerSocket ss = null;
        for (int p = TCP_PORT; p < TCP_PORT + 10 && ss == null; p++) {
            try {
                ss = new ServerSocket();
                ss.setReuseAddress(true);
                ss.bind(new InetSocketAddress(p));
                port = p;
            } catch (Exception e) { try { if (ss != null) ss.close(); } catch (Exception ignored) { } ss = null; }
        }
        if (ss == null) return "err:Port belegt";
        server = ss;
        hosting = true;
        final ServerSocket srv = ss;
        new Thread(new Runnable() {
            public void run() {
                while (hosting) {
                    try {
                        Socket s = srv.accept();
                        int id;
                        synchronized (LanNet.this) { id = nextId++; }
                        conns.put(id, new Conn(id, s));
                        push(id, "{\"t\":\"_join\"}");
                    } catch (Exception e) {
                        if (!hosting) break;
                    }
                }
            }
        }, "dustoff-accept").start();
        new Thread(new Runnable() {
            public void run() {
                DatagramSocket ds = null;
                try {
                    ds = new DatagramSocket();
                    ds.setBroadcast(true);
                    while (hosting) {
                        byte[] b = ("DUST1 " + port + " " + beaconInfo).getBytes("UTF-8");
                        for (InetAddress a : broadcastAddresses()) {
                            try { ds.send(new DatagramPacket(b, b.length, a, UDP_PORT)); } catch (Exception ignored) { }
                        }
                        Thread.sleep(1000);
                    }
                } catch (Exception ignored) {
                } finally { if (ds != null) ds.close(); }
            }
        }, "dustoff-beacon").start();
        return "ok:" + localIp() + ":" + port;
    }

    public void setInfo(String info) { beaconInfo = info; }

    // ------------------------------------------------------------------ Client
    /** Verbindet sich im Hintergrund; Ergebnis kommt als Nachricht "_open" oder "_fail" von Peer 0. */
    public void join(final String ip, final int p) {
        stop();
        new Thread(new Runnable() {
            public void run() {
                try {
                    Socket s = new Socket();
                    s.connect(new InetSocketAddress(ip, p), 4000);
                    conns.put(0, new Conn(0, s));
                    push(0, "{\"t\":\"_open\"}");
                } catch (Exception e) {
                    push(0, "{\"t\":\"_fail\"}");
                }
            }
        }, "dustoff-join").start();
    }

    /** peer < 0: an alle Verbindungen. */
    public void send(int peer, String msg) {
        if (msg == null || msg.indexOf('\n') >= 0) return;
        if (peer < 0) { for (Conn c : conns.values()) c.send(msg); }
        else { Conn c = conns.get(peer); if (c != null) c.send(msg); }
    }

    public void kick(int peer) { Conn c = conns.get(peer); if (c != null) c.close(false); }

    /** Alle eingegangenen Nachrichten als Zeilen "peerId\tjson". */
    public String poll() {
        StringBuilder sb = new StringBuilder();
        String m;
        int n = 0;
        while (n < 2000 && (m = inbox.poll()) != null) { sb.append(m).append('\n'); n++; }
        return sb.toString();
    }

    // ------------------------------------------------------------------ Spielsuche
    public synchronized void scan(boolean on) {
        if (on == scanning) return;
        scanning = on;
        if (!on) { if (scanSock != null) scanSock.close(); return; }
        new Thread(new Runnable() {
            public void run() {
                DatagramSocket ds = null;
                try {
                    ds = new DatagramSocket(null);
                    ds.setReuseAddress(true);
                    ds.setBroadcast(true);
                    ds.bind(new InetSocketAddress(UDP_PORT));
                    ds.setSoTimeout(1000);
                    scanSock = ds;
                    byte[] buf = new byte[4096];
                    while (scanning) {
                        try {
                            DatagramPacket pk = new DatagramPacket(buf, buf.length);
                            ds.receive(pk);
                            String s = new String(pk.getData(), 0, pk.getLength(), "UTF-8");
                            if (!s.startsWith("DUST1 ")) continue;
                            int sp = s.indexOf(' ', 6);
                            if (sp < 0) continue;
                            int p = Integer.parseInt(s.substring(6, sp));
                            String info = s.substring(sp + 1);
                            if (!info.startsWith("{")) continue;
                            String key = pk.getAddress().getHostAddress() + ":" + p;
                            hosts.put(key, info);
                            seen.put(key, System.currentTimeMillis());
                        } catch (java.net.SocketTimeoutException ignored) { }
                    }
                } catch (Exception ignored) {
                } finally { if (ds != null) ds.close(); scanning = false; }
            }
        }, "dustoff-scan").start();
    }

    /** Gefundene Spiele der letzten 4 Sekunden als JSON-Array. */
    public String hostsJson() {
        long now = System.currentTimeMillis();
        StringBuilder sb = new StringBuilder("[");
        for (Map.Entry<String, String> e : hosts.entrySet()) {
            Long t = seen.get(e.getKey());
            if (t == null || now - t > 4000) continue;
            String k = e.getKey();
            int c = k.lastIndexOf(':');
            if (sb.length() > 1) sb.append(',');
            sb.append("{\"ip\":\"").append(k.substring(0, c)).append("\",\"port\":").append(k.substring(c + 1))
              .append(",\"info\":").append(e.getValue()).append('}');
        }
        return sb.append(']').toString();
    }

    // ------------------------------------------------------------------ Aufräumen
    public synchronized void stop() {
        hosting = false;
        if (server != null) { try { server.close(); } catch (Exception ignored) { } server = null; }
        for (Conn c : new ArrayList<Conn>(conns.values())) c.close(false);
        conns.clear();
        inbox.clear();
    }

    public void shutdown() { stop(); scan(false); }

    // ------------------------------------------------------------------ Hilfen
    static List<InetAddress> broadcastAddresses() {
        List<InetAddress> out = new ArrayList<InetAddress>();
        try { out.add(InetAddress.getByName("255.255.255.255")); } catch (Exception ignored) { }
        try {
            Enumeration<NetworkInterface> en = NetworkInterface.getNetworkInterfaces();
            while (en != null && en.hasMoreElements()) {
                NetworkInterface ni = en.nextElement();
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    InetAddress b = ia.getBroadcast();
                    if (b != null && !out.contains(b)) out.add(b);
                }
            }
        } catch (Exception ignored) { }
        return out;
    }

    public static String localIp() {
        try {
            Enumeration<NetworkInterface> en = NetworkInterface.getNetworkInterfaces();
            String fallback = null;
            while (en != null && en.hasMoreElements()) {
                NetworkInterface ni = en.nextElement();
                if (!ni.isUp() || ni.isLoopback()) continue;
                Enumeration<InetAddress> as = ni.getInetAddresses();
                while (as.hasMoreElements()) {
                    InetAddress a = as.nextElement();
                    if (!(a instanceof Inet4Address)) continue;
                    if (a.isSiteLocalAddress()) return a.getHostAddress();
                    if (fallback == null) fallback = a.getHostAddress();
                }
            }
            return fallback != null ? fallback : "?";
        } catch (Exception e) { return "?"; }
    }
}
