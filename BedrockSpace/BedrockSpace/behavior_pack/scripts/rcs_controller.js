/**
 * RCS controller for BedrockSpace, backed by player JSON / dynamic properties.
 *
 * Behavior:
 *  - RCS state is stored on the player as a JSON blob under the dynamic property
 *    key `minecoins:rcs`. That keeps it readable from either pack and durable across
 *    joins/reloads (as durable as player dynamic properties are in this runtime).
 *  - When RCS is enabled and the player is in the space dimension, a per-tick handler
 *    applies small velocity increments based on which axes are mapped to thrust.
 *  - Thrust axes are normalized against the player's current look direction so WASD-style
 *    input can drive translation and the space dimension's low-gravity gravity script
 *    continues to apply on top of it.
 *
 * Integration point:
 *  - This module is loaded and initialized from BedrockSpace's main.js after the gravity
 *    module so the gravity tick runs first and RCS adds on top of it. If that loading is
 *    not available for some reason, the module still self-initializes on import.
 */

const SPACE_DIMENSION = "bedrockspace:space";
const PROP_KEY = "minecoins:rcs";

const N_KEY = "minecoins:n";
const ROLL_LEFT_KEY = "minecoins:y";
const ROLL_RIGHT_KEY = "minecoins:i";

const DEFAULT_STATE = {
  enabled: false,
  thrust_up: false,
  thrust_down: false,
  thrust_forward: false,
  thrust_back: false,
  thrust_left: false,
  thrust_right: false,
  thrust_roll: false,
  slew: "local",
  power: 0.12,
};


