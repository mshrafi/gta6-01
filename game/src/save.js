// Save / load via localStorage: cash, missions completed, position, time of day.
import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash, missionIndex: G.missionIndex, x: G.player.x, y: G.player.y,
      time: G.time, hp: G.player.hp, ammo: G.player.ammo, reserve: G.player.reserve,
      kills: G.stats.kills, carsStolen: G.stats.carsStolen, won: G.won,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.cash !== 'number' || typeof d.missionIndex !== 'number') return null;
    return d;
  } catch { return null; }
}

export function hasSave() { return loadSave() !== null; }
export function clearSave() { try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
