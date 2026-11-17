// The city of Dusk Harbor: a seeded street grid, 3 districts, buildings with
// collision, a park, a beach and pier, and named spots the missions use.
import { WORLD_W, WORLD_H, ROAD_W, DISTRICTS, CAR_COLORS } from './config.js';

export function districtAt(x, y) {
  if (y > 2180) return 'Harbor Beach';
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1) return d.name;
  return 'Downtown';
}

export function buildCity(rng) {
  const roadsV = [];
  const roadsH = [];
  for (let x = 200; x < WORLD_W; x += 400) roadsV.push(x);
  for (let y = 200; y < WORLD_H - 200; y += 400) roadsH.push(y);

  const buildings = [];
  const trees = [];
  const lots = [];
  // Park block: between roads x 1400-1800, y 1000-1400.
  const park = { x: 1400, y: 1000, w: 400, h: 400 };
  const beach = { x: 0, y: 2180, w: WORLD_W, h: 220 };
  const pier = { x: 380, y: 2180, w: 90, h: 210 };

  const palettes = {
    'Harbor Docks': ['#4a5a68', '#5d6d7a', '#3e4c59', '#6b5a4a'],
    Downtown: ['#5a5a7a', '#6a6a8a', '#4a4a6a', '#7a6a5a', '#5a7a6a'],
    'Old Town': ['#7a6a4a', '#8a7a5a', '#6a5a3a', '#9a8a6a'],
  };
  for (let bi = 0; bi < roadsV.length - 1; bi += 1) {
    for (let bj = 0; bj < roadsH.length - 1; bj += 1) {
      const bx0 = roadsV[bi] + ROAD_W / 2 + 14;
      const by0 = roadsH[bj] + ROAD_W / 2 + 14;
      const bw = roadsV[bi + 1] - roadsV[bi] - ROAD_W - 28;
      const bh = roadsH[bj + 1] - roadsH[bj] - ROAD_W - 28;
      const cx = bx0 + bw / 2, cy = by0 + bh / 2;
      // Park block stays green.
      if (cx > park.x && cx < park.x + park.w && cy > park.y && cy < park.y + park.h) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: park.x + 30 + rng.range(0, park.w - 60), y: park.y + 30 + rng.range(0, park.h - 60), r: rng.range(10, 18) });
        }
        continue;
      }
      // Some blocks are parking lots with parked cars.
      if (rng.chance(0.16)) { lots.push({ x: bx0, y: by0, w: bw, h: bh }); continue; }
      const d = districtAt(cx, cy);
      const cols = palettes[d] || palettes.Downtown;
      const n = rng.int(1, 3);
      if (n === 1) {
        buildings.push({ x: bx0 + bw * 0.08, y: by0 + bh * 0.08, w: bw * 0.84, h: bh * 0.84, color: rng.pick(cols), hgt: rng.int(1, 4), district: d });
      } else {
        const vertical = rng.chance(0.5);
        for (let k = 0; k < n; k += 1) {
          if (vertical) buildings.push({ x: bx0 + (bw / n) * k + 6, y: by0 + 8, w: bw / n - 12, h: bh - 16, color: rng.pick(cols), hgt: rng.int(1, 4), district: d });
          else buildings.push({ x: bx0 + 8, y: by0 + (bh / n) * k + 6, w: bw - 16, h: bh / n - 12, color: rng.pick(cols), hgt: rng.int(1, 4), district: d });
        }
      }
      if (rng.chance(0.5)) trees.push({ x: bx0 + rng.range(10, bw - 10), y: by0 + rng.range(10, bh - 10), r: 9 });
    }
  }
  // Beach trees / umbrellas.
  for (let t = 0; t < 10; t += 1) trees.push({ x: rng.range(60, WORLD_W - 60), y: 2210 + rng.range(0, 120), r: 10 });

  const spots = {
    pier: { x: 425, y: 2320 },
    garage: { x: 1600, y: 600 },
    bank: { x: 1800, y: 1000 },
    safehouse: { x: 2800, y: 1800 },
    docks: { x: 600, y: 1000 },
    hospital: { x: 2400, y: 600 },
    policeStation: { x: 1200, y: 1800 },
    park: { x: 1600, y: 1200 },
    beach: { x: 2000, y: 2280 },
    start: { x: 600, y: 2250 },
  };

  return { roadsV, roadsH, buildings, trees, lots, park, beach, pier, spots };
}

export function onRoad(city, x, y) {
  const half = ROAD_W / 2;
  for (const rx of city.roadsV) if (Math.abs(x - rx) < half) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) < half) return true;
  return false;
}

// Nearest point on the road network (used to snap traffic / spawns).
export function nearestRoadPoint(city, x, y) {
  let best = null; let bestD = Infinity;
  for (const rx of city.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of city.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}

export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of buildings; returns true if a collision happened.
export function collideBuildings(city, obj, r) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(obj.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(obj.y, b.y + b.h));
    const dx = obj.x - nx, dy = obj.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        obj.x = nx + (dx / d) * r;
        obj.y = ny + (dy / d) * r;
      } else {
        obj.x += r; // centre inside the building: shove out sideways
      }
    }
  }
  return hit;
}

export function inBeachWater(city, x, y) {
  return y > 2320;
}
