// Grafik-Verbesserungen für alle Karten:
//  - Rauschtextur (kachelbar) für Gelände-Detail, Großflächen-Variation und Felsstruktur an Hängen
//  - weiche, schattierte Baumkronen (runde Normalen, dunkler im Inneren und unten)
//  - Wasser mit bewegten Wellen-Normalen, Sonnenglanz und Himmelsspiegelung
//  - Umgebungsspiegelung (Himmel) für Lack und Verglasung der Hubschrauber
import * as THREE from './lib/three.module.min.js';

// ------------------------------------------------------------ Rauschen
const S = 256;
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// kachelbares Wertrauschen mit Periode p (Teiler von S)
function vnoise(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi % p, yi % p, s), b = hash((xi + 1) % p, yi % p, s), c = hash(xi % p, (yi + 1) % p, s), d = hash((xi + 1) % p, (yi + 1) % p, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(px, py, base, oct, s) {
  let sum = 0, amp = 0.5, norm = 0, p = base;
  for (let o = 0; o < oct; o++) {
    sum += vnoise((px / S) * p, (py / S) * p, p, s + o * 17) * amp;
    norm += amp; amp *= 0.5; p *= 2;
  }
  return sum / norm;
}

let noiseTex = null;
// R: grob (Großflächen), G: mittel, B: fein (Detail), A: sehr fein (Körnung/Steinchen)
export function noiseTexture() {
  if (noiseTex) return noiseTex;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const st = (v) => Math.max(0, Math.min(255, Math.round(((v - 0.5) * 1.9 + 0.5) * 255)));
    data[i] = st(fbm(x, y, 2, 5, 1));
    data[i + 1] = st(fbm(x, y, 4, 5, 2));
    data[i + 2] = st(fbm(x, y, 8, 5, 3));
    data[i + 3] = st(fbm(x, y, 32, 3, 4));
  }
  noiseTex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  noiseTex.magFilter = THREE.LinearFilter;
  noiseTex.minFilter = THREE.LinearMipmapLinearFilter;
  noiseTex.generateMipmaps = true;
  noiseTex.anisotropy = 4;
  noiseTex.needsUpdate = true;
  return noiseTex;
}

// ------------------------------------------------------------ Gelände
// opts.rock: Farbe der Felsen an steilen Hängen (linear), opts.detail: Stärke der Bodenstruktur
export function terrainMaterial(opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const tex = noiseTexture();
  const rock = new THREE.Color(opts.rock ?? 0x6e665a);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNoise = { value: tex };
    sh.uniforms.uRock = { value: rock };
    sh.uniforms.uDetail = { value: opts.detail ?? 1 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying float vNY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;\nvNY = normal.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uNoise;\nuniform vec3 uRock;\nuniform float uDetail;\nvarying vec3 vWP;\nvarying float vNY;')
      .replace('#include <map_fragment>', `
        {
          vec2 p = vWP.xz;
          float dist = length(vWP - cameraPosition);
          vec4 nA = texture2D(uNoise, p / 900.0);
          vec4 nB = texture2D(uNoise, p / 140.0 + 0.37);
          // Großflächen: Helligkeit und leichte Farbverschiebung (trockener / satter)
          float macro = mix(0.84, 1.14, nA.r) * mix(0.93, 1.07, nB.g);
          diffuseColor.rgb *= macro;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.0, 0.86), clamp((nA.g - 0.5) * 1.4, -0.6, 0.6));
          // Fels an steilen Hängen mit Schichtung
          float steep = 1.0 - smoothstep(0.62, 0.86, vNY);
          float strata = texture2D(uNoise, vec2((p.x + p.y) / 55.0, vWP.y / 9.0)).b;
          vec3 rockC = uRock * (0.72 + 0.5 * strata) * mix(0.85, 1.12, nB.r);
          diffuseColor.rgb = mix(diffuseColor.rgb, rockC, steep * 0.85);
          // Bodenstruktur im Nahbereich (zwei Maßstäbe, blendet mit der Entfernung aus)
          float fade = (1.0 - smoothstep(40.0, 520.0, dist)) * uDetail;
          float d1 = texture2D(uNoise, p / 11.0).b;
          float d2 = texture2D(uNoise, p / 2.7).a;
          float det = (0.8 + 0.4 * d1) * (0.86 + 0.28 * d2);
          diffuseColor.rgb *= mix(1.0, det, fade * (0.75 + 0.5 * steep));
          // ferne Flächen leicht entsättigen (Luftperspektive)
          float aer = smoothstep(900.0, 4200.0, dist) * 0.35;
          float l = dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l), aer);
        }`);
  };
  mat.customProgramCacheKey = () => 'terrainGfx';
  return mat;
}

