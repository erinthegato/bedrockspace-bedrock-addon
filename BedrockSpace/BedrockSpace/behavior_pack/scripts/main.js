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

  // New BedrockSpace expansion systems.
  try {
    const planetMod = require("./space_planets.js");
    if (planetMod && planetMod.Planet) {
      // Planet registry is initialized on demand via Planet.generate / Planet.place.
    }
  } catch (e) {
  }

  try {
    const researchMod = require("./space_research.js");
    if (researchMod) {
      // Research state is stored in the runtime registry on first use.
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
  const parts = event.command.split(/\\s+/);
  const baseCommand = parts[0];

  if (baseCommand === "space") {
    handleSpaceCommand(event, parts.slice(1));
    return;
  }

  if (baseCommand === "planet") {
    handlePlanetCommand(event, parts.slice(1));
    return;
  }

  if (baseCommand === "rocket") {
    handleRocketCommand(event, parts.slice(1));
    return;
  }

  if (baseCommand === "satellite") {
    handleSatelliteCommand(event, parts.slice(1));
    return;
  }

  if (baseCommand === "weapon") {
    handleWeaponCommand(event, parts.slice(1));
    return;
  }

  if (baseCommand === "research") {
    handleResearchCommand(event, parts.slice(1));
    return;
  }
}

function handleSpaceCommand(event, args) {
  const player = event.player;
  if (player.dimension.id !== SPACE_DIMENSION) {
    player.sendMessage("§cUse /space while in the space dimension.");
    return;
  }

  const sub = args[0];
  if (!sub) {
    player.sendMessage("§eUsage: /space <command>");
    return;
  }

  if (sub === "station") {
    try {
      player.runCommand(
        `summon bedrockspace:space_station_anchor at ${player.location.x} ${player.location.y} ${player.location.z}`
      );
      player.sendMessage("§aSpace station anchor placed.");
    } catch (e) {
      player.sendMessage("§cFail to place station anchor.");
    }
    return;
  }

  player.sendMessage("§eAvailable: /space station");
}

function handlePlanetCommand(event, args) {
  const player = event.player;
  if (player.dimension.id !== SPACE_DIMENSION) {
    player.sendMessage("§cUse /planet while in the space dimension.");
    return;
  }

  const sub = args[0];
  if (sub === "generate") {
    try {
      const name = args[1] || "Procedural Planet";
      const seed = args[2] ? Number(args[2]) : null;

      const Planet = require("./space_planets.js").Planet;
      const planet = Planet.generate({ name, seed });
      player.sendMessage(
        "§eGenerated planet: " + planet.id + " (" + planet.name + ")"
      );
      return;
    } catch (e) {
      player.sendMessage("§cFailed to generate planet: " + e.message);
      return;
    }
  }

  if (sub === "place") {
    try {
      const name = args[1] || "Procedural Planet";
      const seed = args[2] ? Number(args[2]) : Planet.seedForName(name);

      const Planet = require("./space_planets.js").Planet;
      const planet = Planet.generate({ name, seed });

      Planet.place(player, planet).then(placed => {
        player.sendMessage(
          "§aPlaced landable planet: " + placed.id + " (" + placed.name + ")"
        );
      }).catch(err => {
        player.sendMessage("§cFailed to place planet: " + err.message);
      });
      return;
    } catch (e) {
      player.sendMessage("§cFailed to place planet: " + e.message);
      return;
    }
  }

  if (sub === "info") {
    try {
      const Planet = require("./space_planets.js").Planet;
      const nearest = Planet.nearest(player.location);
      if (!nearest) {
        player.sendMessage("§eNo landable planet nearby.");
        return;
      }
      player.sendMessage(
        "§ePlanet: " + nearest.name + " (" + nearest.id + ")"
      );
      player.sendMessage("§eTheme: " + nearest.theme);
      player.sendMessage("§eSurface block: " + nearest.surfaceBlock);
      player.sendMessage("§eAtmosphere: " + nearest.atmosphereTint);
      return;
    } catch (e) {
      player.sendMessage("§cFailed to query planet info: " + e.message);
      return;
    }
  }

  player.sendMessage("§eUsage: /planet <generate|place|info> [name] [seed]");
}

function handleRocketCommand(event, args) {
  const player = event.player;
  if (player.dimension.id !== SPACE_DIMENSION) {
    player.sendMessage("§cUse /rocket while in the space dimension.");
    return;
  }

  const sub = args[0];
  if (sub === "launch") {
    try {
      const Assembly = require("./space_rocket_assembly.js").Assembly;
      Assembly.startLaunch(player, {
        player,
        countdownSeconds: args[1] ? Number(args[1]) : 6
      }).then(launch => {
        player.sendMessage(
          "§aRocket launch started: " + launch.id + " (" + launch.state + ")"
        );
      }).catch(err => {
        player.sendMessage("§cFailed to launch rocket: " + err.message);
      });
      return;
    } catch (e) {
      player.sendMessage("§cFailed to launch rocket: " + e.message);
      return;
    }
  }

  if (sub === "info") {
    try {
      const Assembly = require("./space_rocket_assembly.js").Assembly;
      const origin = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z)
      };
      const dim = player.dimension;
      const desc = Assembly.describeAssembly(origin, dim);
      if (!desc.ok) {
        player.sendMessage("§cAssembly issue: " + desc.reason);
        return;
      }
      const launch = desc.launch;
      player.sendMessage("§aAssembly valid at " + origin.x + " " + origin.y + " " + origin.z);
      if (launch) {
        player.sendMessage("§eLaunch state: " + launch.state);
        if (launch.countdownRemaining != null) {
          player.sendMessage("§eCountdown remaining: " + launch.countdownRemaining);
        }
      } else {
        player.sendMessage("§eNo active launch.");
      }
      return;
    } catch (e) {
      player.sendMessage("§cFailed to query assembly: " + e.message);
      return;
    }
  }

  player.sendMessage("§eUsage: /rocket <launch|info>");
}

