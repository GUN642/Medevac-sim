// Glatte Rumpfformen aus Querschnitten (Superellipsen entlang der Längsachse) und Lackierungs-Texturen
import * as THREE from './lib/three.module.min.js';

const TAU = Math.PI * 2;

// Catmull-Rom-Interpolation eines Feldes über die Schlüsselquerschnitte
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function sample(keys, steps, dz) {
  const out = [];
  const F = ['z', 'w', 'top', 'bot', 'nt', 'nb', 'x'];
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
    const n = keys[i].sharp ? 1 : Math.max(steps, Math.ceil((k2.z - k1.z) / dz));
    for (let s = 0; s < n; s++) {
      const t = s / n, o = {};
      for (const f of F) {
        const d = f === 'nt' || f === 'nb' ? 2.4 : 0;
        const v = (k) => (k[f] ?? d);
        o[f] = f === 'z' ? v(k1) + (v(k2) - v(k1)) * t : cr(v(k0), v(k1), v(k2), v(k3), t);
      }
      o.w = Math.max(o.w, 0.001);
      if (o.top < o.bot + 0.001) o.top = o.bot + 0.001;
      out.push(o);
    }
  }
  const last = keys[keys.length - 1];
  out.push({ z: last.z, w: Math.max(last.w, 0.001), top: last.top, bot: last.bot, nt: last.nt ?? 2.4, nb: last.nb ?? 2.4, x: last.x ?? 0 });
  return out;
}

function angIn(a, a0, a1) {
  a = ((a % TAU) + TAU) % TAU; a0 = ((a0 % TAU) + TAU) % TAU; a1 = ((a1 % TAU) + TAU) % TAU;
  return a0 <= a1 ? a >= a0 && a <= a1 : a >= a0 || a <= a1;
}

// Punkt auf dem Querschnitt; Winkel 0 = rechts (+x), PI/2 = oben
export function sectionPoint(sec, a, out = new THREE.Vector3()) {
  const c = Math.cos(a), s = Math.sin(a);
  const n = s >= 0 ? sec.nt : sec.nb;
  const e = 2 / n;
  const yc = (sec.top + sec.bot) / 2, hh = (sec.top - sec.bot) / 2;
  return out.set((sec.x || 0) + (sec.w / 2) * Math.sign(c) * Math.pow(Math.abs(c), e), yc + hh * Math.sign(s) * Math.pow(Math.abs(s), e), sec.z);
}

/**
 * keys: [{ z, w, top, bot, nt, nb, x }] von vorn (-z) nach hinten (+z)
 * holes: [{ z0, z1, a0, a1 }] ausgesparte Bereiche (Türen, Fenster); only: nur diese Bereiche erzeugen (Verglasung)
 */