// ------------------------------------------------------------ Bäume
// Kronen weich schattieren: Normalen zeigen nach außen (runde Kronen statt Facetten),
// innen/unten dunkler (Eigenschatten), leichte Farbstreuung je Ecke
export function softenTree(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, col = geo.attributes.color;
  if (!pos || !nor || !col) return geo;
  const n = pos.count;
  let y0 = Infinity, y1 = -Infinity;
  const leaf = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = col.getX(i), g = col.getY(i), b = col.getZ(i);
    // Laub (grün) oder Schnee (hell) – Stämme sind rotbraun
    if (g >= r * 0.97 && g >= b * 0.85) { leaf[i] = 1; const y = pos.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (y1 <= y0) return geo;
  const ym = (y0 + y1) / 2, span = y1 - y0;
  const v = new THREE.Vector3(), f = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    if (!leaf[i]) continue;
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    v.set(x, (y - ym) * 1.1, z);
    if (v.lengthSq() < 1e-6) v.set(0, 1, 0);
    v.normalize();
    f.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    // unregelmäßige Kronenform: Ecken nach außen/innen verschieben (nur von der Lage abhängig, damit keine Risse entstehen)
    const bump = Math.sin(x * 1.31 + y * 0.77) * Math.sin(z * 1.17 - y * 0.93) + 0.5 * Math.sin(x * 2.9 - z * 2.3 + y * 1.7);
    const amp = span * 0.075 * bump;
    pos.setXYZ(i, x + v.x * amp, y + v.y * amp * 0.7, z + v.z * amp);
    v.multiplyScalar(0.7).addScaledVector(f, 0.3).normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
    const t = (y - y0) / span;
    const rad = Math.min(1, Math.hypot(x, z) / Math.max(1, span));
    const h = hash(Math.round(x * 13), Math.round(y * 7 + z * 11), 5);
    const k = (0.62 + 0.46 * t) * (0.86 + 0.2 * rad) * (0.92 + 0.16 * h);
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k * (0.98 + 0.06 * h), col.getZ(i) * k);
  }
  pos.needsUpdate = true; nor.needsUpdate = true; col.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

