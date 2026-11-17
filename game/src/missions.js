// Missions: Rook's six jobs for Delia Crane — linear chain with live objectives.
import { MISSIONS } from './config.js';
import { spawnGang } from './combat.js';
import { setWanted } from './police.js';
import { saveGame } from './save.js';

function spotPos(G, name) {
  return G.city.spots[name] || { x: 1600, y: 1200 };
}

export function currentMissionDef(G) {
  return MISSIONS[G.missionIndex] || null;
}

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) { G.mission = null; G.marker = null; G.objective = ''; return; }
  G.missionIndex = index;
  G.mission = { def, stepIndex: 0, timer: 0, killsAtStart: G.stats.kills, spawned: false };
  G.message = def.brief;
  G.messageTimer = 6;
  setupStep(G);
}

function setupStep(G) {
  const m = G.mission;
  if (!m) return;
  const step = m.def.steps[m.stepIndex];
  m.step = step;
  m.killsAtStart = G.stats.kills;
  m.spawned = false;
  if (step.kind === 'timed') m.timer = step.time;
  if (step.kind === 'chase' || step.kind === 'escape') setWanted(G, step.wanted || 2);
  if (step.spot) {
    const pos = spotPos(G, step.spot);
    G.marker = { x: pos.x, y: pos.y };
  }
  G.objective = step.label;
  if (step.kind === 'kill') {
    const pos = spotPos(G, step.spot);
    spawnGang(G, pos.x, pos.y, step.count + 1, true);
    m.spawned = true;
  }
}

function nextStep(G) {
  const m = G.mission;
  m.stepIndex += 1;
  if (m.stepIndex >= m.def.steps.length) completeMission(G);
  else setupStep(G);
}

function completeMission(G) {
  const m = G.mission;
  G.cash += m.def.reward;
  G.audio.jingle();
  G.message = `Mission complete: ${m.def.name} — +$${m.def.reward}`;
  G.messageTimer = 4;
  G.missionIndex += 1;
  G.marker = null;
  G.gang = [];
  if (G.missionIndex >= MISSIONS.length) {
    G.won = true;
    G.screen = 'win';
    saveGame(G);
    return;
  }
  saveGame(G);
  startMission(G, G.missionIndex);
}

function failMission(G, reason) {
  G.audio.fail();
  G.message = `Mission failed: ${reason}. Restarting "${G.mission.def.name}".`;
  G.messageTimer = 4;
  G.gang = [];
  G.heat = Math.max(0, G.heat - 20);
  startMission(G, G.missionIndex);
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m || G.won) return;
  const step = m.step;
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const target = G.marker;
  const dist = target ? Math.hypot(px - target.x, py - target.y) : Infinity;

  switch (step.kind) {
    case 'goto':
    case 'chase':
    case 'escape':
      if (dist < step.radius) nextStep(G);
      break;
    case 'timed':
      m.timer -= dt;
      G.objective = `${step.label} — ${Math.max(0, Math.ceil(m.timer))}s`;
      if (dist < step.radius) nextStep(G);
      else if (m.timer <= 0) failMission(G, 'out of time');
      break;
    case 'steal': {
      const inTarget = p.inCar && p.inCar.missionCar && p.inCar.type === 'sports';
      if (inTarget) {
        G.message = 'Got the Comet. Now lose the heat and deliver it.';
        G.messageTimer = 3;
        nextStep(G);
      } else if (dist < step.radius && !p.inCar) {
        G.objective = `${step.label} — press E near the red Comet`;
      }
      break;
    }
    case 'kill': {
      const done = G.stats.kills - m.killsAtStart;
      G.objective = step.label.replace(/\(\d+\/\d+\)/, `(${Math.min(done, step.count)}/${step.count})`);
      // Top the gang up if the player thinned them without finishing.
      if (G.gang.length < 2 && done < step.count && !m.spawned2) {
        m.spawned2 = true;
        const pos = spotPos(G, step.spot);
        spawnGang(G, pos.x, pos.y, 3, true);
      }
      if (done >= step.count) nextStep(G);
      break;
    }
    default:
      break;
  }
}
