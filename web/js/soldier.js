// Infanterie: spielbarer Soldat mit Handwaffen (und Avatare der Mitspieler)
import * as THREE from './lib/three.module.min.js';
import { Figure, weaponGeo, vcMat, OPTICS } from './models.js';
import { HALF, G } from './config.js';
import { clamp, rand, dist2 } from './util.js';
import { T } from './theme.js';
import { MOUNT_WEAPON } from './mounts.js';

// Handwaffen der Infanterie (Vietnam 1968 / Afghanistan 2010)
const WEAPONS_VN = [
  { id: 'm16', sight: [0.165, -0.0, -0.66, 0.26, 0.05, 0.034], handle: 0.24, name: 'M16A1', desc: 'Sturmgewehr', mag: 20, reserve: 200, rpm: 750, auto: true, vel: 990, spread: 0.012, fov: 30, reload: 2.2, sound: 'm16', tracer: 3, recoil: 0.006 },
  { id: 'm60', sight: [0.1, 0.02, -0.93, 0.28, 0.06, 0.03], name: 'M60', desc: 'Maschinengewehr', mag: 100, reserve: 300, rpm: 550, auto: true, vel: 853, spread: 0.022, fov: 38, reload: 5.0, sound: 'm60', tracer: 2, recoil: 0.009, slow: 0.78 },
  { id: 'm79', sight: [0.11, -0.06, -0.46, 0.3, 0.045, 0.065], name: 'M79', desc: 'Granatwerfer', mag: 1, reserve: 24, rpm: 50, auto: false, vel: 76, spread: 0.006, fov: 42, reload: 1.8, sound: 'thump', grenade: true, recoil: 0.05 },
  { id: 'ithaca', sight: [0.06, 0.04, -0.71, 0.3, 0.045, 0.036], name: 'Ithaca 37', desc: 'Schrotflinte', mag: 5, reserve: 40, rpm: 80, auto: false, vel: 400, spread: 0.055, fov: 50, reload: 3.0, sound: 'shotgun', pellets: 9, recoil: 0.06 },
  { id: 'm1911', sight: [0.06, 0.02, -0.17, 0.45, 0.045, 0.045], name: 'M1911', desc: 'Pistole', mag: 7, reserve: 56, rpm: 360, auto: false, vel: 253, spread: 0.018, fov: 45, reload: 1.6, sound: 'pistol', recoil: 0.03 },
  // Panzerfaust: nur aus den Ablagen an der FOB-Mauer
  { id: 'law', sight: [0.12, 0.16, -0.42, 0.3, 0.075, 0.075], name: 'M72 LAW', desc: 'Panzerfaust', rpm: 30, auto: false, vel: 230, spread: 0.004, fov: 40, reload: 2.6, sound: 'thump', recoil: 0.08, launcher: true, mag: 1, reserve: 2, start: 0 },
];
const WEAPONS_AFG = [
  { id: 'm4', optic: true, sight: [0.165, 0.0, -0.66, 0.26], name: 'M4A1', desc: 'Sturmgewehr', mag: 30, reserve: 240, rpm: 800, auto: true, vel: 910, spread: 0.011, fov: 26, reload: 2.3, sound: 'm16', tracer: 4, recoil: 0.005 },
  { id: 'm249', optic: true, sight: [0.155, 0.02, -0.93, 0.3], name: 'M249 SAW', desc: 'leichtes MG', mag: 200, reserve: 400, rpm: 800, auto: true, vel: 915, spread: 0.02, fov: 36, reload: 5.5, sound: 'm60', tracer: 3, recoil: 0.007, slow: 0.8 },
  { id: 'm320', sight: [0.11, -0.06, -0.46, 0.3, 0.045, 0.065], name: 'M320', desc: 'Granatwerfer', mag: 1, reserve: 24, rpm: 55, auto: false, vel: 76, spread: 0.006, fov: 42, reload: 1.7, sound: 'thump', grenade: true, recoil: 0.05 },
  { id: 'm590', sight: [0.06, 0.04, -0.71, 0.3, 0.045, 0.036], name: 'Mossberg 590', desc: 'Schrotflinte', mag: 8, reserve: 48, rpm: 85, auto: false, vel: 400, spread: 0.05, fov: 50, reload: 3.4, sound: 'shotgun', pellets: 9, recoil: 0.06 },
  { id: 'm9', sight: [0.06, 0.02, -0.17, 0.45, 0.045, 0.045], name: 'M9', desc: 'Pistole', mag: 15, reserve: 60, rpm: 400, auto: false, vel: 375, spread: 0.016, fov: 45, reload: 1.5, sound: 'pistol', recoil: 0.025 },
  { id: 'at4', sight: [0.13, 0.18, -0.45, 0.3, 0.085, 0.085], name: 'AT4', desc: 'Panzerfaust', rpm: 30, auto: false, vel: 230, spread: 0.004, fov: 40, reload: 2.6, sound: 'thump', recoil: 0.08, launcher: true, mag: 1, reserve: 2, start: 0 },
];
// Wird beim Start passend zum Einsatzgebiet befüllt (gleiche Array-Instanz für alle Importe)
export const WEAPONS = WEAPONS_VN.slice();
export function setWeaponSet(theme) {
  WEAPONS.length = 0;
  WEAPONS.push(...(theme === 'afghanistan' || theme === 'mali' ? WEAPONS_AFG : WEAPONS_VN));
}

