"use strict";
/**
 * space_research.js
 *
 * Research/tech progression for bedrockspace:space.
 *
 * Design (default choices):
 *   - Command-driven tech tree with a simple UI view.
 *   - Unlocks gate scanning, multiblock launch, satellite building, weapons,
 *     and terraforming.
 *   - Progress is stored in-memory in the behavior pack runtime registry.
 *
 * This module assumes space_kernel.js is available.
 */

const Kernel = require("./space_kernel.js").SpaceKernel;
const { Registry, RESEARCH_TOPICS, SCRAP_TYPES } = Kernel;

const RESEARCH_STATE_UNAVAILABLE = "unavailable";
const RESEARCH_STATE_LOCKED = "locked";
const RESEARCH_STATE_AVAILABLE = "available";
const RESEARCH_STATE_COMPLETED = "completed";

const Research = {
  storeKey: "bedrockspace:research_state",

  /**
   * Return the full research tree with current player progress.
   */
  tree(player) {
    const state = this._ensureState(player);
    return RESEARCH_TOPICS.map(topic => {
      const entry = state.topics[topic.id] || {
        state: RESEARCH_STATE_UNAVAILABLE,
        progress: 0
      };
      return {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        state: entry.state,
        progress: entry.progress ?? 0
      };
    });
  },

  /**
   * View research for a player.
   */
  view(player, options) {
    const tree = this.tree(player);
    if (options?.compact) {
      return tree.map(t => ({
        id: t.id,
        state: t.state
      }));
    }
    return tree;
  },

  /**
   * Start working on a research topic.
   */
  start(player, topicId) {
    const state = this._ensureState(player);
    const topic = RESEARCH_TOPICS.find(t => t.id === topicId);
    if (!topic) {
      throw new Error("Unknown research topic: " + topicId);
    }

    const entry = state.topics[topicId];
    if (!entry) {
      state.topics[topicId] = {
        state: RESEARCH_STATE_AVAILABLE,
        progress: 0
      };
    } else if (entry.state === RESEARCH_STATE_COMPLETED) {
      throw new Error("Research already completed: " + topicId);
    } else if (entry.state === RESEARCH_STATE_UNAVAILABLE) {
      throw new Error("Research is unavailable: " + topicId);
    }

    entry.state = RESEARCH_STATE_AVAILABLE;
    entry.progress = entry.progress ?? 0;
    this._saveState(player, state);
    return this.tree(player).find(t => t.id === topicId);
  },

  /**
   * Advance research progress.
   */
  advance(player, topicId, amount) {
    const state = this._ensureState(player);
    const entry = state.topics[topicId];
    if (!entry) {
      throw new Error("Research topic not started: " + topicId);
    }
    if (entry.state === RESEARCH_STATE_COMPLETED) {
      throw new Error("Research already completed: " + topicId);
    }
    if (entry.state !== RESEARCH_STATE_AVAILABLE) {
      throw new Error("Research is not available: " + topicId);
    }

    const increment = Math.max(0, Number(amount) || 1);
    entry.progress = Math.min(100, (entry.progress ?? 0) + increment);

    if (entry.progress >= 100) {
      entry.state = RESEARCH_STATE_COMPLETED;
    }

    this._saveState(player, state);
    return this.tree(player).find(t => t.id === topicId);
  },

  /**
   * Check whether a topic is completed.
   */
  isCompleted(player, topicId) {
    const state = this._ensureState(player);
    const entry = state.topics[topicId];
    return entry != null && entry.state === RESEARCH_STATE_COMPLETED;
  },

  /**
   * Return unlock flags derived from completed research.
   */
  unlocks(player) {
    const completed = new Set();
    for (const topic of RESEARCH_TOPICS) {
      if (this.isCompleted(player, topic.id)) {
        completed.add(topic.id);
      }
    }
    return {
      scanning: completed.has("scanning"),
      multiblockLaunch: completed.has("multiblock_launch"),
      satellites: completed.has("satellites"),
      weapons: completed.has("weapons"),
      scrap: completed.has("scrap"),
      terraform: completed.has("terraform")
    };
  },

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  _ensureState(player) {
    const existing = Registry.get(this.storeKey + "::" + player.id);
    if (existing) {
      return existing;
    }
    return {
      playerId: player.id,
      topics: {}
    };
  },

  _saveState(player, state) {
    Registry.set(this.storeKey + "::" + player.id, state);
  }
};

export { Research };
