export const WORLD = {
  width: 1600,
  height: 900,
  killMargin: 180,
} as const;

export const PHYSICS = {
  gravity: 1.35,
  timeStepMs: 1000 / 60,
  positionIterations: 10,
  velocityIterations: 8,
  constraintIterations: 4,
} as const;

export const FIGHTER = {
  maxHealth: 100,
  moveForce: 0.0042,
  airMoveForce: 0.0015,
  maxWalkSpeed: 7.2,
  maxAirSpeed: 6.2,
  jumpSpeed: 11.4,
  coyoteMs: 90,
  stunMs: 280,
  punchCooldownMs: 260,
  punchRange: 58,
  punchDamage: 8,
  punchKnockback: 0.045,
  throwSpeed: 14,
  uprightGain: 0.22,
  uprightDamp: 0.1,
};

export const COLORS = {
  bgTop: "#10182c",
  bgBot: "#070b16",
  platform: "#d9cbb2",
  platformEdge: "#8d7a5e",
  platformShadow: "#3c3228",
  p1: "#ff5a1f",
  p1Ink: "#ff8a4c",
  p2: "#2ec4b6",
  p2Ink: "#7eeae0",
  weapon: "#f4d35e",
  weaponDark: "#c9a227",
  ui: "#f4f1ea",
  dim: "rgba(7, 11, 22, 0.55)",
} as const;

export const PLAYER_COLORS = [COLORS.p1, COLORS.p2] as const;
export const PLAYER_INK = [COLORS.p1Ink, COLORS.p2Ink] as const;
export const PLAYER_NAMES = ["Ember", "Tide"] as const;
