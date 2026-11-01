"use strict";
/**
 * space_planets.js
 *
 * Procedural, landable planets for bedrockspace:space.
 *
 * A planet is:
 *   - a metadata record in the runtime registry
 *   - a placed multiblock surface body players can stand on in space
 *
 * Generation is deterministic from a seed/definition so planets are stable
 * and reproducible across reloads (within the same runtime instance).
 *
 * This module assumes space_kernel.js is available and exports SpaceKernel.
 */

const Kernel = require("./space_kernel.js").SpaceKernel;
const { SPACE_DIMENSION, createRNG, Registry, makePlanetId, PLANET_DEFAULTS } =
  Kernel;

const Planet = {
  /**
   * Generate a planet definition from an optional override object.
   * Uses deterministic RNG seeded from the planet seed.
   */
  generate(overrides) {
    const def = Object.assign({}, PLANET_DEFAULTS, overrides || {});
    const seed = typeof def.seed === "number" ? def.seed : hashSeed(def.name || "unnamed");
    const rng = createRNG(seed);

    const radius = Math.max(8, Math.floor(def.baseRadiusBlocks + (rng() - 0.5) * 12));
    const heightVar = Math.max(2, Math.floor(def.heightVariationBlocks * (0.5 + rng() * 0.8)));

    const biomeThemes = [
      "rocky",
      "metallic",
      "icy",
      "cratered",
      "ridge",
      "barren"
    ];
    const theme = def.biomeTheme || biomeThemes[Math.floor(rng() * biomeThemes.length)];

    const tints = [
      "#3a4a6a",
      "#5a4a3a",
      "#4a5a6a",
      "#6a5a4a",
      "#3a4a5a",
      "#5a5a6a"
    ];
    const atmosphereTint = def.atmosphereTint || tints[Math.floor(rng() * tints.length)];

    const surfaceBlock = def.surfaceBlock || "minecraft:gravel";
    const bedrockBlock = def.bedrockBlock || "minecraft:bedrock";

    const planet = {
      id: makePlanetId(seed),
      seed,
      name: def.name || "Planet " + makePlanetId(seed).split(":")[1],
      theme,
      radius,
      heightVariation: heightVar,
      surfaceBlock,
      bedrockBlock,
      atmosphereTint,
      gravityModifier: def.gravityModifier ?? 1.0,
      isLandable: def.isLandable ?? true,
      surfacePlateRadius: def.surfacePlateRadiusBlocks || radius,
      surfacePlateThickness: def.surfacePlateThicknessBlocks || 3,
      spawnHeightOffset: def.spawnHeightOffset ?? 4,
      // Set when the surface body is placed.
      origin: null,
      placed: false
    };

    return planet;
  },

  /**
   * Place a landable planet body in the space dimension.
   *
   * The surface representation is a flat cylindrical plate made of the
   * planet's surface block, with localized height variation around the
   * origin and a bedrock core layer underneath.
   *
   * Returns the placed planet metadata if successful.
   */
  async place(target, planetDef) {
    const dim = target.dimension;
    if (dim.id !== SPACE_DIMENSION) {
      throw new Error("Planet placement is only supported in bedrockspace:space.");
    }

    const origin = {
      x: Math.floor(target.location.x),
      y: Math.floor(target.location.y),
      z: Math.floor(target.location.z)
    };

    const plateRadius = Math.max(4, planetDef.surfacePlateRadius || planetDef.radius || 48);
    const thickness = Math.max(1, planetDef.surfacePlateThickness || 3);
    const heightOffset = planetDef.spawnHeightOffset ?? 4;

    const surfaceY = origin.y;
    const coreY = surfaceY - thickness;

    // Build surface plate + height variation around origin.
    const setBlocks = [];
    const radiusSq = plateRadius * plateRadius;

    for (let dx = -plateRadius; dx <= plateRadius; dx++) {
      for (let dz = -plateRadius; dz <= plateRadius; dz++) {
        const distSq = dx * dx + dz * dz;
        if (distSq > radiusSq) continue;

        // Height variation based on distance from center and seed-derived noise.
        const dist = Math.sqrt(distSq);
        const noiseVal = octaveNoise(planetDef.seed, dx, dz);
        const heightDelta = Math.floor((noiseVal - 0.5) * planetDef.heightVariation || 0);
        const topY = surfaceY + heightDelta + heightOffset;

        // Surface layer stack.
        for (let y = coreY; y <= topY; y++) {
          const blockId = (y === topY)
            ? planetDef.surfaceBlock
            : planetDef.bedrockBlock;
          setBlocks.push({
            location: { x: origin.x + dx, y, z: origin.z + dz },
            blockId
          });
        }
      }
    }

    if (setBlocks.length === 0) {
      throw new Error("Planet generation produced no surface blocks.");
    }

    // Apply block changes in the world.
    try {
      await dim.getBlockSets().applyBatch(setBlocks.map(s => ({
        location: s.location,
        block: { name: s.blockId }
      })));
    } catch (err) {
      throw new Error("Failed to place planet surface: " + err.message);
    }

    const placed = Object.assign({}, planetDef, {
      origin,
      placed: true
    });

    Registry.set(placed.id, placed);
    return placed;
  },

  /**
   * Find the planet metadata for a location, if any.
   */
  atLocation(location) {
    for (const [, planet] of Registry.entries()) {
      if (!planet.origin) continue;
      if (!planet.isLandable) continue;

      const dx = location.x - planet.origin.x;
      const dz = location.z - planet.origin.z;
      const distSq = dx * dx + dz * dz;
      const plateRadius = planet.surfacePlateRadius || planet.radius || 48;

      if (distSq <= plateRadius * plateRadius) {
        // Crude height containment: on or above the plate region.
        return planet;
      }
    }
    return null;
  },

  /**
   * Find the nearest landable planet to a location.
   */
  nearest(location) {
    let best = null;
    let bestDistSq = Infinity;

    for (const [, planet] of Registry.entries()) {
      if (!planet.origin) continue;
      if (!planet.isLandable) continue;

      const dx = location.x - planet.origin.x;
      const dz = location.z - planet.origin.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = planet;
      }
    }

    return best;
  },

  /**
   * Return a stable seed from a planet name.
   */
  seedForName(name) {
    return hashSeed(name);
  }
};

/**
 * Simple hash-to-seed helper for string identifiers.
 */
function hashSeed(str) {
  return Kernel.hashStringToSeed(str);
}

/**
 * Cheap 2D pseudo-noise using a couple of hash-derived octaves.
 */
function octaveNoise(seed, x, z) {
  const rng = createRNG(seed);
  // Advance RNG arbitrarily based on coordinates so each column is stable.
  let v = 0;
  let amp = 1;
  let freq = 1;
  for (let i = 0; i < 3; i++) {
    // Move rng state deterministically using coordinates and octave index.
    const localSeed = seed + i * 7919 + x * 17 + z * 31;
    const r = createRNG(localSeed);
    v += r() * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return Math.max(0, Math.min(1, v));
}

export { Planet };
