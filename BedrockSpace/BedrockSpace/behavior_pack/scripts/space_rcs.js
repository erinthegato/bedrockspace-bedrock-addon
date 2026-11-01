/**
 * Space RCS integration for the BedrockSpace dimension.
 *
 * Loads the shared Minecoins RCS controller so the player RCS state lives in the
 * Minecoins pack's player dynamic property namespace, while the space dimension
 * tick applies thrust above the low-gravity baseline already provided by the
 * BedrockSpace gravity module.
 *
 * This file is intentionally thin: it only re-exposes the Minecoins controller's
 * API inside the BedrockSpace script context and ensures the shared tick hook is
 * registered once.
 */

const RCS = (() => {
  try {
    return require("../Minecoins/behavior_pack/scripts/rcs_controller.js");
  } catch {
    return null;
  }
})();

export const isRCSAvailable = () => !!RCS;

export function enable(player) {
  RCS?.enable(player);
}

export function disable(player) {
  RCS?.disable(player);
}

export function setAxis(player, axis, on) {
  RCS?.setAxis(player, axis, on);
}

export function setSlew(player, mode) {
  RCS?.setSlew(player, mode);
}

export function setPower(player, amount) {
  RCS?.setPower(player, amount);
}

export function snapshot(player) {
  RCS?.snapshot(player);
}

export function initialize() {
  RCS?.initialize();
}
