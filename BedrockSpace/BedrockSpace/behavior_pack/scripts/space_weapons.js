"use strict";
/**
 * space_weapons.js
 *
 * Space weapons for bedrockspace:space.
 *
 * Design (default choices):
 *   - Railgun and orbital strike cannon are scripted weapons.
 *   - Railgun shots are real projectile entities with flight/impact behavior.
 *   - GPS/guidance is a capability exposed by satellites/payloads and used by
 *     guided shots.
 *
 * This module assumes space_kernel.js is available.
 */

const Kernel = require("./space_kernel.js").SpaceKernel;
const { SPACE_DIMENSION, Registry, createRNG, makeProjectileId } = Kernel;

const Weapons = {
  /**
   * Fire a railgun projectile from a source toward a target.
   *
   * `source` can be a player/entity/position.
   * `target` should be a location/position in space.
   *
   * Returns a projectile record that can be tracked and resolved later.
   */
  fireRailgun(source, target, options) {
    const origin = this._positionFromSource(source);
    const destination = this._positionFromTarget(target);

    if (origin.dimension && origin.dimension.id !== SPACE_DIMENSION) {
      throw new Error("Railgun fire is only supported in bedrockspace:space.");
    }

    const seed = ((origin.x * 73856093) ^ (origin.y * 19349663) ^ (origin.z * 83492791)) >>> 0;
    const id = makeProjectileId(seed);

    const projectile = {
      id,
      type: "railgun",
      origin: { ...origin },
      target: destination ? { ...destination } : null,
      travelTimeMs: Math.max(250, Number(options?.travelTimeMs) || 1200),
      startedAt: Date.now(),
      alive: true,
      hits: [],
      guidance: options?.guidance ?? null,
      payload: options?.payload ?? null
    };

    Registry.set(projectile.id, projectile);

    // In a fuller implementation this would also spawn a visible projectile
    // entity. For now the flight is modeled as a tracked projectile record
    // with deterministic travel time and impact resolution.
    return projectile;
  },

  /**
   * Perform an orbital strike from a satellite/position.
   */
  orbitalStrike(source, target, options) {
    const origin = this._positionFromSource(source);
    const destination = this._positionFromTarget(target);

    if (origin.dimension && origin.dimension.id !== SPACE_DIMENSION) {
      throw new Error("Orbital strike is only supported in bedrockspace:space.");
    }

    const seed = ((origin.x * 73856093) ^ (origin.y * 19349663) ^ (origin.z * 83492791) ^ (options?.seed || 0)) >>> 0;
    const id = makeProjectileId(seed + 0x9e3779b9);

    const strike = {
      id,
      type: "orbital_strike",
      origin: { ...origin },
      target: destination ? { ...destination } : null,
      startedAt: Date.now(),
      alive: true,
      impactDelayMs: Math.max(300, Number(options?.impactDelayMs) || 1500),
      impactResolved: false,
      payload: options?.payload ?? null
    };

    Registry.set(strike.id, strike);
    return strike;
  },

  /**
   * Resolve a projectile after its travel/impact time has elapsed.
   */
  resolveProjectile(id) {
    const p = Registry.get(id);
    if (!p || !p.alive) {
      return { error: "Projectile not found or already resolved." };
    }

    p.alive = false;
    p.resolvedAt = Date.now();

    if (p.target) {
      p.hits.push({
        target: { ...p.target },
        time: p.resolvedAt,
        type: p.type
      });
    }

    Registry.set(id, p);
    return p;
  },

  /**
   * Return live projectiles, optionally filtered by type.
   */
  list(options) {
    const out = [];
    for (const [, p] of Registry.entries()) {
      if (!p.alive) continue;
      if (options?.type && p.type !== options.type) continue;
      out.push(p);
    }
    return out;
  },

  /**
   * Compute a guided intercept position toward a target, using GPS data
   * when available.
   */
  guideToward(source, target, gpsData) {
    const src = this._positionFromSource(source);
    const tgt = this._positionFromTarget(target);

    if (!src || !tgt) return null;

    // Simple guidance: move the impact point toward the target based on
    // available GPS correction.
    const correction = (gpsData && gpsData.corrections)
      ? gpsData.corrections
      : 0;

    return {
      x: tgt.x + correction.x,
      y: tgt.y + correction.y,
      z: tgt.z + correction.z
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
    return null;
  },

  _positionFromTarget(target) {
    if (target.location) {
      return {
        x: Math.floor(target.location.x),
        y: Math.floor(target.location.y),
        z: Math.floor(target.location.z),
        dimension: target.dimension ? target.dimension.id : undefined
      };
    }
    if (target.position) {
      return {
        x: Math.floor(target.position.x),
        y: Math.floor(target.position.y),
        z: Math.floor(target.position.z),
        dimension: target.dimension ? target.dimension.id : undefined
      };
    }
    if (target.x !== undefined && target.y !== undefined && target.z !== undefined) {
      return {
        x: Math.floor(target.x),
        y: Math.floor(target.y),
        z: Math.floor(target.z),
        dimension: target.dimension
      };
    }
    return null;
  }
};

export { Weapons };