export function loft(keys, { radial = 32, steps = 5, dz = 0.35, holes = [], only = null, grow = 0, capEnd = false, capStart = false } = {}) {
  const secs = sample(keys, steps, dz);
  const R = radial, N = secs.length;
  const z0 = secs[0].z, len = secs[N - 1].z - z0 || 1;
  const pos = [], uv = [], idx = [];
  const p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const s = secs[i];
    const g = grow ? { ...s, w: s.w + grow * 2, top: s.top + grow, bot: s.bot - grow } : s;
    for (let j = 0; j <= R; j++) {
      const a = (j / R) * TAU;
      sectionPoint(g, a, p);
      pos.push(p.x, p.y, p.z);
      uv.push((s.z - z0) / len, j / R);
    }
  }
  const inList = (list, zc, ac) => list.some((h) => zc >= h.z0 && zc <= h.z1 && angIn(ac, h.a0, h.a1));
  for (let i = 0; i < N - 1; i++) {
    const zc = (secs[i].z + secs[i + 1].z) / 2;
    for (let j = 0; j < R; j++) {
      const ac = ((j + 0.5) / R) * TAU;
      if (only ? !inList(only, zc, ac) : inList(holes, zc, ac)) continue;
      const a = i * (R + 1) + j, b = a + 1, c = a + R + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const capAt = (i, flip) => {
    const s = secs[i];
    const ci = pos.length / 3;
    pos.push(s.x || 0, (s.top + s.bot) / 2, s.z); uv.push((s.z - z0) / len, 0.5);
    for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j, b = a + 1;
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  };
  if (capStart) capAt(0, true);
  if (capEnd) capAt(N - 1, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.userData.secs = secs;
  return geo;
}

// Querschnitt an einer beliebigen z-Position (für das Anbringen von Teilen auf der Haut)
export function sectionAt(geo, z) {
  const secs = geo.userData.secs;
  for (let i = 0; i < secs.length - 1; i++) {
    const a = secs[i], b = secs[i + 1];
    if (z >= a.z && z <= b.z) {
      const t = (z - a.z) / (b.z - a.z || 1);
      const o = {};
      for (const f of ['w', 'top', 'bot', 'nt', 'nb', 'x']) o[f] = (a[f] || 0) + ((b[f] || 0) - (a[f] || 0)) * t;
      o.z = z;
      return o;
    }
  }
  return secs[z < secs[0].z ? 0 : secs.length - 1];
}

// ---------------------------------------------------------------- Lackierung
const texCache = {};
/**
 * Prozedurale Lackierung: Grundfarbe mit Fleckigkeit, Blechfugen (Spanten längs, Stringer quer), Nieten,
 * Verschmutzung unten und Ruß hinter den Abgasen. frames: z-Anteile 0..1 der Spanten.
 */
export function paintTexture(key, { base = '#444a3a', frames = 14, stringers = 8, soot = null, camo = null, w = 1024, h = 512 } = {}) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Tarnmuster (z. B. Bundeswehr) als weiche Flecken
  if (camo) for (let i = 0; i < 70; i++) {
    x.fillStyle = camo[i % camo.length];
    x.beginPath();
    const cx = rnd() * w, cy = rnd() * h, r = 20 + rnd() * 60;
    x.ellipse(cx, cy, r * 1.8, r, rnd() * 3, 0, TAU);
    x.fill();
  }
  // Fleckige, ausgeblichene Farbe
  for (let i = 0; i < 2600; i++) {
    const l = rnd() < 0.5 ? 255 : 0;
    x.fillStyle = `rgba(${l},${l},${l},${0.008 + rnd() * 0.018})`;
    const r = 2 + rnd() * 16;
    x.beginPath(); x.ellipse(rnd() * w, rnd() * h, r * 1.6, r, 0, 0, TAU); x.fill();
  }
  // Spanten (vertikal = quer zum Rumpf) und Stringer (horizontal = längs)
  x.strokeStyle = 'rgba(0,0,0,0.2)';
  x.lineWidth = 1.2;
  const fr = typeof frames === 'number' ? Array.from({ length: frames }, (_, i) => (i + 0.5) / frames) : frames;
  for (const f of fr) { x.beginPath(); x.moveTo(f * w, 0); x.lineTo(f * w, h); x.stroke(); }
  for (let i = 0; i < stringers; i++) { const y = ((i + 0.5) / stringers) * h; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
  // Nietreihen entlang der Spanten
  x.fillStyle = 'rgba(0,0,0,0.16)';
  for (const f of fr) for (let y = 0; y < h; y += 7) x.fillRect(f * w + 3, y, 1.5, 1.5);
  x.fillStyle = 'rgba(255,255,255,0.06)';
  for (const f of fr) for (let y = 3; y < h; y += 7) x.fillRect(f * w - 4, y, 1.5, 1.5);
  // Wartungsklappen
  x.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 26; i++) {
    const px = rnd() * w, py = rnd() * h, pw = 14 + rnd() * 40, ph = 10 + rnd() * 26;
    x.strokeRect(px, py, pw, ph);
  }
  // Schmutz unten (Unterseite liegt bei v = 0.75, also Canvas-y = 0.25 h)
  const g = x.createLinearGradient(0, h * 0.05, 0, h * 0.45);
  g.addColorStop(0, 'rgba(30,25,15,0)');
  g.addColorStop(0.5, 'rgba(30,25,15,0.22)');
  g.addColorStop(1, 'rgba(30,25,15,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  // Ruß hinter Abgasen (soot: [z0, z1, y0, y1] als Anteile)
  if (soot) for (const s of soot) {
    const gr = x.createLinearGradient(s[0] * w, 0, s[1] * w, 0);
    gr.addColorStop(0, 'rgba(10,10,10,0.55)');
    gr.addColorStop(1, 'rgba(10,10,10,0)');
    x.fillStyle = gr;
    x.fillRect(s[0] * w, s[2] * h, (s[1] - s[0]) * w, (s[3] - s[2]) * h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  texCache[key] = t;
  return t;
}

export function paintMaterial(tex, opts = {}) {
  return new THREE.MeshPhongMaterial({ map: tex, shininess: opts.shininess ?? 14, specular: opts.specular ?? 0x262626, side: THREE.DoubleSide });
}

// Kleine, feine Kornstruktur (für Putz, Sand, Metall)
let grainTex = null;
export function grainTexture() {
  if (grainTex) return grainTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const img = x.createImageData(256, 256);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 256 * 256; i++) {
    const px = i % 256, py = (i / 256) | 0;
    const v = 0.8 + rnd() * 0.2 + 0.06 * Math.sin(px * 0.21 + Math.sin(py * 0.09) * 3) + 0.04 * Math.sin(py * 0.5);
    const b = Math.max(0, Math.min(1, v)) * 255;
    img.data[i * 4] = b; img.data[i * 4 + 1] = b; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // Risse
  x.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 40; i++) {
    x.beginPath();
    let cx = rnd() * 256, cy = rnd() * 256;
    x.moveTo(cx, cy);
    for (let k = 0; k < 5; k++) { cx += (rnd() - 0.5) * 30; cy += rnd() * 20; x.lineTo(cx, cy); }
    x.stroke();
  }
  grainTex = new THREE.CanvasTexture(c);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.anisotropy = 4;
  return grainTex;
}

// Mehrere Geometrien (Position, Normale, UV) zu einer zusammenfassen
export function mergeUV(geos) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (!g.attributes.normal) g.computeVertexNormals();
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

// Flaches Profil (Leitwerk, Flosse) als extrudierte Platte. pts: [[a, b], ...]
// plane 'zy': senkrechte Flosse (Dicke in x), 'xz': waagerechte Fläche (Dicke in y)
export function plate(pts, thick, plane = 'zy') {
  const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.3, bevelSize: thick * 0.3, bevelSegments: 1, steps: 1 });
  if (plane === 'zy') { g.rotateY(-Math.PI / 2); g.translate(thick / 2, 0, 0); }
  else { g.rotateX(Math.PI / 2); g.translate(0, thick / 2, 0); }
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.05, uv.getY(i) * 0.05);
  return g;
}
