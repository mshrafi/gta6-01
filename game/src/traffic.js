// Traffic AI (cars drive the street grid) and pedestrians (sidewalk walkers who flee).
import { CAR_TYPES, WORLD_W, WORLD_H } from './config.js';
import { collideBuildings, nearestRoadPoint } from './city.js';
import { makeCar } from './vehicles.js';

export function spawnTraffic(G) {
  const rng = G.rng;
  for (let i = 0; i < 14; i += 1) {
    const vertical = rng.chance(0.5);
    const x = vertical ? rng.pick(G.city.roadsV) + (rng.chance(0.5) ? 22 : -22) : rng.range(300, WORLD_W - 300);
    const y = vertical ? rng.range(300, WORLD_H - 300) : rng.pick(G.city.roadsH) + (rng.chance(0.5) ? 22 : -22);
    const car = makeCar(G, rng.pick(['sedan', 'sedan', 'taxi', 'taxi', 'truck', 'sports']), x, y, vertical ? (y % 2 ? 0 : Math.PI) : 0, 'traffic');
    car.roadAxis = vertical ? 'v' : 'h';
    car.lane = vertical ? (x > rng.pick(G.city.roadsV) ? 22 : -22) : 0;
    car.speed = rng.range(90, 170);
    car.targetSpeed = car.speed;
    car.dir = rng.chance(0.5) ? 1 : -1;
    car.angle = vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    G.cars.push(car);
  }
  for (let i = 0; i < 26; i += 1) {
    G.peds.push(makePed(G));
  }
}

function makePed(G) {
  const rng = G.rng;
  const vertical = rng.chance(0.5);
  const x = vertical ? rng.pick(G.city.roadsV) + rng.pick([-64, 64]) : rng.range(200, WORLD_W - 200);
  const y = vertical ? rng.range(200, WORLD_H - 200) : rng.pick(G.city.roadsH) + rng.pick([-64, 64]);
  return {
    x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 55),
    vertical, dir: rng.chance(0.5) ? 1 : -1, flee: 0, color: rng.pick(['#e8e0d0', '#c25a5a', '#5a7ac2', '#7ac25a', '#c2a05a', '#9a5ac2']),
    walkPhase: rng.range(0, 6), hp: 30,
  };
}

function nearIntersection(city, x, y) {
  for (const rx of city.roadsV) for (const ry of city.roadsH) {
    if (Math.hypot(x - rx, y - ry) < 60) return true;
  }
  return false;
}

export function updateTraffic(G, dt) {
  const rng = G.rng;
  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue;
    const t = CAR_TYPES[car.type];
    // Slow near intersections, and behind a slow car ahead (simple crash avoidance).
    let target = car.targetSpeed;
    if (nearIntersection(G.city, car.x, car.y)) target = Math.min(target, 70);
    for (const other of G.cars) {
      if (other === car || other.driver === 'wreck') continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 70 && side < 30) target = Math.min(target, 40);
    }
    car.speed += Math.max(-260 * dt, Math.min(160 * dt, target - car.speed));
    // Random turn at intersections.
    if (nearIntersection(G.city, car.x, car.y) && rng.chance(dt * 0.35)) {
      if (car.roadAxis === 'v') {
        car.roadAxis = 'h';
        car.dir = rng.chance(0.5) ? 1 : -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
        car.y = Math.round(car.y / 400) * 400 + (car.dir > 0 ? 200 : 200);
        // snap to the nearest horizontal road
        let best = G.city.roadsH[0], bd = Infinity;
        for (const ry of G.city.roadsH) { const d = Math.abs(ry - car.y); if (d < bd) { bd = d; best = ry; } }
        car.y = best + (car.dir > 0 ? 22 : -22);
      } else {
        car.roadAxis = 'v';
        car.dir = rng.chance(0.5) ? 1 : -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        let best = G.city.roadsV[0], bd = Infinity;
        for (const rx of G.city.roadsV) { const d = Math.abs(rx - car.x); if (d < bd) { bd = d; best = rx; } }
        car.x = best + (car.dir > 0 ? 22 : -22);
      }
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the city edge onto another road.
    if (car.x < 100 || car.x > WORLD_W - 100 || car.y < 100 || car.y > WORLD_H - 100) {
      const p = nearestRoadPoint(G.city, rng.range(300, WORLD_W - 300), rng.range(300, WORLD_H - 300));
      car.x = p.x; car.y = p.y;
      car.roadAxis = Math.abs(p.x - car.x) < 1 ? 'v' : 'h';
      car.angle = car.roadAxis === 'v' ? Math.PI / 2 : 0;
      car.dir = 1;
    }
    collideBuildings(G.city, car, 18);
  }
}

export function updatePeds(G, dt) {
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : 0;
  const gunfire = G.gunfireT > 0;
  for (const ped of G.peds) {
    if (ped.flee > 0) ped.flee -= dt;
    const dPlayer = Math.hypot(ped.x - px, ped.y - py);
    // Flee from gunfire, speeding cars, and the player running at them.
    if ((gunfire && dPlayer < 420) || (playerSpeed > 220 && dPlayer < 160) || (dPlayer < 40 && playerSpeed > 60)) {
      ped.flee = 1.6;
    }
    let vx, vy;
    if (ped.flee > 0) {
      const a = Math.atan2(ped.y - py, ped.x - px);
      vx = Math.cos(a); vy = Math.sin(a);
      ped.x += vx * 150 * dt; ped.y += vy * 150 * dt;
      ped.angle = a;
    } else {
      if (ped.vertical) { ped.x += 0; ped.y += ped.dir * ped.speed * dt; }
      else { ped.x += ped.dir * ped.speed * dt; ped.y += 0; }
      ped.angle = ped.vertical ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
      // Turn around at the end of a block.
      if (ped.x < 180 || ped.x > WORLD_W - 180 || ped.y < 180 || ped.y > WORLD_H - 180) ped.dir *= -1;
      if (G.rng.chance(dt * 0.02)) ped.dir *= -1;
    }
    ped.walkPhase += dt * 8;
    collideBuildings(G.city, ped, 10);
    ped.x = Math.max(12, Math.min(WORLD_W - 12, ped.x));
    ped.y = Math.max(12, Math.min(WORLD_H - 12, ped.y));
    // A speeding player car hitting a pedestrian: they fall, wanted rises.
    if (p.inCar && playerSpeed > 140 && dPlayer < 30) {
      ped.hp = 0;
      ped.down = true;
      ped.downT = 4;
      G.audio.crash();
      G.shake = Math.max(G.shake, 5);
      // Wanted: hitting a pedestrian is a crime.
      G.heat = Math.min(100, G.heat + 18);
      G.message = 'You hit a pedestrian! Wanted level rising.';
      G.messageTimer = 2.5;
    }
    if (ped.down) {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        // Pedestrian gets up and walks away, or respawns elsewhere.
        const np = makePed(G);
        ped.x = np.x; ped.y = np.y; ped.hp = 30; ped.down = false; ped.flee = 0;
      }
    }
  }
}
