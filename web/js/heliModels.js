// Detaillierte Hubschraubermodelle: UH-1D, UH-60 Black Hawk, CH-47 Chinook, CH-53GS
// Rumpf als glatte Querschnittsform mit Lackierungstextur, echte Tür- und Fensteröffnungen mit Verglasung,
// Innenraum mit Cockpit, Sitzen und Instrumenten. Schnittstelle: group, body, glass, spin, guns, pilots, seats, eyePilot, exhaust
import * as THREE from './lib/three.module.min.js';
import { P, merge, Figure, COL, textTexture, m60Geo } from './models.js';
import { loft, mergeUV, plate, paintTexture, paintMaterial, sectionAt } from './loft.js';
import { T } from './theme.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 14) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
const tor = (r, t, s = 12) => new THREE.TorusGeometry(r, t, 6, s);
const HALFPI = Math.PI / 2, PI = Math.PI;

export const detailMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 18, specular: 0x1c1c1c, side: THREE.DoubleSide });
const glassMat = new THREE.MeshPhongMaterial({
  color: 0x6f8794, transparent: true, opacity: 0.22, shininess: 120, specular: 0xffffff, side: THREE.DoubleSide, depthWrite: false,
});
const discMatProto = new THREE.MeshBasicMaterial({ color: 0x202020, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });

// ---------------------------------------------------------------- Instrumententafel
// Statische Textur: 'analog' (Rundinstrumente, ältere Muster) oder 'glass' (Bildschirme, moderne Muster)
const panelTex = {};
function instrumentTexture(style) {
  if (panelTex[style]) return panelTex[style];
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 320;
  const x = c.getContext('2d');
  x.fillStyle = '#1c1f1e'; x.fillRect(0, 0, 1024, 320);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const screw = (cx, cy) => { x.fillStyle = '#4a4d4a'; x.beginPath(); x.arc(cx, cy, 3, 0, 7); x.fill(); };
  const attitude = (cx, cy, r) => {
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip();
    x.fillStyle = '#3d7fc0'; x.fillRect(cx - r, cy - r, 2 * r, r + 4);
    x.fillStyle = '#7a4a22'; x.fillRect(cx - r, cy + 4, 2 * r, r);
    x.strokeStyle = '#fff'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(cx - r, cy + 4); x.lineTo(cx + r, cy + 4); x.stroke();
    for (const d of [-24, -12, 12, 24]) { x.beginPath(); x.moveTo(cx - r * 0.25, cy + 4 + d); x.lineTo(cx + r * 0.25, cy + 4 + d); x.stroke(); }
    x.restore();
    x.strokeStyle = '#f2c230'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(cx - r * 0.55, cy); x.lineTo(cx - r * 0.15, cy); x.lineTo(cx, cy + 8); x.lineTo(cx + r * 0.15, cy); x.lineTo(cx + r * 0.55, cy); x.stroke();
  };
  if (style === 'glass') {
    // Bildschirme (MFD) mit Tastenrahmen
    const mfd = (mx, my, w, h, kind) => {
      x.fillStyle = '#2b2f2e'; x.fillRect(mx - 14, my - 12, w + 28, h + 24);
      for (let i = 0; i < 5; i++) { x.fillStyle = '#585c58'; x.fillRect(mx - 11, my + 8 + i * (h - 16) / 4.5, 8, 10); x.fillRect(mx + w + 3, my + 8 + i * (h - 16) / 4.5, 8, 10); }
      x.fillStyle = '#05080a'; x.fillRect(mx, my, w, h);
      const cx = mx + w / 2, cy = my + h / 2;
      if (kind === 'pfd') {
        x.save(); x.beginPath(); x.rect(mx, my, w, h); x.clip();
        x.fillStyle = '#2f6fb4'; x.fillRect(mx, my, w, h * 0.52);
        x.fillStyle = '#7c4e24'; x.fillRect(mx, my + h * 0.52, w, h);
        x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(mx, my + h * 0.52); x.lineTo(mx + w, my + h * 0.52); x.stroke();
        for (const d of [-36, -18, 18, 36]) { x.beginPath(); x.moveTo(cx - 18, my + h * 0.52 + d); x.lineTo(cx + 18, my + h * 0.52 + d); x.stroke(); }
        x.restore();
        x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(mx + 4, my + 20, 34, h - 40); x.fillRect(mx + w - 38, my + 20, 34, h - 40);
        x.fillStyle = '#e8e8e8'; x.font = 'bold 13px Arial';
        for (let i = 0; i < 6; i++) { x.fillText(String(120 - i * 20), mx + 7, my + 34 + i * (h - 50) / 5); x.fillText(String(800 - i * 100), mx + w - 36, my + 34 + i * (h - 50) / 5); }
        x.strokeStyle = '#f2c230'; x.lineWidth = 4;
        x.beginPath(); x.moveTo(cx - 34, cy + 6); x.lineTo(cx - 10, cy + 6); x.moveTo(cx + 10, cy + 6); x.lineTo(cx + 34, cy + 6); x.stroke();
        x.fillStyle = '#000'; x.fillRect(mx + 4, my + h - 22, w - 8, 18);
        x.fillStyle = '#e8e8e8'; x.font = '12px Arial'; for (let i = 0; i < 7; i++) x.fillText(['33', 'N', '03', '06', 'E', '12', '15'][i], mx + 10 + i * (w - 24) / 6, my + h - 9);
      } else if (kind === 'map') {
        x.fillStyle = '#0d1a10'; x.fillRect(mx, my, w, h);
        x.strokeStyle = '#2f6b3a'; x.lineWidth = 1;
        for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(mx, my + rnd() * h); x.bezierCurveTo(mx + w * 0.3, my + rnd() * h, mx + w * 0.6, my + rnd() * h, mx + w, my + rnd() * h); x.stroke(); }
        x.strokeStyle = '#4fa3e0'; x.lineWidth = 3; x.beginPath(); x.moveTo(mx, my + h * 0.7); x.bezierCurveTo(mx + w * 0.4, my + h * 0.5, mx + w * 0.6, my + h * 0.9, mx + w, my + h * 0.6); x.stroke();
        x.strokeStyle = '#d050d0'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy + 20); x.lineTo(cx + w * 0.25, my + 18); x.stroke();
        x.strokeStyle = '#e8e8e8'; x.beginPath(); x.arc(cx, cy + 20, h * 0.38, PI * 1.15, PI * 1.85); x.stroke();
        x.fillStyle = '#e8e8e8'; x.beginPath(); x.moveTo(cx, cy + 10); x.lineTo(cx - 7, cy + 26); x.lineTo(cx + 7, cy + 26); x.fill();
      } else {
        // Triebwerksanzeigen: Balken und Zahlen
        x.fillStyle = '#e8e8e8'; x.font = 'bold 13px Arial';
        const lab = ['TRQ', 'NR', 'TOT', 'N1'];
        for (let i = 0; i < 4; i++) {
          const bx = mx + 12 + i * (w - 24) / 4, bw = (w - 24) / 4 - 14, bh = h - 60;
          x.fillStyle = '#2a2e2c'; x.fillRect(bx, my + 26, bw, bh);
          const f = 0.55 + rnd() * 0.3;
          x.fillStyle = '#3fcf5a'; x.fillRect(bx, my + 26 + bh * (1 - f), bw, bh * f);
          x.fillStyle = '#f2c230'; x.fillRect(bx - 2, my + 26 + bh * 0.12, bw + 4, 2);
          x.fillStyle = '#e8e8e8'; x.fillText(lab[i], bx, my + 18); x.fillText(String(Math.round(f * 100)), bx, my + h - 14);
        }
      }
    };
    mfd(40, 34, 190, 170, 'pfd');
    mfd(282, 34, 190, 170, 'map');
    mfd(552, 34, 190, 170, 'eng');
    mfd(794, 34, 190, 170, 'pfd');
    // Bedienteile und Warnleuchten
    for (let i = 0; i < 14; i++) { x.fillStyle = ['#1f4a20', '#7a5a10', '#2b2f2e', '#5a1a14'][i % 4]; x.fillRect(250 + i * 38, 238, 28, 14); }
    for (let i = 0; i < 3; i++) attitudeSmall(120 + i * 380);
    function attitudeSmall(cx) { x.fillStyle = '#0b0c0c'; x.beginPath(); x.arc(cx, 272, 24, 0, 7); x.fill(); x.strokeStyle = '#9a9a90'; x.lineWidth = 2; x.stroke(); }
    attitude(512, 278, 26);
  } else {
    const gauge = (cx, cy, r, face = '#0b0c0c') => {
      x.fillStyle = '#2a2c2a'; x.beginPath(); x.arc(cx, cy, r + 6, 0, 7); x.fill();
      x.fillStyle = face; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      x.strokeStyle = '#9a9a90'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
      x.strokeStyle = '#d8d8cc'; x.lineWidth = 1.5;
      for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.28, l = i % 2 ? 0.86 : 0.74; x.beginPath(); x.moveTo(cx + Math.cos(a) * r * l, cy + Math.sin(a) * r * l); x.lineTo(cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94); x.stroke(); }
      x.strokeStyle = '#3fae4a'; x.lineWidth = 4; const g0 = rnd() * 3; x.beginPath(); x.arc(cx, cy, r * 0.9, g0, g0 + 1.2); x.stroke();
      const a = rnd() * 6.28;
      x.strokeStyle = '#f0f0e0'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); x.stroke();
      x.fillStyle = '#444'; x.beginPath(); x.arc(cx, cy, 4, 0, 7); x.fill();
      screw(cx - r - 2, cy - r - 2); screw(cx + r + 2, cy - r - 2);
    };
    // Pilotenseite (rechts) und Copilotenseite (links), Mitte: Triebwerksinstrumente
    for (const ox of [0, 640]) {
      gauge(ox + 70, 80, 46); attitude(ox + 190, 80, 52); gauge(ox + 310, 80, 46);
      gauge(ox + 70, 210, 42); gauge(ox + 190, 215, 46); gauge(ox + 310, 210, 42);
      x.strokeStyle = '#9a9a90'; x.lineWidth = 2; x.beginPath(); x.arc(ox + 190, 80, 52, 0, 7); x.stroke();
    }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) gauge(450 + i * 62, 70 + j * 92, 26);
    for (let i = 0; i < 12; i++) { x.fillStyle = ['#7a5a10', '#5a1a14', '#1f4a20'][i % 3]; x.fillRect(420 + (i % 6) * 32, 260 + Math.floor(i / 6) * 22, 24, 14); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return (panelTex[style] = t);
}

// Instrumentenbrett mit Blendschutz vor den Piloten (nach Bau des Modells, braucht den Augenpunkt)
function instrumentPanel(group, eye, ck, style) {
  const d = Math.max(0.32, eye.z - ck.z);                 // Abstand Auge – Brett
  const zf = eye.z - d;
  const top = eye.y - d * 0.62, bot = eye.y - d * 1.65;   // Oberkante ca. 32° unter Augenhöhe: Sicht nach vorn unten bleibt
  const w = ck.w * 0.92, h = top - bot;
  const tilt = -0.22;
  const g = new THREE.Group();
  g.position.set(0, (top + bot) / 2, zf);
  g.rotation.x = tilt;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: instrumentTexture(style), polygonOffset: true, polygonOffsetFactor: -1 }));
  face.position.z = 0.012;
  g.add(face);
  const dark = new THREE.MeshPhongMaterial({ color: 0x1a1c1b, shininess: 8 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.12), dark);
  back.position.z = -0.05;
  g.add(back);
  // Blendschutz: flache Haube über dem Brett, leicht vorstehend
  const hood = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.02, 0.2), dark);
  hood.position.set(0, h / 2 + 0.01, -0.04);
  hood.rotation.x = -tilt;
  g.add(hood);
  group.add(g);
}

// Cockpit: Mittelkonsole, Pilotensitze mit Panzerung, Steuerknüppel (Instrumentenbrett: instrumentPanel)
function cockpit(parts, group, { z, w, y, seatX, seatZ, seatY }) {
  group.userData.ck = { z, w };
  parts.push(P(box(0.35, 0.5, 0.9), 0x24272a, [0, y - 0.45, z + 0.5]));
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.55, 0.12, 0.55), 0x2f302b, [sx * seatX, seatY, seatZ]));
    parts.push(P(box(0.55, 0.85, 0.12), 0x2f302b, [sx * seatX, seatY + 0.45, seatZ + 0.3], [-0.12, 0, 0]));
    parts.push(P(box(0.08, 0.6, 0.5), 0x3a3b33, [sx * (seatX + 0.3), seatY + 0.3, seatZ + 0.1]));
    parts.push(P(cyl(0.02, 0.02, 0.42, 6), 0x111111, [sx * seatX, seatY + 0.16, seatZ - 0.42], [0.35, 0, 0]));
  }
}

// Rotorkopf mit verjüngten, profilierten Blättern, Blatthaltern, Steuerstangen und Taumelscheibe
function rotorGeo(n, r, chord, { tip = 0xc8a42a, hub = 0x2b2c2b, hubR = 0.35 } = {}) {
  const parts = [
    P(cyl(hubR, hubR * 1.1, 0.32, 16), hub, [0, 0, 0]),
    P(cyl(hubR * 0.9, hubR * 0.9, 0.08, 16), 0x55585a, [0, -0.28, 0]),
    P(cyl(0.1, 0.12, 0.45, 10), 0x3a3b3b, [0, 0.3, 0]),
  ];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    const ca = Math.cos(a), sa = -Math.sin(a);
    parts.push(P(box(0.6, 0.16, chord * 0.55), hub, [ca * (hubR + 0.3), 0, sa * (hubR + 0.3)], [0, a, 0]));
    parts.push(P(cyl(0.03, 0.03, 0.35, 6), 0x777a7a, [ca * (hubR + 0.15), -0.18, sa * (hubR + 0.15)]));
    const L = r - hubR - 0.6;
    const blade = new THREE.BoxGeometry(L, 0.07, chord, 6, 1, 2);
    const p = blade.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const t = (p.getX(k) + L / 2) / L;
      const zz = p.getZ(k);
      p.setZ(k, zz * (1 - 0.18 * t));
      p.setY(k, p.getY(k) * (1 - 0.4 * t) * (Math.abs(zz) > chord * 0.3 ? 0.4 : 1));
    }
    blade.computeVertexNormals();
    parts.push(P(blade, COL.rotor, [ca * (hubR + 0.6 + L / 2), 0, sa * (hubR + 0.6 + L / 2)], [0, a, 0]));
    parts.push(P(box(0.35, 0.05, chord * 0.82), tip, [ca * (r - 0.18), 0, sa * (r - 0.18)], [0, a, 0]));
  }
  return merge(parts);
}

function tailRotorGeo(n, r, chord = 0.24) {
  const parts = [P(cyl(0.14, 0.14, 0.25, 12), 0x2b2c2b, [0, 0, 0], [0, 0, HALFPI])];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    parts.push(P(box(0.05, r - 0.12, chord), COL.rotor, [0, Math.cos(a) * (r / 2 + 0.06), Math.sin(a) * (r / 2 + 0.06)], [a, 0, 0]));
    parts.push(P(box(0.055, 0.2, chord), 0xc8a42a, [0, Math.cos(a) * (r - 0.1), Math.sin(a) * (r - 0.1)], [a, 0, 0]));
  }
  return merge(parts);
}

function decal(group, text, w, h, pos, side, color = '#151511', font = 'bold 72px Arial', ry = 0) {
  const tex = textTexture(text, 512, 128, font, color);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  pl.position.set(pos[0] * side, pos[1], pos[2]);
  pl.rotation.y = side * HALFPI + ry * side;
  group.add(pl);
}

function crossDecal(group, size, pos, side, rotY = null) {
  const parts = [
    P(box(0.02, size, size), 0xe8e6de, [0, 0, 0]),
    P(box(0.03, size * 0.75, size * 0.24), COL.red, [0, 0, 0]),
    P(box(0.03, size * 0.24, size * 0.75), COL.red, [0, 0, 0]),
  ];
  const m = new THREE.Mesh(merge(parts), detailMat);
  m.position.set(pos[0] * side, pos[1], pos[2]);
  if (rotY !== null) m.rotation.y = rotY;
  group.add(m);
}

function ironCross(group, size, pos, side) {
  const parts = [
    P(box(0.03, size * 0.34, size), 0xe8e6de, [0, 0, 0]), P(box(0.03, size, size * 0.34), 0xe8e6de, [0, 0, 0]),
    P(box(0.04, size * 0.2, size * 0.86), 0x111111, [0, 0, 0]), P(box(0.04, size * 0.86, size * 0.2), 0x111111, [0, 0, 0]),
  ];
  const m = new THREE.Mesh(merge(parts), detailMat);
  m.position.set(pos[0] * side, pos[1], pos[2]);
  group.add(m);
}

// Rad mit Reifen und Felge (Achse entlang x)
function wheel(parts, r, w, pos) {
  parts.push(P(cyl(r, r, w, 18), 0x151515, pos, [0, 0, HALFPI]));
  parts.push(P(cyl(r * 0.55, r * 0.55, w + 0.02, 12), 0x55585a, pos, [0, 0, HALFPI]));
}

// Rohr entlang einer Punktliste (Kufen, Bügel)
function tube(pts, r, color, seg = 24) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return P(new THREE.TubeGeometry(curve, seg, r, 8, false), color);
}

