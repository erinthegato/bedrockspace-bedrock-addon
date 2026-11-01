"use strict";
/**
 * space_rocket_assembly.js
 *
 * Multiblock rocket assembly for bedrockspace:space.
 *
 * Design (default choices):
 *   - Assembly is anchored by a focal controller block:
 *       bedrockspace:rocket_assembly
 *   - The controller validates structure around it, stores launch state on the
 *     assembly, and can be triggered by a command block.
 *   - Launch sequence: countdown -> launch animation (block state change) ->
 *     teleport player + rocket assembly to space as a script-managed launch
 *     object.
 *
 * This module assumes space_kernel.js is available.
 */

const Kernel = require("./space_kernel.js").SpaceKernel;
const { SPACE_DIMENSION, Registry, createRNG, makeLaunchId } = Kernel;

const Assembly = {
  /**
   * Identifier of the focal assembly controller block.
   */
  CONTROLLER_ID: "bedrockspace:rocket_assembly",

  /**
   * Block states used by the assembly controller.
   */
  STATE_READY: "ready",
  STATE_COUNTDOWN: "countdown",
  STATE_LAUNCHING: "launching",
  STATE_LAUNCHED: "launched",

  /**
   * Minimal structural requirements around the controller.
   * This is a simple validation rule set; expand it as the multiblock
   * design grows.
   */
  validateStructure(origin, dim) {
    if (dim.id !== SPACE_DIMENSION) return { ok: false, reason: "Not in space dimension." };

    const { x, y, z } = origin;

    // Require the controller itself.
    const controller = dim.getBlock({ x, y, z });
    if (!controller || controller.name !== this.CONTROLLER_ID) {
      return { ok: false, reason: "Missing rocket assembly controller." };
    }

    // Require a fuel chamber block above the controller.
    const above = dim.getBlock({ x, y: y + 1, z });
    if (!above || above.name !== "bedrockspace:rocket_fuel_chamber") {
      return { ok: false, reason: "Missing fuel chamber above assembly." };
    }

    // Require a command-facing interface block adjacent to the controller.
    const side = dim.getBlock({ x: x + 1, y, z });
    if (!side || side.name !== "bedrockspace:rocket_interface") {
      return { ok: false, reason: "Missing rocket interface block." };
    }

    return { ok: true };
  },

  /**
   * Start a launch sequence from the controller location.
   *
   * This is intended to be triggered by a command block or similar
   * mechanism in the world.
   */
  async startLaunch(target, options) {
    const origin = this._originFromTarget(target);
    const dim = target.dimension;

    if (dim.id !== SPACE_DIMENSION) {
      throw new Error("Rocket launch is only supported in bedrockspace:space.");
    }

    const validation = this.validateStructure(origin, dim);
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    const existing = Registry.get(this.CONTROLLER_ID + "::" + originKey(origin));
    if (existing && existing.state !== this.STATE_READY) {
      throw new Error("Rocket assembly is not ready for launch.");
    }

    const countdown = Math.max(3, Math.min(30, Number(options?.countdownSeconds) || 6));
    const launchId = makeLaunchId((origin.x * 73856093) ^ (origin.y * 19349663) ^ (origin.z * 83492791));

    const launch = {
      id: launchId,
      controllerOrigin: { ...origin },
      state: this.STATE_COUNTDOWN,
      countdownTotal: countdown,
      countdownRemaining: countdown,
      launched: false,
      createdAt: Date.now()
    };

    Registry.set(this.CONTROLLER_ID + "::" + originKey(origin), launch);

    // Begin countdown + launch animation.
    this._applyControllerState(dim, origin, this.STATE_COUNTDOWN);

    await this._runCountdown(launch, dim);

    // Final launch step.
    this._applyControllerState(dim, origin, this.STATE_LAUNCHING);

    // Teleport player + rocket to space.
    const player = options?.player;
    if (player) {
      // Place the rocket assembly in space at a stable offset from the player.
      const destination = this._launchDestination(origin, dim);
      await player.setLocation(destination);
    }

    // Mark assembly as launched so it can be tracked as a space object.
    launch.state = this.STATE_LAUNCHED;
    launch.launchedAt = Date.now();
    launch.location = this._launchDestination(origin, dim);

    Registry.set(this.CONTROLLER_ID + "::" + originKey(origin), launch);

    this._applyControllerState(dim, origin, this.STATE_LAUNCHED);

    return launch;
  },

  /**
   * Return the current launch state for a controller location, if any.
   */
  getLaunch(origin) {
    return Registry.get(this.CONTROLLER_ID + "::" + originKey(origin)) || null;
  },

  /**
   * Simple structure query for the assembly controller.
   */
  describeAssembly(origin, dim) {
    if (dim.id !== SPACE_DIMENSION) {
      return { ok: false, reason: "Not in space dimension." };
    }
    const validation = this.validateStructure(origin, dim);
    const launch = this.getLaunch(origin);
    return {
      ok: validation.ok,
      reason: validation.reason,
      launch: launch ? {
        id: launch.id,
        state: launch.state,
        countdownRemaining: launch.countdownRemaining ?? null,
        launched: launch.launched
      } : null
    };
  },

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  _originFromTarget(target) {
    if (target.location) {
      return {
        x: Math.floor(target.location.x),
        y: Math.floor(target.location.y),
        z: Math.floor(target.location.z)
      };
    }
    if (target.position) {
      return {
        x: Math.floor(target.position.x),
        y: Math.floor(target.position.y),
        z: Math.floor(target.position.z)
      };
    }
    throw new Error("Unable to resolve assembly origin from target.");
  },

  _runCountdown(launch, dim) {
    return new Promise((resolve, reject) => {
      let remaining = launch.countdownTotal;
      const interval = setInterval(() => {
        remaining -= 1;
        launch.countdownRemaining = Math.max(0, remaining);

        if (remaining > 0) {
          // Update controller visual to reflect countdown progress.
          this._applyControllerState(dim, launch.controllerOrigin, this.STATE_COUNTDOWN);
        }

        if (remaining <= 0) {
          clearInterval(interval);
          resolve();
        }
      }, 1000);

      // Safety timeout in case interval handling is interrupted.
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error("Countdown timed out."));
      }, (launch.countdownTotal + 2) * 1000);
    });
  },

  _applyControllerState(dim, origin, state) {
    try {
      const block = dim.getBlock(origin);
      if (block && block.name === this.CONTROLLER_ID) {
        block.updateComponent("minecraft:display_name", {
          value: this._displayNameForState(state)
        });
      }
    } catch (e) {
      // State application is best-effort; a missing block should not abort
      // the launch sequence.
    }
  },

  _displayNameForState(state) {
    switch (state) {
      case this.STATE_READY:
        return "Rocket Assembly (ready)";
      case this.STATE_COUNTDOWN:
        return "Rocket Assembly (countdown)";
      case this.STATE_LAUNCHING:
        return "Rocket Assembly (launching)";
      case this.STATE_LAUNCHED:
        return "Rocket Assembly (launched)";
      default:
        return "Rocket Assembly";
    }
  },

  _launchDestination(origin, dim) {
    // Place the launched rocket in space at a stable offset above the
    // assembly's origin. In a richer design this would inject an initial
    // velocity or staging orbit vector; for now it teleports upward within
    // the space dimension.
    return {
      x: origin.x,
      y: origin.y + 48,
      z: origin.z,
      dimension: dim.id
    };
  }
};

function originKey(origin) {
  return origin.x + ":" + origin.y + ":" + origin.z;
}

export { Assembly };
