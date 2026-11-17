// Keyboard input: held keys plus per-frame edge presses (consumed once).
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyE: 'enter', KeyF: 'punch', Space: 'shoot', KeyR: 'reload',
  KeyM: 'mute', Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm',
};

export function createInput(canvas) {
  const held = {};
  const pressed = {};
  function onDown(e) {
    const a = KEYMAP[e.code];
    if (!a) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!held[a]) pressed[a] = true;
    held[a] = true;
  }
  function onUp(e) {
    const a = KEYMAP[e.code];
    if (a) held[a] = false;
  }
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', () => { for (const k of Object.keys(held)) held[k] = false; });
  canvas.addEventListener('mousedown', () => canvas.focus());
  // Mouse aim: the player shoots toward the cursor; until the mouse moves,
  // aim follows the movement direction.
  const mouse = { x: 0, y: 0, active: false };
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  });
  return {
    held, mouse,
    // Build this frame's action object; edge presses are consumed.
    read() {
      const act = {
        up: !!held.up, down: !!held.down, left: !!held.left, right: !!held.right,
        run: !!held.run,
        enter: !!pressed.enter, punch: !!pressed.punch, shoot: !!held.shoot,
        shootPressed: !!pressed.shoot, reload: !!pressed.reload,
        mute: !!pressed.mute, pause: !!pressed.pause, confirm: !!pressed.confirm,
      };
      for (const k of Object.keys(pressed)) pressed[k] = false;
      return act;
    },
    clear() { for (const k of Object.keys(pressed)) pressed[k] = false; },
  };
}

// Synthetic input for the deterministic ?shot= autopilot.
export function blankAction() {
  return { up: false, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, shootPressed: false, reload: false, mute: false, pause: false, confirm: false };
}