// Bord-MGs mit Lafette und Munitionskasten, Schützen, Piloten, Rotorscheiben, Beacon; fasst Anbauteile zusammen
// M134 Minigun: Gehäuse und Laufbündel (dreht sich beim Feuern)
function m134Geo() {
  return merge([
    P(box(0.16, 0.16, 0.42), 0x2a2c28, [0, 0, 0.05]),
    P(cyl(0.08, 0.08, 0.2, 12), 0x2a2c28, [0, 0, -0.25], [HALFPI, 0, 0]),
    P(box(0.05, 0.14, 0.05), 0x1c1c1c, [0.1, -0.06, 0.25]), P(box(0.05, 0.14, 0.05), 0x1c1c1c, [-0.1, -0.06, 0.25]),
    P(box(0.28, 0.04, 0.04), 0x1c1c1c, [0, 0.0, 0.28]),
    P(box(0.22, 0.26, 0.32), 0x4a5030, [-0.22, -0.12, 0.05]),
    P(cyl(0.025, 0.025, 0.5, 6), 0x3a3a34, [-0.12, -0.02, 0.0], [0.6, 0, HALFPI]),
  ]);
}
function m134Barrels() {
  const p = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push(P(cyl(0.013, 0.013, 0.62, 6), 0x1a1a1a, [Math.cos(a) * 0.045, Math.sin(a) * 0.045, -0.62], [HALFPI, 0, 0])); }
  p.push(P(cyl(0.065, 0.065, 0.04, 12), 0x2a2c28, [0, 0, -0.85], [HALFPI, 0, 0]));
  return merge(p);
}
// M3M (.50 cal): schweres Maschinengewehr mit Lochmantel
function m3mGeo() {
  return merge([
    P(box(0.17, 0.2, 0.62), 0x2a2c28, [0, 0, 0.05]),
    P(cyl(0.032, 0.032, 1.05, 8), 0x1d1e1c, [0, 0.02, -0.78], [HALFPI, 0, 0]),
    P(cyl(0.05, 0.05, 0.42, 10), 0x2e302b, [0, 0.02, -0.45], [HALFPI, 0, 0]),
    P(cyl(0.045, 0.04, 0.12, 8), 0x161616, [0, 0.02, -1.3], [HALFPI, 0, 0]),
    P(box(0.05, 0.14, 0.05), 0x1c1c1c, [0.08, -0.06, 0.38]), P(box(0.05, 0.14, 0.05), 0x1c1c1c, [-0.08, -0.06, 0.38]),
    P(box(0.24, 0.24, 0.34), 0x4a5030, [-0.24, -0.1, 0.0]),
    P(box(0.06, 0.08, 0.06), 0x1c1c1c, [0, 0.14, -0.1]),
  ]);
}

function finish(group, parts, cfg) {
  const crewType = T.crew || 'crew';
  const gunGeo = cfg.gunGeo || m60Geo();
  const guns = {};
  const g = cfg.guns;
  const mounts = cfg.gunMounts || ['left', 'right'].map((side) => {
    const sx = side === 'left' ? -1 : 1;
    return { side, pos: [sx * g.x, g.y, g.z], baseYaw: side === 'left' ? HALFPI : -HALFPI, fig: [sx * g.figX, g.figY || 0, g.z + 0.25], sitY: g.sitY, post: true };
  });
  for (const m of mounts) {
    const mount = new THREE.Group();
    mount.position.set(...m.pos);
    mount.userData.baseYaw = m.baseYaw;
    mount.rotation.y = m.baseYaw;
    const pitch = new THREE.Group();
    mount.add(pitch);
    pitch.add(new THREE.Mesh(m.geo || gunGeo, detailMat));
    let spin = null;
    if (cfg.spinGeo && !m.dummy) { spin = new THREE.Mesh(cfg.spinGeo, detailMat); pitch.add(spin); }
    if (m.arc) mount.userData.arc = m.arc;
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.01, m.muzzleZ || -0.9);
    pitch.add(muzzle);
    const eye = new THREE.Object3D();
    eye.position.set(...(m.eye || [0, 0.3, 0.5]));
    pitch.add(eye);
    if (!m.dummy) group.add(mount);
    if (m.post) {
      const sx = Math.sign(m.pos[0]);
      parts.push(P(cyl(0.035, 0.035, m.pos[1] - cfg.floor - 0.1, 8), 0x2a2b2b, [m.pos[0], (m.pos[1] + cfg.floor) / 2 - 0.05, m.pos[2]]));
      parts.push(P(box(0.3, 0.25, 0.4), 0x4a5030, [m.pos[0] - sx * 0.35, cfg.floor + 0.15, m.pos[2] + 0.35]));
    }
    let gunner = m.figure;
    if (!gunner && !m.noFig) {
      gunner = new Figure(crewType);
      gunner.group.position.set(...m.fig);
      gunner.group.rotation.y = m.baseYaw;
      gunner.sit(1.0, m.sitY);
      if (!m.dummy) group.add(gunner.group);
    }
    guns[m.side] = { mount, pitch, muzzle, eye, gunner, spin };
  }
  // Platzhalter für nicht vorhandene Schützenplätze (z. B. Rampe)
  for (const side of ['left', 'right', 'ramp']) {
    if (guns[side]) continue;
    const mount = new THREE.Group(), pitch = new THREE.Group();
    mount.add(pitch);
    mount.userData.baseYaw = 0;
    const muzzle = new THREE.Object3D(), eye = new THREE.Object3D();
    pitch.add(muzzle, eye);
    guns[side] = { mount, pitch, muzzle, eye, gunner: new Figure(crewType), spin: null };
  }
  const pilots = [];
  const plist = cfg.pilotList || [-1, 1].map((sx) => [sx * cfg.pilots.x, cfg.pilots.y || 0, cfg.pilots.z, cfg.pilots.sitY]);
  for (const [x, y, z, sitY] of plist) {
    const f = new Figure(crewType);
    f.group.position.set(x, y, z);
    f.sit(1.35, sitY);
    group.add(f.group);
    pilots.push(f);
  }
  if (cfg.cpgGun) guns[cfg.cpgGun].gunner = pilots[0];
  const discMat = discMatProto.clone();
  const discs = [];
  for (const r of cfg.discs) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(r.r, 48), discMat);
    d.rotation.x = -HALFPI;
    d.position.copy(r.obj.position);
    group.add(d);
    discs.push(d);
  }
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), beaconMat);
  beacon.position.set(...cfg.beacon);
  group.add(beacon);
  const detail = new THREE.Mesh(merge(parts), detailMat);
  group.add(detail);
  return { guns, pilots, discMat, rotorDisc: discs[0], beacon, beaconMat, detail };
}

// Heckrampe als eigenes, um das Scharnier schwenkbares Teil.
// Winkel 0 = waagerecht (Flug), open = abgesenkt bis auf den Boden
function rampPart(group, { y, z, w, len, col, open }) {
  const pts = [
    P(box(w, 0.12, len), col, [0, -0.06, len / 2]),
    P(box(w, 0.05, 0.35), 0x2a2b24, [0, -0.08, len + 0.12], [-0.22, 0, 0]),
    P(cyl(0.07, 0.07, w + 0.1, 10), 0x2a2b24, [0, 0, 0], [0, 0, HALFPI]),
  ];
  for (const sx of [-1, 1]) pts.push(P(box(0.08, 0.14, len), 0x2a2b24, [sx * (w / 2 - 0.04), 0.06, len / 2]));
  for (let i = 1; i < 5; i++) pts.push(P(box(w - 0.3, 0.03, 0.06), 0x2a2b24, [0, 0.015, i * len / 5]));   // Trittleisten
  const obj = new THREE.Group();
  obj.position.set(0, y, z);
  obj.rotation.x = open;
  obj.add(new THREE.Mesh(merge(pts), detailMat));
  group.add(obj);
  return { obj, open, ang: open };
}

function seatsGrid(list, sit) {
  return list.map(([x, z, r, kind]) => ({ p: [x, z], r, sit: sit || (kind === 'bench' ? [1.2, -0.25] : [0.35, -0.67]) }));
}

// Rumpfhaut (eine lackierte Geometrie) und Verglasung aus Querschnittsformen
function hull(group, key, list, paint, extraSkin = []) {
  const skinGeos = [], glassGeos = [];
  let main = null;
  for (const k of list) {
    const o = { radial: k.radial || 36, dz: k.dz || 0.3 };
    skinGeos.push(loft(k.keys, { ...o, holes: k.holes || [], capEnd: k.capEnd, capStart: k.capStart }));
    if (!main) main = skinGeos[0];
    if (k.glass) glassGeos.push(loft(k.keys, { ...o, only: k.glass, grow: 0.004 }));
  }
  const tex = paintTexture(key, paint);
  tex.wrapS = THREE.RepeatWrapping;
  const skin = new THREE.Mesh(mergeUV(skinGeos.concat(extraSkin)), paintMaterial(tex));
  group.add(skin);
  const glass = new THREE.Mesh(glassGeos.length ? mergeUV(glassGeos) : new THREE.BufferGeometry(), glassMat);
  glass.renderOrder = 2;
  group.add(glass);
  // Außenkante des Hauptrumpfs bei z (für Beschriftungen auf der Haut)
  const X = (z) => sectionAt(main, z).w / 2 + 0.025;
  return { skin, glass, X };
}

// Öffnung auf der rechten Seite (Winkel a0..a1) und gespiegelt links
const both = (z0, z1, a0, a1) => [{ z0, z1, a0, a1 }, { z0, z1, a0: PI - a1, a1: PI - a0 }];

export function buildHeliModel(spec, opts = {}) {
  const m = spec.model === 'blackhawk' ? buildBlackhawk(opts) : spec.model === 'chinook' ? buildChinook(opts) : spec.model === 'ch53' ? buildCH53(opts)
    : spec.model === 'apache' ? buildApache(opts) : spec.model === 'h145' ? buildH145(opts) : spec.model === 'nh90' ? buildNH90(opts)
    : spec.model === 'tiger' ? buildTiger(opts) : spec.model === 'mi8' ? buildMi8(opts) : spec.model === 'mi24' ? buildMi24(opts) : buildHuey(opts);
  // Instrumentenbrett: Glascockpit bei modernen Mustern, Rundinstrumente bei UH-1D und CH-53
  const ck = m.group.userData.ck;
  if (ck && m.eyePilot && !opts.static) instrumentPanel(m.group, m.eyePilot, ck, ['huey', 'ch53', 'mi8'].includes(spec.model) || !spec.model ? 'analog' : 'glass');
  // Katastropheneinsatz: Bordwaffen und Schützen ausblenden
  if (spec.noGuns) for (const g of Object.values(m.guns)) { g.mount.visible = false; if (g.gunner) g.gunner.group.visible = false; }
  return m;
}

// ================================================================= NH90 TTH (Sanitätshubschrauber)
function buildNH90({ static: isStatic = false, number = '79+21' } = {}) {
  const group = new THREE.Group();
  const cockpitWin = [
    { z0: -6.1, z1: -4.45, a0: 0.4, a1: PI - 0.4 },
    { z0: -6.0, z1: -5.3, a0: PI + 0.7, a1: 2 * PI - 0.7 },
    ...both(-5.1, -4.2, -0.25, 0.5),
  ];
  const doors = both(-3.6, -1.4, -0.85, 0.85);
  const cabWin = both(-0.9, 1.3, 0.12, 0.55);
  const fus = [
    { z: -6.45, w: 0.5, top: -0.35, bot: -0.7 },
    { z: -6.05, w: 1.7, top: 0.35, bot: -1.0, nt: 2.2, nb: 2.4 },
    { z: -5.3, w: 2.25, top: 0.95, bot: -1.12, nt: 2.5, nb: 3.3 },
    { z: -4.3, w: 2.45, top: 1.2, bot: -1.18, nt: 3.3, nb: 4.5 },
    { z: 1.6, w: 2.45, top: 1.25, bot: -1.18, nt: 3.4, nb: 4.5 },
    { z: 2.6, w: 2.2, top: 1.2, bot: -0.4, nt: 3, nb: 3 },
    { z: 3.6, w: 1.4, top: 1.15, bot: 0.35, nt: 2.6, nb: 2.6 },
    { z: 4.6, w: 0.9, top: 1.1, bot: 0.6, nt: 2.4, nb: 2.4 },
    { z: 8.6, w: 0.55, top: 1.3, bot: 0.85, nt: 2.3, nb: 2.3 },
    { z: 9.0, w: 0.4, top: 1.3, bot: 0.95 },
  ];
  const cowl = [
    { z: -4.2, w: 0.8, top: 1.35, bot: 1.15 },
    { z: -3.6, w: 1.9, top: 2.05, bot: 1.15, nt: 3, nb: 4 },
    { z: 1.6, w: 1.8, top: 2.0, bot: 1.15, nt: 3, nb: 4 },
    { z: 2.6, w: 0.9, top: 1.6, bot: 1.2 },
  ];
  const sponson = (sx) => [
    { z: -1.4, w: 0.3, top: -0.45, bot: -0.85, x: sx * 1.3 },
    { z: -1.0, w: 0.7, top: -0.25, bot: -1.05, x: sx * 1.45, nt: 3, nb: 3 },
    { z: 1.4, w: 0.7, top: -0.25, bot: -1.05, x: sx * 1.45, nt: 3, nb: 3 },
    { z: 1.9, w: 0.3, top: -0.45, bot: -0.85, x: sx * 1.3 },
  ];
  const fin = plate([[8.0, 1.0], [8.9, 1.0], [9.7, 3.6], [9.1, 3.65], [8.5, 2.2]], 0.2, 'zy');
  const stab = plate([[0, 8.3], [2.2, 8.4], [2.2, 8.9], [0, 8.85]], 0.08, 'xz');
  stab.translate(0.1, 1.45, 0);
  const h = hull(group, 'nh90', [
    { keys: fus, holes: [...cockpitWin, ...doors, ...cabWin], glass: [...cockpitWin, ...cabWin], capEnd: true, radial: 40 },
    { keys: cowl, capStart: true, capEnd: true, radial: 24 },
    { keys: sponson(-1), capStart: true, capEnd: true, radial: 18 },
    { keys: sponson(1), capStart: true, capEnd: true, radial: 18 },
  ], { base: '#53583f', frames: 22, stringers: 9, soot: [[0.35, 0.55, 0.05, 0.25]] }, [fin, stab]);

  const parts = [];
  parts.push(P(box(2.3, 0.06, 6.4), 0x2b2d24, [0, -1.0, -1.3]));
  cockpit(parts, group, { z: -5.4, w: 2.1, y: -0.3, seatX: 0.55, seatZ: -4.55, seatY: -0.45 });
  // Bänke an den Kabinenwänden
  for (const sx of [-1, 1]) parts.push(P(box(0.45, 0.08, 3.4), 0x3b3f2b, [sx * 0.95, -0.66, 0.0]), P(box(0.06, 0.6, 3.4), 0x3b3f2b, [sx * 1.17, -0.35, 0.0]));
  // Fahrwerk: Haupträder in den Stummelflächen, Doppel-Bugrad
  for (const sx of [-1, 1]) {
    wheel(parts, 0.38, 0.25, [sx * 1.5, -1.27, -0.2]);
    parts.push(P(box(0.16, 0.45, 0.16), COL.metal, [sx * 1.5, -0.95, -0.2]));
    wheel(parts, 0.28, 0.18, [sx * 0.2, -1.37, -4.9]);
    parts.push(P(box(0.3, 0.04, 0.3), 0x2a2b2b, [sx * 1.3, -1.12, -3.7]));
  }
  parts.push(P(box(0.14, 0.55, 0.14), COL.metal, [0, -1.05, -4.9]));
  parts.push(P(cyl(0.24, 0.28, 0.75, 12), COL.metal, [0, 2.3, -1.2]));
  parts.push(P(box(0.04, 0.5, 0.25), 0x111111, [0, 2.2, 2.0], [0.35, 0, 0]));
  parts.push(P(cyl(0.16, 0.16, 0.4, 10), COL.gun, [0.25, 3.0, 9.2], [0, 0, HALFPI]));
  for (const s of [-1, 1]) {
    crossDecal(group, 0.85, [h.X(0.6), -0.2, 0.6], s);
    ironCross(group, 0.75, [h.X(5.4), 0.85, 5.4], s);
    decal(group, number, 1.1, 0.28, [h.X(7.4), 1.05, 7.4], s, '#151511', 'bold 72px Arial', -0.05);
  }
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.75, -1.2);
  mainRotor.add(new THREE.Mesh(rotorGeo(4, 8.15, 0.6, { hubR: 0.42 }), detailMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.42, 3.0, 9.2);
  tailRotor.add(new THREE.Mesh(tailRotorGeo(4, 1.6, 0.3), detailMat));
  group.add(tailRotor);
  const f = finish(group, parts, {
    guns: { x: 1.3, y: 0.25, z: -2.2, figX: 0.85, sitY: -0.32 }, floor: -1.0,
    pilots: { x: 0.55, z: -4.6, sitY: -0.35 },
    discs: [{ obj: mainRotor, r: 8.15 }],
    beacon: [0, 2.25, 2.4],
  });
  const seatList = [];
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) seatList.push([sx * 0.95, -1.2 + i * 0.85, sx < 0 ? HALFPI : -HALFPI, 'floor']);
  for (let i = 0; i < 4; i++) seatList.push([(i % 2 - 0.5) * 0.6, -0.6 + Math.floor(i / 2) * 1.4, 0, 'floor']);
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats: seatsGrid(seatList, [1.25, -0.52]), isStatic,
    eyePilot: new THREE.Vector3(0.55, 0.68, -4.85),
    spin: [[mainRotor, 'y', 20], [tailRotor, 'x', 65]],
    exhaust: new THREE.Vector3(0, 1.6, 2.7),
    hoist: new THREE.Vector3(1.55, 1.0, -2.2),
    gear: [[-1.5, -1.65, -0.2], [1.5, -1.65, -0.2], [0, -1.65, -4.9]],   // Aufsetzpunkte (Räder) für den Bodenkontakt
  };
}

