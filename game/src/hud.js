// HUD: health, cash, wanted stars, weapon/ammo, objective, clock — plus the
// live minimap (canvas-drawn city, player, police and mission markers).
import { WORLD_W, WORLD_H, MISSIONS } from './config.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function text(ctx, value, x, y, size, color, align, bold) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function clockString(time) {
  const h = Math.floor(time);
  const m = Math.floor((time - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawHud(ctx, G, vw, vh) {
  const p = G.player;
  ctx.save();
  // Top-left: health bar + cash.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 12, 250, 62);
  text(ctx, 'ROOK', 24, 34, 15, '#ffffff', 'left', true);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 42, 180, 12);
  ctx.fillStyle = p.hp > 50 ? '#3fd06a' : p.hp > 25 ? '#e8b820' : '#e53a3a';
  ctx.fillRect(24, 42, Math.max(0, 180 * (p.hp / 100)), 12);
  text(ctx, `${Math.ceil(p.hp)}`, 210, 53, 13, '#ffffff', 'left', true);
  text(ctx, `$${G.cash}`, 24, 70, 17, '#7dff8a', 'left', true);

  // Top-centre: wanted stars.
  const stars = G.wanted;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(vw / 2 - 90, 12, 180, 34);
  for (let i = 0; i < 5; i += 1) {
    text(ctx, '★', vw / 2 - 70 + i * 32, 38, 26, i < stars ? '#ffd23f' : '#555', 'left');
  }

  // Top-right: clock + mission counter.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(vw - 214, 12, 200, 62);
  text(ctx, clockString(G.time), vw - 24, 36, 18, '#ffffff', 'right', true);
  const mi = Math.min(G.missionIndex + 1, MISSIONS.length);
  text(ctx, `Mission ${mi}/${MISSIONS.length}`, vw - 24, 58, 14, '#ffd23f', 'right');
  text(ctx, G.district, vw - 24, 74, 12, '#bcd', 'right');

  // Bottom-left: weapon + ammo, or car health when driving.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, vh - 58, 250, 46);
  if (p.inCar) {
    text(ctx, `${p.inCar.type.toUpperCase()}  HP ${Math.max(0, Math.ceil(p.inCar.hp))}/${p.inCar.maxHp}`, 24, vh - 30, 16, '#ffffff', 'left', true);
    text(ctx, 'E exit car', 24, vh - 14, 12, '#bcd', 'left');
  } else {
    text(ctx, `PISTOL  ${p.ammo} / ${p.reserve}`, 24, vh - 30, 16, '#ffffff', 'left', true);
    text(ctx, p.reloadT > 0 ? 'Reloading…' : 'Space shoot · F punch · R reload', 24, vh - 14, 12, '#bcd', 'left');
  }

  // Objective banner under the stars.
  if (G.objective) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = Math.min(560, 24 + G.objective.length * 8.4);
    ctx.fillRect(vw / 2 - w / 2, 52, w, 30);
    text(ctx, `◆ ${G.objective}`, vw / 2, 73, 15, '#ffd23f', 'center', true);
  }

  // Transient message, wrapped to two lines so long briefs stay readable.
  if (G.messageTimer > 0 && G.message) {
    const words = G.message.split(' ');
    const lines = [''];
    for (const w of words) {
      if ((lines[lines.length - 1] + ' ' + w).trim().length > 72) lines.push(w);
      else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim();
    }
    const shown = lines.slice(0, 2);
    const w = 700;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(vw / 2 - w / 2, vh - 118 - (shown.length - 1) * 26, w, 26 + shown.length * 22);
    shown.forEach((ln, i) => text(ctx, ln, vw / 2, vh - 96 - (shown.length - 1) * 26 + i * 22, 15, '#ffffff', 'center'));
  }

  // District popup.
  if (G.districtTimer > 0) {
    const a = Math.min(1, G.districtTimer);
    ctx.globalAlpha = a;
    text(ctx, G.district, vw / 2, vh / 2 - 120, 44, '#ffffff', 'center', true);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawMinimap(ctx, G, vw, vh) {
  const mw = 200, mh = 150;
  const x0 = vw - mw - 14, y0 = vh - mh - 14;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
  // Water / beach.
  ctx.fillStyle = '#1d4a6b';
  ctx.fillRect(x0, y0 + 2180 * sy, mw, mh - 2180 * sy);
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(x0, y0 + 2180 * sy, mw, 8);
  // Park.
  ctx.fillStyle = '#2a6a3a';
  ctx.fillRect(x0 + 1400 * sx, y0 + 1000 * sy, 400 * sx, 400 * sy);
  // Roads.
  ctx.fillStyle = '#555c66';
  for (const rx of G.city.roadsV) ctx.fillRect(x0 + (rx - 48) * sx, y0, 96 * sx, mh);
  for (const ry of G.city.roadsH) ctx.fillRect(x0, y0 + (ry - 48) * sy, mw, 96 * sy);
  // Buildings.
  ctx.fillStyle = '#8a8f98';
  for (const b of G.city.buildings) ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  // Mission marker (pulsing).
  if (G.marker) {
    const pulse = 3 + Math.sin(G.elapsed * 5) * 1.5;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x0 + G.marker.x * sx, y0 + G.marker.y * sy, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#4a8cff';
  for (const car of G.cars) {
    if (car.driver !== 'police') continue;
    ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
  }
  for (const c of G.cops) ctx.fillRect(x0 + c.x * sx - 2, y0 + c.y * sy - 2, 4, 4);
  // Gang.
  ctx.fillStyle = '#ff5a4a';
  for (const g of G.gang) ctx.fillRect(x0 + g.x * sx - 2, y0 + g.y * sy - 2, 4, 4);
  // Player.
  const p = G.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3fd06a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