// Material für alle Bäume: Laub in Blattbüschel aufgelöst (helle, sonnige Büschel, dunkle Lücken),
// leichte Farbstreuung ins Gelbgrüne; Stämme bleiben unverändert
export function treeMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const tex = noiseTexture();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNoise = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uNoise;\nvarying vec3 vLP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float leaf = step(vColor.r * 0.97, vColor.g) * step(vColor.b * 0.85, vColor.g);
          float n1 = texture2D(uNoise, vLP.xz * 0.11 + vLP.y * 0.07).b;
          float n2 = texture2D(uNoise, vLP.zy * 0.37 + vLP.x * 0.05 + 0.31).a;
          float clump = smoothstep(0.28, 0.72, n1);
          float k = (0.8 + 0.75 * clump) * (0.86 + 0.32 * n2) * 1.55;
          diffuseColor.rgb *= mix(1.0, k, leaf);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.22, 1.12, 0.7), leaf * clump * 0.5);
          diffuseColor.rgb = min(diffuseColor.rgb, vec3(0.92));
        }`);
  };
  mat.customProgramCacheKey = () => 'treeGfx';
  return mat;
}

// ------------------------------------------------------------ Bildlook
// Filmische Tonwertkurve und Luftperspektive: Dunst wird zur Sonnenseite hin heller und wärmer,
// auf der Gegenseite kühler. Gilt für alle Materialien mit Nebel.
let lookDone = false;
export function setupLook(renderer, sunDir) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  if (lookDone) return;
  lookDone = true;
  const C = THREE.ShaderChunk;
  // Farbabstimmung nach der Tonwertkurve: etwas weniger Sättigung (kein Neon-Grün), Schatten leicht kühl, Lichter warm
  C.tonemapping_fragment = C.tonemapping_fragment.replace('gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );', `gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
    {
      float lumG = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor.rgb = mix(vec3(lumG), gl_FragColor.rgb, 0.8);
      gl_FragColor.rgb *= mix(vec3(0.96, 0.99, 1.05), vec3(1.04, 1.0, 0.94), smoothstep(0.05, 0.6, lumG));
    }`);
  const sx = sunDir.x, sz = sunDir.z, sl = Math.hypot(sx, sz) || 1;
  C.fog_pars_vertex = C.fog_pars_vertex.replace('varying float vFogDepth;', 'varying float vFogDepth;\nvarying vec3 vFogView;');
  C.fog_vertex = C.fog_vertex.replace('vFogDepth = - mvPosition.z;', 'vFogDepth = - mvPosition.z;\nvFogView = mvPosition.xyz;');
  C.fog_pars_fragment = C.fog_pars_fragment.replace('varying float vFogDepth;', 'varying float vFogDepth;\nvarying vec3 vFogView;');
  C.fog_fragment = C.fog_fragment.replace('gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );', `
    vec3 fogW = normalize((vec4(vFogView, 0.0) * viewMatrix).xyz);
    float fogAz = dot(normalize(fogW.xz + vec2(1e-5)), vec2(${(sx / sl).toFixed(4)}, ${(sz / sl).toFixed(4)})) * 0.5 + 0.5;
    float fogHz = 1.0 - clamp(abs(fogW.y) * 2.5, 0.0, 1.0);
    vec3 fogC = fogColor * mix(vec3(0.9, 0.95, 1.04), vec3(1.16, 1.08, 0.94), fogAz * fogAz) * (0.96 + 0.08 * fogHz);
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogC, fogFactor );`);
}

// ------------------------------------------------------------ Wasser
let waterNormal = null;
function waterNormalTexture() {
  if (waterNormal) return waterNormal;
  const N = 128, data = new Uint8Array(N * N * 4);
  const hgt = (x, y) => fbm(x * 2, y * 2, 4, 4, 9) * 0.7 + fbm(x * 2, y * 2, 16, 3, 11) * 0.3;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = hgt((x + 1) % N, y) - hgt((x + N - 1) % N, y), dy = hgt(x, (y + 1) % N) - hgt(x, (y + N - 1) % N);
    const nx = -dx * 6, ny = -dy * 6, nz = 1, l = Math.hypot(nx, ny, nz);
    const i = (y * N + x) * 4;
    data[i] = (nx / l * 0.5 + 0.5) * 255; data[i + 1] = (ny / l * 0.5 + 0.5) * 255; data[i + 2] = (nz / l * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  waterNormal = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
  waterNormal.minFilter = THREE.LinearMipmapLinearFilter;
  waterNormal.generateMipmaps = true;
  waterNormal.needsUpdate = true;
  return waterNormal;
}

// Wellen-Normalen auf das bestehende Wassermaterial legen (UV über die ganze Karte, daher hohe Wiederholung)
export function upgradeWater(mesh, worldSize) {
  const m = mesh.material;
  const t = waterNormalTexture().clone();
  t.needsUpdate = true;
  t.repeat.set(worldSize / 36, worldSize / 36);
  m.normalMap = t;
  m.normalScale = new THREE.Vector2(0.45, 0.45);
  m.shininess = Math.max(m.shininess || 0, 110);
  m.specular = new THREE.Color(m.specular || 0x666666).multiplyScalar(1.5);
  m.needsUpdate = true;
  mesh.userData.waveTex = t;
}
export function animateWater(mesh, t) {
  const tex = mesh && mesh.userData.waveTex;
  if (tex) tex.offset.set((t * 0.011) % 1, (t * 0.007) % 1);
}

// ------------------------------------------------------------ Umgebungsspiegelung
export const ENV = { tex: null };

// Kleine Würfeltextur vom Himmel (und Boden) für Lack, Glas und Wasser
export function buildEnv(renderer, skyMesh, groundColor) {
  try {
    const rt = new THREE.WebGLCubeRenderTarget(64, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cam = new THREE.CubeCamera(1, 10000, rt);
    const sc = new THREE.Scene();
    const sky = new THREE.Mesh(skyMesh.geometry, skyMesh.material);
    sc.add(sky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(4000, 24), new THREE.MeshBasicMaterial({ color: groundColor, fog: false }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -60;
    sc.add(ground);
    cam.update(renderer, sc);
    ENV.tex = rt.texture;
    ENV.update = () => cam.update(renderer, sc);
  } catch (e) { ENV.tex = null; }
  return ENV.tex;
}

// Lack und Glas eines Hubschraubermodells spiegeln lassen
export function applyEnv(group) {
  if (!ENV.tex) return;
  group.traverse((o) => {
    const m = o.material;
    if (!m || !m.isMeshPhongMaterial || m.userData.envDone) return;
    if (m.transparent && m.opacity < 0.9) { m.envMap = ENV.tex; m.reflectivity = 0.55; m.combine = THREE.MixOperation; }
    else if (m.map) { m.envMap = ENV.tex; m.reflectivity = 0.07; m.combine = THREE.MixOperation; }
    else return;
    m.userData.envDone = true;
    m.needsUpdate = true;
  });
}

// Wasser spiegelt den Himmel
export function applyWaterEnv(mesh) {
  if (!ENV.tex || !mesh || !mesh.material || !mesh.material.isMeshPhongMaterial) return;
  const m = mesh.material;
  m.envMap = ENV.tex; m.combine = THREE.MixOperation; m.reflectivity = 0.32;
  m.needsUpdate = true;
}

// ------------------------------------------------------------ Gras im Nahbereich
// Büschel aus schmalen Halmen um die Kamera, Farbe passend zum Boden, wiegen im Wind.
// Nicht auf Wasser, Schnee, Landeplätzen und steilen Hängen.
function tuftGeo() {
  const pos = [], col = [], nor = [];
  const blades = 7;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + hash(i, 1, 3) * 0.8, r = 0.12 + hash(i, 2, 3) * 0.22;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r, h = 0.35 + hash(i, 3, 3) * 0.45, w = 0.045;
    const lean = 0.12 + hash(i, 4, 3) * 0.2;
    const tx = bx + Math.cos(a) * lean, tz = bz + Math.sin(a) * lean;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    // ein Halm = Dreieck (breiter Fuß, Spitze); Normale nach oben gekippt für weiches Licht
    // beide Seiten als eigene Dreiecke mit nach oben zeigender Normale (keine dunklen Rückseiten)
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, h, tz);
    pos.push(bx + px, 0, bz + pz, bx - px, 0, bz - pz, tx, h, tz);
    for (let k = 0; k < 2; k++) col.push(0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 1.2, 1.2, 1.2);
    for (let k = 0; k < 6; k++) nor.push(Math.cos(a) * 0.25, 0.97, Math.sin(a) * 0.25);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export class GrassField {
  constructor(scene, world, opts = {}) {
    this.w = world;
    this.R = opts.radius || 70;
    this.step = opts.step || 1.9;
    this.density = opts.density ?? 1;
    const tn = opts.tint || [1, 1, 1];
    this.tint = new THREE.Color().setRGB(tn[0], tn[1], tn[2]);
    const per = Math.ceil((2 * this.R / this.step) ** 2 * 0.8);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.time = { value: 0 };
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          float sw = sin(uTime * 1.7 + ip.x * 0.31 + ip.z * 0.23) * 0.5 + sin(uTime * 2.9 + ip.x * 0.7) * 0.25;
          transformed.xz += vec2(0.12, 0.07) * sw * position.y * 2.0;`);
    };
    this.mat.customProgramCacheKey = () => 'grassGfx';
    this.mesh = new THREE.InstancedMesh(tuftGeo(), this.mat, per);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(per * 3), 3);
    scene.add(this.mesh);
    this.cap = per;
    this.last = null;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color(); this._e = new THREE.Euler();
  }

  update(t, cam) {
    this.time.value = t;
    const cx = cam.position.x, cz = cam.position.z;
    const w = this.w;
    // über ca. 140 m Höhe sieht man die Halme ohnehin nicht
    const agl = cam.position.y - Math.max(0, w.height(cx, cz));
    this.mesh.visible = agl < 140;
    if (!this.mesh.visible) return;
    if (this.last && Math.hypot(cx - this.last.x, cz - this.last.z) < 6) return;
    this.last = { x: cx, z: cz };
    const st = this.step, R = this.R, R2 = R * R;
    const i0 = Math.floor((cx - R) / st), i1 = Math.ceil((cx + R) / st), j0 = Math.floor((cz - R) / st), j1 = Math.ceil((cz + R) / st);
    let n = 0;
    const m = this._m, q = this._q, v = this._v, s = this._s, c = this._c, e = this._e;
    for (let j = j0; j <= j1 && n < this.cap; j++) for (let i = i0; i <= i1 && n < this.cap; i++) {
      const h1 = hash(i, j, 21);
      if (h1 > this.density) continue;
      const x = (i + hash(i, j, 22)) * st, z = (j + hash(i, j, 23)) * st;
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz > R2) continue;
      const y = w.height(x, z);
      if (y < 0.4) continue;
      if (w.nearFlat && w.nearFlat(x, z, -2)) continue;
      const nr = w.normal(x, z);
      if (nr.y < 0.86) continue;
      if (w.grassOk && !w.grassOk(x, z, y)) continue;
      const k = 0.75 + hash(i, j, 24) * 0.7;
      e.set(0, hash(i, j, 25) * 6.28, 0);
      q.setFromEuler(e);
      m.compose(v.set(x, y - 0.03, z), q, s.set(k, k * (0.8 + hash(i, j, 26) * 0.6), k));
      this.mesh.setMatrixAt(n, m);
      w.groundColor(x, z, c);
      c.multiply(this.tint);
      c.multiplyScalar(0.92 + hash(i, j, 27) * 0.25);
      this.mesh.setColorAt(n, c);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

// ------------------------------------------------------------ Bodenbedeckung: Felsen und Büsche
// Zufällig, aber fest pro Rasterzelle verteilt in einem Ring um die Kamera (wie das Gras).
// Landezonen, Pads, FOB, Dörfer und Wasser bleiben frei; rein optisch (keine Kollision).
function rockGeo() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const b = 1 + 0.22 * Math.sin(x * 3.1 + z * 1.7) * Math.cos(y * 2.3 - x) + 0.12 * Math.sin(z * 5.3 + y * 4.1);
    const yy = y < 0 ? y * 0.35 : y * 0.62;
    pos.setXYZ(i, x * b, yy * b, z * b * 0.85);
    const k = 0.72 + 0.28 * (y * 0.5 + 0.5) + 0.06 * Math.sin(x * 9 + z * 7);
    col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function bushGeo() {
  const parts = [];
  const blobs = [[0, 0.55, 0, 0.75, 0.6], [0.5, 0.45, 0.25, 0.55, 0.45], [-0.45, 0.42, -0.2, 0.55, 0.45], [0.1, 0.75, -0.35, 0.45, 0.4], [-0.15, 0.4, 0.45, 0.5, 0.4]];
  for (const [x, y, z, r, ry] of blobs) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(r, ry, r); g.translate(x, y, z);
    parts.push(g);
  }
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < g.attributes.position.count; i++) { col[(o + i) * 3] = 0.075; col[(o + i) * 3 + 1] = 0.13; col[(o + i) * 3 + 2] = 0.045; }
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  softenTree(out);
  return out;
}