// ================================================================= Tiger (Kampfhubschrauber)
function buildTiger({ static: isStatic = false, number = '74+38' } = {}) {
  const group = new THREE.Group();
  const canopy = [{ z0: -5.0, z1: -3.55, a0: 0.2, a1: PI - 0.2 }, { z0: -3.35, z1: -2.0, a0: 0.25, a1: PI - 0.25 }];
  const fus = [
    { z: -6.0, w: 0.4, top: -0.2, bot: -0.5 },
    { z: -5.6, w: 0.85, top: 0.15, bot: -0.7, nt: 3, nb: 2.6 },
    { z: -4.8, w: 0.95, top: 0.62, bot: -0.8, nt: 3.2, nb: 3 },
    { z: -3.6, w: 1.0, top: 0.9, bot: -0.82, nt: 3.4, nb: 3.4 },
    { z: -2.4, w: 1.05, top: 1.35, bot: -0.8, nt: 3.4, nb: 3.4 },
    { z: 0.4, w: 1.15, top: 1.4, bot: -0.62, nt: 3.4, nb: 3.4 },
    { z: 2.2, w: 0.85, top: 1.2, bot: -0.1, nt: 3, nb: 3 },
    { z: 3.6, w: 0.55, top: 1.0, bot: 0.3, nt: 2.6, nb: 2.6 },
    { z: 7.6, w: 0.38, top: 1.0, bot: 0.55, nt: 2.4, nb: 2.4 },
    { z: 8.3, w: 0.28, top: 0.95, bot: 0.65 },
  ];
  const nac = (sx) => [
    { z: -1.3, w: 0.38, top: 1.35, bot: 1.0, x: sx * 0.72 },
    { z: -1.0, w: 0.55, top: 1.52, bot: 0.86, x: sx * 0.75, nt: 2.4, nb: 2.4 },
    { z: 1.8, w: 0.55, top: 1.5, bot: 0.86, x: sx * 0.78, nt: 2.4, nb: 2.4 },
    { z: 2.4, w: 0.38, top: 1.35, bot: 1.0, x: sx * 0.8 },
  ];
  const wing = plate([[-2.25, -0.4], [2.25, -0.4], [2.25, 0.55], [-2.25, 0.55]], 0.1, 'xz');
  wing.translate(0, 0.45, 0);
  const fin = plate([[7.3, 0.8], [8.2, 0.8], [8.75, 2.75], [8.2, 2.8], [7.7, 1.6]], 0.18, 'zy');
  const stab = plate([[-1.3, 6.6], [1.3, 6.6], [1.3, 7.1], [-1.3, 7.1]], 0.07, 'xz');
  stab.translate(0, 0.82, 0);
  const h = hull(group, 'tiger', [
    { keys: fus, holes: canopy, glass: canopy, capEnd: true, radial: 32 },
    { keys: nac(-1), capStart: true, capEnd: true, radial: 18 },
    { keys: nac(1), capStart: true, capEnd: true, radial: 18 },
  ], { base: '#4a4f44', frames: 20, stringers: 8, soot: [[0.42, 0.62, 0.05, 0.25]] }, [wing, fin, stab]);

  const parts = [];
  for (const [z, y] of [[-4.2, -0.5], [-2.65, -0.1]]) {
    parts.push(P(box(0.48, 0.1, 0.5), 0x2f302b, [0, y, z]));
    parts.push(P(box(0.48, 0.7, 0.1), 0x2f302b, [0, y + 0.4, z + 0.3]));
    parts.push(P(box(0.8, 0.38, 0.1), 0x24272a, [0, y + 0.5, z - 0.72], [-0.4, 0, 0]));
  }
  // Seitenleitwerks-Endscheiben am Höhenleitwerk
  for (const sx of [-1, 1]) parts.push(P(box(0.06, 0.6, 0.5), 0x484d42, [sx * 1.3, 0.95, 6.85]));
  // Fahrwerk (Spornradfahrwerk)
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.1, 0.1, 0.9), COL.metal, [sx * 0.9, -0.95, -2.0], [0.4, 0, 0]));
    wheel(parts, 0.3, 0.18, [sx * 1.0, -1.2, -2.3]);
    parts.push(P(cyl(0.2, 0.24, 0.5, 12), 0x1b1b19, [sx * 0.95, 1.15, 2.55], [HALFPI, 0, sx * -0.5]));
    // Raketenwerfer außen, Lenkflugkörper innen
    const ox = sx * 2.0, ix = sx * 1.35;
    parts.push(P(box(0.08, 0.3, 0.5), 0x2a2c27, [ox, 0.25, 0.1]), P(box(0.08, 0.3, 0.5), 0x2a2c27, [ix, 0.25, 0.1]));
    parts.push(P(cyl(0.24, 0.24, 1.5, 14), 0x474b3f, [ox, -0.1, 0.0], [HALFPI, 0, 0]));
    parts.push(P(cyl(0.19, 0.19, 0.02, 14), 0x101010, [ox, -0.1, -0.76], [HALFPI, 0, 0]));
    for (const dy of [-0.05, -0.32]) {
      parts.push(P(cyl(0.08, 0.08, 1.5, 8), 0x6a6c5c, [ix, 0.15 + dy, 0.1], [HALFPI, 0, 0]));
      parts.push(P(new THREE.ConeGeometry(0.08, 0.18, 8), 0x55584a, [ix, 0.15 + dy, -0.73], [-HALFPI, 0, 0]));
    }
  }
  parts.push(P(box(0.08, 1.0, 0.08), COL.metal, [0, -0.1, 7.4], [-0.2, 0, 0]));
  wheel(parts, 0.15, 0.1, [0, -1.33, 7.55]);
  // Mast, Dachvisier, Drahtschneider
  parts.push(P(cyl(0.15, 0.18, 0.8, 12), COL.metal, [0, 2.1, -0.6]));
  parts.push(P(sph(0.34, 16, 10), 0x3a3e36, [0, 1.75, -2.35], [0, 0, 0], [1, 0.8, 1]));
  parts.push(P(box(0.05, 0.55, 0.06), 0x777777, [0, 1.15, -3.8], [-0.4, 0, 0]));
  parts.push(P(box(0.05, 0.45, 0.06), 0x777777, [0, -0.95, -4.7], [0.4, 0, 0]));
  for (const s of [-1, 1]) {
    ironCross(group, 0.6, [h.X(4.6), 0.75, 4.6], s);
    decal(group, number, 0.85, 0.2, [h.X(6.2), 0.8, 6.2], s, '#141512', 'bold 72px Arial', -0.04);
  }
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.55, -0.6);
  mainRotor.add(new THREE.Mesh(rotorGeo(4, 6.5, 0.48, { hubR: 0.3 }), detailMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.32, 2.3, 8.45);
  tailRotor.add(new THREE.Mesh(tailRotorGeo(3, 1.25, 0.24), detailMat));
  group.add(tailRotor);
  const f = finish(group, parts, {
    gunMounts: [
      { side: 'left', pos: [0, -0.92, -4.3], baseYaw: 0, geo: m230Geo(), muzzleZ: -1.8, eye: [0, -0.24, -0.45], noFig: true },
      { side: 'right', pos: [0, 0, 0], baseYaw: 0, fig: [0, 0, 0], sitY: 0, dummy: true },
    ],
    floor: -0.85,
    // hinten Waffensystemoffizier, vorn Pilot
    pilotList: [[0, 0.3, -2.55, -0.2], [0, -0.1, -4.1, -0.55]],
    cpgGun: 'left',
    discs: [{ obj: mainRotor, r: 6.5 }],
    beacon: [0, 1.3, 4.0],
  });
  f.guns.left.gunner.group.visible = true;
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats: [], isStatic,
    eyePilot: new THREE.Vector3(0, 0.72, -4.35),
    spin: [[mainRotor, 'y', 24], [tailRotor, 'x', 75]],
    exhaust: new THREE.Vector3(0.95, 1.15, 2.6),
    gear: [[-1.0, -1.5, -2.3], [1.0, -1.5, -2.3], [0, -1.5, 7.55]],   // Aufsetzpunkte (Räder) für den Bodenkontakt
    rocketPods: [new THREE.Vector3(-2.0, -0.1, -0.8), new THREE.Vector3(2.0, -0.1, -0.8)],
  };
}

// ================================================================= Airbus H145M LUH SAR
function buildH145({ static: isStatic = false, number = '77+05' } = {}) {
  const group = new THREE.Group();
  const cockpitWin = [
    { z0: -3.78, z1: -2.35, a0: 0.4, a1: PI - 0.4 },
    { z0: -3.72, z1: -3.0, a0: PI + 0.7, a1: 2 * PI - 0.7 },
    ...both(-3.05, -1.95, -0.3, 0.55),
  ];
  const cabWin = [...both(-1.55, 0.55, 0.02, 0.55), ...both(0.95, 1.5, 0.15, 0.5)];
  const fus = [
    { z: -4.05, w: 0.35, top: -0.25, bot: -0.55 },
    { z: -3.75, w: 1.25, top: 0.3, bot: -0.8, nt: 2.1, nb: 2.4 },
    { z: -3.1, w: 1.62, top: 0.75, bot: -0.92, nt: 2.4, nb: 3.2 },
    { z: -2.2, w: 1.75, top: 1.0, bot: -0.95, nt: 3.2, nb: 4.5 },
    { z: 0.9, w: 1.75, top: 1.02, bot: -0.95, nt: 3.4, nb: 4.5 },
    { z: 1.7, w: 1.6, top: 0.98, bot: -0.6, nt: 3, nb: 3 },
    { z: 2.3, w: 1.0, top: 0.95, bot: 0.15, nt: 2.4, nb: 2.4 },
    { z: 3.0, w: 0.62, top: 0.95, bot: 0.45, nt: 2.2, nb: 2.2 },
    { z: 6.4, w: 0.36, top: 0.98, bot: 0.66, nt: 2.2, nb: 2.2 },
    { z: 6.7, w: 0.3, top: 0.95, bot: 0.72 },
  ];
  const cowl = [
    { z: -1.95, w: 0.7, top: 1.15, bot: 1.0 },
    { z: -1.5, w: 1.35, top: 1.62, bot: 0.98, nt: 3, nb: 4 },
    { z: 1.4, w: 1.3, top: 1.56, bot: 0.98, nt: 3, nb: 4 },
    { z: 2.15, w: 0.7, top: 1.3, bot: 1.0 },
  ];
  // Fenestron-Seitenleitwerk (Mantelpropeller)
  const fin = plate([[5.95, 0.62], [6.95, 0.42], [7.45, 1.05], [7.35, 2.7], [6.85, 2.8], [6.3, 1.7]], 0.24, 'zy');
  const h = hull(group, 'h145', [
    { keys: fus, holes: [...cockpitWin, ...cabWin], glass: [...cockpitWin, ...cabWin], capEnd: true },
    { keys: cowl, capStart: true, capEnd: true, radial: 24 },
  ], { base: '#596066', frames: 14, stringers: 8, soot: [[0.4, 0.55, 0.05, 0.25]] }, [fin]);

  const parts = [];
  parts.push(P(box(1.6, 0.06, 3.4), 0x2b2d2e, [0, -0.75, -0.5]));
  // zwei Sitzreihen gegenüber (Blick zueinander)
  for (const [x, z, r] of [[-0.55, -1.2, Math.PI], [0, -1.2, Math.PI], [0.55, -1.2, Math.PI], [-0.55, 0.8, 0], [0, 0.8, 0], [0.55, 0.8, 0]]) {
    parts.push(P(box(0.46, 0.07, 0.45), 0x3a3d40, [x, -0.42, z + (r ? -0.05 : 0.05)]));
    parts.push(P(box(0.46, 0.55, 0.06), 0x3a3d40, [x, -0.12, z + (r ? -0.3 : 0.3)]));
  }
  cockpit(parts, group, { z: -3.05, w: 1.45, y: -0.25, seatX: 0.42, seatZ: -2.2, seatY: -0.42 });
  // Mantelring und Leitschaufeln des Fenestron
  parts.push(P(tor(0.55, 0.11, 18), 0x4c5257, [0, 1.15, 6.95], [0, HALFPI, 0]));
  parts.push(P(cyl(0.5, 0.5, 0.26, 18), 0x1d1f21, [0, 1.15, 6.95], [0, 0, HALFPI]));
  // Höhenleitwerk mit Endscheiben
  parts.push(P(box(2.7, 0.06, 0.62), 0x50575c, [0, 0.82, 5.55]));
  for (const sx of [-1, 1]) parts.push(P(box(0.06, 0.62, 0.55), 0x50575c, [sx * 1.35, 0.92, 5.55]));
  // Kufen
  for (const sx of [-1, 1]) {
    parts.push(tube([[sx * 1.0, -1.3, 1.6], [sx * 1.0, -1.3, -2.2], [sx * 1.0, -1.2, -2.65], [sx * 1.0, -0.98, -2.85]], 0.05, COL.metal));
    for (const z of [-1.6, 0.8]) parts.push(tube([[sx * 1.0, -1.28, z], [sx * 0.98, -1.1, z], [sx * 0.75, -0.96, z], [0, -0.95, z]], 0.05, COL.metal, 10));
  }
  // Rettungswinde rechts über der Schiebetür
  parts.push(P(box(0.75, 0.12, 0.14), 0x3a3d40, [1.15, 1.08, -0.9]));
  parts.push(P(cyl(0.14, 0.14, 0.5, 10), 0xd8d8d0, [1.5, 1.02, -0.9], [HALFPI, 0, 0]));
  parts.push(P(box(0.05, 0.3, 0.05), 0x222222, [1.55, 0.82, -0.9]));
  parts.push(P(cyl(0.16, 0.2, 0.5, 12), COL.metal, [0, 1.8, -0.2]));
  parts.push(P(cyl(0.035, 0.035, 1.1, 6), 0x111111, [0.35, -0.55, -3.95], [1.2, 0, 0]));
  // Suchscheinwerfer und Antennen
  parts.push(P(cyl(0.16, 0.16, 0.2, 10), 0xdedede, [0.3, -0.98, -2.6]));
  parts.push(P(box(0.04, 0.4, 0.12), 0x111111, [0, 1.25, 2.6], [0.4, 0, 0]));
  for (const s of [-1, 1]) {
    decal(group, 'SAR', 0.95, 0.3, [h.X(-0.6), 0.55, -0.6], s, '#e8c020', 'bold 96px Arial');
    ironCross(group, 0.55, [h.X(4.4), 0.72, 4.4], s);
    decal(group, number, 1.0, 0.24, [h.X(1.4), 0.62, 1.4], s);
  }
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.05, -0.2);
  mainRotor.add(new THREE.Mesh(rotorGeo(4, 5.5, 0.36, { hubR: 0.26 }), detailMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.14, 1.15, 6.95);
  tailRotor.add(new THREE.Mesh(tailRotorGeo(8, 0.46, 0.12), detailMat));
  group.add(tailRotor);
  const f = finish(group, parts, {
    gunMounts: [], floor: -0.75,
    pilots: { x: 0.42, z: -2.25, sitY: -0.35 },
    discs: [{ obj: mainRotor, r: 5.5 }],
    beacon: [0, 1.62, 1.6],
  });
  // Kabinensitze: aufrecht sitzend, Beine bleiben in der Kabine
  const seatPos = [[-0.55, -1.2, Math.PI], [0, -1.2, Math.PI], [0.55, -1.2, Math.PI], [-0.55, 0.8, 0], [0, 0.8, 0], [0.55, 0.8, 0]];
  const seats = seatsGrid(seatPos.map(([x, z, r]) => [x, z, r, 'seat']), [1.3, -0.33]);
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats, isStatic,
    eyePilot: new THREE.Vector3(0.42, 0.56, -2.55),
    spin: [[mainRotor, 'y', 26], [tailRotor, 'x', 90]],
    exhaust: new THREE.Vector3(0, 1.4, 2.2),
    hoist: new THREE.Vector3(1.55, 0.7, -0.9),
    gear: [[-1.0, -1.3, -1.9], [1.0, -1.3, -1.9], [-1.0, -1.3, 1.3], [1.0, -1.3, 1.3]],   // Aufsetzpunkte (Kufen) für den Bodenkontakt
  };
}