function handleSatelliteCommand(event, args) {
  const player = event.player;
  if (player.dimension.id !== SPACE_DIMENSION) {
    player.sendMessage("§cUse /satellite while in the space dimension.");
    return;
  }

  const sub = args[0];
  if (sub === "deploy") {
    try {
      const Satellite = require("./space_satellite.js").Satellite;
      const role = args[1] || Satellite.ROLES.SENSOR;
      const sat = Satellite.deploy(player, {
        role,
        gps: role === Satellite.ROLES.GPS
      });
      player.sendMessage(
        "§aDeployed satellite: " + sat.id + " (role: " + sat.role + ")"
      );
      return;
    } catch (e) {
      player.sendMessage("§cFailed to deploy satellite: " + e.message);
      return;
    }
  }

  if (sub === "launch") {
    try {
      const satelliteId = args[1];
      if (!satelliteId) {
        player.sendMessage("§eUsage: /satellite launch <satelliteId>");
        return;
      }
      const Satellite = require("./space_satellite.js").Satellite;
      Satellite.launch(satelliteId, { offset: 64 }).then(sat => {
        player.sendMessage(
          "§aLaunched satellite: " + sat.id + " (operational: " + sat.operational + ")"
        );
      }).catch(err => {
        player.sendMessage("§cFailed to launch satellite: " + err.message);
      });
      return;
    } catch (e) {
      player.sendMessage("§cFailed to launch satellite: " + e.message);
      return;
    }
  }

  if (sub === "list") {
    try {
      const Satellite = require("./space_satellite.js").Satellite;
      const list = Satellite.list();
      if (list.length === 0) {
        player.sendMessage("§eNo satellites deployed.");
        return;
      }
      for (const sat of list.slice(0, 10)) {
        player.sendMessage(
          "§eSatellite: " + sat.id + " (role: " + sat.role +
          ", launched: " + sat.launched + ")"
        );
      }
      return;
    } catch (e) {
      player.sendMessage("§cFailed to list satellites: " + e.message);
      return;
    }
  }

  player.sendMessage("§eUsage: /satellite <deploy|launch|list> [role] [satelliteId]");
}

