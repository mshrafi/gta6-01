// Cars: physics, spawning, collisions, damage and smoke.
import { CAR_TYPES, CAR_COLORS, WORLD_W, WORLD_H } from './config.js';
import { collideBuildings, nearestRoadPoint, onRoad } from './city.js';

let carId = 0;

export function makeCar(G, type, x, y, angle, driver) {
  const t = CAR_TYPES[type] || CAR_TYPES.sedan;
  const car = {
    id: carId += 1, type, x, y, angle, speed: 0,
    color: type === 'police' ? t.color : (G.rng.pick(CAR_COLORS)),
    w: t.w, h: t.h, hp: t.hp, maxHp: t.hp,
    driver: driver || 'parked', parked: driver === 'parked' || !driver,
    smoke: 0, skidT: 0, targetSpeed: 0, roadAxis: null, lane: 0, dir: 1,
  };
  if (type === 'sports') car.color = '#c22a3a';
  if (type === 'taxi') car.color = '#e8b820';
  return car;
}

export function spawnParkedCars(G) {
  const rng = G.rng;
  // Parked cars along roads and in parking lots.
  for (let i = 0; i < 26; i += 1) {
    const rx = rng.pick(G.city.roadsV);
    const ry = rng.pick(G.city.roadsH);
    const vertical = rng.chance(0.5);
    const x = vertical ? rx + 34 : rng.range(300, WORLD_W - 300);
    const y = vertical ? rng.range(300, WORLD_H - 300) : ry + 34;
    if (Math.hypot(x - G.player.x, y - G.player.y) < 120) continue;
    const type = rng.pick(['sedan', 'sedan', 'taxi', 'truck', 'sports']);
    const car = makeCar(G, type, x, y, vertical ? Math.PI / 2 : 0, 'parked');
    G.cars.push(car);
  }
  for (const lot of G.city.lots) {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i += 1) {
      const car = makeCar(G, rng.pick(['sedan', 'sedan', 'sports', 'taxi']), lot.x + 40 + i * 70, lot.y + lot.h / 2, 0, 'parked');
      G.cars.push(car);
    }
  }
  // The mission Comet: a red sports car outside the bank.
  const bank = G.city.spots.bank;
  const comet = makeCar(G, 'sports', bank.x + 60, bank.y + 120, Math.PI / 2, 'parked');
  comet.missionCar = true;
  G.cars.push(comet);
  // A sedan by the pier for mission 1.
  const pier = G.city.spots.pier;
  const starter = makeCar(G, 'sedan', pier.x - 120, pier.y - 60, 0, 'parked');
  starter.missionCar = true;
  G.cars.push(starter);
}

// Player driving physics.
export function driveCar(G, car, act, dt) {
  const t = CAR_TYPES[car.type];
  const moving = Math.abs(car.speed) > 5;
  if (act.up) car.speed += t.accel * dt;
  else if (act.down) {
    if (car.speed > 10) car.speed -= t.accel * 1.6 * dt;
    else car.speed -= t.accel * 0.55 * dt;
  } else {
    car.speed *= Math.pow(0.4, dt); // drag
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.max(-t.maxSpeed * 0.45, Math.min(t.maxSpeed, car.speed));
  if (moving) {
    const steer = ((act.left ? 1 : 0) - (act.right ? 1 : 0)) * t.turn * (car.speed >= 0 ? 1 : -1);
    car.angle += steer * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
    // Skid marks on hard turns at speed.
    if (Math.abs(steer) > 1.5 && Math.abs(car.speed) > 200) {
      car.skidT -= dt;
      if (car.skidT <= 0) {
        car.skidT = 0.05;
        const bx = car.x - Math.cos(car.angle) * 14, by = car.y - Math.sin(car.angle) * 14;
        G.skids.push({ x: bx, y: by, angle: car.angle, life: 5 });
      }
    }
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx; car.y = ny;
  car.x = Math.max(20, Math.min(WORLD_W - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD_H - 20, car.y));
  const hitBuilding = collideBuildings(G.city, car, 20);
  if (car.crashCd > 0) car.crashCd -= dt;
  if (hitBuilding && Math.abs(car.speed) > 200 && car.crashCd <= 0) {
    car.hp -= Math.abs(car.speed) * 0.02;
    car.crashCd = 0.5;
    G.audio.crash();
    G.shake = Math.max(G.shake, 6);
    car.speed *= -0.25;
    spawnCrashSparks(G, car.x, car.y);
  } else if (hitBuilding) {
    car.speed *= 0.4;
  }
  if (car.hp < car.maxHp * 0.4) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      G.particles.push({ x: car.x + (G.rng.next() - 0.5) * 20, y: car.y - 8, vx: (G.rng.next() - 0.5) * 30, vy: -40, life: 0.8, max: 0.8, color: '#888888', size: 5 });
    }
  }
  if (car.hp <= 0 && car.driver === 'player') {
    // Car destroyed: player is thrown out, hurt.
    car.hp = 0;
    G.player.hp -= 25;
    G.message = 'Your car was destroyed!';
    G.messageTimer = 2.5;
    G.audio.crash();
    explodeCar(G, car);
    car.driver = 'wreck';
    car.parked = true;
    G.player.inCar = null;
    G.player.x = car.x + 40; G.player.y = car.y + 40;
  }
}

export function spawnCrashSparks(G, x, y) {
  for (let i = 0; i < 6; i += 1) {
    G.particles.push({ x, y, vx: (G.rng.next() - 0.5) * 200, vy: (G.rng.next() - 0.5) * 200, life: 0.3, max: 0.3, color: '#ffd23f', size: 2 });
  }
}

export function explodeCar(G, car) {
  for (let i = 0; i < 26; i += 1) {
    G.particles.push({ x: car.x, y: car.y, vx: (G.rng.next() - 0.5) * 320, vy: (G.rng.next() - 0.5) * 320, life: 0.7, max: 0.7, color: i % 3 === 0 ? '#ff5a4a' : '#ffd23f', size: 4 });
  }
  G.shake = Math.max(G.shake, 10);
}

// Simple circle-vs-circle car collisions (player car vs traffic / parked).
export function collideCars(G) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i], b = cars[j];
      if (a.driver === 'wreck' || b.driver === 'wreck') continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 34;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const ux = dx / d, uy = dy / d;
        const aPlayer = a.driver === 'player', bPlayer = b.driver === 'player';
        if (!aPlayer) { a.x -= ux * push; a.y -= uy * push; }
        if (!bPlayer) { b.x += ux * push; b.y += uy * push; }
        if (aPlayer || bPlayer) {
          const rel = Math.abs(a.speed - b.speed);
          if (rel > 150) {
            G.audio.crash();
            G.shake = Math.max(G.shake, 4);
            a.hp -= rel * 0.015; b.hp -= rel * 0.015;
            a.speed *= 0.7; b.speed *= 0.7;
            spawnCrashSparks(G, (a.x + b.x) / 2, (a.y + b.y) / 2);
          }
        }
      }
    }
  }
}
