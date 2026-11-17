// DUSK HARBOR — constants, car types, districts and the 6-mission story chain.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;
export const STEP = 1 / 60;
export const SAVE_KEY = 'duskharbor-save-v1';
export const VIEW_W = 1280;
export const VIEW_H = 800;

export const DISTRICTS = [
  { name: 'Harbor Docks', x0: 0, y0: 0, x1: 1150, y1: 2400, color: '#5a6b7a' },
  { name: 'Downtown', x0: 1150, y0: 0, x1: 2250, y1: 2400, color: '#7a6a8a' },
  { name: 'Old Town', x0: 2250, y0: 0, x1: 3200, y1: 2400, color: '#8a7a5a' },
];

export const CAR_TYPES = {
  sedan:  { accel: 260, maxSpeed: 330, turn: 2.6, color: '#3f6fb5', w: 46, h: 22, hp: 100 },
  taxi:   { accel: 250, maxSpeed: 310, turn: 2.7, color: '#e8b820', w: 46, h: 22, hp: 90 },
  truck:  { accel: 170, maxSpeed: 240, turn: 1.9, color: '#7a4a2a', w: 62, h: 26, hp: 180 },
  sports: { accel: 380, maxSpeed: 460, turn: 3.1, color: '#c22a3a', w: 48, h: 21, hp: 110 },
  police: { accel: 340, maxSpeed: 420, turn: 3.0, color: '#1a2a4a', w: 48, h: 22, hp: 140 },
};

export const CAR_COLORS = ['#3f6fb5', '#c22a3a', '#2a8a5a', '#d0d0d0', '#222831', '#8a4ab5', '#e07a20', '#4a9a9a'];

// Missions: linear chain for Rook, jobs for fixer Delia Crane. Steps reference
// city spots by name; missions.js resolves them to coordinates.
export const MISSIONS = [
  {
    id: 1, name: 'First Job', reward: 200,
    brief: 'Delia Crane: "Rook, you are new in Dusk Harbor. Prove you can drive. Take the sedan by the pier and bring it to the Downtown garage."',
    steps: [
      { kind: 'goto', spot: 'garage', label: 'Drive to the Downtown garage', radius: 70 },
    ],
  },
  {
    id: 2, name: 'Hot Delivery', reward: 400,
    brief: 'Delia: "A package for the Old Town safehouse. The harbour patrol is jumpy — 75 seconds, no excuses."',
    steps: [
      { kind: 'timed', spot: 'safehouse', label: 'Deliver the package to the Old Town safehouse', radius: 70, time: 75 },
    ],
  },
  {
    id: 3, name: 'Boost the Comet', reward: 600,
    brief: 'Delia: "A red Comet sports car is parked outside the Downtown bank. Take it. Quietly, if you can."',
    steps: [
      { kind: 'steal', spot: 'bank', label: 'Steal the red Comet outside the bank', radius: 90 },
      { kind: 'goto', spot: 'garage', label: 'Bring the Comet to the garage', radius: 70 },
    ],
  },
  {
    id: 4, name: 'Heat', reward: 800,
    brief: 'Delia: "The crew tipped off the harbour police. Lose them and get to the pier — the boat leaves when you do."',
    steps: [
      { kind: 'chase', spot: 'pier', label: 'Escape the police and reach the pier', radius: 80, wanted: 2 },
    ],
  },
  {
    id: 5, name: 'Dockyard War', reward: 1200,
    brief: 'Delia: "The Vipers took our docks. Take them back. Six of them, Rook. Make it loud."',
    steps: [
      { kind: 'kill', spot: 'docks', label: 'Take out the Vipers at the docks (0/6)', radius: 260, count: 6 },
    ],
  },
  {
    id: 6, name: 'The Harbor Heist', reward: 2500,
    brief: 'Delia: "One last job. The Downtown bank vault, then the pier. Do this and Dusk Harbor is ours."',
    steps: [
      { kind: 'goto', spot: 'bank', label: 'Reach the Downtown bank', radius: 70 },
      { kind: 'kill', spot: 'bank', label: 'Fight off the bank guards (0/4)', radius: 240, count: 4 },
      { kind: 'escape', spot: 'pier', label: 'Escape to the pier with the loot', radius: 80, wanted: 3 },
    ],
  },
];

export const STORY_INTRO = 'DUSK HARBOR — Rook arrives in a city that never sleeps. Fixer Delia Crane has six jobs. Finish them all and the harbor is yours.';