// ================================================================= UH-1D „Huey“
function buildHuey({ static: isStatic = false, number = '66-16024' } = {}) {
  const group = new THREE.Group();
  const cockpitWin = [
    { z0: -3.12, z1: -1.75, a0: 0.42, a1: PI - 0.42 },
    { z0: -3.05, z1: -2.45, a0: PI + 0.65, a1: 2 * PI - 0.65 },
    ...both(-2.55, -1.05, 0.02, 0.42),
  ];
  const doors = both(-0.95, 1.85, -0.95, 0.95);
  const fus = [
    { z: -3.35, w: 0.4, top: -0.25, bot: -0.65 },
    { z: -3.05, w: 1.7, top: 0.45, bot: -0.98, nt: 2.1, nb: 2.4 },
    { z: -2.5, w: 2.25, top: 0.95, bot: -1.1, nt: 2.4, nb: 3.2 },
    { z: -1.75, w: 2.42, top: 1.2, bot: -1.15, nt: 3.2, nb: 4.5 },
    { z: 1.9, w: 2.42, top: 1.25, bot: -1.15, nt: 3.4, nb: 4.5 },
    { z: 2.65, w: 2.2, top: 1.22, bot: -0.55, nt: 3, nb: 3 },
    { z: 3.4, w: 1.25, top: 1.15, bot: 0.15, nt: 2.4, nb: 2.4 },
    { z: 4.6, w: 0.74, top: 1.05, bot: 0.45, nt: 2.2, nb: 2.2 },
    { z: 9.1, w: 0.42, top: 1.0, bot: 0.66, nt: 2.2, nb: 2.2 },
    { z: 9.45, w: 0.3, top: 0.96, bot: 0.74 },
  ];
  const engine = [
    { z: -0.75, w: 0.7, top: 1.32, bot: 1.18 },
    { z: -0.35, w: 1.3, top: 1.92, bot: 1.15, nt: 3, nb: 4 },
    { z: 2.5, w: 1.42, top: 1.98, bot: 1.15, nt: 3, nb: 4 },
    { z: 3.05, w: 1.0, top: 1.82, bot: 1.25, nt: 2.5, nb: 3 },
    { z: 3.15, w: 0.75, top: 1.75, bot: 1.4 },
  ];
  const fin = plate([[8.55, 0.85], [9.0, 0.85], [9.85, 2.55], [9.5, 2.6], [9.1, 1.6]], 0.12, 'zy');
  const stab = plate([[-1.3, 6.4], [1.3, 6.4], [1.3, 6.85], [-1.3, 6.85]], 0.06, 'xz');
  stab.translate(0, 0.74, 0);
  const h = hull(group, 'huey', [
    { keys: fus, holes: [...cockpitWin, ...doors], glass: cockpitWin, capEnd: true },
    { keys: engine, capEnd: true, capStart: true, radial: 24 },
  ], { base: '#4a5033', frames: 16, stringers: 8, soot: [[0.55, 0.9, 0.15, 0.35]] }, [fin, stab]);

  const parts = [];
  parts.push(P(box(2.32, 0.06, 4.9), 0x2b2d24, [0, -0.72, -0.3]));
  parts.push(P(box(2.3, 1.85, 0.06), 0x3b3f2b, [0, 0.25, 1.88]));
  parts.push(P(box(0.95, 0.08, 0.48), 0x5a5a3c, [0, -0.27, 1.6]), P(box(0.95, 0.5, 0.06), 0x5a5a3c, [0, 0.0, 1.84]));
  for (const sx of [-1, 1]) parts.push(P(box(0.42, 0.08, 0.42), 0x5a5a3c, [sx * 0.62, -0.25, 1.4]));
  cockpit(parts, group, { z: -2.55, w: 1.9, y: -0.15, seatX: 0.55, seatZ: -1.65, seatY: -0.38 });
  for (const sx of [-1, 1]) {
    parts.push(tube([[sx * 1.25, -1.55, 2.4], [sx * 1.25, -1.55, -1.9], [sx * 1.25, -1.45, -2.45], [sx * 1.25, -1.15, -2.7]], 0.055, COL.metal));
    for (const z of [-0.8, 1.1]) parts.push(tube([[sx * 1.25, -1.52, z], [sx * 1.2, -1.3, z], [sx * 0.95, -1.12, z], [0, -1.1, z]], 0.055, COL.metal, 10));
    parts.push(P(box(0.25, 0.04, 0.35), 0x2a2b2b, [sx * 1.25, -1.0, -1.6]));
  }
  parts.push(P(cyl(0.13, 0.15, 0.7, 12), COL.metal, [0, 2.25, 0.25]));
  parts.push(P(cyl(0.3, 0.27, 0.6, 14), 0x232221, [0, 1.6, 3.35], [HALFPI - 0.15, 0, 0]));
  parts.push(P(box(0.9, 0.3, 0.06), 0x1d1d1b, [0, 1.6, -0.62]));
  parts.push(P(box(0.04, 0.5, 0.15), 0x111111, [0, 1.35, 4.6], [0.4, 0, 0]));
  parts.push(P(cyl(0.012, 0.012, 1.4, 4), 0x111111, [0.3, 0.6, -2.9], [0.5, 0, 0.2]));
  parts.push(P(box(0.06, 0.38, 0.5), 0x353a24, [0, 0.52, 9.3], [0.3, 0, 0]));
  parts.push(P(cyl(0.06, 0.06, 0.25, 8), COL.gun, [-0.12, 2.15, 9.45], [0, 0, HALFPI]));
  for (const s of [-1, 1]) {
    decal(group, 'U.S. ARMY', 2.2, 0.4, [h.X(6.0), 0.8, 6.0], s);
    decal(group, number, 0.95, 0.24, [0.08, 1.95, 9.35], s);
  }
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.62, 0.25);
  mainRotor.add(new THREE.Mesh(rotorGeo(2, 7.3, 0.53, { hubR: 0.3 }), detailMat));
  mainRotor.add(new THREE.Mesh(merge([P(box(0.06, 0.06, 2.4), COL.gun, [0, 0.36, 0]), P(sph(0.07, 6, 4), COL.gun, [0, 0.36, 1.2]), P(sph(0.07, 6, 4), COL.gun, [0, 0.36, -1.2])]), detailMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-0.27, 2.15, 9.45);
  tailRotor.add(new THREE.Mesh(tailRotorGeo(2, 1.3, 0.2), detailMat));
  group.add(tailRotor);
  const f = finish(group, parts, {
    guns: { x: 1.2, y: 0.2, z: 1.2, figX: 0.6, sitY: -0.23 }, floor: -0.72,
    pilots: { x: 0.55, z: -1.68, sitY: -0.33 },
    discs: [{ obj: mainRotor, r: 7.3 }],
    beacon: [0, 2.0, 2.5],
  });
  const seats = seatsGrid([
    [-0.35, 1.6, 0, 'bench'], [0.0, 1.6, 0, 'bench'], [0.35, 1.6, 0, 'bench'],
    [-1.1, -0.65, HALFPI, 'floor'], [1.1, -0.65, -HALFPI, 'floor'], [-1.1, -0.05, HALFPI, 'floor'],
    [1.1, -0.05, -HALFPI, 'floor'], [-1.1, 0.55, HALFPI, 'floor'], [1.1, 0.55, -HALFPI, 'floor'], [0.0, 0.5, 0, 'floor'],
  ]);
  seats[9].sit = [1.5, -0.67];
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats, isStatic,
    eyePilot: new THREE.Vector3(0.55, 0.72, -2.0),
    spin: [[mainRotor, 'y', 22], [tailRotor, 'x', 70]],
    exhaust: new THREE.Vector3(0, 1.62, 3.5),
    gear: [[-1.25, -1.6, -1.9], [1.25, -1.6, -1.9], [-1.25, -1.6, 2.4], [1.25, -1.6, 2.4]],   // Aufsetzpunkte (Räder/Kufen) für den Bodenkontakt
  };
}

// ================================================================= UH-60 Black Hawk
function buildBlackhawk({ static: isStatic = false, number = '08-20112' } = {}) {
  const group = new THREE.Group();
  const cockpitWin = [
    { z0: -4.95, z1: -3.35, a0: 0.45, a1: PI - 0.45 },
    { z0: -5.15, z1: -4.45, a0: PI + 0.7, a1: 2 * PI - 0.7 },
    ...both(-4.55, -3.05, -0.22, 0.45),
  ];
  const gunWin = both(-2.35, -1.4, 0.0, 0.85);
  const doors = both(-0.95, 1.65, -0.85, 0.82);
  const cabWin = both(1.85, 2.35, 0.15, 0.6);
  const fus = [
    { z: -5.65, w: 0.45, top: -0.5, bot: -0.85 },
    { z: -5.25, w: 1.35, top: -0.08, bot: -1.0, nt: 2.1, nb: 2.4 },
    { z: -4.6, w: 1.98, top: 0.45, bot: -1.05, nt: 2.3, nb: 3 },
    { z: -3.9, w: 2.26, top: 0.92, bot: -1.06, nt: 2.8, nb: 4.5 },
    { z: -3.1, w: 2.36, top: 1.05, bot: -1.06, nt: 3.2, nb: 5 },
    { z: 2.35, w: 2.36, top: 1.05, bot: -1.06, nt: 3.2, nb: 5 },
    { z: 3.05, w: 2.1, top: 1.0, bot: -0.6, nt: 3, nb: 3 },
    { z: 4.1, w: 1.3, top: 0.96, bot: 0.0, nt: 2.5, nb: 2.5 },
    { z: 5.6, w: 0.8, top: 0.95, bot: 0.45, nt: 2.2, nb: 2.2 },
    { z: 9.3, w: 0.5, top: 0.98, bot: 0.52, nt: 2.2, nb: 2.2 },
    { z: 9.95, w: 0.34, top: 1.02, bot: 0.62 },
  ];
  const dog = [
    { z: -2.4, w: 0.8, top: 1.12, bot: 1.0 },
    { z: -1.7, w: 1.55, top: 1.72, bot: 1.0, nt: 3, nb: 4 },
    { z: 1.2, w: 1.8, top: 1.72, bot: 1.0, nt: 3, nb: 4 },
    { z: 2.7, w: 1.0, top: 1.25, bot: 1.0, nt: 2.4, nb: 3 },
  ];
  const nacelle = (sx) => [
    { z: -0.9, w: 0.55, top: 1.62, bot: 1.08, x: sx * 0.9 },
    { z: -0.6, w: 0.8, top: 1.75, bot: 0.98, x: sx * 0.92, nt: 2.2, nb: 2.2 },
    { z: 1.6, w: 0.8, top: 1.75, bot: 0.98, x: sx * 0.95, nt: 2.2, nb: 2.2 },
    { z: 2.2, w: 0.55, top: 1.62, bot: 1.1, x: sx * 1.0 },
  ];
  const fin = plate([[8.9, 0.6], [9.6, 0.6], [10.75, 3.0], [10.25, 3.05], [9.3, 1.5]], 0.2, 'zy');
  const stab = plate([[-2.2, 9.0], [2.2, 9.0], [2.2, 9.75], [-2.2, 9.75]], 0.07, 'xz');
  stab.translate(0, 0.42, 0);
  const h = hull(group, 'uh60', [
    { keys: fus, holes: [...cockpitWin, ...gunWin, ...doors, ...cabWin], glass: [...cockpitWin, ...cabWin], capEnd: true },
    { keys: dog, capStart: true, capEnd: true, radial: 24 },
    { keys: nacelle(-1), capStart: true, capEnd: true, radial: 20 },
    { keys: nacelle(1), capStart: true, capEnd: true, radial: 20 },
  ], { base: '#3b4033', frames: 18, stringers: 9, soot: [[0.45, 0.8, 0.05, 0.4]] }, [fin, stab]);

  const parts = [];
  parts.push(P(box(2.3, 0.06, 5.6), 0x26281f, [0, -0.82, -0.4]));
  parts.push(P(box(2.3, 1.8, 0.06), 0x34372c, [0, 0.1, 2.36]));
  parts.push(P(box(2.1, 0.08, 0.45), 0x4a4a3c, [0, -0.45, 1.95]), P(box(2.1, 0.55, 0.06), 0x4a4a3c, [0, -0.15, 2.3]));
  cockpit(parts, group, { z: -4.25, w: 2.0, y: -0.3, seatX: 0.55, seatZ: -3.3, seatY: -0.4 });
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.06, 1.75, 1.8), 0x393d31, [sx * 1.26, 0.0, 2.4]));
    parts.push(P(box(0.04, 0.5, 0.6), 0x1b2023, [sx * 1.3, 0.35, 2.4]));
    parts.push(P(box(0.12, 0.75, 0.14), COL.metal, [sx * 1.32, -1.0, -3.3], [0, 0, sx * -0.35]));
    parts.push(P(box(0.95, 0.1, 0.14), 0x3b3d38, [sx * 0.85, -0.92, -3.3]));
    parts.push(P(cyl(0.06, 0.06, 0.8, 8), 0x555555, [sx * 1.05, -0.8, -3.0], [0.7, 0, sx * 0.4]));
    wheel(parts, 0.34, 0.24, [sx * 1.45, -1.21, -3.3]);
    parts.push(P(cyl(0.26, 0.3, 0.6, 14), 0x1d1d1b, [sx * 1.1, 1.4, 2.4], [HALFPI, 0, sx * -0.55]));
    parts.push(P(tor(0.27, 0.05, 14), 0x2a2a2a, [sx * 0.92, 1.37, -0.92]));
    parts.push(P(box(0.3, 0.04, 0.2), 0x2a2b2b, [sx * 1.25, -0.9, -2.6]));
  }
  wheel(parts, 0.2, 0.14, [0, -1.35, 8.85]);
  parts.push(P(box(0.12, 1.9, 0.14), COL.metal, [0, -0.4, 9.05], [0.15, 0, 0]));
  parts.push(P(cyl(0.16, 0.2, 0.7, 12), COL.metal, [0, 2.0, -0.35]));
  parts.push(P(box(0.05, 0.9, 0.08), 0x777777, [0, 1.35, -3.9], [-0.35, 0, 0]));
  parts.push(P(box(0.05, 0.6, 0.08), 0x777777, [0, -1.25, -4.2], [0.4, 0, 0]));
  parts.push(P(box(0.04, 0.45, 0.25), 0x111111, [0, 1.2, 4.6], [0.35, 0, 0]));
  parts.push(P(cyl(0.15, 0.15, 0.45, 8), COL.gun, [0.25, 2.6, 10.3], [0, 0, HALFPI]));
  for (const s of [-1, 1]) {
    crossDecal(group, 0.8, [h.X(2.85), 0.35, 2.85], s);
    decal(group, 'U.S. ARMY', 2.0, 0.36, [h.X(7.0), 0.72, 7.0], s);
    decal(group, number, 0.95, 0.24, [0.14, 1.75, 9.95], s, '#151511', 'bold 72px Arial', -0.06);
  }
  crossDecal(group, 0.55, [0, -0.52, -5.33], 1, HALFPI);

  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.4, -0.35);
  mainRotor.add(new THREE.Mesh(rotorGeo(4, 8.2, 0.53), detailMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.4, 2.6, 10.3);
  tailRotor.rotation.z = -0.35;
  tailRotor.add(new THREE.Mesh(tailRotorGeo(4, 1.7), detailMat));
  group.add(tailRotor);
  const f = finish(group, parts, {
    guns: { x: 1.17, y: 0.2, z: -1.9, figX: 0.7, sitY: -0.2 }, floor: -0.82,
    pilots: { x: 0.55, z: -3.35, sitY: -0.3 },
    discs: [{ obj: mainRotor, r: 8.2 }],
    beacon: [0, 1.1, 3.8],
  });
  const seats = seatsGrid([
    [-0.8, 1.85, 0, 'bench'], [-0.25, 1.85, 0, 'bench'], [0.3, 1.85, 0, 'bench'], [0.85, 1.85, 0, 'bench'],
    [-0.5, 0.9, 0, 'bench'], [0.0, 0.9, 0, 'bench'], [0.5, 0.9, 0, 'bench'],
    [-0.5, -0.1, PI, 'bench'], [0.0, -0.1, PI, 'bench'], [0.5, -0.1, PI, 'bench'], [0.0, 0.4, 0, 'floor'],
  ]);
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats, isStatic,
    eyePilot: new THREE.Vector3(0.55, 0.74, -3.72),
    spin: [[mainRotor, 'y', 26], [tailRotor, 'x', 75]],
    exhaust: new THREE.Vector3(1.1, 1.4, 2.5),
    gear: [[-1.45, -1.55, -3.3], [1.45, -1.55, -3.3], [0, -1.55, 8.85]],   // Aufsetzpunkte (Räder/Kufen) für den Bodenkontakt
  };
}