function handleWeaponCommand(event, args) {
  const player = event.player;
  if (player.dimension.id !== SPACE_DIMENSION) {
    player.sendMessage("§cUse /weapon while in the space dimension.");
    return;
  }

  const sub = args[0];
  if (sub === "railgun") {
    try {
      const targetX = Number(args[1]);
      const targetY = Number(args[2]);
      const targetZ = Number(args[3]);
      if (!targetX || !targetY || !targetZ) {
        player.sendMessage("§eUsage: /weapon railgun <x> <y> <z>");
        return;
      }

      const Weapons = require("./space_weapons.js").Weapons;
      const proj = Weapons.fireRailgun(player, {
        x: targetX,
        y: targetY,
        z: targetZ
      }, {
        guidance: args[4] === "guided" ? "gps" : null
      });

      player.sendMessage(
        "§aFired railgun projectile: " + proj.id +
        " (target: " + targetX + " " + targetY + " " + targetZ + ")"
      );
      return;
    } catch (e) {
      player.sendMessage("§cFailed to fire railgun: " + e.message);
      return;
    }
  }

  if (sub === "orbital") {
    try {
      const targetX = Number(args[1]);
      const targetY = Number(args[2]);
      const targetZ = Number(args[3]);
      if (!targetX || !targetY || !targetZ) {
        player.sendMessage("§eUsage: /weapon orbital <x> <y> <z>");
        return;
      }

      const Weapons = require("./space_weapons.js").Weapons;
      const strike = Weapons.orbitalStrike(player, {
        x: targetX,
        y: targetY,
        z: targetZ
      });

      player.sendMessage(
        "§aOrbital strike ordered: " + strike.id +
        " (target: " + targetX + " " + targetY + " " + targetZ + ")"
      );
      return;
    } catch (e) {
      player.sendMessage("§cFailed to order orbital strike: " + e.message);
      return;
    }
  }

  if (sub === "list") {
    try {
      const Weapons = require("./space_weapons.js").Weapons;
      const live = Weapons.list();
      if (live.length === 0) {
        player.sendMessage("§eNo live projectiles.");
        return;
      }
      for (const p of live.slice(0, 10)) {
        player.sendMessage(
          "§eProjectile: " + p.id + " (type: " + p.type + ", alive: " + p.alive + ")"
        );
      }
      return;
    } catch (e) {
      player.sendMessage("§cFailed to list projectiles: " + e.message);
      return;
    }
  }

  player.sendMessage("§eUsage: /weapon <railgun|orbital|list> [x y z] [guided]");
}

function handleResearchCommand(event, args) {
  const player = event.player;
  const sub = args[0];

  if (sub === "view") {
    try {
      const Research = require("./space_research.js").Research;
      const tree = Research.view(player, { compact: args[1] === "compact" });
      for (const entry of tree) {
        const stateMarkers = {
          unavailable: "§7",
          locked: "§8",
          available: "§b",
          completed: "§a"
        };
        const marker = stateMarkers[entry.state] || "§7";
        player.sendMessage(
          marker + entry.id + " §7" + entry.state +
          (entry.progress != null ? " §7(" + entry.progress + "%)" : "")
        );
      }
      return;
    } catch (e) {
      player.sendMessage("§cFailed to view research: " + e.message);
      return;
    }
  }

  if (sub === "start") {
    try {
      const topicId = args[1];
      if (!topicId) {
        player.sendMessage("§eUsage: /research start <topicId>");
        return;
      }
      const Research = require("./space_research.js").Research;
      const entry = Research.start(player, topicId);
      player.sendMessage("§aStarted research: " + entry.id + " (" + entry.state + ")");
      return;
    } catch (e) {
      player.sendMessage("§cFailed to start research: " + e.message);
      return;
    }
  }

  if (sub === "advance") {
    try {
      const topicId = args[1];
      const amount = args[2] ? Number(args[2]) : 1;
      if (!topicId) {
        player.sendMessage("§eUsage: /research advance <topicId> [amount]");
        return;
      }
      const Research = require("./space_research.js").Research;
      const entry = Research.advance(player, topicId, amount);
      player.sendMessage(
        "§aAdvanced research: " + entry.id + " (" + entry.state + ", " +
        (entry.progress != null ? entry.progress + "%" : "unknown") + ")"
      );
      return;
    } catch (e) {
      player.sendMessage("§cFailed to advance research: " + e.message);
      return;
    }
  }

  if (sub === "unlocks") {
    try {
      const Research = require("./space_research.js").Research;
      const u = Research.unlocks(player);
      player.sendMessage("§eUnlocks:");
      player.sendMessage("§bscanning: " + u.scanning);
      player.sendMessage("§bmultiblockLaunch: " + u.multiblockLaunch);
      player.sendMessage("§bsatellites: " + u.satellites);
      player.sendMessage("§bweapons: " + u.weapons);
      player.sendMessage("§bscrap: " + u.scrap);
      player.sendMessage("§bterraform: " + u.terraform);
      return;
    } catch (e) {
      player.sendMessage("§cFailed to query unlocks: " + e.message);
      return;
    }
  }

  player.sendMessage("§eUsage: /research <view|start|advance|unlocks> [topicId] [amount]");
}
