const SPACE_BOUNDS = {
  minX: -64,
  maxX: 64,
  minY: 20,
  maxY: 120,
  minZ: -64,
  maxZ: 64
};

function outOfBounds(loc) {
  return (
    loc.x < SPACE_BOUNDS.minX ||
    loc.x > SPACE_BOUNDS.maxX ||
    loc.y < SPACE_BOUNDS.minY ||
    loc.y > SPACE_BOUNDS.maxY ||
    loc.z < SPACE_BOUNDS.minZ ||
    loc.z > SPACE_BOUNDS.maxZ
  );
}

export function onPlayerLocationChange(event) {
  const player = event.player;
  if (player.dimension.id !== "bedrockspace:space") {
    return;
  }
  if (outOfBounds(event.location)) {
    player.runCommand(
      `tp ${player.name} 0 100 0 minecraft:overworld`
    );
  }
}
