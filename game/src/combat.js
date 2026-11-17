// Combat: bullets, gang members, health packs, pickups and particles.
import { collideBuildings } from './city.js';
import { onGangDown, spawnHit } from './player.js';

export function spawnGang(G, x, y, count, hostile) {
  for (let i = 0; i < count; i += 1) {
    const a = G.rng.range(0, Math.PI * 2);
    const r = G.rng.range(30, 160);
    G.gang.push({
      x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
      angle: 0, hp: 60, speed: 95, shootCd: G.rng.range(0.5, 1.5),
      walkPhase: G.rng.range(0, 6), hostile: hostile !== false,
    });
  }
}

export function spawnHealthPacks(G) {
  const spots = [
    { x: 600, y: 600 }, { x: 1600, y: 1200 }, { x: 2600, y: 1000 },
    { x: 1000, y: 1800 }, { x: 2400, y: 600 }, { x: 400, y: 1400 },
    { x: 2000, y: 2200 }, { x: 2800, y: 400 }, { x: 600, y: 900 },
  ];
  for (const s of spots) G.pickups.push({ x: s.x, y: s.y, kind: 'health', taken: false, bob: 0 });
  // Ammo pickups near the docks and bank.
  G.pickups.push({ x: 700, y: 1100, kind: 'ammo', taken: false, bob: 0 });
  G.pickups.push({ x: 1900, y: 1100, kind: 'ammo', taken: false, bob: 0 });
  G.pickups.push({ x: 1600, y: 500, kind: 'ammo', taken: false, bob: 0 });
  // Cash drops — street money left around the city.
  const cashSpots = [
    { x: 1000, y: 400 }, { x: 2200, y: 1400 }, { x: 400, y: 1800 },
    { x: 1800, y: 2200 }, { x: 2600, y: 600 }, { x: 800, y: 800 },
  ];
  for (const s of cashSpots) G.pickups.push({ x: s.x, y: s.y, kind: 'cash', taken: false, bob: 0 });
}

export function updateCombat(G, dt) {
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  if (G.gunfireT > 0) G.gunfireT -= dt;

  // Bullets fly, hit buildings, cars, gang and the player.
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (collideBuildings(G.city, b, 2)) { b.dead = true; spawnHit(G, b.x, b.y); continue; }
    if (b.from === 'player') {
      for (const g of G.gang) {
        if (g.hp > 0 && Math.hypot(g.x - b.x, g.y - b.y) < 16) {
          g.hp -= b.damage; b.dead = true; spawnHit(G, b.x, b.y);
          if (g.hp <= 0) onGangDown(G, g);
          break;
        }
      }
      if (b.dead) continue;
      for (const c of G.cops) {
        if (!c.down && Math.hypot(c.x - b.x, c.y - b.y) < 14) {
          c.hp -= b.damage; b.dead = true; spawnHit(G, b.x, b.y);
          if (c.hp <= 0) { c.down = true; }
          break;
        }
      }
      if (b.dead) continue;
      for (const car of G.cars) {
        if (car.driver === 'player') continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
          car.hp -= b.damage; b.dead = true; spawnHit(G, b.x, b.y);
          break;
        }
      }
    } else {
      // Enemy bullet: hits the player (or their car).
      const tx = p.inCar ? p.inCar.x : p.x;
      const ty = p.inCar ? p.inCar.y : p.y;
      const rr = p.inCar ? 26 : 14;
      if (Math.hypot(tx - b.x, ty - b.y) < rr) {
        b.dead = true;
        if (p.inCar) p.inCar.hp -= b.damage;
        else if (p.iframes <= 0) {
          p.hp -= b.damage;
          p.iframes = 0.4;
          G.shake = Math.max(G.shake, 3);
        }
        spawnHit(G, b.x, b.y);
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);

  // Gang AI: approach the player and shoot.
  for (const g of G.gang) {
    if (g.hp <= 0) continue;
    const dx = px - g.x, dy = py - g.y;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    g.angle = a;
    if (d > 260) {
      g.x += Math.cos(a) * g.speed * dt;
      g.y += Math.sin(a) * g.speed * dt;
      g.walkPhase += dt * 9;
    } else if (d > 130) {
      g.x += Math.cos(a) * g.speed * 0.5 * dt;
      g.y += Math.sin(a) * g.speed * 0.5 * dt;
      g.walkPhase += dt * 6;
    }
    collideBuildings(G.city, g, 11);
    g.shootCd -= dt;
    if (g.shootCd <= 0 && d < 380) {
      g.shootCd = G.rng.range(1.5, 2.6);
      const spread = (G.rng.next() - 0.5) * 0.45;
      const sa = a + spread;
      G.bullets.push({ x: g.x + Math.cos(sa) * 18, y: g.y + Math.sin(sa) * 18, vx: Math.cos(sa) * 520, vy: Math.sin(sa) * 520, from: 'gang', damage: 5, life: 1.1 });
      G.audio.enemyShot();
      G.gunfireT = 0.5;
      g.muzzle = 0.07;
    }
    if (g.muzzle > 0) g.muzzle -= dt;
  }
  G.gang = G.gang.filter((g) => g.hp > 0);

  // Pickups.
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    pk.bob += dt;
    const d = Math.hypot(pk.x - px, pk.y - py);
    if (d < 34) {
      pk.taken = true;
      if (pk.kind === 'health') {
        p.hp = Math.min(100, p.hp + 40);
        G.message = '+40 health';
      } else if (pk.kind === 'cash') {
        G.cash += 50;
        G.message = '+$50 street cash';
      } else {
        p.reserve += 36;
        G.message = '+36 pistol ammo';
      }
      G.messageTimer = 1.8;
      G.audio.pickup();
      for (let i = 0; i < 10; i += 1) {
        G.particles.push({ x: pk.x, y: pk.y, vx: (G.rng.next() - 0.5) * 160, vy: (G.rng.next() - 0.5) * 160, life: 0.5, max: 0.5, color: pk.kind === 'health' ? '#3fd06a' : '#ffd23f', size: 3 });
      }
    }
  }
  // Respawn taken pickups after a while so the city stays stocked.
  G.pickupT -= dt;
  if (G.pickupT <= 0) {
    G.pickupT = 20;
    for (const pk of G.pickups) if (pk.taken && G.rng.chance(0.5)) pk.taken = false;
  }

  // Particles and skid marks decay.
  for (const pt of G.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.96; pt.vy *= 0.96; pt.life -= dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
  for (const s of G.skids) s.life -= dt;
  G.skids = G.skids.filter((s) => s.life > 0);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 22);
}