const geoCache = {};
const wgeo = (id) => geoCache[id] || (geoCache[id] = weaponGeo(id));
const ZERO = new THREE.Vector3();
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Vector3();

// Kimme (zwei Pfosten) und Korn: Oberkanten liegen genau auf der Visierlinie
const sightMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
function sightMeshes(w) {
  const [H, rz, fz, eye] = w.sight;
  // Korn so breit, dass es aus Augenposition gut 60 % der Kimmenlücke füllt
  const kw = 0.009 * ((eye + rz - fz) / eye) * 0.6;
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.01), sightMat);
    post.position.set(sx * 0.0085, H + 0.008, rz);
    g.add(post);
  }
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.01), sightMat);
  base.position.set(0, H - 0.013, rz);
  g.add(base);
  const korn = new THREE.Mesh(new THREE.BoxGeometry(kw, 0.028 * ((eye + rz - fz) / eye) * 0.5, 0.006), sightMat);
  korn.position.set(0, H - korn.geometry.parameters.height / 2, fz);
  g.add(korn);
  const kornFuss = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.012), sightMat);
  kornFuss.position.set(0, H - 0.03, fz);
  g.add(kornFuss);
  // Halterungen bis auf die Waffe hinunter, damit Kimme und Korn nicht schweben
  const [, , , , rb = H, fb = H] = w.sight;
  const rh = H - 0.019 - rb, fh = H - 0.036 - fb;
  if (rh > 0.002) {
    const len = w.handle || 0.03; // M16: Tragegriff nach vorn
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.026, rh, len), sightMat);
    m.position.set(0, rb + rh / 2, rz - len / 2 + 0.01);
    g.add(m);
  }
  if (fh > 0.002) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.012, fh, 0.016), sightMat);
    m.position.set(0, fb + fh / 2, fz);
    g.add(m);
  }
  return g;
}

