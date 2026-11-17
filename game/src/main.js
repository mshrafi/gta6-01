// Boot and the one loop: input every frame, the world in fixed 1/60 s steps,
// screens title / play / paused / over / win. ?seed=N fixes the city.
// ?shot=start|play|chase|end (with &seed=N) stages that scene, paints it twice
// and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createGame, applySave, stepGame } from './game.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { saveGame, loadSave, hasSave } from './save.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);

function runShot(name) {
  const scene = stageShot(name, seed);
  window.__G = scene.G;
  window.__shotInfo = {
    shot: name, screen: scene.screen, cash: scene.G.cash, hp: Math.round(scene.G.player.hp),
    inCar: !!scene.G.player.inCar, missionIndex: scene.G.missionIndex,
    wanted: scene.G.wanted, x: Math.round(scene.G.player.x), y: Math.round(scene.G.player.y),
  };
  let painted = 0;
  function paint() {
    renderer.draw(scene.G, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let G = createGame(seed, audio);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let continuePressed = false;
  let savePressed = false;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyC') continuePressed = true;
    if (e.code === 'KeyS') savePressed = true;
  });
  window.__G = G;

  function announce(message) { status.textContent = message; }

  function newGame() {
    G = createGame(seed, audio);
    window.__G = G;
    screen = SCREEN_PLAY;
    G.screen = 'play';
    audio.unlock();
    announce('Playing. Follow the gold marker — Delia Crane\'s first job.');
  }

  function continueGame() {
    const data = loadSave();
    if (!data) { newGame(); return; }
    G = createGame(seed, audio);
    applySave(G, data);
    window.__G = G;
    screen = SCREEN_PLAY;
    G.screen = 'play';
    audio.unlock();
    announce(`Continued. Mission ${G.missionIndex + 1}, $${G.cash}.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const act = input.read();
    // Mouse aim: convert the cursor to world coordinates for shooting.
    if (input.mouse.active) {
      act.aimX = G.camera.x - renderer.vw / 2 + input.mouse.x;
      act.aimY = G.camera.y - renderer.vh / 2 + input.mouse.y;
    }

    if (act.mute) {
      audio.setMuted(!audio.isMuted());
      G.muted = audio.isMuted();
    }

    if (screen === SCREEN_TITLE) {
      if (act.confirm) newGame();
      else if (continuePressed && hasSave()) continueGame();
      // Idle city life behind the title: step traffic/peds only.
      G.screen = 'play';
      while (accumulator >= STEP) {
        const idle = { up: false, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, shootPressed: false, reload: false, mute: false, pause: false, confirm: false };
        stepGame(G, idle, STEP);
        accumulator -= STEP;
        if (G.screen !== 'play') { G.screen = 'play'; break; }
      }
      G.screen = 'title';
      accumulator = 0;
    } else if (screen === SCREEN_PLAY) {
      if (act.pause) {
        screen = SCREEN_PAUSED;
        G.screen = 'paused';
        announce('Paused.');
      } else {
        G.screen = 'play';
        let firstStep = true;
        while (accumulator >= STEP) {
          stepGame(G, act, STEP);
          accumulator -= STEP;
          // Edge presses fire once: a second sub-step in the same frame must
          // not re-trigger them (E would enter AND exit the car in one frame).
          if (firstStep) {
            firstStep = false;
            act.enter = false; act.punch = false; act.reload = false; act.confirm = false;
          }
          if (G.screen !== 'play') break;
        }
        if (G.screen === 'over') { screen = SCREEN_OVER; announce(G.overReason === 'busted' ? 'Busted by the police.' : 'Wasted.'); }
        else if (G.screen === 'win') { screen = SCREEN_WIN; announce('All missions complete. Dusk Harbor is yours.'); }
        if (savePressed) { saveGame(G); G.message = 'Game saved.'; G.messageTimer = 2; }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (act.pause || act.confirm) { screen = SCREEN_PLAY; G.screen = 'play'; announce('Playing.'); }
      else if (savePressed) { saveGame(G); G.message = 'Game saved.'; G.messageTimer = 2; screen = SCREEN_PLAY; G.screen = 'play'; }
      accumulator = 0;
    } else if (screen === SCREEN_OVER) {
      if (act.confirm) {
        screen = SCREEN_PLAY;
        G.screen = 'play';
        announce('Back on the streets.');
      }
      accumulator = 0;
    } else if (screen === SCREEN_WIN) {
      if (act.confirm) { screen = SCREEN_PLAY; G.screen = 'play'; }
      accumulator = 0;
    }
    continuePressed = false;
    savePressed = false;
    if (screen === SCREEN_TITLE) G.screen = 'title';
    renderer.draw(G, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; G.screen = 'paused'; announce('Paused.'); }
  });

  announce('Dusk Harbor. Press Enter to start, C to continue a saved game.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
