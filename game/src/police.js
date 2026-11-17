// Wanted system (0–5 stars) and the police: chasing cars and foot cops, BUSTED.
import { CAR_TYPES } from './config.js';
import { makeCar } from './vehicles.js';
import { collideBuildings } from './city.js';

export function starsOf(G) { return Math.min(5, Math.floor(G.heat / 20)); }

export function addHeat(G, n) {
  G.heat = Math.min(100, G.heat + n);
  G.lastSeenT = 0; // police have seen the player just now
}

export function setWanted(G, stars) {
  G.heat = Math.max(G.heat, stars * 20 + 1);
  G.lastSeenT = 0;
}

// Called when the player is caught on foot by a cop.
export function bustPlayer(G) {
  const fine = Math.min(G.cash, 150);
  G.cash -= fine;
  G.heat = 0;
  G.wanted = 0;
  G.overReason = 'busted';
  G.overFine = fine;
  // Respawn at the police station.
  const st = G.city.spots.policeStation;
  G.player.x = st.x; G.player.y = st.y + 60;
  if (G.player.inCar) { G.player.inCar.driver = 'parked'; G.player.inCar = null; }
  G.player.hp = 100;
  for (const c of G.cops) c.remove = true;
  for (const c of G.cars) if (c.driver === 'police') c.remove = true;
  G.cars = G.cars.filter((c) => !c.remove);
  G.cops = G.cops.filter((c) => !c.remove);
  G.screen = 'over';
  G.audio.fail();
}

export function wastePlayer(G) {
  const fine = Math.min(G.cash, 200);
  G.cash -= fine;
  G.heat = Math.max(0, G.heat - 20);
  G.overReason = 'wasted';
  G.overFine = fine;
  const h = G.city.spots.hospital;
  G.player.x = h.x; G.player.y = h.y + 60;
  if (G.player.inCar) { G.player.inCar.driver = 'parked'; G.player.inCar = null; }
  G.player.hp = 100;
  G.player.ammo = 12; G.player.reserve = 48;
  for (const c of G.cops) c.remove = true;
  for (const c of G.cars) if (c.driver === 'police') c.remove = true;
  G.cars = G.cars.filter((c) => !c.remove);
  G.cops = G.cops.filter((c) => !c.remove);
  G.screen = 'over';
  G.audio.fail();
}

function spawnPoliceCar(G) {
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  // Spawn off-screen-ish, on a road near the player.
  const a = G.rng.range(0, Math.PI * 2);
  const x = Math.max(220, Math.min(2980, px + Math.cos(a) * 700));
  const y = Math.max(220, Math.min(2180, py + Math.sin(a) * 700));
  const car = makeCar(G, 'police', x, y, Math.atan2(py - y, px - x), 'police');
  car.targetSpeed = CAR_TYPES.police.maxSpeed;
  G.cars.push(car);
  return car;
}

function spawnFootCop(G) {
  const p = G.player;
  const a = G.rng.range(0, Math.PI * 2);
  G.cops.push({
    x: p.x + Math.cos(a) * 320, y: p.y + Math.sin(a) * 320,
    angle: 0, speed: 175, hp: 60, onFoot: true, bustT: 0, down: false, walkPhase: 0,
  });
}

export function updatePolice(G, dt) {
  const wanted = starsOf(G);
  G.wanted = wanted;
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;

  // Wanted decays when the player breaks line of sight and stays hidden.
  const copNear = G.cops.some((c) => !c.down && Math.hypot(c.x - px, c.y - py) < 500)
    || G.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - px, c.y - py) < 600);
  if (wanted > 0) {
    if (copNear) G.lastSeenT = 0;
    else {
      G.lastSeenT += dt;
      if (G.lastSeenT > 6) { G.heat = Math.max(0, G.heat - dt * 4); }
    }
  } else {
    G.heat = Math.max(0, G.heat - dt * 2);
  }

  // Spawn police to match the wanted level.
  const policeCars = G.cars.filter((c) => c.driver === 'police').length;
  const wantCars = wanted === 0 ? 0 : Math.min(4, wanted);
  if (policeCars < wantCars && G.spawnT <= 0) {
    spawnPoliceCar(G);
    G.spawnT = 1.2;
  }
  if (G.spawnT > 0) G.spawnT -= dt;
  const footCops = G.cops.filter((c) => !c.down).length;
  // During a shootout mission the cops hang back from the gang war.
  const inShootout = G.mission && G.mission.step && G.mission.step.kind === 'kill';
  const wantFoot = (!p.inCar && wanted >= 2 && !inShootout) ? Math.min(3, wanted - 1) : 0;
  if (footCops < wantFoot && G.spawnT <= 0) {
    spawnFootCop(G);
    G.spawnT = 1.5;
  }

  // Police cars chase and ram.
  for (const car of G.cars) {
    if (car.driver !== 'police') continue;
    const dx = px - car.x, dy = py - car.y;
    const d = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    const t = CAR_TYPES.police;
    const target = d > 60 ? t.maxSpeed : t.maxSpeed * 0.5;
    car.speed += Math.max(-t.accel * dt, Math.min(t.accel * dt, target - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideBuildings(G.city, car, 18);
    // Ram the player car (gentle: a shove, not an instant wreck).
    if (p.inCar && d < 40) {
      p.inCar.hp -= 10 * dt;
      p.inCar.speed *= 0.99;
      G.shake = Math.max(G.shake, 3);
      if (Math.random() < dt * 2) G.audio.crash();
    }
    // Cop car too far / stuck: despawn when wanted is gone.
    if (wanted === 0 && d > 900) car.remove = true;
  }
  G.cars = G.cars.filter((c) => !c.remove);

  // Foot cops pursue the player on foot; touching one for a while = BUSTED.
  for (const cop of G.cops) {
    if (cop.down) continue;
    const dx = p.x - cop.x, dy = p.y - cop.y;
    const d = Math.hypot(dx, dy);
    if (p.inCar) {
      // Cops give up chasing a car on foot; stand and watch.
      cop.bustT = 0;
      continue;
    }
    const a = Math.atan2(dy, dx);
    cop.angle = a;
    cop.x += Math.cos(a) * cop.speed * dt;
    cop.y += Math.sin(a) * cop.speed * dt;
    cop.walkPhase += dt * 10;
    collideBuildings(G.city, cop, 10);
    if (d < 30) {
      cop.bustT += dt;
      if (cop.bustT > 2.0) { bustPlayer(G); return; }
    } else cop.bustT = Math.max(0, cop.bustT - dt * 2);
  }
  G.cops = G.cops.filter((c) => !c.down || c.hp > 0);
}