// EOTech: Absehen (65-MOA-Ring mit Punkt) im Fenster und klappbarer 3x-Vergrößerer (G33) dahinter
let reticleTex = null;
function reticleTexture() {
  if (reticleTex) return reticleTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = '#ff3a2a'; x.fillStyle = '#ff3a2a'; x.lineWidth = 4;
  x.shadowColor = '#ff2010'; x.shadowBlur = 6;
  x.beginPath(); x.arc(64, 64, 50, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.arc(64, 64, 4, 0, Math.PI * 2); x.fill();
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { x.beginPath(); x.moveTo(64 + dx * 50, 64 + dy * 50); x.lineTo(64 + dx * 58, 64 + dy * 58); x.stroke(); }
  reticleTex = new THREE.CanvasTexture(c);
  reticleTex.colorSpace = THREE.SRGBColorSpace;
  return reticleTex;
}
function opticMeshes(w) {
  const o = OPTICS[w.id], eye = w.sight[3];
  const g = new THREE.Group();
  const dist = eye + w.sight[1] - o.zc;
  const size = (0.019 * dist) / 0.39 * 2 * 0.5;
  const ret = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
    map: reticleTexture(), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  ret.position.set(0, o.H, o.zc);
  ret.renderOrder = 20;
  g.add(ret);
  // Vergrößerer auf Klappmontage (Scharnier rechts unten, klappt zur Seite weg)
  const mag = new THREE.Group();
  mag.position.set(0.03, o.H - 0.04, o.zc + 0.115);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.1, 16, 1, true), new THREE.MeshLambertMaterial({ color: 0x1d1e1d, side: THREE.DoubleSide }));
  tube.rotation.x = Math.PI / 2;
  tube.position.set(-0.03, 0.04, 0);
  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.05), new THREE.MeshLambertMaterial({ color: 0x1d1e1d }));
  mount.position.set(-0.012, 0.0, 0);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.019, 16), new THREE.MeshPhongMaterial({ color: 0x5a6a80, transparent: true, opacity: 0.15, shininess: 100 }));
  lens.position.set(-0.03, 0.04, -0.049);
  mag.add(tube, mount, lens);
  g.add(mag);
  return { g, ret, mag };
}

function nameSprite(name) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 30px Arial';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = Math.min(250, x.measureText(name).width + 24);
  x.fillStyle = 'rgba(10,14,8,0.6)'; x.fillRect(128 - w / 2, 10, w, 44);
  x.fillStyle = '#8fe0ff'; x.fillRect(128 - w / 2, 50, w, 4);
  x.fillStyle = '#fff'; x.fillText(name, 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false, transparent: true }));
  s.scale.set(2.4, 0.6, 1);
  s.position.y = 2.3;
  return s;
}

export class Soldier {
  constructor(game, remote = false, name = '') {
    this.game = game;
    this.remote = remote;
    this.fig = new Figure(T.player);
    this.group = this.fig.group;
    this.arm = new THREE.Group();
    this.arm.position.set(0.16, 1.3, -0.05);
    this.group.add(this.arm);
    this.gun = new THREE.Mesh(wgeo(WEAPONS[0].id), vcMat);
    this.gun.position.set(-0.05, -0.04, -0.28);
    this.arm.add(this.gun);
    if (remote && name) { this.label = nameSprite(name); this.group.add(this.label); }
    game.scene.add(this.group);
    this.pos = new THREE.Vector3();
    this.vy = 0; this.yaw = 0; this.pitch = 0;
    this.hp = 100; this.alive = true; this.crouch = false; this.w = 0;
    this.mag = WEAPONS.map((w) => w.start ?? w.mag);
    this.res = WEAPONS.map((w) => w.start ?? w.reserve);
    this.reloadT = 0; this.cool = 0; this.lastHit = -99; this.deadT = 0;
    this.active = false; this.moving = false; this.onGround = true; this.zoom = false;
    this.group.visible = false;
  }