// ================================================================= CH-47 Chinook
function buildChinook({ static: isStatic = false, number = '82+01' } = {}) {
  const group = new THREE.Group();
  const cockpitWin = [
    { z0: -8.45, z1: -7.15, a0: 0.42, a1: PI - 0.42 },
    { z0: -8.4, z1: -7.6, a0: PI + 0.75, a1: 2 * PI - 0.75 },
    ...both(-8.1, -6.65, -0.25, 0.42),
  ];
  const gunWin = [{ z0: -5.85, z1: -4.55, a0: -0.75, a1: 0.6 }, { z0: -5.6, z1: -4.6, a0: PI - 0.6, a1: PI + 0.25 }];
  const cabWin = [];
  for (let i = 0; i < 5; i++) cabWin.push(...both(-2.6 + i * 1.9, -2.15 + i * 1.9, 0.08, 0.36));
  const fus = [
    { z: -8.75, w: 0.6, top: -0.35, bot: -0.8 },
    { z: -8.35, w: 2.25, top: 0.4, bot: -1.05, nt: 2.1, nb: 2.4 },
    { z: -7.6, w: 3.0, top: 1.0, bot: -1.12, nt: 2.4, nb: 3.5 },
    { z: -6.6, w: 3.38, top: 1.52, bot: -1.15, nt: 2.6, nb: 6 },
    { z: 5.6, w: 3.4, top: 1.56, bot: -1.15, nt: 2.6, nb: 6 },
    { z: 6.9, w: 3.32, top: 1.56, bot: -1.15, nt: 2.6, nb: 6 },
    { z: 7.45, w: 3.2, top: 1.5, bot: -1.15, nt: 2.6, nb: 6 },   // Heck über der Rampe offen
  ];
  // hoher hinterer Pylon mit fast senkrechter Hinterkante (Rotor deutlich höher als vorn)
  const rearPylon = [
    { z: 2.9, w: 0.8, top: 1.62, bot: 1.5 },
    { z: 4.1, w: 1.5, top: 2.95, bot: 1.42, nt: 2.8, nb: 4 },
    { z: 6.3, w: 1.62, top: 3.8, bot: 1.42, nt: 2.6, nb: 4 },
    { z: 7.6, w: 1.55, top: 3.78, bot: 1.45, nt: 2.6, nb: 4 },
    { z: 8.0, w: 1.1, top: 3.2, bot: 1.55, nt: 2.4, nb: 3 },
  ];
  // vorderer Pylon über dem Cockpit, nach vorn abgeschrägt
  const frontPylon = [
    { z: -7.45, w: 0.65, top: 1.12, bot: 1.0 },
    { z: -6.95, w: 1.42, top: 2.15, bot: 1.08, nt: 2.6, nb: 4 },
    { z: -5.5, w: 1.48, top: 2.5, bot: 1.18, nt: 2.6, nb: 4 },
    { z: -4.5, w: 1.0, top: 2.1, bot: 1.35, nt: 2.4, nb: 3 },
    { z: -4.1, w: 0.6, top: 1.8, bot: 1.45 },
  ];
  const spine = [{ z: -4.6, w: 0.55, top: 1.8, bot: 1.4 }, { z: -4.2, w: 0.65, top: 1.95, bot: 1.4 }, { z: 3.8, w: 0.65, top: 1.95, bot: 1.4 }, { z: 4.2, w: 0.55, top: 1.85, bot: 1.4 }];
  const sponson = (sx) => [
    { z: -4.7, w: 0.3, top: -0.4, bot: -0.9, x: sx * 1.8 },
    { z: -4.2, w: 0.85, top: -0.2, bot: -1.12, x: sx * 1.98, nt: 3, nb: 3 },
    { z: 3.9, w: 0.85, top: -0.2, bot: -1.12, x: sx * 1.98, nt: 3, nb: 3 },
    { z: 4.5, w: 0.3, top: -0.4, bot: -0.9, x: sx * 1.8 },
  ];
  // große Triebwerksgondeln seitlich am hinteren Pylon
  const engineNac = (sx) => [
    { z: 4.15, w: 0.75, top: 2.0, bot: 1.2, x: sx * 2.05 },
    { z: 4.5, w: 1.1, top: 2.18, bot: 1.0, x: sx * 2.08, nt: 2.2, nb: 2.2 },
    { z: 7.0, w: 1.08, top: 2.16, bot: 1.02, x: sx * 2.1, nt: 2.2, nb: 2.2 },
    { z: 7.6, w: 0.72, top: 1.95, bot: 1.22, x: sx * 2.1 },
  ];
  const h = hull(group, 'ch47', [
    { keys: fus, holes: [...cockpitWin, ...gunWin, ...cabWin], glass: [...cockpitWin, ...cabWin], radial: 40 },
    { keys: rearPylon, capStart: true, capEnd: true, radial: 24 },
    { keys: frontPylon, capStart: true, capEnd: true, radial: 24 },
    { keys: spine, capStart: true, capEnd: true, radial: 16 },
    { keys: sponson(-1), capStart: true, capEnd: true, radial: 20 },
    { keys: sponson(1), capStart: true, capEnd: true, radial: 20 },
    { keys: engineNac(-1), capStart: true, radial: 20 },
    { keys: engineNac(1), capStart: true, radial: 20 },
  ], { base: '#50575c', frames: 30, stringers: 10, soot: [[0.82, 1.0, 0.1, 0.45]] });

  const parts = [];
  parts.push(P(box(3.2, 0.06, 13.8), 0x25271e, [0, -1.08, -0.3]));
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.45, 0.08, 9.8), 0x4a5054, [sx * 1.35, -0.6, 0.6]));
    parts.push(P(box(0.06, 0.55, 9.8), 0x454b4f, [sx * 1.6, -0.3, 0.6]));
    // vorne Doppelräder, hinten je ein Rad pro Seite
    for (const dx of [-0.2, 0.2]) wheel(parts, 0.42, 0.24, [sx * 1.6 + dx, -1.33, -4.6]);
    parts.push(P(box(0.16, 0.65, 0.16), COL.metal, [sx * 1.6, -0.95, -4.6]));
    wheel(parts, 0.45, 0.3, [sx * 1.6, -1.3, 5.05]);
    parts.push(P(box(0.16, 0.65, 0.16), COL.metal, [sx * 1.6, -0.95, 5.05]));
    parts.push(P(box(0.1, 0.08, 0.9), COL.metal, [sx * 1.6, -0.75, 5.4], [0.5, 0, 0]));
    // Triebwerke: Einlauf mit Gitter, Abgasdüse, Haltestreben
    parts.push(P(cyl(0.4, 0.34, 0.3, 14), 0x1b1b19, [sx * 2.1, 1.59, 7.72], [HALFPI, 0, 0]));
    parts.push(P(cyl(0.3, 0.3, 0.05, 14), 0x050505, [sx * 2.1, 1.59, 7.88], [HALFPI, 0, 0]));
    parts.push(P(tor(0.46, 0.065, 14), 0x2a2a2a, [sx * 2.06, 1.59, 4.17]));
    parts.push(P(cyl(0.42, 0.42, 0.04, 14), 0x23262a, [sx * 2.06, 1.59, 4.2], [HALFPI, 0, 0]));
    for (const z of [5.0, 6.6]) parts.push(P(box(0.55, 0.1, 0.12), 0x3f4448, [sx * 1.68, 1.55, z]));
    // Rückspiegel, Trittstufen an der Tür
    parts.push(P(box(0.04, 0.26, 0.18), 0x222222, [sx * 1.55, 0.45, -8.0]));
    parts.push(P(box(0.05, 0.05, 0.42), 0x2a2b2b, [sx * 1.72, -0.65, -5.2]));
    parts.push(P(box(0.3, 0.04, 0.3), 0x2a2b2b, [sx * 1.7, -1.0, -5.3]));
  }
  // Heckrampe: Scharnier am Kabinenboden, abgesenkt bis zum Boden
  // Scharnier am Ende des Kabinenbodens (z 6.95), hinteres Ende liegt auf dem Boden auf
  const ramp = rampPart(group, { y: -1.12, z: 6.95, w: 2.6, len: 2.3, col: 0x3c4246, open: 0.28 });
  parts.push(P(box(3.0, 1.9, 0.06), 0x353a3e, [0, 0.0, -6.55]));
  cockpit(parts, group, { z: -8.0, w: 2.5, y: -0.25, seatX: 0.65, seatZ: -7.15, seatY: -0.45 });
  parts.push(P(cyl(0.2, 0.24, 0.65, 12), COL.metal, [0, 2.75, -6.0]), P(cyl(0.2, 0.24, 0.65, 12), COL.metal, [0, 4.05, 6.8]));
  // Antennen, Positionslichter, Wartungsklappen-Rahmen am Pylon
  parts.push(P(box(0.03, 0.45, 0.16), 0x161616, [0, -1.35, 0.5], [0.3, 0, 0]), P(box(0.03, 0.4, 0.15), 0x161616, [0, 1.95, -2.8], [-0.3, 0, 0]));
  parts.push(P(box(1.0, 0.04, 2.0), 0x2c3134, [0, 3.83, 6.95]));
  parts.push(P(box(0.04, 0.5, 0.25), 0x111111, [0, 1.9, -2.0], [0.35, 0, 0]));
  parts.push(P(cyl(0.03, 0.03, 1.6, 6), 0x111111, [0.4, -1.0, -8.0], [1.2, 0, 0]));
  // Luftbetankungssonde (deutsche CH-47F): rechts unten am Bug, weit über die Nase hinaus
  parts.push(P(cyl(0.075, 0.075, 7.4, 10), 0x2c3033, [1.78, -0.55, -8.0], [HALFPI, 0, 0]));
  parts.push(P(cyl(0.11, 0.075, 0.45, 12), 0x1e2123, [1.78, -0.55, -11.9], [HALFPI, 0, 0]));
  parts.push(P(cyl(0.05, 0.11, 0.18, 12), 0x8a8f92, [1.78, -0.55, -12.2], [HALFPI, 0, 0]));
  parts.push(P(box(0.26, 0.26, 1.1), 0x464c50, [1.72, -0.55, -4.6]));
  for (const z of [-5.6, -7.0]) parts.push(P(box(0.32, 0.07, 0.14), 0x2c3033, [1.6, -0.55, z]));
  for (const s of [-1, 1]) {
    decal(group, 'LUFTWAFFE', 2.8, 0.55, [h.X(1.6), 0.95, 1.6], s);
    ironCross(group, 1.0, [h.X(4.9), 0.45, 4.9], s);
    decal(group, number, 1.2, 0.3, [0.79, 2.65, 6.1], s);
  }
  const front = new THREE.Group();
  front.position.set(0, 3.1, -6.0);
  front.add(new THREE.Mesh(rotorGeo(3, 9.1, 0.8, { hubR: 0.45 }), detailMat));
  group.add(front);
  const rear = new THREE.Group();
  rear.position.set(0, 4.4, 6.8);
  rear.add(new THREE.Mesh(rotorGeo(3, 9.1, 0.8, { hubR: 0.45 }), detailMat));
  group.add(rear);
  const f = finish(group, parts, {
    gunGeo: m134Geo(), spinGeo: m134Barrels(),
    gunMounts: [
      { side: 'left', pos: [-1.62, 0.15, -5.1], baseYaw: HALFPI, fig: [-1.15, 0, -4.85], sitY: -0.35, post: true },
      { side: 'right', pos: [1.62, 0.15, -5.1], baseYaw: -HALFPI, fig: [1.15, 0, -4.85], sitY: -0.35, post: true },
      // Heckschütze mit Minigun auf der Rampe, Blick nach hinten
      { side: 'ramp', pos: [0, -0.4, 8.6], baseYaw: Math.PI, fig: [0, 0, 8.05], sitY: -0.35, eye: [0, 0.32, 0.55], arc: { yaw: 1.15, pmin: -1.0, pmax: 0.25 } },
    ],
    floor: -1.08,
    pilots: { x: 0.65, z: -7.25, sitY: -0.35 },
    discs: [{ obj: front, r: 9.1 }, { obj: rear, r: 9.1 }],
    beacon: [0, 3.3, 4.6],
  });
  const seatList = [];
  // Truppensitze an den Bordwänden, Rücken zur Wand, Blick zur Kabinenmitte
  for (let i = 0; i < 17; i++) for (const s of [-1, 1]) seatList.push([s * 1.25, -4.3 + i * 0.62, s < 0 ? -HALFPI : HALFPI, 'floor']);
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor: front, tailRotor: rear, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats: seatsGrid(seatList, [0.35, -0.5]), isStatic, ramp,
    eyePilot: new THREE.Vector3(0.65, 0.74, -7.66),
    spin: [[front, 'y', 18], [rear, 'y', -18]],
    exhaust: new THREE.Vector3(2.1, 1.59, 7.85),
    gear: [[-1.6, -1.75, -4.6], [1.6, -1.75, -4.6], [-1.6, -1.75, 5.05], [1.6, -1.75, 5.05]],   // Aufsetzpunkte (Räder/Kufen) für den Bodenkontakt
  };
}

