const SPACE_DIMENSION = "bedrockspace:space";

// Low gravity in space: each tick, reduce downward acceleration for players in the
// space dimension so falls are slow and floaty. This is a script-side approximation
// of space gravity, since the behavior API does not expose a direct gravity setter.

const SPACE_GRAVITY_CUTOFF_Y = 30; // only apply the low-gravity effect above this Y
const TICK = 1 / 20; // 20 ticks/sec
const NORMAL_GRAVITY = 0.98; // approximate vanilla gravity scale factor
const SPACE_GRAVITY = 0.15; // much weaker effective gravity in space

export function onWorldInitialize(event) {
  event.world.beforeEvents.tick.subscribe(() => {
    for (const player of event.world.getPlayers()) {
      if (player.dimension.id !== SPACE_DIMENSION) {
        continue;
      }
      if (!isEffectivelyInSpace(player)) {
        continue;
      }
      applySpaceGravity(player);
    }
  });
}

function isEffectivelyInSpace(player) {
  const loc = player.location;
  // Keep regular gravity near the station/ground so players can stand on blocks.
  if (loc.y < SPACE_GRAVITY_CUTOFF_Y) {
    return false;
  }
  return true;
}

function applySpaceGravity(player) {
  try {
    const vel = player.getVelocity();
    const { x, y, z } = vel;

    // In space, reduce downward pull and give a tiny floaty upward bias when
    // the player is already falling, so movement feels weightless.
    let newY = y;
    if (y < 0) {
      // falling: dampen the fall
      newY = y * (SPACE_GRAVITY / NORMAL_GRAVITY);
    } else {
      // rising / hovering: keep momentum, slowly bleed vertical speed
      newY = y + (0 - y) * 0.02;
    }

    // Horizontal motion stays mostly the same but slightly damped to feel floaty.
    const damp = 0.995;
    player.setVelocity({ x: x * damp, y: newY, z: z * damp });
  } catch (e) {
    // If velocity access is restricted in this runtime, skip silently.
  }
}
