// Core game state and the fixed-step update: wires player, cars, traffic,
// police, combat and missions together. No drawing and no DOM here except audio.
import { WORLD_W, WORLD_H, STEP, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { buildCity, districtAt } from './city.js';
import { createAudio } from './audio.js';
import { updatePlayerOnFoot, tryEnterCar, exitCar } from './player.js';
import { driveCar, collideCars, spawnParkedCars } from './vehicles.js';
import { spawnTraffic, updateTraffic, updatePeds } from './traffic.js';
import { updatePolice, wastePlayer, starsOf } from './police.js';
import { updateCombat, spawnHealthPacks } from './combat.js';
import { startMission, updateMission } from './missions.js';

export function createGame(seed, audio) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const G = {
    seed, rng, city, audio: audio || createAudio(),
    time: 8.0, elapsed: 0,
    player: {
      x: city.spots.start.x, y: city.spots.start.y, angle: -Math.PI / 2, hp: 100,
      ammo: 12, reserve: 48, inCar: null, moving: false, walkPhase: 0,
      punchCd: 0, punchAnim: 0, shootCd: 0, muzzle: 0, reloadT: 0, iframes: 0,
    },
    cars: [], peds: [], cops: [], gang: [], bullets: [], particles: [], skids: [], pickups: [],
    cash: 100, heat: 0, wanted: 0, lastSeenT: 0, spawnT: 0, gunfireT: 0, pickupT: 20,
    missionIndex: 0, mission: null, marker: null, objective: '',
    camera: { x: Math.max(640, Math.min(2560, city.spots.start.x)), y: Math.max(400, Math.min(2000, city.spots.start.y)) },
    district: districtAt(city.spots.start.x, city.spots.start.y), districtTimer: 0,
    shake: 0, message: '', messageTimer: 0,
    stats: { kills: 0, carsStolen: 0 },
    screen: 'title', overReason: null, overFine: 0, won: false,
    muted: false,
  };
  spawnParkedCars(G);
  spawnTraffic(G);
  spawnHealthPacks(G);
  startMission(G, 0);
  return G;
}

export function applySave(G, data) {
  G.cash = data.cash;
  G.missionIndex = Math.min(data.missionIndex, MISSIONS.length - 1);
  G.player.x = data.x; G.player.y = data.y;
  G.time = data.time || 8;
  G.player.hp = data.hp || 100;
  G.player.ammo = data.ammo ?? 12;
  G.player.reserve = data.reserve ?? 48;
  G.stats.kills = data.kills || 0;
  G.stats.carsStolen = data.carsStolen || 0;
  G.won = !!data.won;
  G.camera.x = Math.max(640, Math.min(2560, G.player.x));
  G.camera.y = Math.max(400, Math.min(2000, G.player.y));
  startMission(G, G.missionIndex);
}

export function stepGame(G, act, dt) {
  if (G.screen !== 'play') return;
  G.elapsed += dt;
  // Clock: one game hour per 3 real minutes.
  G.time = (G.time + dt / 180) % 24;
  const p = G.player;

  // Enter / exit car.
  if (act.enter) {
    if (p.inCar) exitCar(G);
    else tryEnterCar(G);
  }
  if (p.inCar) {
    driveCar(G, p.inCar, act, dt);
    // driveCar can destroy the car and drop the player out — re-check.
    if (p.inCar) { p.x = p.inCar.x; p.y = p.inCar.y; p.angle = p.inCar.angle; }
    // Shooting from a car is not allowed; F honks (blip) instead.
    if (act.punch) G.audio.blip();
  } else {
    updatePlayerOnFoot(G, act, dt);
  }
  collideCars(G);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  if (G.screen !== 'play') return; // busted during police update
  updateCombat(G, dt);
  updateMission(G, dt);
  if (G.screen !== 'play') return; // win during mission update

  // WASTED?
  if (p.hp <= 0) { wastePlayer(G); return; }

  // Camera follows the player (or their car), clamped to the world.
  const tx = p.inCar ? p.inCar.x : p.x;
  const ty = p.inCar ? p.inCar.y : p.y;
  const vw = 1280, vh = 800;
  G.camera.x += (Math.max(vw / 2, Math.min(WORLD_W - vw / 2, tx)) - G.camera.x) * Math.min(1, dt * 5);
  G.camera.y += (Math.max(vh / 2, Math.min(WORLD_H - vh / 2, ty)) - G.camera.y) * Math.min(1, dt * 5);

  // District popup.
  const d = districtAt(tx, ty);
  if (d !== G.district) {
    G.district = d;
    G.districtTimer = 3;
    G.audio.blip();
  }
  if (G.districtTimer > 0) G.districtTimer -= dt;
  if (G.messageTimer > 0) G.messageTimer -= dt;

  // Sound: engine hum follows the driven car; siren follows wanted level.
  const driving = p.inCar ? Math.abs(p.inCar.speed) / 460 : 0;
  G.audio.engine(driving, !!p.inCar);
  G.audio.siren(G.wanted > 0, dt);
}

export { STEP };
