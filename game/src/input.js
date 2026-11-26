// Keyboard and mouse input: one job, turn raw device events into a clean
// control state the flight model reads every frame.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    pitchUp: false, // ArrowUp / I
    pitchDown: false, // ArrowDown / K
    bankLeft: false, // ArrowLeft / J
    bankRight: false, // ArrowRight / L
    throttleUp: false, // W
    throttleDown: false, // S
    brake: false, // Space: airbrake
    mouseX: 0, // -1..1, mouse offset from screen centre
    mouseY: 0, // -1..1, mouse offset from screen centre
    mouseActive: false, // mouse steers only after it moves
    pressed: new Set(), // edge-triggered keys, consumed by the game loop
    anyKey: false,
  };

  const KEYMAP = {
    ArrowUp: 'pitchUp', KeyI: 'pitchUp',
    ArrowDown: 'pitchDown', KeyK: 'pitchDown',
    ArrowLeft: 'bankLeft', KeyJ: 'bankLeft',
    ArrowRight: 'bankRight', KeyL: 'bankRight',
    KeyW: 'throttleUp',
    KeyS: 'throttleDown',
    Space: 'brake',
  };

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    keys.add(event.code);
    input.anyKey = true;
    sync();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
    sync();
  }

  function sync() {
    for (const [code, field] of Object.entries(KEYMAP)) input[field] = keys.has(code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    input.mouseX = Math.max(-1, Math.min(1, (event.clientX - cx) / (rect.width / 2)));
    input.mouseY = Math.max(-1, Math.min(1, (event.clientY - cy) / (rect.height / 2)));
    input.mouseActive = true;
  }

  function onMouseDown() {
    input.anyKey = true;
    input.pressed.add('MouseClick');
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  // Edge-triggered keys are consumed once per frame by the game loop.
  input.consumePressed = () => {
    const out = new Set(input.pressed);
    input.pressed.clear();
    return out;
  };

  return input;
}