// ================================================================= CH-53GS (Luftwaffe)
function buildCH53({ static: isStatic = false, number = '85+12' } = {}) {
  const group = new THREE.Group();
  const cockpitWin = [
    { z0: -7.0, z1: -5.45, a0: 0.42, a1: PI - 0.42 },
    { z0: -7.0, z1: -6.2, a0: PI + 0.75, a1: 2 * PI - 0.75 },
    ...both(-6.6, -5.0, -0.22, 0.42),
  ];
  const gunWin = [{ z0: -4.55, z1: -3.3, a0: -0.7, a1: 0.65 }, { z0: -4.4, z1: -3.4, a0: PI - 0.65, a1: PI + 0.3 }];
  const cabWin = [];
  for (let i = 0; i < 4; i++) cabWin.push(...both(-2.4 + i * 1.6, -1.95 + i * 1.6, 0.1, 0.45));
  const fus = [
    { z: -7.45, w: 0.55, top: -0.3, bot: -0.75 },
    { z: -7.05, w: 1.95, top: 0.35, bot: -1.0, nt: 2.1, nb: 2.4 },
    { z: -6.25, w: 2.7, top: 1.0, bot: -1.1, nt: 2.4, nb: 3.5 },
    { z: -5.0, w: 3.0, top: 1.42, bot: -1.15, nt: 2.7, nb: 5 },
    { z: 4.4, w: 3.0, top: 1.48, bot: -1.15, nt: 2.7, nb: 5 },
    { z: 5.7, w: 2.75, top: 1.62, bot: -0.55, nt: 2.6, nb: 3 },
    { z: 7.3, w: 1.85, top: 1.82, bot: 0.45, nt: 2.4, nb: 2.4 },
    { z: 9.1, w: 1.1, top: 2.02, bot: 1.0, nt: 2.2, nb: 2.2 },
    { z: 11.7, w: 0.62, top: 2.45, bot: 1.62, nt: 2.2, nb: 2.2 },
    { z: 12.3, w: 0.4, top: 2.55, bot: 1.92 },
  ];
  // langer Aufbau über der Kabine (Getriebe, Triebwerke), läuft flach in den Heckausleger aus
  const top = [
    { z: -5.05, w: 0.7, top: 1.3, bot: 1.05 },
    { z: -4.5, w: 1.65, top: 2.0, bot: 1.15, nt: 2.6, nb: 4 },
    { z: -1.2, w: 2.05, top: 2.55, bot: 1.25, nt: 2.9, nb: 4 },
    { z: 2.3, w: 1.95, top: 2.5, bot: 1.3, nt: 2.9, nb: 4 },
    { z: 4.8, w: 1.25, top: 2.05, bot: 1.4, nt: 2.6, nb: 4 },
    { z: 6.6, w: 0.62, top: 1.95, bot: 1.6 },
  ];
  // Triebwerksgondeln seitlich am Aufbau, Einlauf vorn hinter dem Cockpit
  const nac = (sx) => [
    { z: -4.0, w: 0.82, top: 2.28, bot: 1.52, x: sx * 1.3 },
    { z: -3.7, w: 0.98, top: 2.42, bot: 1.42, x: sx * 1.32, nt: 2.3, nb: 2.3 },
    { z: 0.2, w: 0.98, top: 2.42, bot: 1.42, x: sx * 1.36, nt: 2.3, nb: 2.3 },
    { z: 1.05, w: 0.7, top: 2.3, bot: 1.58, x: sx * 1.42 },
  ];
  const sponson = (sx) => [
    { z: -1.7, w: 0.4, top: -0.3, bot: -0.85, x: sx * 1.75 },
    { z: -1.2, w: 1.05, top: -0.05, bot: -1.05, x: sx * 1.95, nt: 3, nb: 3 },
    { z: 2.6, w: 1.05, top: -0.05, bot: -1.05, x: sx * 1.95, nt: 3, nb: 3 },
    { z: 3.2, w: 0.4, top: -0.3, bot: -0.85, x: sx * 1.75 },
  ];
  const tank = (sx) => [
    { z: -1.9, w: 0.1, top: -0.22, bot: -0.32, x: sx * 2.8 },
    { z: -1.5, w: 0.85, top: 0.2, bot: -0.7, x: sx * 2.8, nt: 2, nb: 2 },
    { z: 2.4, w: 0.85, top: 0.2, bot: -0.7, x: sx * 2.8, nt: 2, nb: 2 },
    { z: 3.1, w: 0.1, top: -0.2, bot: -0.3, x: sx * 2.8 },
  ];
  // Heckpylon: breit am Fuß, nach hinten gepfeilt und – typisch CH-53 – um ca. 20° nach links geneigt
  const CANT = 0.35, PIV = 1.9;
  const fin = plate([[10.3, 1.75], [12.55, 1.95], [13.2, 5.8], [12.45, 5.95], [11.55, 3.3]], 0.44, 'zy');
  fin.translate(0, -PIV, 0); fin.rotateZ(CANT); fin.translate(0, PIV, 0);
  const lean = (y) => -Math.sin(CANT) * (y - PIV);
  const stab = plate([[0, 12.05], [3.3, 12.3], [3.3, 13.0], [0, 12.95]], 0.1, 'xz');
  stab.translate(lean(5.1) + 0.2, 5.1, 0);   // Höhenflosse rechts am Pylon, gerade (CH-53G/GS)
  const h = hull(group, 'ch53', [
    { keys: fus, holes: [...cockpitWin, ...gunWin, ...cabWin, { z0: 4.5, z1: 6.9, a0: PI + 0.45, a1: 2 * PI - 0.45 }], glass: [...cockpitWin, ...cabWin], capEnd: true, radial: 40 },
    { keys: top, capStart: true, capEnd: true, radial: 24 },
    { keys: nac(-1), capStart: true, capEnd: true, radial: 20 },
    { keys: nac(1), capStart: true, capEnd: true, radial: 20 },
    { keys: sponson(-1), capStart: true, capEnd: true, radial: 20 },
    { keys: sponson(1), capStart: true, capEnd: true, radial: 20 },
    { keys: tank(-1), radial: 18 },
    { keys: tank(1), radial: 18 },
  ], { base: '#4b5141', camo: ['#3c4734', '#2c3029', '#5a5c45'], frames: 26, stringers: 10, soot: [[0.4, 0.6, 0.05, 0.3]] }, [fin, stab]);

  const parts = [], gearParts = [];
  parts.push(P(box(2.8, 0.06, 9.6), 0x25271e, [0, -1.02, -0.2]));
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.45, 0.08, 7.5), 0x55553f, [sx * 1.15, -0.55, 0.3]));
    wheel(gearParts, 0.42, 0.32, [sx * 1.95, -1.23, 0.4]);
    gearParts.push(P(box(0.18, 0.5, 0.2), COL.metal, [sx * 1.95, -0.95, 0.4]));
    // Fahrwerksschacht unten in der Stummelfläche
    parts.push(P(box(0.5, 0.03, 1.0), 0x1d1f19, [sx * 1.95, -1.03, 0.4]));
    // Triebwerkseinlauf mit Schutzgitter, Abgasrohr nach außen geknickt
    parts.push(P(tor(0.4, 0.07, 14), 0x2a2a2a, [sx * 1.3, 1.9, -4.02]));
    parts.push(P(cyl(0.36, 0.36, 0.04, 14), 0x16171a, [sx * 1.3, 1.9, -3.98], [HALFPI, 0, 0]));
    parts.push(P(cyl(0.3, 0.36, 0.7, 14), 0x1b1b19, [sx * 1.62, 1.95, 1.35], [HALFPI, sx * 0.55, 0]));
    parts.push(P(cyl(0.24, 0.24, 0.05, 14), 0x050505, [sx * 1.82, 1.95, 1.65], [HALFPI, sx * 0.55, 0]));
    // Rückspiegel und Trittstufen
    parts.push(P(box(0.04, 0.28, 0.2), 0x222222, [sx * 1.25, 0.55, -6.6]), P(cyl(0.015, 0.015, 0.45, 5), 0x222222, [sx * 1.12, 0.55, -6.6], [0, 0, HALFPI]));
    for (const y of [-0.55, -0.15]) parts.push(P(box(0.05, 0.05, 0.4), 0x2a2b2b, [sx * 1.52, y, -4.0]));
    parts.push(P(box(0.3, 0.04, 0.3), 0x2a2b2b, [sx * 1.55, -0.95, -4.0]));
  }
  wheel(gearParts, 0.32, 0.22, [-0.3, -1.33, -5.6]);
  wheel(gearParts, 0.32, 0.22, [0.3, -1.33, -5.6]);
  gearParts.push(P(box(0.15, 0.55, 0.15), COL.metal, [0, -1.0, -5.6]));
  // Einziehfahrwerk: Räder fahren in Stummelflächen und Bug ein
  const gearObj = new THREE.Group();
  gearObj.add(new THREE.Mesh(merge(gearParts), detailMat));
  group.add(gearObj);
  const retract = { obj: gearObj, lift: 0.72, k: 0, up: false };
  // Heckrampe: Scharnier am Kabinenboden (z 4.6), hinteres Ende auf dem Boden
  // Rettungswinde über der rechten vorderen Tür
  parts.push(P(box(0.6, 0.14, 0.16), 0x3a3d40, [1.5, 1.35, -3.9]), P(cyl(0.15, 0.15, 0.5, 10), 0xd8d8d0, [1.78, 1.28, -3.9], [HALFPI, 0, 0]));
  const ramp = rampPart(group, { y: -1.05, z: 4.6, w: 2.3, len: 2.3, col: 0x353a2c, open: 0.26 });
  parts.push(P(box(2.9, 2.2, 0.06), 0x34372c, [0, 0.1, -4.75]));
  cockpit(parts, group, { z: -6.45, w: 2.3, y: -0.2, seatX: 0.6, seatZ: -5.45, seatY: -0.42 });
  parts.push(P(cyl(0.24, 0.28, 0.85, 12), COL.metal, [0, 2.7, 0]));
  parts.push(P(box(0.04, 0.5, 0.28), 0x111111, [0, 2.75, 3.6], [0.35, 0, 0]));
  // Wärmebildkamera (FLIR) unter der Nase, Antennen, Hilfstriebwerk-Auslass
  parts.push(P(sph(0.26, 12, 8), 0x2a2d2c, [0, -1.05, -6.4]), P(cyl(0.16, 0.16, 0.2, 10), 0x2a2d2c, [0, -0.86, -6.4]));
  parts.push(P(box(0.03, 0.4, 0.16), 0x161616, [0, -1.3, -1.0], [0.3, 0, 0]), P(box(0.03, 0.35, 0.14), 0x161616, [0, 1.95, 7.6], [-0.4, 0, 0]));
  parts.push(P(cyl(0.12, 0.12, 0.3, 8), 0x1a1a1a, [0.7, 2.2, 3.2], [0, 0, HALFPI]));
  // Heckrotornabe am geneigten Pylon
  parts.push(P(cyl(0.2, 0.2, 0.55, 10), COL.gun, [lean(4.9) - 0.3, 4.9, 12.55], [0, 0, HALFPI + CANT]));
  for (const s of [-1, 1]) {
    decal(group, 'LUFTWAFFE', 2.4, 0.48, [h.X(1.8), 0.95, 1.8], s);
    ironCross(group, 0.9, [h.X(-1.4), 0.6, -1.4], s);
    decal(group, number, 1.3, 0.34, [h.X(7.6), 1.3, 7.6], s, '#151511', 'bold 72px Arial', -0.25);
  }
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 3.1, 0);
  mainRotor.add(new THREE.Mesh(rotorGeo(6, 11, 0.7, { hubR: 0.5 }), detailMat));
  group.add(mainRotor);
  // Heckrotor links am geneigten Pylon: äußere Gruppe neigt, innere dreht
  const trTilt = new THREE.Group();
  trTilt.position.set(lean(4.9) - 0.62, 4.9, 12.55);
  trTilt.rotation.z = CANT;
  const tailRotor = new THREE.Group();
  tailRotor.add(new THREE.Mesh(tailRotorGeo(4, 3.0, 0.32), detailMat));
  trTilt.add(tailRotor);
  group.add(trTilt);
  const f = finish(group, parts, {
    gunGeo: m3mGeo(),
    gunMounts: [
      { side: 'left', pos: [-1.42, 0.25, -3.9], baseYaw: HALFPI, fig: [-0.95, 0, -3.65], sitY: -0.3, post: true },
      { side: 'right', pos: [1.42, 0.25, -3.9], baseYaw: -HALFPI, fig: [0.95, 0, -3.65], sitY: -0.3, post: true },
      // Heckschütze auf der Rampe, Blick nach hinten
      { side: 'ramp', pos: [0, -0.35, 6.3], baseYaw: Math.PI, fig: [0, 0, 5.75], sitY: -0.32, eye: [0, 0.32, 0.55], arc: { yaw: 1.15, pmin: -1.0, pmax: 0.25 } },
    ],
    floor: -1.02,
    pilots: { x: 0.6, z: -5.5, sitY: -0.32 },
    discs: [{ obj: mainRotor, r: 11 }],
    beacon: [0, 2.6, 3.0],
  });
  const seatList = [];
  // Truppensitze an den Bordwänden, Rücken zur Wand, Blick zur Kabinenmitte
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) seatList.push([s * 1.05, -2.9 + i * 0.62, s < 0 ? -HALFPI : HALFPI, 'floor']);
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats: seatsGrid(seatList, [0.35, -0.45]), isStatic, ramp, retract,
    hoist: new THREE.Vector3(1.75, 1.0, -3.9),
    eyePilot: new THREE.Vector3(0.6, 0.76, -5.92),
    spin: [[mainRotor, 'y', 17], [tailRotor, 'x', 60]],
    exhaust: new THREE.Vector3(1.8, 1.95, 1.7),
    gear: [[-1.95, -1.65, 0.4], [1.95, -1.65, 0.4], [0, -1.65, -5.6]],   // Aufsetzpunkte (Räder/Kufen) für den Bodenkontakt
  };
}

// ================================================================= AH-64E Apache Guardian
// Tandemcockpit (vorn Waffensystemoffizier, hinten Pilot), Stummelflügel mit Raketen und Hellfire,
// 30-mm-Kettenkanone im Kinn, Zielsensor in der Nase, Longbow-Radar auf dem Mast
function m230Geo() {
  return merge([
    P(box(0.32, 0.26, 0.5), 0x2a2c27, [0, 0, 0.05]),
    P(cyl(0.05, 0.05, 1.7, 10), 0x1e1f1d, [0, 0, -0.9], [HALFPI, 0, 0]),
    P(cyl(0.075, 0.075, 0.5, 10), 0x2a2c27, [0, 0, -0.35], [HALFPI, 0, 0]),
    P(cyl(0.07, 0.06, 0.12, 10), 0x111111, [0, 0, -1.75], [HALFPI, 0, 0]),
    P(box(0.2, 0.18, 0.3), 0x3a3e33, [0.22, 0.02, 0.15]),
  ]);
}

export function buildApache({ static: isStatic = false, number = '09-05601' } = {}) {
  const group = new THREE.Group();
  const canopy = [{ z0: -5.55, z1: -2.35, a0: 0.2, a1: PI - 0.2 }];
  const fus = [
    { z: -6.75, w: 0.5, top: -0.15, bot: -0.55 },
    { z: -6.25, w: 0.95, top: 0.12, bot: -0.78, nt: 3, nb: 2.6 },
    { z: -5.4, w: 1.0, top: 0.5, bot: -0.88, nt: 3.2, nb: 3 },
    { z: -4.1, w: 1.06, top: 0.98, bot: -0.92, nt: 3.4, nb: 3.4 },
    { z: -3.0, w: 1.12, top: 1.38, bot: -0.92, nt: 3.4, nb: 3.4 },
    { z: -2.0, w: 1.22, top: 1.42, bot: -0.86, nt: 3.4, nb: 3.4 },
    { z: 0.6, w: 1.26, top: 1.46, bot: -0.7, nt: 3.4, nb: 3.4 },
    { z: 2.5, w: 1.0, top: 1.25, bot: -0.2, nt: 3, nb: 3 },
    { z: 4.0, w: 0.62, top: 1.06, bot: 0.25, nt: 2.6, nb: 2.6 },
    { z: 9.0, w: 0.42, top: 1.05, bot: 0.55, nt: 2.4, nb: 2.4 },
    { z: 9.95, w: 0.3, top: 1.0, bot: 0.66 },
  ];
  const nac = (sx) => [
    { z: -1.0, w: 0.45, top: 1.3, bot: 0.9, x: sx * 0.95 },
    { z: -0.7, w: 0.62, top: 1.48, bot: 0.74, x: sx * 0.98, nt: 2.4, nb: 2.4 },
    { z: 2.3, w: 0.62, top: 1.48, bot: 0.74, x: sx * 1.0, nt: 2.4, nb: 2.4 },
    { z: 2.9, w: 0.42, top: 1.32, bot: 0.9, x: sx * 1.02 },
  ];
  const fairing = [
    { z: -2.2, w: 0.5, top: 1.5, bot: 1.4 },
    { z: -1.4, w: 0.95, top: 1.95, bot: 1.4, nt: 3, nb: 4 },
    { z: 1.4, w: 0.95, top: 1.9, bot: 1.4, nt: 3, nb: 4 },
    { z: 2.6, w: 0.5, top: 1.5, bot: 1.4 },
  ];
  const wing = plate([[-2.65, -0.35], [2.65, -0.35], [2.65, 0.75], [-2.65, 0.75]], 0.1, 'xz');
  wing.translate(0, 0.55, 0);
  const fin = plate([[8.8, 0.75], [9.85, 0.75], [10.6, 3.05], [10.0, 3.1], [9.3, 1.6]], 0.18, 'zy');
  const stab = plate([[-1.7, 9.35], [1.7, 9.35], [1.7, 10.0], [-1.7, 10.0]], 0.07, 'xz');
  stab.translate(0, 0.62, 0);
  const h = hull(group, 'ah64', [
    { keys: fus, holes: canopy, glass: canopy, capEnd: true, radial: 32 },
    { keys: nac(-1), capStart: true, capEnd: true, radial: 18 },
    { keys: nac(1), capStart: true, capEnd: true, radial: 18 },
    { keys: fairing, capStart: true, capEnd: true, radial: 20 },
  ], { base: '#3a3f35', frames: 22, stringers: 8, soot: [[0.42, 0.62, 0.05, 0.25]] }, [wing, fin, stab]);

  const parts = [];
  // Cockpitrahmen, Sitze, Instrumente (vorn tiefer, hinten erhöht)
  for (const [z, y] of [[-4.6, -0.55], [-3.25, -0.15]]) {
    parts.push(P(box(0.5, 0.1, 0.5), 0x2f302b, [0, y, z]));
    parts.push(P(box(0.5, 0.75, 0.1), 0x2f302b, [0, y + 0.42, z + 0.3]));
    parts.push(P(box(0.85, 0.42, 0.1), 0x24272a, [0, y + 0.55, z - 0.75], [-0.4, 0, 0]));
  }
  // Zielsensor (TADS/PNVS) in der Nase
  parts.push(P(cyl(0.34, 0.34, 0.55, 16), 0x2c302a, [0, -0.35, -6.75], [0, 0, HALFPI]));
  parts.push(P(box(0.32, 0.26, 0.08), 0x101215, [0, -0.35, -7.05]));
  parts.push(P(box(0.3, 0.2, 0.4), 0x2c302a, [0, 0.12, -6.6]));
  // Fahrwerk (Hauptfahrwerk vorn, Spornrad hinten)
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.1, 0.1, 1.0), COL.metal, [sx * 0.95, -1.0, -2.6], [0.4, 0, 0]));
    parts.push(P(box(0.1, 0.6, 0.1), 0x555555, [sx * 0.75, -0.75, -2.3], [0, 0, sx * 0.4]));
    wheel(parts, 0.33, 0.2, [sx * 1.05, -1.22, -2.95]);
    // Abgaskühler (Black Hole) seitlich gerichtet
    parts.push(P(cyl(0.22, 0.26, 0.55, 12), 0x1b1b19, [sx * 1.25, 1.1, 3.0], [HALFPI, 0, sx * -0.6]));
    parts.push(P(tor(0.22, 0.04, 12), 0x2a2a2a, [sx * 0.96, 1.11, -1.02]));
    // Waffenstationen unter den Flügeln: Raketenwerfer außen, Hellfire innen
    const ox = sx * 2.25, ix = sx * 1.45;
    parts.push(P(box(0.08, 0.35, 0.6), 0x2a2c27, [ox, 0.33, 0.2]), P(box(0.08, 0.35, 0.6), 0x2a2c27, [ix, 0.33, 0.2]));
    parts.push(P(cyl(0.25, 0.25, 1.65, 14), 0x4a4d3e, [ox, -0.05, 0.1], [HALFPI, 0, 0]));
    parts.push(P(cyl(0.2, 0.2, 0.02, 14), 0x101010, [ox, -0.05, -0.74], [HALFPI, 0, 0]));
    for (const [dx, dy] of [[-0.14, -0.08], [0.14, -0.08], [-0.14, -0.36], [0.14, -0.36]]) {
      parts.push(P(cyl(0.09, 0.09, 1.6, 8), 0x6c6e5c, [ix + dx, 0.2 + dy, 0.2], [HALFPI, 0, 0]));
      parts.push(P(new THREE.ConeGeometry(0.09, 0.2, 8), 0x55584a, [ix + dx, 0.2 + dy, -0.7], [-HALFPI, 0, 0]));
    }
  }
  parts.push(P(box(0.1, 1.4, 0.1), COL.metal, [0, -0.25, 8.6], [-0.2, 0, 0]));
  wheel(parts, 0.18, 0.12, [0, -1.37, 8.75]);
  // Mast, Longbow-Radar, Drahtschneider, Antennen
  parts.push(P(cyl(0.16, 0.2, 0.9, 12), COL.metal, [0, 2.4, -0.3]));
  parts.push(P(sph(0.42, 16, 10), 0x3c4036, [0, 3.45, -0.3], [0, 0, 0], [1, 0.62, 1]));
  parts.push(P(box(0.05, 0.6, 0.06), 0x777777, [0, 1.6, -4.0], [-0.4, 0, 0]));
  parts.push(P(box(0.05, 0.5, 0.06), 0x777777, [0, -1.05, -5.0], [0.4, 0, 0]));
  parts.push(P(box(0.04, 0.4, 0.2), 0x111111, [0, 1.15, 5.5], [0.4, 0, 0]));
  parts.push(P(cyl(0.12, 0.12, 0.35, 8), COL.gun, [-0.22, 2.4, 10.05], [0, 0, HALFPI]));
  for (const s of [-1, 1]) decal(group, number, 0.9, 0.22, [h.X(7.5), 0.82, 7.5], s, '#141512', 'bold 72px Arial', -0.04);

  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.9, -0.3);
  mainRotor.add(new THREE.Mesh(rotorGeo(4, 7.3, 0.53, { hubR: 0.32 }), detailMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-0.36, 2.4, 10.05);
  const tg = merge([P(cyl(0.12, 0.12, 0.2, 10), 0x2b2c2b, [0, 0, 0], [0, 0, HALFPI]),
    ...[0, 1.0, PI, PI + 1.0].map((a) => P(box(0.05, 1.3, 0.22), COL.rotor, [0, Math.cos(a) * 0.7, Math.sin(a) * 0.7], [a, 0, 0]))]);
  tailRotor.add(new THREE.Mesh(tg, detailMat));
  group.add(tailRotor);
  const f = finish(group, parts, {
    gunMounts: [
      { side: 'left', pos: [0, -0.95, -3.75], baseYaw: 0, geo: m230Geo(), muzzleZ: -1.8, eye: [0, -0.24, -0.45], noFig: true },
      { side: 'right', pos: [0, 0, 0], baseYaw: 0, fig: [0, 0, 0], sitY: 0, dummy: true },
    ],
    floor: -0.9,
    pilotList: [[0, -0.05, -4.55, -0.6], [0, 0.35, -3.2, -0.2]],
    cpgGun: 'left',
    discs: [{ obj: mainRotor, r: 7.3 }],
    beacon: [0, 1.5, 4.5],
  });
  // vorderer Sitz = Waffensystemoffizier (gehört zur Kanone), hinterer = Pilot (Kamera im Cockpit)
  f.guns.left.gunner.group.visible = true;
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats: [], isStatic,
    eyePilot: new THREE.Vector3(0, 1.08, -3.25),
    spin: [[mainRotor, 'y', 24], [tailRotor, 'x', 75]],
    exhaust: new THREE.Vector3(1.2, 1.1, 3.1),
    gear: [[-1.05, -1.55, -2.95], [1.05, -1.55, -2.95], [0, -1.55, 8.75]],   // Aufsetzpunkte (Räder/Kufen) für den Bodenkontakt
    rocketPods: [new THREE.Vector3(-2.25, -0.05, -0.8), new THREE.Vector3(2.25, -0.05, -0.8)],
  };
}