function readRCS(player) {
  try {
    const raw = player.getDynamicProperty(PROP_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function writeRCS(player, state) {
  try {
    player.setDynamicProperty(PROP_KEY, JSON.stringify(state));
  } catch {
    // best effort
  }
}

function stateClone(state) {
  return {
    enabled: !!state.enabled,
    thrust_up: !!state.thrust_up,
    thrust_down: !!state.thrust_down,
    thrust_forward: !!state.thrust_forward,
    thrust_back: !!state.thrust_back,
    thrust_left: !!state.thrust_left,
    thrust_right: !!state.thrust_right,
    thrust_roll: !!state.thrust_roll,
    slew: state.slew === "world" ? "world" : "local",
    power: Math.max(0, Number(state.power) || DEFAULT_STATE.power),
  };
}

function applyRCS(player, state) {
  if (!state.enabled) return;
  if (player.dimension.id !== SPACE_DIMENSION) return;
  if (!isEffectivelyInSpace(player)) return;
  const power = state.power;
  const vel = player.getVelocity();
  if (!vel) return;
  let fx = 0, fz = 0, up = 0, down = 0, roll = 0;
  const yaw = cachedYaw(player);
  if (state.slew === "world") {
    if (state.thrust_forward) fz -= power;
    if (state.thrust_back) fz += power;
    if (state.thrust_right) fx += power;
    if (state.thrust_left) fx -= power;
  } else {
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    if (state.thrust_forward) { fz -= power * ca; fx -= power * sa; }
    if (state.thrust_back) { fz += power * ca; fx += power * sa; }
    if (state.thrust_right) { fx += power * ca; fz -= power * sa; }
    if (state.thrust_left) { fx -= power * ca; fz += power * sa; }
  }
  if (state.thrust_up) up += power;
  if (state.thrust_down) up -= power;
  if (state.thrust_roll) roll += power;
  try {
    player.setVelocity({
      x: vel.x + fx,
      y: vel.y + up,
      z: vel.z + fz,
      roll,
    });
  } catch {
    // best effort
  }
}
    if (state.thrust_back) { fz += power * ca; fx += power * sa; }
    if (state.thrust_right) { fx += power * ca; fz -= power * sa; }
    if (state.thrust_left) { fx -= power * ca; fz += power * sa; }
  }
  if (state.thrust_up) up += power;
  if (state.thrust_down) up -= power;

  try {
    player.setVelocity({
      x: vel.x + fx,
      y: vel.y + up,
      z: vel.z + fz,
    });
  } catch {
    // best effort
  }
}

// Cheap yaw approximation using the player's current rotation.
function cachedYaw(player) {
  try {
    const rot = player.getRotation();
    if (rot) return rot.yaw;
  } catch {
    // ignore
  }
  return 0;
}

// Matches the gravity module's effective-space check so RCS stays off near the ground.
function isEffectivelyInSpace(player) {
  const loc = player.location;
  if (loc.y < 30) return false;
  return true;
}

let tickHandle = null;

export function enable(player) {
  const s = readRCS(player);
  if (!s.enabled) {
    writeRCS(player, { ...s, enabled: true });
    ensureTick();
    player.sendMessage(`§b[RCS] §aReaction control system enabled.`);
  }
}

export function disable(player) {
  const s = readRCS(player);
  if (s.enabled) {
    writeRCS(player, { ...s, enabled: false });
    player.sendMessage(`§b[RCS] §cReaction control system disabled.`);
  }
}

export function setAxis(player, axis, on) {
  const s = readRCS(player);
  const next = stateClone(s);
  if (axis === "up") next.thrust_up = !!on;
  else if (axis === "down") next.thrust_down = !!on;
  else if (axis === "forward") next.thrust_forward = !!on;
  else if (axis === "back") next.thrust_back = !!on;
  else if (axis === "left") next.thrust_left = !!on;
  else if (axis === "right") next.thrust_right = !!on;
  else return;
  writeRCS(player, next);
}

export function setSlew(player, mode) {
  const s = readRCS(player);
  const next = stateClone(s);
  next.slew = mode === "world" ? "world" : "local";
  writeRCS(player, next);
  player.sendMessage(
    `§b[RCS] §aSlew mode: §f${next.slew === "world" ? "world-aligned" : "camera-relative"}§a.`
  );
}

export function setPower(player, amount) {
  const s = readRCS(player);
  const next = stateClone(s);
  next.power = Math.max(0, Math.min(0.5, Number(amount) || 0.12));
  writeRCS(player, next);
  player.sendMessage(`§b[RCS] §aThrust set to §f${next.power.toFixed(3)}§a blocks/tick.`);
}

export function snapshot(player) {
  const s = readRCS(player);
  if (player.dimension.id !== SPACE_DIMENSION) {
    player.sendMessage(`§b[RCS] §cOnly usable in the space dimension.`);
    return;
  }
  const loc = player.location;
  const vel = player.getVelocity();
  player.sendMessage(
    `§b[RCS] §eenabled §a${s.enabled ? "on" : "off"} §8· §eaxes §a[${[
      s.thrust_up ? "U" : "-",
      s.thrust_down ? "D" : "-",
      s.thrust_forward ? "F" : "-",
      s.thrust_back ? "B" : "-",
      s.thrust_left ? "L" : "-",
      s.thrust_right ? "R" : "-",
    ].join("")}] §8· §eplane §f${s.slew} §8· §epower §f${s.power.toFixed(3)}`
  );
  player.sendMessage(
    `§b[RCS] §elocation §f${Math.floor(loc.x)}, ${Math.floor(loc.y)}, ${Math.floor(loc.z)} §8· §evel §f${Math.round((vel?.x ?? 0)*1000)/1000}, ${(vel?.y ?? 0)*1000/1000}, ${(vel?.z ?? 0)*1000/1000}`
  );
}

function ensureTick() {
  if (tickHandle) return;
  try {
    const { world } = require("@minecraft/server");
    if (!world) return;
    tickHandle = world.beforeEvents.tick.subscribe(() => {
      for (const player of world.getPlayers()) {
        applyRCS(player, readRCS(player));
      }
    });
  } catch {
    // best effort
  }
}

export function dispose() {
  tickHandle = null;
}

// Toggle keys: U/H/J/K map to up/left/down/right thrust while in space.
// This toggles each axis on/off and does not change slew mode or power.
const KEY_CONFIG = {
  // Enable/disable RCS
  rcs_toggle: "minecoins:n",

  // Translation axes
  up: "minecoins:up",
  left: "minecoins:left",
  down: "minecoins:down",
  right: "minecoins:right",

  // Roll axes
  roll_left: "minecoins:y",
  roll_right: "minecoins:i",
};

const TOGGLE_KEYS = new Map([
  [KEY_CONFIG.rcs_toggle, "rcs_toggle"],
  [KEY_CONFIG.up, "up"],
  [KEY_CONFIG.left, "left"],
  [KEY_CONFIG.down, "down"],
  [KEY_CONFIG.right, "right"],
  [KEY_CONFIG.roll_left, "roll_left"],
  [KEY_CONFIG.roll_right, "roll_right"],
]);

let keyHandle = null;

function ensureKeyHooks() {
  if (keyHandle) return;
  try {
    const { world } = require("@minecraft/server");
    if (!world) return;
    // Attempt to subscribe to player keyboard input. The event shape varies by
    // runtime, so we try a couple of common hooks and ignore failures.
    if (typeof world.beforeEvents?.playerInput?.subscribe === "function") {
      keyHandle = world.beforeEvents.playerInput.subscribe((event) => {
        const player = event.player;
        if (player.dimension.id !== SPACE_DIMENSION) return;
        const state = readRCS(player);
        if (!state.enabled) return;
        const key = event.input?.key ?? event.input?.processedKey;
        if (key) applyToggle(player, state, key);
      });
    } else if (typeof world.beforeEvents?.keyPress?.subscribe === "function") {
      keyHandle = world.beforeEvents.keyPress.subscribe((event) => {
        const player = event.player;
        if (!player) return;
        if (player.dimension.id !== SPACE_DIMENSION) return;
        const state = readRCS(player);
        if (!state.enabled) return;
        const key = event.key;
        if (key) applyToggle(player, state, key);
      });
    }
  } catch {
    // best effort
  }
}

function applyToggle(player, state, key) {
  const axis = TOGGLE_KEYS.get(key);
  if (!axis) return;
  const next = stateClone(state);
  if (axis === "up") next.thrust_up = !next.thrust_up;
  else if (axis === "down") next.thrust_down = !next.thrust_down;
  else if (axis === "left") next.thrust_left = !next.thrust_left;
  else if (axis === "right") next.thrust_right = !next.thrust_right;
  else if (axis === "rcs_toggle") {
    next.enabled = !next.enabled;
    player.sendMessage(
      next.enabled
        ? "§b[RCS] §aReaction control system enabled."
        : "§b[RCS] §cReaction control system disabled."
    );
  }
  else if (axis === "roll_left") next.thrust_roll = !next.thrust_roll;
  else if (axis === "roll_right") next.thrust_roll = !next.thrust_roll;
  else return;
  if (axis !== "rcs_toggle") {
    const on = next["thrust_" + axis];
    const label = KEY_CONFIG[axis] ? axis : axis;
    player.sendMessage(
      `§b[RCS] §aAxis ${label} ${on ? "ON" : "OFF"}`
    );
  }
  writeRCS(player, next);
}

export function initialize() {
  ensureTick();
  ensureKeyHooks();
}
