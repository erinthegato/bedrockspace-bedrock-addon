"use strict";
/**
 * space_kernel.js
 *
 * Shared low-level helpers for the BedrockSpace expansion systems:
 *   - deterministic PRNG for reproducible planet/structure generation
 *   - a tiny in-memory registry for runtime space objects
 *   - constant defaults and id helpers for planets, rockets, satellites,
 *     weapons, scrap, and research
 *
 * Everything here is scoped to the space dimension unless noted otherwise.
 */

const SPACE_DIMENSION = "bedrockspace:space";

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) so planet/structure generation is stable.
// ---------------------------------------------------------------------------
function createRNG(seed) {
  let s = seed >>> 0;
  if (s === 0) s = 1;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Tiny runtime registry. This is in-memory only, so values reset on reload.
// It is shared across the new space systems so they can reference each other
// without tight coupling.
// ---------------------------------------------------------------------------
const Registry = {
  _items: new Map(),

  set(key, value) {
    this._items.set(key, value);
  },

  get(key) {
    return this._items.get(key);
  },

  has(key) {
    return this._items.has(key);
  },

  delete(key) {
    return this._items.delete(key);
  },

  clear() {
    this._items.clear();
  },

  /** Return all entries as a plain array of [key, value] pairs. */
  entries() {
    return Array.from(this._items.entries());
  }
};

// ---------------------------------------------------------------------------
// Identifier helpers
// ---------------------------------------------------------------------------
function makePlanetId(seedOrName) {
  const h = typeof seedOrName === "string"
    ? hashStringToSeed(seedOrName)
    : (seedOrName >>> 0) || 1;
  return "bedrockspace:planet_" + h.toString(16);
}

function makeSatelliteId(seed) {
  return "bedrockspace:satellite_" + (seed >>> 0).toString(16);
}

function makeLaunchId(seed) {
  return "bedrockspace:launch_" + (seed >>> 0).toString(16);
}

function makeProjectileId(seed) {
  return "bedrockspace:proj_" + (seed >>> 0).toString(16);
}

// ---------------------------------------------------------------------------
// Constant defaults
// ---------------------------------------------------------------------------

/** Default planet surface/body parameters. */
const PLANET_DEFAULTS = {
  seed: 1,
  name: "Procedural Planet",
  surfaceBlock: "minecraft:gravel",
  bedrockBlock: "minecraft:bedrock",
  baseRadiusBlocks: 48,
  heightVariationBlocks: 12,
  gravityModifier: 1.0,
  atmosphereTint: "#3a4a6a",
  biomeTheme: "rocky",
  isLandable: true,
  // World-editable surface representation is built as a flat cylinder/plate
  // plus localized height variation around the planet origin.
  surfacePlateRadiusBlocks: 48,
  surfacePlateThicknessBlocks: 3,
  spawnHeightOffset: 4
};

/** Research topics available in the tech tree. */
const RESEARCH_TOPICS = [
  { id: "scanning", name: "Space Scanning", description: "Scan nearby planets and objects." },
  { id: "multiblock_launch", name: "Multiblock Rocket Launch", description: "Validate and launch assembled rockets." },
  { id: "satellites", name: "Satellite Builders", description: "Deploy and launch satellites." },
  { id: "weapons", name: "Space Weapons", description: "Railguns, orbital strike, and guided payloads." },
  { id: "scrap", name: "Scrap Recovery", description: "Recover debris and materials." },
  { id: "terraform", name: "Terraforming", description: "Modify planet parameters over time." }
];

/** Scrap resource types produced by destruction. */
const SCRAP_TYPES = [
  { id: "bedrockspace:scrap_metal", name: "Space Scrap Metal", amount: 1 },
  { id: "bedrockspace:scrap_circuit", name: "Space Scrap Circuit", amount: 1 },
  { id: "bedrockspace:scrap_alloy", name: "Space Scrap Alloy", amount: 1 }
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export const SpaceKernel = {
  SPACE_DIMENSION,
  createRNG,
  hashStringToSeed,
  Registry,
  makePlanetId,
  makeSatelliteId,
  makeLaunchId,
  makeProjectileId,
  PLANET_DEFAULTS,
  RESEARCH_TOPICS,
  SCRAP_TYPES
};