  get weapon() { return this.mount ? MOUNT_WEAPON : WEAPONS[this.w]; }
  // Munition der aktuellen Waffe (an der Lafette: Munition des MGs)
  get curMag() { return this.mount ? this.mount.ammo.mag : this.mag[this.w]; }
  set curMag(v) { if (this.mount) this.mount.ammo.mag = v; else this.mag[this.w] = v; }
  get curRes() { return this.mount ? this.mount.ammo.res : this.res[this.w]; }
  set curRes(v) { if (this.mount) this.mount.ammo.res = v; else this.res[this.w] = v; }
  // 3x-Vergrößerer nur bei Waffen mit Rotpunktvisier
  magFactor() { return this.weapon.optic && this.magOn ? 3 : 1; }
  toggleMagnifier() {
    if (!this.weapon.optic) return false;
    this.magOn = !this.magOn;
    return true;
  }

  spawn(x, z, yaw = 0) {
    const w = this.game.world;
    this.pos.set(x, Math.max(0, w.height(x, z)), z);
    this.yaw = yaw; this.pitch = 0; this.vy = 0;
    this.hp = 100; this.alive = true; this.deadT = 0; this.active = true;
    this.group.visible = true;
    this.group.rotation.set(0, yaw, 0);
    this.fig.stand();
    this.sync();
  }

  hide() { this.active = false; this.group.visible = false; if (this.vm) this.vm.visible = false; }

  // ------------------------------------------------------------ Ego-Perspektive (Waffe vor der Kamera)
  updateViewModel(dt, camera, on) {
    if (!this.vm) {
      this.vm = new THREE.Group();
      this.vmGun = new THREE.Mesh(wgeo(WEAPONS[0].id), vcMat);
      this.vm.add(this.vmGun);
      camera.add(this.vm);
      this.adsT = 0; this.kick = 0;
    }
    this.vm.visible = on;
    if (!on) return;
    const w = this.weapon;
    if (this.vmId !== w.id) {
      this.vmId = w.id;
      this.vmGun.geometry = wgeo(w.id);
      if (this.vmSights) this.vmGun.remove(this.vmSights);
      this.vmOptic = w.optic ? opticMeshes(w) : null;
      this.vmSights = this.vmOptic ? this.vmOptic.g : sightMeshes(w);
      this.vmGun.add(this.vmSights);
    }
    if (this.vmOptic) {
      // Vergrößerer: aufgeklappt hinter dem Visier oder zur Seite weggeklappt
      const tgt = this.magOn ? 0 : -1.6;
      const m = this.vmOptic.mag;
      m.rotation.z += (tgt - m.rotation.z) * Math.min(1, dt * 14);
      this.vmOptic.ret.visible = this.adsT > 0.35;
    }
    this.adsT += ((this.zoom && this.reloadT <= 0 ? 1 : 0) - this.adsT) * Math.min(1, dt * 10);
    this.kick *= Math.exp(-dt * 14);
    const [H, rz, , eye] = w.sight;
    const a = this.adsT;
    // Hüfte: rechts unten; Zielen: Visierlinie auf der Kameraachse
    const hip = [0.17, -0.19, -0.42], ads = [0, -H, -eye - rz];
    const bob = this.moving && this.onGround ? Math.sin(performance.now() / 120) * 0.012 * (1 - a * 0.8) : 0;
    this.vm.position.set(hip[0] + (ads[0] - hip[0]) * a, hip[1] + (ads[1] - hip[1]) * a + bob, hip[2] + (ads[2] - hip[2]) * a + this.kick);
    this.vm.rotation.set(this.kick * 1.5, (1 - a) * 0.05, 0);
    if (this.reloadT > 0) this.vm.rotation.x -= 0.6;
  }

  // Panzerfäuste aus einer Ablage aufnehmen (bis zu 3 Schuss) und gleich in die Hand nehmen
  takeLauncher() {
    const i = WEAPONS.findIndex((w) => w.launcher);
    if (i < 0) return false;
    const w = WEAPONS[i];
    if (this.mag[i] + this.res[i] >= w.mag + w.reserve) return false;
    this.mag[i] = w.mag;
    this.res[i] = w.reserve;
    this.setWeapon(i);
    return w;
  }

