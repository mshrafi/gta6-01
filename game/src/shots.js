// Deterministic screenshot scenes behind ?shot=start|play|chase|end.
// Each plays the real game forward from a fresh seeded world, steered by a
// road-following autopilot, so the frame is what real play looks like and the
// same seed always gives the same frame.
import { STEP } from './config.js';
import { createGame, stepGame } from './game.js';
import { blankAction } from './input.js';
import { setWanted } from './police.js';
import { startMission } from './missions.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN } from './render.js';

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Drive a car along road waypoints toward each point in turn. Eases off the
// accelerator on sharp turns and near waypoints so the car stays on the road
// instead of ramming buildings at full speed.
function driveWaypoints(G, waypoints, seconds) {
  let wp = 0;
  let stuckT = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const act = blankAction();
    const car = G.player.inCar;
    if (!car) {
      // Car lost (destroyed/busted): steal the nearest parked car and carry on.
      if (wp < waypoints.length && G.screen === 'play') enterNearestCar(G);
      stepGame(G, act, STEP);
      continue;
    }
    // Reached the last waypoint: stop here, mid-action, instead of sitting
    // still while the police pile in.
    if (wp >= waypoints.length) break;
    const t = waypoints[wp];
    const d = Math.hypot(t.x - car.x, t.y - car.y);
    if (d < 70) { wp += 1; stuckT = 0; continue; }
    const want = Math.atan2(t.y - car.y, t.x - car.x);
    const diff = normAngle(want - car.angle);
    // Sharp turn or close to the waypoint: coast so the car turns tighter.
    act.up = Math.abs(diff) < 0.9 && d > 130;
    if (diff > 0.12) act.left = true;
    else if (diff < -0.12) act.right = true;
    // Stuck against a wall: reverse out briefly.
    if (Math.abs(car.speed) < 12) stuckT += STEP;
    else stuckT = 0;
    if (stuckT > 0.8) { act.down = true; act.up = false; if (stuckT > 1.6) stuckT = 0; }
    stepGame(G, act, STEP);
    if (G.screen !== 'play') break;
  }
}

function enterNearestCar(G) {
  // Walk the player next to the closest parked car, then press E.
  let best = null; let bestD = Infinity;
  for (const car of G.cars) {
    if (car.driver !== 'parked') continue;
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  G.player.x = best.x - 40;
  G.player.y = best.y;
  const act = blankAction();
  act.enter = true;
  stepGame(G, act, STEP);
}

export function stageShot(name, seed) {
  const G = createGame(seed);
  G.screen = 'play';
  if (name === 'start') {
    // A few seconds of city life behind the title screen.
    for (let i = 0; i < 5 / STEP; i += 1) stepGame(G, blankAction(), STEP);
    G.screen = 'title';
    return { G, screen: SCREEN_TITLE };
  }
  if (name === 'chase') {
    // Mission 4 getaway: wanted 3, police chase, drive to the pier.
    // The player boosts the fast Comet for the getaway.
    startMission(G, 3);
    setWanted(G, 3);
    const comet = G.cars.find((c) => c.missionCar && c.type === 'sports');
    if (comet) { G.player.x = comet.x - 40; G.player.y = comet.y; }
    else { G.player.x = 1400; G.player.y = 1000; }
    enterNearestCar(G);
    if (!G.player.inCar) {
      // Fallback: commandeer the nearest car outright.
      const car = G.cars.find((c) => c.driver === 'parked');
      if (car) { G.player.inCar = car; car.driver = 'player'; car.parked = false; G.player.x = car.x; G.player.y = car.y; }
    }
    driveWaypoints(G, [{ x: 1800, y: 2200 }, { x: 600, y: 2200 }, { x: 425, y: 2320 }], 10);
    G.screen = 'play';
    return { G, screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    // The win screen after the final heist, city and loot behind it.
    G.missionIndex = 6;
    G.cash = 5300;
    G.stats.kills = 10;
    G.stats.carsStolen = 4;
    G.won = true;
    G.screen = 'win';
    for (let i = 0; i < 2 / STEP; i += 1) stepGame(G, blankAction(), STEP);
    G.screen = 'win';
    return { G, screen: SCREEN_WIN };
  }
  // play: mission 1 drive with a 1-star chase building behind the player.
  setWanted(G, 1);
  enterNearestCar(G);
  driveWaypoints(G, [{ x: 600, y: 2200 }, { x: 600, y: 600 }, { x: 1600, y: 600 }], 16);
  G.screen = 'play';
  return { G, screen: SCREEN_PLAY };
}