// ================================================================= Ukraine: Mi-8 und Mi-24
// Hoheitszeichen der ukrainischen Luftstreitkräfte (blau-gelber Kreis)
function uaRoundel(group, size, pos, side, rotY = null) {
  const parts = [
    P(cyl(size / 2, size / 2, 0.02, 24), 0x0057b7, [0, 0, 0], [0, 0, HALFPI]),
    P(cyl(size * 0.3, size * 0.3, 0.03, 24), 0xffd700, [0, 0, 0], [0, 0, HALFPI]),
  ];
  const m = new THREE.Mesh(merge(parts), detailMat);
  m.position.set(pos[0] * side, pos[1], pos[2]);
  if (rotY !== null) m.rotation.y = rotY;
  group.add(m);
}

// Staubschutz vor den Triebwerkseinläufen (typische „Pilze“ der Mi-8/Mi-24)
function pzu(parts, x, y, z, r) {
  parts.push(P(sph(r, 14, 10), 0x6b6e66, [x, y, z], [0, 0, 0], [1, 1, 1.35]));
  parts.push(P(cyl(r * 0.55, r * 0.55, 0.08, 12), 0x1c1d1b, [x, y, z - r * 1.32], [HALFPI, 0, 0]));
}

function buildMi8({ static: isStatic = false, number = '15' } = {}) {
  const group = new THREE.Group();
  const cockpitWin = [
    { z0: -8.5, z1: -7.35, a0: 0.45, a1: PI - 0.45 },
    { z0: -8.45, z1: -7.75, a0: PI + 0.8, a1: 2 * PI - 0.8 },
    ...both(-8.05, -6.55, -0.15, 0.48),
  ];
  // offene Schiebetür links, MG-Luke rechts
  const doors = [{ z0: -5.0, z1: -3.75, a0: PI - 0.7, a1: PI + 0.62 }, { z0: -4.75, z1: -3.95, a0: -0.45, a1: 0.5 }];
  const cabWin = [];
  for (let i = 0; i < 4; i++) cabWin.push({ z0: -3.2 + i * 1.05, z1: -2.8 + i * 1.05, a0: 0.12, a1: 0.42 });
  for (let i = 0; i < 4; i++) cabWin.push({ z0: -3.0 + i * 1.05, z1: -2.6 + i * 1.05, a0: PI - 0.42, a1: PI - 0.12 });
  const fus = [
    { z: -8.75, w: 0.7, top: -0.2, bot: -0.78 },
    { z: -8.45, w: 1.75, top: 0.25, bot: -1.02, nt: 2.0, nb: 2.6 },
    { z: -7.7, w: 2.3, top: 0.78, bot: -1.15, nt: 2.3, nb: 3.2 },
    { z: -6.6, w: 2.45, top: 1.0, bot: -1.2, nt: 2.6, nb: 4 },
    { z: 0.6, w: 2.5, top: 1.02, bot: -1.2, nt: 2.6, nb: 4 },
    { z: 1.9, w: 2.3, top: 1.0, bot: -0.6, nt: 2.5, nb: 2.8 },   // Heckklappen schräg nach oben
    { z: 2.9, w: 1.3, top: 1.0, bot: 0.15, nt: 2.2, nb: 2.2 },
    { z: 4.6, w: 0.85, top: 0.98, bot: 0.35, nt: 2.1, nb: 2.1 },
    { z: 10.0, w: 0.48, top: 1.1, bot: 0.66 },
    { z: 10.6, w: 0.38, top: 1.15, bot: 0.78 },
  ];
  const top = [
    { z: -6.5, w: 0.9, top: 1.15, bot: 0.95 },
    { z: -5.7, w: 2.1, top: 1.9, bot: 0.95, nt: 2.6, nb: 4 },
    { z: -1.0, w: 2.15, top: 2.2, bot: 0.95, nt: 2.8, nb: 4 },
    { z: 1.3, w: 1.6, top: 2.0, bot: 0.95, nt: 2.6, nb: 4 },
    { z: 2.9, w: 0.7, top: 1.4, bot: 1.0 },
  ];
  const eng = (sx) => [
    { z: -5.8, w: 0.75, top: 2.0, bot: 1.3, x: sx * 0.68 },
    { z: -5.45, w: 0.95, top: 2.15, bot: 1.12, x: sx * 0.7, nt: 2.2, nb: 2.2 },
    { z: -2.2, w: 0.95, top: 2.15, bot: 1.12, x: sx * 0.72, nt: 2.2, nb: 2.2 },
    { z: -1.7, w: 0.7, top: 2.0, bot: 1.3, x: sx * 0.76 },
  ];
  // Zusatztanks außen (rechts lang, links hinter der Tür)
  const tank = (sx, z0, z1) => [
    { z: z0, w: 0.15, top: -0.5, bot: -0.62, x: sx * 1.55 },
    { z: z0 + 0.35, w: 0.95, top: -0.05, bot: -1.0, x: sx * 1.58, nt: 2, nb: 2 },
    { z: z1 - 0.35, w: 0.95, top: -0.05, bot: -1.0, x: sx * 1.58, nt: 2, nb: 2 },
    { z: z1, w: 0.15, top: -0.5, bot: -0.62, x: sx * 1.55 },
  ];
  const fin = plate([[9.85, 1.0], [10.95, 1.1], [11.45, 4.0], [10.95, 4.1], [10.3, 2.0]], 0.3, 'zy');
  const stab = plate([[-1.6, 8.6], [1.6, 8.6], [1.6, 9.4], [-1.6, 9.4]], 0.08, 'xz');
  stab.translate(0, 0.82, 0);
  const h = hull(group, 'mi8', [
    { keys: fus, holes: [...cockpitWin, ...doors, ...cabWin], glass: [...cockpitWin, ...cabWin], capEnd: true, radial: 40 },
    { keys: top, capStart: true, capEnd: true, radial: 24 },
    { keys: eng(-1), capStart: true, capEnd: true, radial: 18 },
    { keys: eng(1), capStart: true, capEnd: true, radial: 18 },
    { keys: tank(1, -2.7, 0.5), capStart: true, capEnd: true, radial: 18 },
    { keys: tank(-1, -3.4, 0.2), capStart: true, capEnd: true, radial: 18 },
  ], { base: '#5f6748', camo: ['#7b7a57', '#3e4532', '#8d8a72'], frames: 26, stringers: 10, soot: [[0.32, 0.5, 0.05, 0.3]] }, [fin, stab]);

  const parts = [];
  parts.push(P(box(2.3, 0.06, 6.6), 0x26281f, [0, -1.05, -2.3]));
  parts.push(P(box(2.4, 2.0, 0.06), 0x33372c, [0, 0.0, -5.6]));
  cockpit(parts, group, { z: -7.6, w: 2.2, y: -0.25, seatX: 0.6, seatZ: -6.9, seatY: -0.5 });
  for (const sx of [-1, 1]) {
    pzu(parts, sx * 0.68, 1.65, -6.05, 0.48);
    parts.push(P(cyl(0.32, 0.38, 0.7, 14), 0x1b1b19, [sx * 1.12, 1.72, -1.55], [HALFPI, sx * 0.6, 0]));
    parts.push(P(cyl(0.26, 0.26, 0.05, 14), 0x050505, [sx * 1.35, 1.72, -1.25], [HALFPI, sx * 0.6, 0]));
    // Hauptfahrwerk mit Streben, außen liegende Räder
    wheel(parts, 0.43, 0.3, [sx * 1.95, -1.32, -0.4]);
    parts.push(P(box(0.12, 1.2, 0.14), COL.metal, [sx * 1.85, -0.75, -0.4], [0, 0, sx * 0.12]));
    parts.push(P(box(0.9, 0.1, 0.12), COL.metal, [sx * 1.45, -0.95, -0.4], [0, 0, sx * -0.35]));
    parts.push(P(box(0.08, 0.08, 1.4), COL.metal, [sx * 1.6, -0.95, -0.9], [0.35, sx * 0.3, 0]));
    // Rückspiegel, Trittstufen
    parts.push(P(box(0.04, 0.26, 0.2), 0x222222, [sx * 1.32, 0.35, -8.1]));
  }
  for (const y of [-0.55, -0.2]) parts.push(P(box(0.45, 0.05, 0.3), 0x2a2b2b, [-1.35, y, -4.4]));
  // Bugfahrwerk (Doppelrad)
  for (const dx of [-0.24, 0.24]) wheel(parts, 0.33, 0.2, [dx, -1.42, -6.9]);
  parts.push(P(box(0.12, 0.6, 0.12), COL.metal, [0, -1.15, -6.9]));
  // Heckschleifsporn, Mast, Antennen, Rettungswinde über der Tür
  parts.push(P(box(0.08, 0.7, 0.08), COL.metal, [0, 0.35, 9.9], [-0.4, 0, 0]));
  parts.push(P(cyl(0.22, 0.26, 1.0, 12), COL.metal, [0, 2.75, -1.6]));
  parts.push(P(box(0.04, 0.5, 0.25), 0x111111, [0, 1.5, 4.0], [0.4, 0, 0]));
  parts.push(P(box(0.04, 0.45, 0.2), 0x111111, [0, -1.45, -3.0], [-0.3, 0, 0]));
  parts.push(P(box(0.6, 0.18, 0.2), 0x3a3d40, [-1.4, 1.15, -4.4]));
  parts.push(P(cyl(0.2, 0.2, 0.6, 10), COL.gun, [-0.25, 3.3, 10.95], [0, 0, HALFPI]));
  for (const s of [-1, 1]) {
    uaRoundel(group, 1.0, [h.X(-0.9) + 0.02, 0.0, -0.9], s);
    decal(group, number, 1.0, 0.5, [h.X(-6.2) + 0.02, 0.35, -6.2], s, '#f2d33a', 'bold 96px Arial');
  }
  uaRoundel(group, 0.7, [0, 3.0, 10.95], 1, 0);

  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 3.35, -1.6);
  mainRotor.add(new THREE.Mesh(rotorGeo(5, 10.65, 0.52, { hubR: 0.5, tip: 0xb8b8b0 }), detailMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-0.55, 3.3, 10.95);
  tailRotor.add(new THREE.Mesh(tailRotorGeo(3, 1.95, 0.3), detailMat));
  group.add(tailRotor);
  const f = finish(group, parts, {
    gunMounts: [
      { side: 'left', pos: [-1.3, 0.05, -4.4], baseYaw: HALFPI, fig: [-0.85, 0, -4.15], sitY: -0.4, post: true },
      { side: 'right', pos: [1.3, 0.05, -4.35], baseYaw: -HALFPI, fig: [0.85, 0, -4.1], sitY: -0.4, post: true },
    ],
    floor: -1.05,
    pilots: { x: 0.6, z: -6.95, sitY: -0.4 },
    discs: [{ obj: mainRotor, r: 10.65 }],
    beacon: [0, 1.2, 4.0],
  });
  const seatList = [];
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) seatList.push([s * 0.95, -3.4 + i * 0.36, s < 0 ? -HALFPI : HALFPI, 'floor']);
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats: seatsGrid(seatList, [0.35, -0.5]), isStatic,
    eyePilot: new THREE.Vector3(0.6, 0.62, -7.35),
    spin: [[mainRotor, 'y', 19], [tailRotor, 'x', 62]],
    exhaust: new THREE.Vector3(1.35, 1.72, -1.25),
    gear: [[-1.95, -1.75, -0.4], [1.95, -1.75, -0.4], [0, -1.75, -6.9]],
  };
}

// Vierläufiges 12,7-mm-MG JakB im Kinnturm
function jakbGeo() {
  const parts = [P(sph(0.36, 14, 10), 0x3a3d33, [0, 0.05, 0.1], [0, 0, 0], [1, 0.8, 1])];
  for (const [dx, dy] of [[-0.05, -0.05], [0.05, -0.05], [-0.05, 0.05], [0.05, 0.05]]) parts.push(P(cyl(0.022, 0.022, 1.3, 6), 0x1e1f1d, [dx, dy, -0.75], [HALFPI, 0, 0]));
  parts.push(P(cyl(0.11, 0.11, 0.08, 10), 0x1e1f1d, [0, 0, -1.2], [HALFPI, 0, 0]));
  return merge(parts);
}

