// On-foot player movement, entering/exiting cars, punching and shooting.
import { WORLD_W, WORLD_H } from './config.js';
import { collideBuildings, inBeachWater } from './city.js';
import { addHeat } from './police.js';

export function updatePlayerOnFoot(G, act, dt) {
  const p = G.player;
  // Mouse aim overrides facing: Rook shoots where the cursor points.
  if (act.aimX !== undefined && act.aimY !== undefined) {
    p.angle = Math.atan2(act.aimY - p.y, act.aimX - p.x);
  }
  let dx = (act.right ? 1 : 0) - (act.left ? 1 : 0);
  let dy = (act.down ? 1 : 0) - (act.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len; dy /= len;
    const speed = act.run ? 260 : 165;
    p.x += dx * speed * dt;
    p.y += dy * speed * dt;
    if (act.aimX === undefined) p.angle = Math.atan2(dy, dx);
    p.moving = true;
    p.walkPhase += dt * (act.run ? 14 : 9);
  } else p.moving = false;
  p.x = Math.max(14, Math.min(WORLD_W - 14, p.x));
  p.y = Math.max(14, Math.min(WORLD_H - 14, p.y));
  if (inBeachWater(G.city, p.x, p.y)) p.y = 2320; // can't swim out to sea
  collideBuildings(G.city, p, 13);

  // Punch: short-range hit on gang / cops / peds.
  if (act.punch && p.punchCd <= 0) {
    p.punchCd = 0.45;
    p.punchAnim = 0.18;
    G.audio.punch();
    const px = p.x + Math.cos(p.angle) * 26, py = p.y + Math.sin(p.angle) * 26;
    for (const g of G.gang) {
      if (g.hp > 0 && Math.hypot(g.x - px, g.y - py) < 30) { g.hp -= 34; spawnHit(G, g.x, g.y); if (g.hp <= 0) onGangDown(G, g); }
    }
    for (const c of G.cops) {
      if (c.onFoot && Math.hypot(c.x - px, c.y - py) < 30) { c.hp -= 40; spawnHit(G, c.x, c.y); addHeat(G, 8); if (c.hp <= 0) { c.hp = 0; c.down = true; } }
    }
  }
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.punchAnim > 0) p.punchAnim -= dt;

  // Shoot pistol toward aim (movement direction, or last aim).
  if (act.shoot && p.shootCd <= 0 && p.ammo > 0) {
    p.shootCd = 0.22;
    p.ammo -= 1;
    p.muzzle = 0.07;
    G.audio.shot();
    const a = p.angle;
    G.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, from: 'player', damage: 34, life: 0.9 });
    addHeat(G, 10);
    G.shake = Math.max(G.shake, 2);
  }
  if (act.reload && p.ammo < 12 && p.reserve > 0 && p.reloadT <= 0) {
    p.reloadT = 0.9;
    G.audio.reload();
  }
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const need = 12 - p.ammo;
      const take = Math.min(need, p.reserve);
      p.ammo += take; p.reserve -= take;
    }
  }
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.muzzle > 0) p.muzzle -= dt;
  if (p.iframes > 0) p.iframes -= dt;
}

export function spawnHit(G, x, y) {
  for (let i = 0; i < 8; i += 1) {
    G.particles.push({ x, y, vx: (G.rng.next() - 0.5) * 160, vy: (G.rng.next() - 0.5) * 160, life: 0.4, max: 0.4, color: '#ff5a4a', size: 3 });
  }
}

export function onGangDown(G, g) {
  G.stats.kills += 1;
  G.cash += 25;
  G.audio.blip();
  spawnHit(G, g.x, g.y);
  for (let i = 0; i < 14; i += 1) {
    G.particles.push({ x: g.x, y: g.y, vx: (G.rng.next() - 0.5) * 220, vy: (G.rng.next() - 0.5) * 220, life: 0.6, max: 0.6, color: '#ffd23f', size: 3 });
  }
}

// Try to enter the nearest car (E). Returns true if entered.
export function tryEnterCar(G) {
  const p = G.player;
  let best = null; let bestD = 78;
  for (const car of G.cars) {
    if (car.driver === 'player') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return false;
  if (best.driver === 'traffic') {
    // Carjacking in view of a pedestrian or cop raises the heat.
    addHeat(G, 14);
    G.message = 'Car stolen! The city saw that.';
    G.messageTimer = 2.5;
    G.stats.carsStolen += 1;
    best.driver = 'player';
    best.parked = false;
  } else if (best.parked) {
    addHeat(G, 6);
    G.stats.carsStolen += 1;
    best.driver = 'player';
    best.parked = false;
  } else if (best.driver === 'police') {
    return false; // can't steal a police car with a cop in it
  } else {
    best.driver = 'player';
    best.parked = false;
  }
  p.inCar = best;
  p.x = best.x; p.y = best.y;
  G.audio.click();
  return true;
}

export function exitCar(G) {
  const p = G.player;
  if (!p.inCar) return;
  const car = p.inCar;
  car.driver = car.type === 'police' ? 'police' : 'parked';
  car.parked = car.driver === 'parked';
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.angle = car.angle;
}
