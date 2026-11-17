// Drawing only: the city, cars, people, effects and screens. Camera follows the
// player; a day/night tint cycles with the clock.
import { WORLD_W, WORLD_H, VIEW_W, VIEW_H, MISSIONS, STORY_INTRO } from './config.js';
import { drawHud, drawMinimap } from './hud.js';
import { hasSave } from './save.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function nightTint(time) {
  // 0 = noon bright, 1 = deep night. Night 21:00–05:00, dusk/dawn ramps.
  if (time >= 6 && time < 18) return time < 7 || time >= 17 ? 0.12 : 0;
  if (time >= 18 && time < 21) return 0.18;
  if (time >= 5 && time < 6) return 0.2;
  return 0.32;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let vw = VIEW_W, vh = VIEW_H;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    vw = canvas.width / ratio;
    vh = canvas.height / ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function text(value, x, y, size, color, align, bold) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawCar(car, flash, elapsed) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const w = car.w, h = car.h;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 6);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,45,0.9)';
    ctx.fillRect(-w * 0.18, -h / 2 + 3, w * 0.3, h - 6);
    ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.fillRect(w * 0.12, -h / 2 + 4, 3, h - 8);
    // Headlights / taillights.
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(w / 2 - 2, -h / 2 + 2, 3, 4);
    ctx.fillRect(w / 2 - 2, h / 2 - 6, 3, 4);
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(-w / 2 - 1, -h / 2 + 2, 3, 4);
    ctx.fillRect(-w / 2 - 1, h / 2 - 6, 3, 4);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#111';
      ctx.fillRect(-w * 0.1, -h / 2 - 4, 12, 4);
      text('TAXI', 0, 4, 8, '#111', 'center', true);
    }
    if (car.type === 'police') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-w * 0.28, -h / 2 + 2, w * 0.56, h - 4);
      ctx.fillStyle = '#1a2a4a';
      text('PD', 0, 4, 9, '#1a2a4a', 'center', true);
      // Light bar flashing (driven by game time, so screenshots stay deterministic).
      ctx.fillStyle = flash ? '#ff2a2a' : '#2a6cff';
      ctx.fillRect(-8, -h / 2 - 5, 8, 5);
      ctx.fillStyle = flash ? '#2a6cff' : '#ff2a2a';
      ctx.fillRect(0, -h / 2 - 5, 8, 5);
    }
    if (car.missionCar) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (car.hp < car.maxHp * 0.4) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath();
      ctx.arc(car.x + Math.sin(elapsed * 7 + car.id) * 7, car.y - 10, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPerson(x, y, angle, color, walkPhase, down) {
    ctx.save();
    ctx.translate(x, y);
    if (down) ctx.rotate(Math.PI / 2);
    const bob = Math.sin(walkPhase) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 4, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Legs.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-3, 0); ctx.lineTo(-3 + bob, 8);
    ctx.moveTo(3, 0); ctx.lineTo(3 - bob, 8);
    ctx.stroke();
    // Body.
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, -2, 8, 0, Math.PI * 2); ctx.fill();
    // Head.
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath(); ctx.arc(Math.cos(angle) * 2, -10 + Math.sin(angle) * 2, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawWorld(G) {
    const camX = G.camera.x - vw / 2;
    const camY = G.camera.y - vh / 2;
    // Screen shake uses game time, not Math.random, so screenshots stay deterministic.
    const shX = G.shake > 0 ? Math.sin(G.elapsed * 61) * G.shake * 0.5 : 0;
    const shY = G.shake > 0 ? Math.cos(G.elapsed * 53) * G.shake * 0.5 : 0;
    ctx.save();
    ctx.translate(-camX + shX, -camY + shY);
    const city = G.city;
    // Ground.
    ctx.fillStyle = '#3a3f35';
    ctx.fillRect(camX - 40, camY - 40, vw + 80, vh + 80);
    // Beach + water.
    ctx.fillStyle = '#c2a878';
    ctx.fillRect(0, 2180, WORLD_W, 140);
    ctx.fillStyle = '#1d5a7a';
    ctx.fillRect(0, 2320, WORLD_W, 80);
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
    // Park.
    ctx.fillStyle = '#2f7a3e';
    ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
    ctx.fillStyle = '#7a9ac2';
    ctx.beginPath(); ctx.arc(city.park.x + 200, city.park.y + 200, 46, 0, Math.PI * 2); ctx.fill();
    // Roads.
    ctx.fillStyle = '#33373d';
    for (const rx of city.roadsV) ctx.fillRect(rx - 48, 0, 96, WORLD_H);
    for (const ry of city.roadsH) ctx.fillRect(0, ry - 48, WORLD_W, 96);
    // Road centre dashes.
    ctx.fillStyle = '#d8c85a';
    for (const rx of city.roadsV) {
      for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of city.roadsH) {
      for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
    }
    // Sidewalks (lighter strips beside roads).
    ctx.fillStyle = 'rgba(200,200,200,0.08)';
    for (const rx of city.roadsV) { ctx.fillRect(rx - 62, 0, 10, WORLD_H); ctx.fillRect(rx + 52, 0, 10, WORLD_H); }
    for (const ry of city.roadsH) { ctx.fillRect(0, ry - 62, WORLD_W, 10); ctx.fillRect(0, ry + 52, WORLD_W, 10); }
    // Buildings.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x, b.y, b.w, 6);
      // Windows.
      ctx.fillStyle = nightTint(G.time) > 0.15 ? 'rgba(255,220,120,0.75)' : 'rgba(180,220,255,0.5)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) {
        ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 16, 12);
      }
    }
    // Trees.
    for (const t of city.trees) {
      ctx.fillStyle = '#1f5a2a';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2f8a3e';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    // Street name labels.
    ctx.font = 'bold 15px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.textAlign = 'center';
    const labels = [
      { t: 'HARBOR BLVD', x: 600, y: 590 }, { t: 'CRANE AVE', x: 1400, y: 990 },
      { t: 'OLD TOWN RD', x: 2600, y: 1390 }, { t: 'PIER WALK', x: 600, y: 2170 },
      { t: 'DOWNTOWN', x: 1800, y: 190 }, { t: 'DOCKSIDE', x: 200, y: 1790 },
    ];
    for (const lb of labels) ctx.fillText(lb.t, lb.x, lb.y);
    // Skid marks.
    ctx.strokeStyle = 'rgba(10,10,10,0.5)';
    ctx.lineWidth = 4;
    for (const s of G.skids) {
      ctx.globalAlpha = Math.min(1, s.life / 5);
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
      ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Pickups.
    for (const pk of G.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(pk.bob * 3) * 2;
      ctx.fillStyle = pk.kind === 'health' ? '#3fd06a' : '#ffd23f';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      if (pk.kind === 'health') {
        ctx.fillRect(pk.x - 2, pk.y + bob - 7, 4, 14);
        ctx.fillRect(pk.x - 7, pk.y + bob - 2, 14, 4);
      } else if (pk.kind === 'cash') {
        text('$', pk.x, pk.y + bob + 5, 15, '#1a4a1a', 'center', true);
      } else {
        text('+', pk.x, pk.y + bob + 4, 14, '#111', 'center', true);
      }
    }
    // Mission marker.
    if (G.marker) {
      const pulse = 1 + Math.sin(G.elapsed * 4) * 0.12;
      ctx.save();
      ctx.translate(G.marker.x, G.marker.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(12, -12); ctx.lineTo(-12, -12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // Cars.
    const flash = Math.floor(G.elapsed * 4) % 2 === 0;
    for (const car of G.cars) drawCar(car, flash, G.elapsed);
    // Pedestrians.
    for (const ped of G.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.walkPhase, ped.down);
    // Gang.
    for (const g of G.gang) {
      drawPerson(g.x, g.y, g.angle, '#8a1a1a', g.walkPhase, false);
      ctx.fillStyle = '#ff5a4a';
      ctx.fillRect(g.x - 12, g.y - 24, 24, 4);
      ctx.fillStyle = '#3fd06a';
      ctx.fillRect(g.x - 12, g.y - 24, 24 * Math.max(0, g.hp / 60), 4);
      if (g.muzzle > 0) {
        ctx.fillStyle = '#ffe9a0';
        ctx.beginPath(); ctx.arc(g.x + Math.cos(g.angle) * 22, g.y + Math.sin(g.angle) * 22, 7, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Foot cops.
    for (const c of G.cops) {
      drawPerson(c.x, c.y, c.angle, '#1a2a4a', c.walkPhase, c.down);
      ctx.fillStyle = '#4a8cff';
      ctx.beginPath(); ctx.arc(c.x, c.y - 16, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player.
    const p = G.player;
    if (!p.inCar) {
      const blink = p.iframes > 0 && Math.floor(p.iframes * 12) % 2 === 0;
      if (!blink) {
        drawPerson(p.x, p.y, p.angle, '#e8e8e8', p.walkPhase, false);
        // Rook's jacket + pistol.
        ctx.fillStyle = '#c22a3a';
        ctx.beginPath(); ctx.arc(p.x, p.y - 2, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.angle) * 8, p.y + Math.sin(p.angle) * 8 - 2);
        ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20 - 2);
        ctx.stroke();
        if (p.muzzle > 0) {
          ctx.fillStyle = '#ffe9a0';
          ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26 - 2, 8, 0, Math.PI * 2); ctx.fill();
        }
        if (p.punchAnim > 0) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
          ctx.lineTo(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30);
          ctx.stroke();
        }
      }
    }
    // Bullets.
    ctx.fillStyle = '#ffe9a0';
    for (const b of G.bullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Night headlights for the player's car.
    if (p.inCar && nightTint(G.time) > 0.15) {
      ctx.save();
      ctx.translate(p.inCar.x, p.inCar.y);
      ctx.rotate(p.inCar.angle);
      ctx.fillStyle = 'rgba(255,230,150,0.10)';
      ctx.beginPath();
      ctx.moveTo(20, -8); ctx.lineTo(280, -70); ctx.lineTo(280, 70); ctx.lineTo(20, 8);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // Particles.
    for (const pt of G.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Day/night tint.
    const tint = nightTint(G.time);
    if (tint > 0) {
      ctx.fillStyle = `rgba(8,12,40,${tint})`;
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = Math.min(680, vw - 60);
    const h = 150 + lines.length * 30;
    const x = (vw - w) / 2, y = (vh - h) / 2;
    ctx.fillStyle = 'rgba(8,10,16,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || '#ffd23f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(title, vw / 2, y + 58, 42, '#ffffff', 'center', true);
    lines.forEach((ln, i) => text(ln, vw / 2, y + 102 + i * 30, 17, '#c8ccd4', 'center'));
    if (prompt) text(prompt, vw / 2, y + h - 26, 18, '#ffd23f', 'center', true);
  }

  function draw(G, screen) {
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, vw, vh);
    if (screen === SCREEN_TITLE) {
      // Live city behind the title.
      drawWorld(G);
      ctx.fillStyle = 'rgba(5,8,14,0.55)';
      ctx.fillRect(0, 0, vw, vh);
      text('DUSK HARBOR', vw / 2, vh / 2 - 150, 64, '#ffd23f', 'center', true);
      text('An open-world crime story — Rook. Delia Crane. Six jobs.', vw / 2, vh / 2 - 108, 19, '#ffffff', 'center');
      const lines = [
        'WASD / Arrows — move & drive · Shift — run',
        'E — enter / steal a car · F — punch · Space — shoot · R — reload',
        'Mouse — aim · Esc / P — pause · M — mute · Steal cars, dodge the police, finish all 6 missions',
      ];
      lines.forEach((ln, i) => text(ln, vw / 2, vh / 2 - 62 + i * 28, 17, '#c8ccd4', 'center'));
      const save = hasSave();
      text(save ? 'Press Enter — New Game  ·  C — Continue saved game' : 'Press Enter to start — New Game', vw / 2, vh / 2 + 52, 20, '#7dff8a', 'center', true);
      text(STORY_INTRO, vw / 2, vh - 30, 13, '#8b93a3', 'center');
      return;
    }
    drawWorld(G);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(ctx, G, vw, vh);
      drawMinimap(ctx, G, vw, vh);
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', [
        'WASD / Arrows — move & drive · Shift — run',
        'E — enter / steal a car · F — punch · Space — shoot · R — reload',
        'Mouse — aim · M — mute · S — save game',
        G.objective ? `Current job: ${G.objective}` : '',
      ].filter(Boolean), 'Press P / Esc to resume · S to save');
    } else if (screen === SCREEN_OVER) {
      const busted = G.overReason === 'busted';
      drawPanel(busted ? 'BUSTED' : 'WASTED', [
        busted ? 'The Dusk Harbor PD caught you.' : 'Rook went down in the streets.',
        `You lost $${G.overFine}. The city keeps your cash.`,
        `Missions done: ${G.missionIndex} / ${MISSIONS.length} · Cash: $${G.cash}`,
      ], 'Press Enter to get back on the streets');
    } else if (screen === SCREEN_WIN) {
      drawPanel('DUSK HARBOR IS YOURS', [
        'All six jobs done. The heist money is in the boat.',
        'Delia Crane: "Told you, Rook. The harbor was always ours."',
        `Final cash: $${G.cash} · Vipers down: ${G.stats.kills} · Cars stolen: ${G.stats.carsStolen}`,
      ], 'Press Enter to keep playing the city');
    }
  }

  return { draw, get vw() { return vw; }, get vh() { return vh; } };
}
