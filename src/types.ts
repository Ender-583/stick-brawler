import type Matter from "matter-js";

export type GameMode = "countdown" | "fight" | "roundOver";

export type WeaponKind =
  | "fists"
  | "pistol"
  | "shotgun"
  | "smg"
  | "bat"
  | "rocket"
  | "glove"
  | "banana";

export type PartName =
  | "head"
  | "torso"
  | "upperArmL"
  | "lowerArmL"
  | "upperArmR"
  | "lowerArmR"
  | "upperLegL"
  | "lowerLegL"
  | "upperLegR"
  | "lowerLegR";

export type BodyUserData =
  | { kind: "platform" }
  | { kind: "part"; fighterId: number; part: PartName }
  | { kind: "loot"; lootId: number; weapon: WeaponKind }
  | {
      kind: "projectile";
      ownerId: number;
      weapon: WeaponKind;
      damage: number;
      knockback: number;
      explosive?: boolean;
      radius?: number;
      peel?: boolean;
    }
  | { kind: "peel"; until: number };

export type GameBody = Matter.Body & { userData?: BodyUserData };

export function setUserData(body: Matter.Body, data: BodyUserData): GameBody {
  const gb = body as GameBody;
  gb.userData = data;
  return gb;
}

export function getUserData(body: Matter.Body | null | undefined): BodyUserData | undefined {
  if (!body) return undefined;
  return (body as GameBody).userData;
}

export interface WeaponDef {
  kind: WeaponKind;
  name: string;
  ammo: number;
  cooldownMs: number;
  automatic: boolean;
  melee: boolean;
  holdable: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: "spark" | "ink" | "sparkle" | "flash" | "ring" | "smoke";
  angle?: number;
  rot?: number;
}