export class GroundCover {
  // opts: radius, step, rock (Dichte 0..1), bush (0..1), rockCol [r,g,b], bushCol [r,g,b], steepRocks
  constructor(scene, world, opts = {}) {
    this.w = world;
    this.R = opts.radius || 200;
    this.step = opts.step || 7;
    this.o = Object.assign({ rock: 0.1, bush: 0.2, rockCol: [0.5, 0.48, 0.45], bushCol: [0.85, 1, 0.75] }, opts);
    const per = Math.ceil((2 * this.R / this.step) ** 2 * 0.8);
    const mk = (geo, mat, cap) => {
      const m = new THREE.InstancedMesh(geo, mat, cap);
      m.count = 0; m.frustumCulled = false;
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      m.castShadow = !!opts.shadows; m.receiveShadow = false;
      scene.add(m);
      return m;
    };
    this.rocks = mk(rockGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), Math.max(1, Math.ceil(per * Math.min(1, this.o.rock * 1.6 + 0.05))));
    this.bushes = mk(bushGeo(), treeMaterial(), Math.max(1, Math.ceil(per * Math.min(1, this.o.bush + 0.05))));
    this.last = null;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color(); this._e = new THREE.Euler();
  }

  blocked(x, z, y) {
    const w = this.w;
    if (y < 0.7) return true;
    if (w.nearFlat && w.nearFlat(x, z, 12)) return true;
    if (w.fob && dist2(x, z, w.fob.x, w.fob.z) < (w.fob.r || 250) + 30) return true;
    for (const s of w.sites || []) if (dist2(x, z, s.x, s.z) < 45) return true;
    const vc = Math.max(40, w.villageClear || 0);
    for (const v of w.villages || []) if (dist2(x, z, v.x, v.z) < vc + (v.big ? 60 : 20)) return true;
    return false;
  }

  update(cam) {
    const cx = cam.position.x, cz = cam.position.z, w = this.w;
    const agl = cam.position.y - Math.max(0, w.height(cx, cz));
    const vis = agl < 700;
    this.rocks.visible = this.bushes.visible = vis;
    if (!vis) return;
    if (this.last && Math.hypot(cx - this.last.x, cz - this.last.z) < 20) return;
    this.last = { x: cx, z: cz };
    const st = this.step, R = this.R, R2 = R * R, o = this.o;
    const i0 = Math.floor((cx - R) / st), i1 = Math.ceil((cx + R) / st), j0 = Math.floor((cz - R) / st), j1 = Math.ceil((cz + R) / st);
    let nr = 0, nb = 0;
    const m = this._m, q = this._q, v = this._v, s = this._s, c = this._c, e = this._e;
    const capR = this.rocks.instanceMatrix.count, capB = this.bushes.instanceMatrix.count;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const h1 = hash(i, j, 41), steepBoost = 0;
      const x = (i + hash(i, j, 42)) * st, z = (j + hash(i, j, 43)) * st;
      const dx = x - cx, dz = z - cz, dd = dx * dx + dz * dz;
      if (dd > R2) continue;
      // am Rand des Bereichs klein einwachsen statt plötzlich aufzutauchen
      const edge = Math.min(1, (R - Math.sqrt(dd)) / (R * 0.3));
      const y = w.height(x, z);
      if (this.blocked(x, z, y)) continue;
      const nrm = w.normal(x, z);
      const steep = 1 - nrm.y;
      // Felsen: häufiger an Hängen, in Gruppen (Rauschen über die Zellen)
      const grp = 0.5 + 0.5 * Math.sin(i * 0.37 + j * 0.21) * Math.cos(i * 0.13 - j * 0.29);
      const pr = o.rock * (0.4 + grp * 1.2) * (1 + steep * (o.steepRocks ?? 1.5)) + steepBoost;
      if (h1 < pr && nr < capR) {
        const big = hash(i, j, 44);
        const k = (0.25 + big * big * (o.rockMax || 1.4)) * edge;
        e.set(hash(i, j, 45) * 0.5, hash(i, j, 46) * 6.28, hash(i, j, 47) * 0.4);
        q.setFromEuler(e);
        m.compose(v.set(x, y - k * 0.12, z), q, s.set(k * (0.8 + hash(i, j, 48) * 0.6), k * (0.7 + hash(i, j, 49) * 0.6), k));
        this.rocks.setMatrixAt(nr, m);
        const t = 0.8 + hash(i, j, 50) * 0.35;
        c.setRGB(o.rockCol[0] * t, o.rockCol[1] * t, o.rockCol[2] * t);
        this.rocks.setColorAt(nr++, c);
        continue;
      }
      const h2 = hash(i, j, 51);
      if (nrm.y > 0.8 && (!w.inForest || w.inForest(x, z) < 0.45) && h2 < o.bush * (0.3 + grp * 1.4) && nb < capB) {
        const k = (0.55 + hash(i, j, 52) * 0.9) * (o.bushSize || 1) * edge;
        e.set(0, hash(i, j, 53) * 6.28, 0);
        q.setFromEuler(e);
        m.compose(v.set(x, y - 0.1, z), q, s.set(k * (0.9 + hash(i, j, 54) * 0.4), k * (0.7 + hash(i, j, 55) * 0.6), k));
        this.bushes.setMatrixAt(nb, m);
        const t = 0.8 + hash(i, j, 56) * 0.4;
        c.setRGB(o.bushCol[0] * t, o.bushCol[1] * t * (0.95 + hash(i, j, 57) * 0.1), o.bushCol[2] * t);
        this.bushes.setColorAt(nb++, c);
      }
    }
    this.rocks.count = nr; this.bushes.count = nb;
    for (const im of [this.rocks, this.bushes]) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  }
}
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// ------------------------------------------------------------ Verwitterung für Bauten und Fahrzeuge
// Fleckiger Putz/Lack, senkrechte Schmutzschlieren an Wänden, Staub auf Oberseiten.
// Objektkoordinaten: das Muster bleibt bei fahrenden Fahrzeugen fest auf der Oberfläche.
export function weatherMaterial(mat, key = 'weather') {
  const tex = noiseTexture();
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uNoiseW = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP;\nvarying vec3 vON;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;\nvON = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uNoiseW;\nvarying vec3 vOP;\nvarying vec3 vON;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 an = abs(normalize(vON));
          vec2 pw = an.x > an.z ? vOP.zy : vOP.xy;
          if (an.y > 0.7) pw = vOP.xz;
          float m1 = texture2D(uNoiseW, pw / 6.5).g;
          float m2 = texture2D(uNoiseW, pw / 1.6 + 0.4).a;
          float streak = texture2D(uNoiseW, vec2(pw.x / 2.2, pw.y / 14.0) + 0.13).b;
          float vert = 1.0 - an.y;
          float top = smoothstep(0.75, 0.95, normalize(vON).y);
          diffuseColor.rgb *= mix(0.9, 1.07, m1) * mix(0.96, 1.03, m2);
          diffuseColor.rgb *= 1.0 - vert * smoothstep(0.5, 0.85, streak) * 0.15;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.8 + vec3(0.07, 0.06, 0.042), top * (0.25 + 0.3 * m1));
        }`);
  };
  mat.customProgramCacheKey = () => key;
  mat.needsUpdate = true;
  return mat;
}