function buildMi24({ static: isStatic = false, number = '36' } = {}) {
  const group = new THREE.Group();
  // Doppelkanzel: vorn tief der Bordschütze, dahinter erhöht der Pilot
  const canopy = [{ z0: -7.75, z1: -6.15, a0: 0.18, a1: PI - 0.18 }, { z0: -5.75, z1: -4.35, a0: 0.3, a1: PI - 0.3 }];
  const fus = [
    { z: -8.3, w: 0.35, top: -0.55, bot: -0.85 },
    { z: -7.75, w: 1.05, top: -0.1, bot: -1.05, nt: 2.4, nb: 2.4 },
    { z: -6.8, w: 1.3, top: 0.32, bot: -1.1, nt: 2.6, nb: 3 },
    { z: -6.0, w: 1.42, top: 0.42, bot: -1.12, nt: 2.8, nb: 3.2 },
    { z: -5.45, w: 1.55, top: 0.98, bot: -1.12, nt: 2.8, nb: 3.4 },
    { z: -4.3, w: 1.75, top: 1.2, bot: -1.1, nt: 3, nb: 3.6 },
    { z: 0.6, w: 1.85, top: 1.25, bot: -1.0, nt: 3, nb: 3.6 },
    { z: 1.8, w: 1.3, top: 1.2, bot: -0.2, nt: 2.6, nb: 2.6 },
    { z: 3.0, w: 0.8, top: 1.15, bot: 0.35, nt: 2.2, nb: 2.2 },
    { z: 8.6, w: 0.45, top: 1.15, bot: 0.65 },
    { z: 9.3, w: 0.35, top: 1.15, bot: 0.75 },
  ];
  const top = [
    { z: -4.45, w: 0.8, top: 1.35, bot: 1.15 },
    { z: -3.65, w: 1.7, top: 2.05, bot: 1.15, nt: 2.6, nb: 4 },
    { z: 0.6, w: 1.75, top: 2.15, bot: 1.2, nt: 2.8, nb: 4 },
    { z: 2.4, w: 1.0, top: 1.7, bot: 1.2, nt: 2.4, nb: 3 },
    { z: 3.4, w: 0.5, top: 1.3, bot: 1.15 },
  ];
  const eng = (sx) => [
    { z: -3.95, w: 0.6, top: 1.95, bot: 1.4, x: sx * 0.62 },
    { z: -3.6, w: 0.78, top: 2.05, bot: 1.3, x: sx * 0.66, nt: 2.2, nb: 2.2 },
    { z: -0.6, w: 0.78, top: 2.05, bot: 1.3, x: sx * 0.7, nt: 2.2, nb: 2.2 },
    { z: -0.1, w: 0.6, top: 1.95, bot: 1.4, x: sx * 0.74 },
  ];
  // Stummelflügel mit negativer V-Stellung
  const wR = plate([[0.85, -1.4], [3.4, -1.05], [3.4, 0.1], [0.85, 0.3]], 0.12, 'xz');
  wR.translate(-0.85, 0, 0); wR.rotateZ(-0.2); wR.translate(0.85, 0.15, 0);
  const wL = plate([[-3.4, -1.05], [-0.85, -1.4], [-0.85, 0.3], [-3.4, 0.1]], 0.12, 'xz');
  wL.translate(0.85, 0, 0); wL.rotateZ(0.2); wL.translate(-0.85, 0.15, 0);
  const fin = plate([[8.35, 1.0], [9.3, 1.1], [9.95, 3.6], [9.45, 3.7], [8.85, 2.0]], 0.26, 'zy');
  const stab = plate([[-1.55, 7.5], [1.55, 7.5], [1.55, 8.2], [-1.55, 8.2]], 0.08, 'xz');
  stab.translate(0, 0.95, 0);
  const h = hull(group, 'mi24', [
    { keys: fus, holes: canopy, glass: canopy, capEnd: true, radial: 36 },
    { keys: top, capStart: true, capEnd: true, radial: 22 },
    { keys: eng(-1), capStart: true, capEnd: true, radial: 18 },
    { keys: eng(1), capStart: true, capEnd: true, radial: 18 },
  ], { base: '#6a6a46', camo: ['#8b7a52', '#4a5232', '#5f5a3e'], frames: 22, stringers: 9, soot: [[0.45, 0.62, 0.05, 0.3]] }, [wR, wL, fin, stab]);

  const parts = [];
  parts.push(P(box(1.6, 0.06, 3.4), 0x26281f, [0, -1.0, -2.2]));
  // Kanzelrahmen und Sitze
  for (const z of [-7.0, -6.2, -5.1, -4.4]) parts.push(P(box(z < -6 ? 1.2 : 1.5, 0.05, 0.06), 0x2a2c27, [0, z < -6 ? 0.38 : 1.12, z]));
  for (const [z, y] of [[-6.85, -0.8], [-5.0, -0.35]]) {
    parts.push(P(box(0.5, 0.1, 0.5), 0x2f302b, [0, y, z]));
    parts.push(P(box(0.5, 0.75, 0.1), 0x2f302b, [0, y + 0.42, z + 0.3]));
  }
  // Sensoren unter der Nase, Staudruckrohr
  parts.push(P(cyl(0.13, 0.13, 0.35, 10), 0x2c302a, [-0.45, -0.95, -7.3], [HALFPI, 0, 0]));
  parts.push(P(cyl(0.025, 0.025, 1.4, 6), 0x777777, [0.35, -0.35, -8.6], [HALFPI, 0, 0]));
  for (const sx of [-1, 1]) {
    pzu(parts, sx * 0.62, 1.68, -4.25, 0.38);
    parts.push(P(cyl(0.26, 0.32, 0.65, 12), 0x1b1b19, [sx * 0.98, 1.66, 0.25], [HALFPI, sx * 0.7, 0]));
    // Waffenstationen: zwei Raketenbehälter B-8 je Seite, Lenkflugkörperschienen an der Flügelspitze
    for (const [x, ry] of [[1.75, -0.42], [2.75, -0.62]]) {
      parts.push(P(box(0.08, 0.3, 0.6), 0x2a2c27, [sx * x, ry + 0.38, -0.4]));
      parts.push(P(cyl(0.27, 0.27, 2.1, 14), 0x4d5040, [sx * x, ry, -0.5], [HALFPI, 0, 0]));
      parts.push(P(cyl(0.2, 0.2, 0.02, 14), 0x101010, [sx * x, ry, -1.56], [HALFPI, 0, 0]));
    }
    for (const dy of [-0.2, 0.15]) parts.push(P(cyl(0.07, 0.07, 1.4, 8), 0x6c6e5c, [sx * 3.45, -0.52 + dy, -0.5], [HALFPI, 0, 0]));
    // Einziehfahrwerk (ausgefahren)
    wheel(parts, 0.38, 0.26, [sx * 1.45, -1.22, -0.1]);
    parts.push(P(box(0.12, 0.8, 0.12), COL.metal, [sx * 1.35, -0.8, -0.1], [0, 0, sx * 0.3]));
  }
  // geschlossene Kabinentüren (oben/unten geteilt) als Fugen
  for (const sx of [-1, 1]) {
    parts.push(P(box(0.02, 1.5, 0.04), 0x1c1d18, [sx * 0.93, 0.05, -3.6]), P(box(0.02, 1.5, 0.04), 0x1c1d18, [sx * 0.93, 0.05, -2.55]));
    parts.push(P(box(0.02, 0.04, 1.05), 0x1c1d18, [sx * 0.94, 0.25, -3.08]), P(box(0.025, 0.35, 0.5), 0x2a3036, [sx * 0.93, 0.55, -3.08]));
  }
  for (const dx of [-0.2, 0.2]) wheel(parts, 0.28, 0.18, [dx, -1.32, -6.4]);
  parts.push(P(box(0.1, 0.55, 0.1), COL.metal, [0, -1.05, -6.4]));
  parts.push(P(box(0.08, 0.6, 0.08), COL.metal, [0, 0.4, 8.5], [-0.4, 0, 0]));
  parts.push(P(cyl(0.18, 0.22, 0.85, 12), COL.metal, [0, 2.5, -1.4]));
  parts.push(P(box(0.04, 0.4, 0.2), 0x111111, [0, 1.45, 4.0], [0.4, 0, 0]));
  parts.push(P(cyl(0.16, 0.16, 0.5, 10), COL.gun, [-0.22, 3.0, 9.6], [0, 0, HALFPI]));
  for (const s of [-1, 1]) {
    uaRoundel(group, 0.85, [h.X(1.8) + 0.02, 0.55, 1.8], s);
    decal(group, number, 0.9, 0.45, [h.X(-3.0) + 0.02, 0.6, -3.0], s, '#f2d33a', 'bold 96px Arial');
  }

  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.95, -1.4);
  mainRotor.add(new THREE.Mesh(rotorGeo(5, 8.65, 0.58, { hubR: 0.42, tip: 0xb8b8b0 }), detailMat));
  group.add(mainRotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-0.45, 3.0, 9.6);
  tailRotor.add(new THREE.Mesh(tailRotorGeo(3, 1.95, 0.3), detailMat));
  group.add(tailRotor);
  const f = finish(group, parts, {
    gunMounts: [
      { side: 'left', pos: [0, -1.12, -7.35], baseYaw: 0, geo: jakbGeo(), muzzleZ: -1.3, eye: [0, -0.2, -0.5], noFig: true },
      { side: 'right', pos: [0, 0, 0], baseYaw: 0, fig: [0, 0, 0], sitY: 0, dummy: true },
    ],
    floor: -1.0,
    pilotList: [[0, -0.35, -6.85, -0.8], [0, 0.2, -5.0, -0.35]],
    cpgGun: 'left',
    discs: [{ obj: mainRotor, r: 8.65 }],
    beacon: [0, 1.3, 4.0],
  });
  f.guns.left.gunner.group.visible = true;
  const seatList = [];
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) seatList.push([s * 0.32, -3.6 + i * 0.55, s < 0 ? HALFPI : -HALFPI, 'floor']);
  return {
    group, body: h.skin, glass: h.glass, detail: f.detail, mainRotor, tailRotor, rotorDisc: f.rotorDisc, discMat: f.discMat, beacon: f.beacon, beaconMat: f.beaconMat,
    guns: f.guns, pilots: f.pilots, seats: seatsGrid(seatList, [0.35, -0.45]), isStatic,
    eyePilot: new THREE.Vector3(0, 0.95, -5.05),
    spin: [[mainRotor, 'y', 22], [tailRotor, 'x', 70]],
    exhaust: new THREE.Vector3(1.1, 1.66, 0.45),
    gear: [[-1.45, -1.6, -0.1], [1.45, -1.6, -0.1], [0, -1.6, -6.4]],
    rocketPods: [new THREE.Vector3(-2.25, -0.55, -1.6), new THREE.Vector3(2.25, -0.55, -1.6)],
  };
}

// ================================================================= Kampfflugzeuge für Luftunterstützung
// Nase zeigt nach -z. kind: 'f16' | 'a10' | 'f4'
export function buildJet(kind) {
  const group = new THREE.Group();
  const parts = [];
  let keys, extra = [], paint;
  if (kind === 'a10') {
    keys = [
      { z: -8.2, w: 0.3, top: 0.2, bot: -0.1 }, { z: -7.4, w: 1.1, top: 0.6, bot: -0.6, nt: 2.4, nb: 2.4 },
      { z: -5.0, w: 1.5, top: 1.2, bot: -0.8, nt: 2.6, nb: 3 }, { z: 2.0, w: 1.4, top: 0.9, bot: -0.7, nt: 2.6, nb: 3 },
      { z: 6.5, w: 0.8, top: 0.7, bot: -0.1 }, { z: 8.0, w: 0.4, top: 0.6, bot: 0.2 },
    ];
    extra = [
      plate([[-8.7, 0.0], [8.7, 0.0], [8.4, 2.3], [-8.4, 2.3]], 0.22, 'xz'),
      plate([[-2.9, 6.6], [2.9, 6.6], [2.9, 7.8], [-2.9, 7.8]], 0.12, 'xz'),
    ];
    extra[1].translate(0, 0.75, 0);
    for (const sx of [-1, 1]) {
      const f = plate([[6.4, 0.2], [7.9, 0.2], [8.1, 2.4], [7.0, 2.4]], 0.14, 'zy');
      f.translate(sx * 2.9, -0.5, 0);
      extra.push(f);
      parts.push(P(cyl(0.6, 0.55, 2.6, 16), 0x5f6662, [sx * 1.45, 1.15, 3.6], [HALFPI, 0, 0]));
      parts.push(P(cyl(0.5, 0.5, 0.05, 16), 0x111111, [sx * 1.45, 1.15, 2.3], [HALFPI, 0, 0]));
      parts.push(P(box(0.25, 0.5, 1.2), 0x6d7470, [sx * 1.0, 0.8, 3.6]));
      for (const x of [3.5, 5.0, 6.5]) parts.push(P(cyl(0.16, 0.16, 2.2, 8), 0x7b7d6e, [sx * x, -0.35, 0.8], [HALFPI, 0, 0]));
    }
    parts.push(P(cyl(0.1, 0.1, 1.2, 8), 0x2a2a2a, [0, -0.35, -8.6], [HALFPI, 0, 0]));
    paint = { base: '#6c7470', frames: 18, stringers: 6 };
  } else if (kind === 'f4') {
    keys = [
      { z: -9.0, w: 0.2, top: 0.1, bot: -0.1 }, { z: -7.5, w: 1.0, top: 0.5, bot: -0.5, nt: 2.2, nb: 2.2 },
      { z: -4.5, w: 1.6, top: 1.0, bot: -0.7, nt: 2.6, nb: 2.6 }, { z: 3.0, w: 2.2, top: 0.8, bot: -0.8, nt: 2.6, nb: 3.5 },
      { z: 7.5, w: 1.6, top: 0.6, bot: -0.6, nt: 2.4, nb: 2.4 }, { z: 8.5, w: 1.5, top: 0.5, bot: -0.5 },
    ];
    extra = [plate([[0, -1.2], [5.8, 2.8], [5.8, 3.8], [0, 4.6], [-5.8, 3.8], [-5.8, 2.8]], 0.18, 'xz')];
    const fin = plate([[5.0, 0.5], [7.8, 0.5], [8.6, 3.4], [7.7, 3.5]], 0.14, 'zy');
    const st = plate([[-2.6, 7.4], [2.6, 7.4], [2.6, 8.6], [-2.6, 8.6]], 0.1, 'xz');
    st.rotateZ(0); st.translate(0, 0.3, 0);
    extra.push(fin, st);
    for (const sx of [-1, 1]) parts.push(P(cyl(0.45, 0.4, 0.4, 14), 0x2a2a2a, [sx * 0.5, -0.1, 8.7], [HALFPI, 0, 0]));
    paint = { base: '#5f6844', camo: ['#7a6a48', '#3f4a30'], frames: 20, stringers: 6 };
  } else if (kind === 'su25') {
    // Su-25: langer Bug, Schulterdecker mit leicht gepfeilten Flügeln, Triebwerke in Gondeln am Rumpf
    keys = [
      { z: -8.6, w: 0.15, top: 0.0, bot: -0.15 }, { z: -7.4, w: 0.9, top: 0.45, bot: -0.55, nt: 2.2, nb: 2.2 },
      { z: -4.6, w: 1.3, top: 1.0, bot: -0.75, nt: 2.6, nb: 2.6 }, { z: 1.0, w: 1.25, top: 0.85, bot: -0.7, nt: 2.6, nb: 3 },
      { z: 6.0, w: 0.8, top: 0.7, bot: -0.2, nt: 2.4, nb: 2.4 }, { z: 7.2, w: 0.5, top: 0.6, bot: 0.1 },
    ];
    extra = [plate([[0, -1.6], [7.2, 1.2], [7.2, 2.6], [0, 3.0], [-7.2, 2.6], [-7.2, 1.2]], 0.16, 'xz')];
    extra[0].translate(0, 0.45, 0);
    extra.push(plate([[-2.6, 5.6], [2.6, 6.2], [2.6, 7.1], [-2.6, 7.1], [-2.6, 6.2]], 0.08, 'xz'));
    extra[1].translate(0, 0.5, 0);
    extra.push(plate([[4.4, 0.7], [6.8, 0.7], [7.7, 3.8], [6.9, 3.9]], 0.14, 'zy'));
    for (const sx of [-1, 1]) {
      parts.push(P(cyl(0.55, 0.5, 6.2, 14), 0x6f7258, [sx * 1.05, -0.25, 1.4], [HALFPI, 0, 0]));
      parts.push(P(cyl(0.42, 0.42, 0.05, 14), 0x111111, [sx * 1.05, -0.25, -1.7], [HALFPI, 0, 0]));
      parts.push(P(cyl(0.38, 0.3, 0.5, 12), 0x2a2a2a, [sx * 1.05, -0.25, 4.7], [HALFPI, 0, 0]));
      for (const x of [2.6, 3.8, 5.0]) parts.push(P(cyl(0.22, 0.22, 1.9, 10), 0x5a5d4c, [sx * x, -0.05, 0.6], [HALFPI, 0, 0]));   // B-8-Raketenbehälter
    }
    parts.push(P(cyl(0.06, 0.06, 1.1, 6), 0x2a2a2a, [0, -0.15, -9.0], [HALFPI, 0, 0]));
    paint = { base: '#76775a', camo: ['#8d8462', '#4c5539', '#6a6650'], frames: 18, stringers: 6 };
  } else {
    keys = [
      { z: -7.6, w: 0.15, top: 0.05, bot: -0.08 }, { z: -6.2, w: 0.8, top: 0.45, bot: -0.4, nt: 2.2, nb: 2.2 },
      { z: -3.5, w: 1.2, top: 0.9, bot: -0.7, nt: 2.6, nb: 2.6 }, { z: 2.0, w: 1.4, top: 0.65, bot: -0.85, nt: 2.6, nb: 3 },
      { z: 6.2, w: 1.1, top: 0.55, bot: -0.55, nt: 2.4, nb: 2.4 }, { z: 7.3, w: 0.9, top: 0.45, bot: -0.45 },
    ];
    extra = [
      plate([[0, -2.2], [4.7, 2.4], [4.7, 3.2], [0, 4.2], [-4.7, 3.2], [-4.7, 2.4]], 0.14, 'xz'),
      plate([[-2.9, 5.9], [2.9, 6.6], [2.9, 7.4], [-2.9, 7.4], [-2.9, 6.6]], 0.08, 'xz'),
    ];
    extra[1].translate(0, -0.1, 0);
    extra.push(plate([[4.0, 0.5], [6.9, 0.5], [7.5, 3.4], [6.6, 3.5]], 0.14, 'zy'));
    parts.push(P(box(1.0, 0.55, 2.0), 0x7b8188, [0, -0.85, -1.6]));                      // Lufteinlass
    parts.push(P(box(0.9, 0.05, 0.05), 0x111111, [0, -0.85, -2.61]));
    parts.push(P(cyl(0.45, 0.4, 0.6, 14), 0x3a3a3a, [0, 0, 7.5], [HALFPI, 0, 0]));
    for (const sx of [-1, 1]) {
      parts.push(P(cyl(0.18, 0.18, 2.3, 8), 0x8a8d84, [sx * 2.4, -0.4, 2.2], [HALFPI, 0, 0]));   // GBU-12
      parts.push(P(cyl(0.06, 0.06, 2.9, 6), 0xcfcfcf, [sx * 4.75, 0.0, 2.9], [HALFPI, 0, 0]));  // AIM-9 an der Flügelspitze
    }
    paint = { base: '#8b9197', frames: 18, stringers: 6 };
  }
  const skin = new THREE.Mesh(mergeUV([loft(keys, { radial: 24, capEnd: true }), ...extra]), paintMaterial(paintTexture('jet_' + kind, paint)));
  group.add(skin);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), glassMat);
  canopy.scale.set(0.45, 0.4, 1.6);
  canopy.position.set(0, kind === 'a10' ? 1.15 : kind === 'su25' ? 1.05 : 0.75, kind === 'a10' ? -5.2 : kind === 'su25' ? -5.4 : -4.4);
  canopy.renderOrder = 2;
  group.add(canopy);
  if (parts.length) group.add(new THREE.Mesh(merge(parts), detailMat));
  const scale = kind === 'a10' ? 1 : 1;
  group.scale.setScalar(scale);
  group.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  return group;
}
