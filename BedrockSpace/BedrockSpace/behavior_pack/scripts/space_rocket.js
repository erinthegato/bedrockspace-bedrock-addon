const SPACE_DIMENSION = "bedrockspace:space";

export function onBlockStateChange(event) {
  const block = event.block;
  if (block.type !== "bedrockspace:rocket") {
    return;
  }

  const newState = event.newState;
  if (!newState) return;

  if (newState.state === "bedrockspace:fuel") {
    return;
  }

  if (newState.state === "bedrockspace:loaded") {
    startRocketLaunch(block);
  }
}

function startRocketLaunch(block) {
  const loc = block.location;
  const world = loc.world;
  const players = world.getPlayers();

  const nearest = players.reduce((best, p) => {
    const d = p.location.distanceTo(loc);
    return d < best.d ? { p, d } : best;
  }, { p: null, d: Infinity });

  if (!nearest.p || nearest.d > 6) return;

  runTakeoffSequence(nearest.p, block);
}

function runTakeoffSequence(player, block) {
  // 1) Brief pre-launch camera zoom out so the player can see the whole rocket.
  zoomCameraOut(player, block);

  // 2) Count down, then teleport the player into the space dimension.
  let countdown = 3;
  const start = Date.now();
  const tick = () => {
    const elapsed = (Date.now() - start) / 1000;
    if (elapsed >= countdown) {
      player.runCommand(`tp ${player.name} 0 60 0 ${SPACE_DIMENSION}`);
      player.sendMessage("§eLaunched into space.");
      restoreCamera(player);
    } else {
      // Update countdown message every second.
      if (Math.floor(elapsed) !== Math.floor(elapsed - 0.1)) {
        player.sendMessage(`§eLaunching in ${countdown}…`);
        countdown = Math.ceil(countdown - 1);
      }
      setTimeout(tick, 100);
    }
  };
  tick();
}

function zoomCameraOut(player, block) {
  // Zoom out to a high vantage point above the rocket so the player sees the whole
  // takeoff. We do this with the /camera command and a temporary control scheme.
  const vec = block.location;
  const cameraTarget = {
    x: vec.x,
    y: vec.y + 8,
    z: vec.z
  };

  try {
    // Fade in a zoomed-out view over the launch pad.
    player.runCommand(
      `camera ${player.name} ${cameraTarget.x} ${cameraTarget.y} ${cameraTarget.z} 30 0.5 0.3 0.8`
    );
  } catch (e) {
    // If /camera isn't available in this runtime, just keep the default view.
  }
}

function restoreCamera(player) {
  try {
    player.runCommand(`camera ${player.name} clear`);
  } catch (e) {
  }
}
