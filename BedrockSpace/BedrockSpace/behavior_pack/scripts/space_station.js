const SPACE_DIMENSION = "bedrockspace:space";

export function onBlockAdded(event) {
  if (event.block.type !== "bedrockspace:space_station_anchor") {
    return;
  }
  const loc = event.block.location;
  try {
    loc.world.setBlocksLightLevel(loc, 8);
  } catch (e) {
  }
}

export function onPlayerInteract(event) {
  if (event.block.type !== "bedrockspace:space_station_anchor") {
    return;
  }
  const player = event.player;
  const loc = event.block.location;
  player.runCommand(
    `tp ${player.name} ${Math.floor(loc.x)} ${Math.floor(loc.y) + 1} ${Math.floor(loc.z)} ${SPACE_DIMENSION}`
  );
}
