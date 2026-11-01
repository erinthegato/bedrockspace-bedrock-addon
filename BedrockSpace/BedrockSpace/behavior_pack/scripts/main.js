const SPACE_DIMENSION = "bedrockspace:space";

export function onGameInitialize(event) {
  // Low-gravity behavior for the space dimension.
  try {
    const spaceGrav = require("./space_gravity.js");
    if (spaceGrav.onWorldInitialize) {
      spaceGrav.onWorldInitialize(event);
    }
  } catch (e) {
  }

  // RCS subsystem: player state lives under Minecoins' player dynamic properties.
  try {
    const spaceRcs = require("./space_rcs.js");
    if (spaceRcs.initialize) {
      spaceRcs.initialize();
    }
  } catch (e) {
  }

  event.onPlayerJoin(result => {
    const player = result.player;
    giveStartupItems(player);
  });
}

function giveStartupItems(player) {
  try {
    player.giveStack({ id: "bedrockspace:rocket" });
    player.giveStack({ id: "bedrockspace:astronaut_suit" });
  } catch (e) {
  }
}

export function onExecuteCommand(event) {
  if (event.command !== "space") {
    return;
  }
  const player = event.player;
  if (player.dimension.id !== SPACE_DIMENSION) {
    player.sendMessage("§cUse /space while in the space dimension.");
    return;
  }
  try {
    player.runCommand(
      `summon bedrockspace:space_station_anchor at ${player.location.x} ${player.location.y} ${player.location.z}`
    );
    player.sendMessage("§aSpace station anchor placed.");
  } catch (e) {
    player.sendMessage("§cFail to place station anchor.");
  }
}

// RCS command helpers, thin wrappers over the shared controller.
export function onRCSCommand(event) {
  const player = event.player;
  const parts = event.command.toLowerCase().split(/\s+/);
  if (parts[0] !== "rcs") return;
  try {
    const spaceRcs = require("./space_rcs.js");
    const sub = parts[1];
    if (!sub) {
      if (typeof spaceRcs?.snapshot === "function") spaceRcs.snapshot(player);
      return;
    }
    if (sub === "on") { if (typeof spaceRcs?.enable === "function") spaceRcs.enable(player); }
    else if (sub === "off") { if (typeof spaceRcs?.disable === "function") spaceRcs.disable(player); }
    else if (sub === "slew") { if (typeof spaceRcs?.setSlew === "function") spaceRcs.setSlew(player, parts[2] === "world" ? "world" : "local"); }
    else if (sub === "power") { if (typeof spaceRcs?.setPower === "function") spaceRcs.setPower(player, parseFloat(parts[2]) || 0.12); }
    else if (sub === "axis") { const axis = parts[2]; const on = parts[3] === "on"; if (axis && typeof spaceRcs?.setAxis === "function") spaceRcs.setAxis(player, axis, on); }
    else if (sub === "status" || sub === "snapshot") { if (typeof spaceRcs?.snapshot === "function") spaceRcs.snapshot(player); }
  } catch (e) {
    player.sendMessage("§c[RCS] Failed to run rcs command.");
  }
}
