import Matter from "matter-js";
import { COLORS } from "./config";
import { setUserData, type WeaponDef, type WeaponKind } from "./types";

export const WEAPON_DEFS: Record<WeaponKind, WeaponDef> = {
  fists: { kind: "fists", name: "Fists", ammo: Infinity, cooldownMs: 260, automatic: false, melee: true, holdable: false },
  pistol: { kind: "pistol", name: "Pistol", ammo: 8, cooldownMs: 220, automatic: false, melee: false, holdable: true },
  shotgun: { kind: "shotgun", name: "Scattergun", ammo: 4, cooldownMs: 520, automatic: false, melee: false, holdable: true },
  smg: { kind: "smg", name: "Buzzgun", ammo: 18, cooldownMs: 70, automatic: true, melee: false, holdable: true },
  bat: { kind: "bat", name: "Bat", ammo: Infinity, cooldownMs: 360, automatic: false, melee: true, holdable: true },
  rocket: { kind: "rocket", name: "Boom Tube", ammo: 2, cooldownMs: 640, automatic: false, melee: false, holdable: true },
  glove: { kind: "glove", name: "Glove Cannon", ammo: 5, cooldownMs: 400, automatic: false, melee: false, holdable: true },
  banana: { kind: "banana", name: "Banana", ammo: 3, cooldownMs: 280, automatic: false, melee: false, holdable: true },
};

export const SPAWNABLE: WeaponKind[] = ["pistol", "shotgun", "smg", "bat", "rocket", "glove", "banana"];

let lootSeq = 1;
let projSeq = 1;

export function randomWeapon(): WeaponKind {
  return SPAWNABLE[Math.floor(Math.random() * SPAWNABLE.length)]!;
}

export function createLoot(x: number, y: number, kind: WeaponKind): Matter.Body {
  const body = Matter.Bodies.rectangle(x, y, 28, 12, {
    density: 0.0012,
    friction: 0.6,
    restitution: 0.25,
    frictionAir: 0.02,
    label: `loot-${kind}`,
    chamfer: { radius: 3 },
  });
  setUserData(body, { kind: "loot", lootId: lootSeq++, weapon: kind });
  Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);
  return body;
}

export interface FireRequest {
  x: number;
  y: number;
  angle: number;
  ownerId: number;
  weapon: WeaponKind;
}

