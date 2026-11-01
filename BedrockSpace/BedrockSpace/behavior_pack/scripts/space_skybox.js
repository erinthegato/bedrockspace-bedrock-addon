const SPACE_DIMENSION = "bedrockspace:space";

export function onPlayerDimensionChange(event) {
  const player = event.player;
  const toDim = event.toDimension;
  const fromDim = event.fromDimension;

  if (toDim === SPACE_DIMENSION) {
    try {
      player.runCommand(`resourcepack activate bedrockspace:space_skybox`);
    } catch (e) {
    }
  } else if (fromDim === SPACE_DIMENSION) {
    try {
      player.runCommand(`resourcepack deactivate bedrockspace:space_skybox`);
    } catch (e) {
    }
  }
}
