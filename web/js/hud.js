// HUD, Kompass, Minikarte, Funk, Overlays
import * as THREE from './lib/three.module.min.js';
import { HALF, WORLD_SIZE, HELI } from './config.js';
import { clamp, bearing, headingFromYaw, fmtDist, fmtBearing, dist2, dirShort, fmtTime } from './util.js';

const $ = (id) => document.getElementById(id);
const _p = new THREE.Vector3();

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of ['hud', 'mission-line', 'mission-step', 'compass', 'wp-text', 'wp-arrow', 'minimap', 'fuel-fill', 'fuel-val', 'fuel-min', 'hp-fill', 'hp-val',
      'pax', 'ammo', 'r-alt', 'r-spd', 'r-vs', 'r-hdg', 'warnings', 'radio', 'crosshair', 'seat-label', 'marker', 'fob-marker', 'hint', 'damage-flash',
      'status-badge', 'briefing', 'brief-title', 'brief-rows', 'brief-radio', 'result', 'result-title', 'result-rows', 'fullmap', 'fullmap-canvas', 'crashscreen', 'crash-cause', 'fps', 'vs-bar', 'collective-bar'])
      this.el[id] = $(id);
    this.compassCtx = this.el.compass.getContext('2d');
    this.miniCtx = this.el.minimap.getContext('2d');
    this.radioLines = [];
    this.textTimer = 0;
    this.flash = 0;
    this.resultTimer = 0;
    this.mapOpen = false;
    this.frames = 0; this.fpsT = 0;
  }

  show(on) { this.el.hud.classList.toggle('hidden', !on); }

  // ------------------------------------------------------------ Funk
  radio(text, from = '', urgent = false) {
    const div = document.createElement('div');
    div.className = 'radio-line' + (urgent ? ' urgent' : '');
    div.innerHTML = (from ? `<b>${from}</b> ` : '') + text.replace(/</g, '&lt;');
    this.el.radio.appendChild(div);
    this.radioLines.push({ div, t: 0 });
    const max = document.body.classList.contains('touch') ? 2 : 5;
    while (this.radioLines.length > max) this.radioLines.shift().div.remove();
  }

  // ------------------------------------------------------------ Briefing / Ergebnis
  showBriefing(m, d) {
    this.el['brief-title'].textContent = d.title;
    const tb = this.el['brief-rows'];
    tb.innerHTML = '';
    for (const [k, v, cls] of d.rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<th>${k}</th><td class="${cls || ''}">${v}</td>`;
      tb.appendChild(tr);
    }
    this.el['brief-radio'].textContent = d.radio;
    this.el.briefing.classList.toggle('hot', !!d.hot);
    this.el.briefing.classList.remove('hidden');
    this.briefOpen = true;
  }
  hideBriefing() { this.el.briefing.classList.add('hidden'); this.briefOpen = false; }

  showResult(r) {
    this.el['result-title'].textContent = r.title;
    const tb = this.el['result-rows'];
    tb.innerHTML = '';
    for (const [k, v] of r.lines) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<th>${k}</th><td>${v}</td>`;
      tb.appendChild(tr);
    }
    this.el.result.classList.remove('hidden');
    this.resultTimer = 6;
  }

  showCrash(cause) {
    this.el['crash-cause'].textContent = cause;
    this.el.crashscreen.classList.remove('hidden');
  }
  hideCrash() { this.el.crashscreen.classList.add('hidden'); }

  damageFlash(a = 0.5) { this.flash = Math.min(0.7, this.flash + a); }

  toggleMap(force) {
    this.mapOpen = force ?? !this.mapOpen;
    this.el.fullmap.classList.toggle('hidden', !this.mapOpen);
    if (this.mapOpen) this.drawFullMap();
  }

  // ------------------------------------------------------------ Update
  update(dt, info) {
    const g = this.game, h = g.heli;
    this.frames++; this.fpsT += dt;
    if (this.fpsT > 1) { if (this.el.fps) this.el.fps.textContent = this.frames + ' FPS'; this.frames = 0; this.fpsT = 0; }

    this.flash = Math.max(0, this.flash - dt * 1.5);
    this.el['damage-flash'].style.opacity = this.flash;
    if (this.resultTimer > 0) { this.resultTimer -= dt; if (this.resultTimer <= 0) this.el.result.classList.add('hidden'); }
    for (const l of this.radioLines) {
      l.t += dt;
      const life = document.body.classList.contains('touch') ? 9 : 14;
      if (l.t > life) l.div.style.opacity = Math.max(0, 1 - (l.t - life) / 2);
    }
    const heading = headingFromYaw(h.yaw);
    const wp = info.waypoint;
    this.drawCompass(heading, wp, g.world.fob);
    this.updateMarkers(wp);

    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = 0.1;
    const mi = g.missions.hudInfo();
    this.el['mission-line'].textContent = mi.line;
    this.el['mission-line'].classList.toggle('hot', !!mi.hot);
    this.el['mission-step'].textContent = mi.step;
    if (wp) {
      const b = bearing(h.pos.x, h.pos.z, wp.x, wp.z);
      const d = dist2(h.pos.x, h.pos.z, wp.x, wp.z);
      this.el['wp-text'].textContent = `${wp.label} · ${fmtBearing(b)} ${dirShort(b)} · ${fmtDist(d)}${h.speed > 8 ? ' · ' + fmtTime(d / h.speed) : ''}`;
      this.el['wp-arrow'].style.transform = `rotate(${b - heading}deg)`;
      this.el['wp-arrow'].style.visibility = 'visible';
    } else {
      this.el['wp-text'].textContent = '';
      this.el['wp-arrow'].style.visibility = 'hidden';
    }
    // Treibstoff
    const fuel = h.fuel;
    const ff = this.el['fuel-fill'];
    ff.style.setProperty('--v', fuel + '%');
    ff.className = 'fill ' + (fuel < 15 ? 'crit' : fuel < 30 ? 'warn' : 'ok');
    this.el['fuel-val'].textContent = Math.round(fuel) + ' %';
    const burn = h.burnRate > 0 ? h.burnRate : 0.12;
    this.el['fuel-min'].textContent = h.engineOn ? '≈ ' + fmtTime(fuel / burn) + ' min' : 'TRIEBWERK AUS';
    const hf = this.el['hp-fill'];
    hf.style.setProperty('--v', h.hp + '%');
    hf.className = 'fill ' + (h.hp < 25 ? 'crit' : h.hp < 55 ? 'warn' : 'ok');
    this.el['hp-val'].textContent = Math.round(h.hp) + ' %';
    // Instrumente (Fuß, Knoten)
    this.el['r-alt'].textContent = Math.max(0, Math.round(h.agl * 3.281));
    this.el['r-spd'].textContent = Math.round(h.speed * 1.944);
    this.el['r-vs'].textContent = Math.round((h.vel.y * 196.85) / 10) * 10;
    this.el['r-hdg'].textContent = fmtBearing(heading);
    const vsn = clamp(h.vel.y / 10, -1, 1);
    this.el['vs-bar'].style.transform = `scaleY(${vsn})`;
    this.el['vs-bar'].className = vsn < -0.45 && h.agl < 30 ? 'danger' : '';
    // Passagiere
    const pc = h.passengers.length;
    this.el.pax.innerHTML = `<span class="lbl">KABINE</span> ${pc}/${HELI.capacity}`;
    const L = g.gunners.left, R = g.gunners.right;
    this.el.ammo.innerHTML = `<span class="lbl">M60</span> L ${L.ammo} · R ${R.ammo}`;
    // Warnungen
    this.el.warnings.innerHTML = info.warnings.map((w) => `<div class="warn ${w.level || ''}">${w.text}</div>`).join('');
    this.el.hint.textContent = info.hint || '';
    this.el.hint.style.display = info.hint ? 'block' : 'none';
    const seatNames = { pilot: 'PILOT', left: 'SCHÜTZE LINKS', right: 'SCHÜTZE RECHTS' };
    this.el['seat-label'].textContent = seatNames[g.seat] + (g.seat !== 'pilot' ? ' · Autopilot hält Position' : '') + (info.cameraLabel ? ' · ' + info.cameraLabel : '');
    this.el.crosshair.style.display = g.seat === 'pilot' ? 'none' : 'block';
    this.drawMinimap(heading, wp);
    if (this.mapOpen) this.drawFullMap();
  }

  drawCompass(heading, wp, fob) {
    const c = this.compassCtx, W = c.canvas.width, H = c.canvas.height;
    const h = this.game.heli;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(10,14,8,0.55)';
    c.fillRect(0, 0, W, H);
    const ppd = W / 120;
    c.strokeStyle = '#d8e0c0';
    c.fillStyle = '#d8e0c0';
    c.font = 'bold 13px "Roboto Condensed", Arial, sans-serif';
    c.textAlign = 'center';
    const names = { 0: 'N', 45: 'NO', 90: 'O', 135: 'SO', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    const start = Math.floor((heading - 60) / 5) * 5;
    for (let d = start; d <= heading + 60; d += 5) {
      const x = W / 2 + (d - heading) * ppd;
      const dd = ((d % 360) + 360) % 360;
      const major = dd % 15 === 0;
      c.beginPath();
      c.moveTo(x, H);
      c.lineTo(x, H - (major ? 12 : 6));
      c.stroke();
      if (names[dd] !== undefined) { c.fillStyle = dd === 0 ? '#ffd257' : '#e8f0d0'; c.fillText(names[dd], x, 16); c.fillStyle = '#d8e0c0'; }
      else if (dd % 30 === 0) c.fillText(String(dd / 10).padStart(2, '0'), x, 16);
    }
    const mark = (b, color, label) => {
      let diff = ((b - heading + 540) % 360) - 180;
      const off = Math.abs(diff) > 58;
      diff = clamp(diff, -58, 58);
      const x = W / 2 + diff * ppd;
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(x, H - 2); c.lineTo(x - 7, H - 14); c.lineTo(x + 7, H - 14); c.closePath();
      c.fill();
      if (label) { c.font = 'bold 10px Arial'; c.fillText(label, x, 29); c.font = 'bold 13px "Roboto Condensed", Arial'; }
      if (off) { c.fillRect(diff < 0 ? 0 : W - 4, 0, 4, H); }
    };
    mark(bearing(h.pos.x, h.pos.z, fob.x, fob.z), '#5fb4ff', 'FOB');
    if (wp) mark(bearing(h.pos.x, h.pos.z, wp.x, wp.z), '#ffd257', 'ZIEL');
    c.fillStyle = '#ffffff';
    c.fillRect(W / 2 - 1, 0, 2, H);
  }

  drawMinimap(heading, wp) {
    const g = this.game, h = g.heli, w = g.world;
    const c = this.miniCtx, S = c.canvas.width;
    const span = 2600;
    const mc = w.mapCanvas, ms = mc.width;
    const scale = ms / WORLD_SIZE;
    const sx = (h.pos.x - span / 2 + HALF) * scale, sz = (h.pos.z - span / 2 + HALF) * scale;
    c.fillStyle = '#24381a';
    c.fillRect(0, 0, S, S);
    c.drawImage(mc, sx, sz, span * scale, span * scale, 0, 0, S, S);
    const toS = (x, z) => [((x - h.pos.x) / span + 0.5) * S, ((z - h.pos.z) / span + 0.5) * S];
    // Landezonen
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 1;
    for (const s of w.sites) { const [x, y] = toS(s.x, s.z); if (x > -5 && x < S + 5 && y > -5 && y < S + 5) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.stroke(); } }
    // FOB
    const [fx, fy] = toS(w.fob.x, w.fob.z);
    c.fillStyle = '#5fb4ff';
    c.fillRect(fx - 5, fy - 5, 10, 10);
    // Feinde (aufgeklärt)
    c.fillStyle = '#ff4a3a';
    for (const e of g.units.enemies) {
      if (!e.alive || e.reveal <= 0) continue;
      const [x, y] = toS(e.x, e.z);
      if (x > 0 && x < S && y > 0 && y < S) c.fillRect(x - 2, y - 2, 4, 4);
    }
    // Ziel
    if (wp) {
      const [x, y] = toS(wp.x, wp.z);
      c.strokeStyle = '#ffd257';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(clamp(x, 6, S - 6), clamp(y, 6, S - 6), wp.approx ? (wp.radius / span) * S : 6, 0, 7);
      c.stroke();
    }
    // Hubschrauber
    c.save();
    c.translate(S / 2, S / 2);
    c.rotate((heading * Math.PI) / 180);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -8); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath();
    c.fill();
    c.restore();
    c.fillStyle = '#e8f0d0';
    c.font = 'bold 11px Arial';
    c.fillText('N', S / 2 - 3, 11);
  }

  drawFullMap() {
    const g = this.game, h = g.heli, w = g.world;
    const cv = this.el['fullmap-canvas'];
    const size = Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.86);
    if (cv.width !== size) { cv.width = cv.height = size; }
    const c = cv.getContext('2d');
    c.drawImage(w.mapCanvas, 0, 0, size, size);
    const toS = (x, z) => [((x + HALF) / WORLD_SIZE) * size, ((z + HALF) / WORLD_SIZE) * size];
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.font = `bold ${Math.round(size / 40)}px Arial`;
    for (let i = 0; i <= 6; i++) {
      const p = (i / 6) * size;
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, size); c.stroke();
      c.beginPath(); c.moveTo(0, p); c.lineTo(size, p); c.stroke();
      if (i < 6) { c.fillText('ABCDEF'[i], p + 4, size / 30); c.fillText(String(i + 1), 4, p + size / 12); }
    }
    c.font = `${Math.round(size / 55)}px Arial`;
    for (const s of w.sites) {
      const [x, y] = toS(s.x, s.z);
      c.strokeStyle = '#fff'; c.beginPath(); c.arc(x, y, 4, 0, 7); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillText(s.name, x + 6, y + 4);
    }
    for (const v of w.villages) { const [x, y] = toS(v.x, v.z); c.fillStyle = 'rgba(60,30,10,0.8)'; c.fillText(v.name, x + 5, y - 4); }
    const [fx, fy] = toS(w.fob.x, w.fob.z);
    c.fillStyle = '#5fb4ff'; c.fillRect(fx - 7, fy - 7, 14, 14);
    c.fillStyle = '#fff'; c.font = `bold ${Math.round(size / 45)}px Arial`; c.fillText(w.fob.name, fx + 10, fy + 5);
    const wp = g.missions.waypoint();
    if (wp) {
      const [x, y] = toS(wp.x, wp.z);
      c.strokeStyle = '#ffd257'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y, Math.max(8, (wp.radius / WORLD_SIZE) * size), 0, 7); c.stroke();
      c.lineWidth = 1;
    }
    const [hx, hy] = toS(h.pos.x, h.pos.z);
    c.save(); c.translate(hx, hy); c.rotate((headingFromYaw(h.yaw) * Math.PI) / 180);
    c.fillStyle = '#fff'; c.strokeStyle = '#000';
    c.beginPath(); c.moveTo(0, -11); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  // Bildschirmmarker für Wegpunkt und FOB
  updateMarkers(wp) {
    const g = this.game, cam = g.camera;
    const place = (el, x, y, z, label, show) => {
      if (!show) { el.style.display = 'none'; return; }
      _p.set(x, y, z).project(cam);
      const behind = _p.z > 1;
      let sx = (_p.x * 0.5 + 0.5) * window.innerWidth, sy = (-_p.y * 0.5 + 0.5) * window.innerHeight;
      if (behind) { sx = window.innerWidth - sx; sy = window.innerHeight - 40; }
      const m = 30;
      const clipped = behind || sx < m || sx > window.innerWidth - m || sy < m || sy > window.innerHeight - m;
      sx = clamp(sx, m, window.innerWidth - m); sy = clamp(sy, m + 40, window.innerHeight - m);
      el.style.display = 'block';
      el.style.transform = `translate(${sx}px, ${sy}px)`;
      el.classList.toggle('edge', clipped);
      const lab = el.querySelector('.mlabel');
      if (lab && lab.textContent !== label) lab.textContent = label;
    };
    const h = g.heli;
    if (wp) {
      const d = dist2(h.pos.x, h.pos.z, wp.x, wp.z);
      place(this.el.marker, wp.x, wp.y + 4, wp.z, `${wp.label} ${fmtDist(d)}`, true);
    } else place(this.el.marker, 0, 0, 0, '', false);
    const f = g.world.fob;
    const df = dist2(h.pos.x, h.pos.z, f.x, f.z);
    place(this.el['fob-marker'], f.x, f.y + 10, f.z, `FOB ${fmtDist(df)}`, df > 350 && (!wp || dist2(wp.x, wp.z, f.x, f.z) > 300));
  }
}