export function spawnProjectiles(req: FireRequest): Matter.Body[] {
  const { x, y, angle, ownerId, weapon } = req;
  const bodies: Matter.Body[] = [];
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };

  const make = (
    px: number,
    py: number,
    vx: number,
    vy: number,
    opts: {
      r?: number;
      w?: number;
      h?: number;
      damage: number;
      knockback: number;
      explosive?: boolean;
      radius?: number;
      peel?: boolean;
      density?: number;
    },
  ): Matter.Body => {
    const body = opts.w
      ? Matter.Bodies.rectangle(px, py, opts.w, opts.h ?? 8, {
          density: opts.density ?? 0.001,
          frictionAir: 0.002,
          restitution: 0.1,
          isSensor: true,
          label: `proj-${weapon}-${projSeq++}`,
        })
      : Matter.Bodies.circle(px, py, opts.r ?? 3.5, {
          density: opts.density ?? 0.0008,
          frictionAir: 0.002,
          restitution: 0.05,
          isSensor: true,
          label: `proj-${weapon}-${projSeq++}`,
        });
    setUserData(body, {
      kind: "projectile",
      ownerId,
      weapon,
      damage: opts.damage,
      knockback: opts.knockback,
      explosive: opts.explosive,
      radius: opts.radius,
      peel: opts.peel,
    });
    Matter.Body.setVelocity(body, { x: vx, y: vy });
    Matter.Body.setAngle(body, angle);
    bodies.push(body);
    return body;
  };

  if (weapon === "pistol") {
    make(x + dir.x * 18, y + dir.y * 18, dir.x * 22, dir.y * 22, { r: 3.2, damage: 12, knockback: 0.028 });
  } else if (weapon === "shotgun") {
    for (let i = 0; i < 6; i++) {
      const spread = (i - 2.5) * 0.09 + (Math.random() - 0.5) * 0.05;
      const a = angle + spread;
      make(x + Math.cos(a) * 16, y + Math.sin(a) * 16, Math.cos(a) * 20, Math.sin(a) * 20, {
        r: 2.6,
        damage: 7,
        knockback: 0.018,
      });
    }
  } else if (weapon === "smg") {
    const a = angle + (Math.random() - 0.5) * 0.12;
    make(x + Math.cos(a) * 16, y + Math.sin(a) * 16, Math.cos(a) * 24, Math.sin(a) * 24, {
      r: 2.8,
      damage: 6,
      knockback: 0.014,
    });
  } else if (weapon === "rocket") {
    make(x + dir.x * 22, y + dir.y * 22, dir.x * 13, dir.y * 13, {
      w: 18,
      h: 8,
      damage: 18,
      knockback: 0.04,
      explosive: true,
      radius: 150,
      density: 0.002,
    });
  } else if (weapon === "glove") {
    make(x + dir.x * 20, y + dir.y * 20, dir.x * 16, dir.y * 16, {
      r: 10,
      damage: 20,
      knockback: 0.085,
      density: 0.003,
    });
  } else if (weapon === "banana") {
    make(x + dir.x * 16, y + dir.y * 16, dir.x * 12, dir.y * 12 - 3, {
      w: 16,
      h: 8,
      damage: 10,
      knockback: 0.03,
      peel: true,
      density: 0.001,
    });
    Matter.Body.setAngularVelocity(bodies[0]!, 0.4);
  }
  return bodies;
}

export function recoilFor(weapon: WeaponKind): number {
  switch (weapon) {
    case "pistol":
      return 0.018;
    case "shotgun":
      return 0.09;
    case "smg":
      return 0.012;
    case "rocket":
      return 0.055;
    case "glove":
      return 0.05;
    case "banana":
      return 0.01;
    default:
      return 0;
  }
}

export function drawWeaponIcon(
  ctx: CanvasRenderingContext2D,
  kind: WeaponKind,
  x: number,
  y: number,
  angle: number,
  scale = 1,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (kind === "pistol") {
    ctx.fillStyle = COLORS.weaponDark;
    ctx.fillRect(-4, -4, 22, 8);
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(2, 2, 6, 10);
  } else if (kind === "shotgun") {
    ctx.fillStyle = "#6b4f2a";
    ctx.fillRect(-8, -4, 34, 8);
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(-2, 3, 8, 9);
  } else if (kind === "smg") {
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(-6, -4, 26, 8);
    ctx.fillRect(4, 4, 4, 8);
    ctx.fillStyle = COLORS.weapon;
    ctx.fillRect(14, -3, 8, 6);
  } else if (kind === "bat") {
    ctx.strokeStyle = "#c9893a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(28, 0);
    ctx.stroke();
    ctx.strokeStyle = "#7a4a18";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(28, 0);
    ctx.stroke();
  } else if (kind === "rocket") {
    ctx.fillStyle = "#c44536";
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(16, -5);
    ctx.lineTo(22, 0);
    ctx.lineTo(16, 5);
    ctx.lineTo(-10, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#eee";
    ctx.fillRect(-14, -5, 8, 10);
  } else if (kind === "glove") {
    ctx.fillStyle = "#e63946";
    ctx.beginPath();
    ctx.arc(8, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-8, -5, 14, 10);
  } else if (kind === "banana") {
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(4, 4, 12, -Math.PI * 0.9, Math.PI * 0.15);
    ctx.stroke();
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-6, -4, 3, 0, Math.PI);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#f4f1ea";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPeel(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#ffe066";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (const a of [-0.6, 0, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.sin(a) * 12, 8, Math.sin(a) * 16, 4);
    ctx.stroke();
  }
  ctx.restore();
}
