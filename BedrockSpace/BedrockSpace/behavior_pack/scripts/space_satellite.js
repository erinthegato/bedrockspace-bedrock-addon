"use strict";
/**
 * space_satellite.js
 *
 * Deployable satellites for bedrockspace:space.
 *
 * Design (default choices):
 *   - A satellite is first deployed as a script-managed entity in space.
 *   - After deployment there is a separate launch step that moves it to its
 *     operational position/role.
 *   - Satellites carry a role/payload: relay, sensor, gps, or weaponized.
 *   - GPS/guidance is exposed as a capability that future weapons and
 *     payloads can use.
 *
 * This module assumes space_kernel.js is available.
 */

const Kernel = require("./space_kernel.js").SpaceKernel;
const { SPACE_DIMENSION, Registry, createRNG, makeSatelliteId } = Kernel;

const Satellite = {
  ROLES: {
    RELAY: "relay",
    SENSOR: "sensor",
    GPS: "gps",
    WEAPON: "weapon"
  },

  /**
   * Deploy a satellite into space from a source location/entity.
   *
   * `source` should be a player, entity, or position in space.
   */
  deploy(source, options) {
    const pos = this._positionFromSource(source);
    if (pos.dimension && pos.dimension.id !== SPACE_DIMENSION) {
      throw new Error("Satellite deployment is only supported in bedrockspace:space.");
    }

    const role = this._normalizeRole(options?.role || this.ROLES.SENSOR);
    const seed = ((pos.x * 73856093) ^ (pos.y * 19349663) ^ (pos.z * 83492791)) >>> 0;
    const id = makeSatelliteId(seed);

    const satellite = {
      id,
      role,
      deployedAt: { ...pos },
      launched: false,
      operational: false,
      spawnYaw: options?.yaw ?? 0,
      spawnPitch: options?.pitch ?? 0,
      // GPS capability is available on any satellite but is most useful
      // for guided payloads.
      gpsEnabled: role === this.ROLES.GPS || options?.gps === true,
      telemetry: {
        launchCount: 0,
        scans: 0,
        shotsFired: 0
      },
      // Future expansion: payload capacity, fuel, antenna reach, etc.
      payload: options?.payload ?? null
    };

    Registry.set(satellite.id, satellite);
    return satellite;
  },

  /**
   * Launch a deployed satellite into its operational state in space.
   */
  async launch(satelliteId, options) {
    const satellite = Registry.get(satelliteId);
    if (!satellite) {
      throw new Error("Unknown satellite: " + satelliteId);
    }
    if (satellite.launched) {
      throw new Error("Satellite is already launched.");
    }

    const targetPos = this._launchPosition(satellite, options);

    // Update operational position in space.
    satellite.launched = true;
    satellite.operational = true;
    satellite.launchPosition = { ...targetPos };
    satellite.launchTime = Date.now();
    satellite.launchCount = (satellite.telemetry?.launchCount || 0) + 1;

    Registry.set(satellite.id, satellite);
    return satellite;
  },

  /**
   * Mark a satellite as destroyed and emit scrap.
   */
  destroy(satelliteId, scrapOptions) {
    const satellite = Registry.get(satelliteId);
    if (!satellite) {
      throw new Error("Unknown satellite: " + satelliteId);
    }

    const scrap = this._produceScrap(satellite, scrapOptions);
    Registry.delete(satelliteId);

    return { satellite, scrap };
  },

  /**
   * Return active satellites, optionally filtered by role.
   */
  list(options) {
    const out = [];
    for (const [, sat] of Registry.entries()) {
      if (options?.role && sat.role !== options.role) continue;
      out.push(sat);
    }
    return out;
  },

  /**
   * Return a GPS position report for a satellite, if it has GPS capability.
   */
  gpsReport(satelliteId, query) {
    const sat = Registry.get(satelliteId);
    if (!sat) {
      return { error: "Unknown satellite." };
    }
    if (!sat.gpsEnabled) {
      return { error: "Satellite does not have GPS enabled." };
    }

    const target = query ?? satellite.launchPosition;
    return {
      satelliteId: sat.id,
      role: sat.role,
      position: target ? { ...target } : null,
      operational: sat.operational,
      telemetry: sat.telemetry
    };
  },

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  _positionFromSource(source) {
    if (source.location) {
      return {
        x: Math.floor(source.location.x),
        y: Math.floor(source.location.y),
        z: Math.floor(source.location.z),
        dimension: source.dimension ? source.dimension.id : undefined
      };
    }
    if (source.position) {
      return {
        x: Math.floor(source.position.x),
        y: Math.floor(source.position.y),
        z: Math.floor(source.position.z),
        dimension: source.dimension ? source.dimension.id : undefined
      };
    }
    if (source.x !== undefined && source.y !== undefined && source.z !== undefined) {
      return {
        x: Math.floor(source.x),
        y: Math.floor(source.y),
        z: Math.floor(source.z),
        dimension: source.dimension
      };
    }
    throw new Error("Unable to resolve satellite deployment position from source.");
  },

  _normalizeRole(role) {
    if (role === this.ROLES.RELAY || role === this.ROLES.SENSOR ||
        role === this.ROLES.GPS || role === this.ROLES.WEAPON) {
      return role;
    }
    return this.ROLES.SENSOR;
  },

  _launchPosition(satellite, options) {
    const offset = options?.offset ?? 64;
    const base = satellite.deployedAt;
    return {
      x: base.x + (options?.xOffset ?? 0),
      y: base.y + (options?.yOffset ?? offset),
      z: base.z + (options?.zOffset ?? 0),
      dimension: satellite.deployedAt.dimension ?? SPACE_DIMENSION
    };
  },

  _produceScrap(satellite, options) {
    const amount = Number(options?.amount ?? 1);
    const types = Kernel.SCRAP_TYPES.slice(0, Math.max(1, Math.min(3, amount)));
    return types.map(t => ({
      id: t.id,
      name: t.name,
      amount: t.amount
    }));
  }
};

export { Satellite };