  // Ohne Munition wird die Panzerfaust beim Durchschalten übersprungen
  hasAmmo(i) { const w = WEAPONS[i]; return !w.launcher || this.mag[i] + this.res[i] > 0; }
  setWeapon(i) {
    const dir = i < this.w ? -1 : 1;
    i = (i + WEAPONS.length) % WEAPONS.length;
    for (let n = 0; n < WEAPONS.length && !this.hasAmmo(i); n++) i = (i + dir + WEAPONS.length) % WEAPONS.length;
    if (i === this.w) return;
    this.w = i;
    this.gun.geometry = wgeo(WEAPONS[i].id);
    this.reloadT = 0;
    this.cool = 0.35;
    if (!this.remote) this.game.audio.shot('click', 1);
  }

  startReload() {
    const w = this.weapon;
    if (this.reloadT > 0 || this.curMag >= w.mag || this.curRes <= 0) return;
    this.reloadT = w.reload;
    this.game.audio.shot('click', 1);
  }

  takeDamage(n) {
    if (!this.alive) return;
    this.hp -= n;
    this.lastHit = this.game.time;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.deadT = 0; }
  }

  sync() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.arm.rotation.x = this.pitch;
    // Waffe beim Knien auf Schulterhöhe des geduckten Körpers
    const kneel = this.crouch && !(this.moving && this.onGround && !this.remote) && !(this.remote && this.moving);
    this.arm.position.y = kneel ? 0.9 : 1.3;
  }

  // Lokaler Spieler
  update(dt, inp, look, fire, zoom) {
    const g = this.game, world = g.world;
    if (!this.active) return;
    if (!this.alive) { this.animateDead(dt); return; }
    this.zoom = zoom;
    const zf = zoom ? (this.magFactor() > 1 ? 0.18 : 0.45) : 1;
    this.yaw -= look.dx * zf;
    this.pitch = clamp(this.pitch - look.dy * zf, -1.25, 1.2);
    // An einer MG-Lafette: keine Bewegung, Blick führt das MG
    if (this.mount) {
      this.moving = false; this.onGround = true; this.vy = 0;
      g.mounts.updatePlayer(this);
      this.sync();
      this.updateGun(dt, fire);
      return;
    }

    // Bewegung
    const w = this.weapon;
    const mv = inp.move;
    let mx = mv.x, my = mv.y;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const sprint = inp.sprint && my > 0.3 && !this.crouch && !zoom;
    if (sprint) this.crouch = false;
    const sp = (sprint ? 6.2 : this.crouch ? 1.7 : 3.6) * (w.slow || 1) * (zoom ? 0.6 : 1);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const vx = (-sy * my + cy * mx) * sp, vz = (-cy * my - sy * mx) * sp;
    this.moving = ml > 0.1;
    const nx = clamp(this.pos.x + vx * dt, -HALF + 20, HALF - 20), nz = clamp(this.pos.z + vz * dt, -HALF + 20, HALF - 20);
    if (world.height(nx, nz) > -0.8) { this.pos.x = nx; this.pos.z = nz; }
    world.trunkPush(this.pos);
    for (const h of g.helis) {
      const dx = this.pos.x - h.pos.x, dz = this.pos.z - h.pos.z, d = Math.hypot(dx, dz);
      if (d < 2.4 && d > 0.01 && this.pos.y < h.pos.y + 1) { this.pos.x = h.pos.x + (dx / d) * 2.4; this.pos.z = h.pos.z + (dz / d) * 2.4; }
    }
    const ground = Math.max(world.height(this.pos.x, this.pos.z), -0.6);
    if (inp.jumpPressed && this.onGround) { this.vy = 4.3; this.onGround = false; }
    this.vy -= G * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= ground) { this.pos.y = ground; this.vy = 0; this.onGround = true; }
    if (this.moving && this.onGround) this.fig.walk(dt, sp);
    else if (this.crouch) this.fig.kneel();
    else this.fig.stand();
    this.sync();

    this.updateGun(dt, fire);

    // Erholung und Nachschub in der FOB
    const f = world.fob;
    const atFob = dist2(this.pos.x, this.pos.z, f.x, f.z) < 220;
    if (g.time - this.lastHit > 6 || atFob) this.hp = Math.min(100, this.hp + (atFob ? 15 : 3) * dt);
    if (atFob) {
      this.resupplyT = (this.resupplyT || 0) + dt;
      if (this.resupplyT > 0.5) {
        this.resupplyT = 0;
        WEAPONS.forEach((wp, i) => { if (!wp.launcher) this.res[i] = Math.min(wp.reserve, this.res[i] + Math.ceil(wp.reserve / 10)); });
      }
    }
  }

  // Abzug, Nachladen (Handwaffe oder MG an der Lafette)
  updateGun(dt, fire) {
    const g = this.game, w = this.weapon;
    this.cool = Math.max(-0.1, this.cool - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = w.mag - this.curMag;
        const take = Math.min(need, this.curRes);
        this.curMag += take; this.curRes -= take;
      }
    } else if (fire) {
      if (this.curMag <= 0) {
        if (this.curRes > 0) this.startReload();
        else if (!this.prevFire) g.audio.shot('click', 1);
      } else {
        for (let n = 0; this.cool <= 0 && (w.auto || !this.prevFire) && this.curMag > 0 && n < 3; n++) {
          this.shoot();
          if (!w.auto) break;
        }
      }
    }
    this.prevFire = fire;
  }

  animateDead(dt) {
    this.deadT += dt;
    this.group.rotation.x = -Math.min(Math.PI / 2, this.deadT * 4);
    this.group.position.y = this.pos.y + 0.15 * Math.min(1, this.deadT * 4);
  }

  muzzlePos(out) {
    if (this.mount) return this.game.mounts.muzzle(this.mount, out);
    if (this.vm && this.vm.visible) {
      this.vm.updateMatrixWorld(true);
      return this.vmGun.localToWorld(out.set(0, this.weapon.sight[0] - 0.05, this.weapon.sight[2] - 0.05));
    }
    this.group.updateMatrixWorld(true);
    return this.gun.localToWorld(out.set(0, 0.02, -0.75));
  }

  shoot() {
    const g = this.game, w = this.weapon, cam = g.camera;
    this.cool += 60 / w.rpm;
    this.curMag--;
    // Zielpunkt: Geländetreffer entlang der Blickrichtung der Kamera
    cam.getWorldDirection(_d);
    const t = g.world.raycast(cam.position, _d, 900);
    const target = _v.copy(cam.position).addScaledVector(_d, t);
    const muzzle = this.muzzlePos(_m);
    const dir = target.clone().sub(muzzle).normalize();
    const spread = w.spread * (this.zoom ? 0.45 : 1) * (this.crouch ? 0.7 : 1) * (this.moving ? 1.6 : 1);
    if (w.launcher) {
      // Rakete mit Feuerstrahl nach hinten
      const v = dir.clone().multiplyScalar(w.vel);
      g.combat.rocket(muzzle, v, false);
      if (g.net) g.net.rocketFire(muzzle, v);
      g.effects.puff(muzzle.x - dir.x * 2, muzzle.y - dir.y * 2, muzzle.z - dir.z * 2, 0.75, 0.72, 0.66, 8, 2.5, 2.5, 1.8);
      if (this.mag[this.w] + this.res[this.w] <= 0) setTimeout(() => this.setWeapon(0), 600);
    } else if (w.grenade) {
      const vel = this.lobVelocity(muzzle, target, w.vel, dir);
      g.combat.grenade(muzzle, vel);
      if (g.net) g.net.footFire(muzzle, vel, w.id, true);
    } else {
      this.shots = (this.shots || 0) + 1;
      for (let p = 0; p < (w.pellets || 1); p++) {
        const d = dir.clone();
        d.x += (rand() - 0.5) * spread * 2; d.y += (rand() - 0.5) * spread * 2; d.z += (rand() - 0.5) * spread * 2;
        d.normalize();
        const tracer = !!w.tracer && this.shots % w.tracer === 0 && p === 0;
        g.combat.fire(muzzle, d, ZERO, tracer, false, w.vel, false, false, !!w.big);
        if (g.net && p === 0) g.net.footFire(muzzle, d, w.id, tracer);
      }
    }
    g.effects.muzzle(muzzle.x + dir.x * 0.2, muzzle.y + dir.y * 0.2, muzzle.z + dir.z * 0.2, w.id === 'm60' || w.id === 'ithaca' || w.id === 'm2');
    g.audio.shot(w.sound, 3);
    this.pitch = Math.min(1.2, this.pitch + w.recoil * (this.crouch ? 0.6 : 1));
    this.kick = Math.min(0.08, (this.kick || 0) + 0.02 + w.recoil * 0.4);
  }

  // Abschussgeschwindigkeit für einen Granatbogen auf den Zielpunkt
  lobVelocity(from, to, v, fallback) {
    const dx = to.x - from.x, dz = to.z - from.z, dy = to.y - from.y;
    const R = Math.hypot(dx, dz);
    const v2 = v * v;
    const disc = v2 * v2 - G * (G * R * R + 2 * dy * v2);
    let ang;
    if (R < 0.5 || disc < 0) ang = disc < 0 ? Math.PI / 4 : Math.asin(clamp(fallback.y, -1, 1));
    else ang = Math.atan((v2 - Math.sqrt(disc)) / (G * R));
    const hx = R > 0.01 ? dx / R : fallback.x, hz = R > 0.01 ? dz / R : fallback.z;
    return new THREE.Vector3(hx * Math.cos(ang) * v, Math.sin(ang) * v, hz * Math.cos(ang) * v);
  }

  // ------------------------------------------------------------ Netzwerk
  getState() {
    const r = (x) => Math.round(x * 100) / 100;
    const fl = (this.alive ? 1 : 0) | (this.crouch ? 2 : 0) | (this.moving ? 4 : 0);
    return [r(this.pos.x), r(this.pos.y), r(this.pos.z), r(this.yaw), r(this.pitch), this.w, Math.round(this.hp), fl];
  }

  applyState(st) {
    if (!this.active) { this.spawn(st[0], st[2], st[3]); this.pos.y = st[1]; }
    this.tgt = st;
    if (st[5] !== this.w) { this.w = st[5]; this.gun.geometry = wgeo(WEAPONS[st[5]].id); }
    this.hp = st[6];
    const alive = !!(st[7] & 1);
    if (!alive && this.alive) this.deadT = 0;
    if (alive && !this.alive) this.group.rotation.x = 0;
    this.alive = alive;
    this.crouch = !!(st[7] & 2);
    this.moving = !!(st[7] & 4);
  }

  updateRemote(dt) {
    if (!this.active || !this.tgt) return;
    const st = this.tgt, k = Math.min(1, dt * 10);
    if (Math.hypot(st[0] - this.pos.x, st[2] - this.pos.z) > 25) this.pos.set(st[0], st[1], st[2]);
    this.pos.x += (st[0] - this.pos.x) * k; this.pos.y += (st[1] - this.pos.y) * k; this.pos.z += (st[2] - this.pos.z) * k;
    this.yaw = st[3]; this.pitch = st[4];
    if (!this.alive) { this.animateDead(dt); return; }
    if (this.moving) this.fig.walk(dt, 3.6);
    else if (this.crouch) this.fig.kneel();
    else this.fig.stand();
    this.sync();
    this.group.visible = this.game.isNearView(this.pos.x, this.pos.z);
  }

  dispose() { this.game.scene.remove(this.group); }
}
