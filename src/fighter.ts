import Matter from "matter-js";
import { COLORS, FIGHTER, PLAYER_COLORS, PLAYER_INK, PLAYER_NAMES } from "./config";
import type { Input, PlayerBinds } from "./input";
import { getUserData, setUserData, type PartName, type WeaponKind } from "./types";
import { drawWeaponIcon, WEAPON_DEFS } from "./weapons";

export interface FighterParts {
  head: Matter.Body;
  torso: Matter.Body;
  upperArmL: Matter.Body;
  lowerArmL: Matter.Body;
  upperArmR: Matter.Body;
  lowerArmR: Matter.Body;
  upperLegL: Matter.Body;
  lowerLegL: Matter.Body;
  upperLegR: Matter.Body;
  lowerLegR: Matter.Body;
}

export class Fighter {
  readonly id: number;
  readonly name: string;
  readonly color: string;
  readonly ink: string;
  readonly binds: PlayerBinds;
  composite: Matter.Composite;
  parts: FighterParts;
  constraints: Matter.Constraint[] = [];
  alive = true;
  health = FIGHTER.maxHealth;
  facing = 1;
  grounded = false;
  coyote = 0;
  stunnedUntil = 0;
  punchUntil = 0;
  nextFireAt = 0;
  weapon: WeaponKind = "fists";
  ammo = Infinity;
  deadAt = 0;
  actionHeld = false;

  constructor(id: number, x: number, y: number, binds: PlayerBinds) {
    this.id = id;
    this.name = PLAYER_NAMES[id] ?? `P${id + 1}`;
    this.color = PLAYER_COLORS[id] ?? COLORS.p1;
    this.ink = PLAYER_INK[id] ?? COLORS.p1Ink;
    this.binds = binds;
    const built = buildRagdoll(x, y, id);
    this.composite = built.composite;
    this.parts = built.parts;
    this.constraints = built.constraints;
  }

  get torso(): Matter.Body {
    return this.parts.torso;
  }

  handPos(): { x: number; y: number } {
    const arm = this.facing >= 0 ? this.parts.lowerArmR : this.parts.lowerArmL;
    const along = this.facing >= 0 ? 1 : -1;
    return {
      x: arm.position.x + Math.cos(arm.angle) * 10 * along,
      y: arm.position.y + Math.sin(arm.angle) * 10,
    };
  }

  allBodies(): Matter.Body[] {
    return [
      this.parts.head,
      this.parts.torso,
      this.parts.upperArmL,
      this.parts.lowerArmL,
      this.parts.upperArmR,
      this.parts.lowerArmR,
      this.parts.upperLegL,
      this.parts.lowerLegL,
      this.parts.upperLegR,
      this.parts.lowerLegR,
    ];
  }

  owns(body: Matter.Body): boolean {
    const d = getUserData(body);
    return d?.kind === "part" && d.fighterId === this.id;
  }

  setGrounded(now: number, grounded: boolean): void {
    this.grounded = grounded;
    if (grounded) this.coyote = now + FIGHTER.coyoteMs;
  }

  canControl(now: number): boolean {
    return this.alive && now >= this.stunnedUntil;
  }

  stun(now: number, ms = FIGHTER.stunMs): void {
    this.stunnedUntil = Math.max(this.stunnedUntil, now + ms);
  }

  damage(amount: number, now: number): void {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.kill(now);
  }

  kill(now: number): void {
    if (!this.alive) return;
    this.alive = false;
    this.deadAt = now;
    for (const c of this.constraints) {
      c.stiffness = 0.35;
      c.damping = 0.02;
    }
  }

  equip(kind: WeaponKind): void {
    this.weapon = kind;
    this.ammo = WEAPON_DEFS[kind].ammo;
  }

  dropWeapon(): WeaponKind | null {
    if (this.weapon === "fists") return null;
    const dropped = this.weapon;
    this.weapon = "fists";
    this.ammo = Infinity;
    return dropped;
  }

  consumeAmmo(): boolean {
    if (this.weapon === "fists") return true;
    if (!Number.isFinite(this.ammo)) return true;
    if (this.ammo <= 0) {
      this.weapon = "fists";
      this.ammo = Infinity;
      return false;
    }
    this.ammo -= 1;
    if (this.ammo <= 0 && !WEAPON_DEFS[this.weapon].melee) {
      this.weapon = "fists";
      this.ammo = Infinity;
    }
    return true;
  }

  applyControls(input: Input, now: number): { jump: boolean; action: boolean; throwWeapon: boolean; move: number } {
    const left = input.isDown(this.binds.left);
    const right = input.isDown(this.binds.right);
    const jumpHeld = input.isDown(this.binds.up);
    const jumpPressed = input.justPressed(this.binds.up);
    const down = input.isDown(this.binds.down);
    const actionDown = this.binds.action.some((c) => input.isDown(c));
    const actionPressed = this.binds.action.some((c) => input.justPressed(c));
    let move = 0;
    if (left) move -= 1;
    if (right) move += 1;
    if (move !== 0 && this.canControl(now)) this.facing = move;

    if (!this.canControl(now)) {
      this.actionHeld = actionDown;
      return { jump: false, action: false, throwWeapon: false, move: 0 };
    }

    const force = this.grounded ? FIGHTER.moveForce : FIGHTER.airMoveForce;
    if (move !== 0) {
      Matter.Body.applyForce(this.torso, this.torso.position, {
        x: move * force * this.torso.mass,
        y: 0,
      });
    }
    const maxV = this.grounded ? FIGHTER.maxWalkSpeed : FIGHTER.maxAirSpeed;
    if (Math.abs(this.torso.velocity.x) > maxV) {
      Matter.Body.setVelocity(this.torso, {
        x: Math.sign(this.torso.velocity.x) * maxV,
        y: this.torso.velocity.y,
      });
    }

    keepUpright(this.torso);
    poseLegs(this, now, move);
    poseArms(this, now);

    let jump = false;
    if (jumpPressed && now <= this.coyote) {
      Matter.Body.setVelocity(this.torso, { x: this.torso.velocity.x, y: -FIGHTER.jumpSpeed });
      Matter.Body.setVelocity(this.parts.head, { x: this.parts.head.velocity.x, y: -FIGHTER.jumpSpeed * 0.9 });
      this.coyote = 0;
      jump = true;
    } else if (jumpHeld && this.torso.velocity.y < -1) {
      Matter.Body.applyForce(this.torso, this.torso.position, { x: 0, y: -0.0006 * this.torso.mass });
    }

    const throwWeapon = actionPressed && down && this.weapon !== "fists";
    const def = WEAPON_DEFS[this.weapon];
    const action = throwWeapon
      ? false
      : def.automatic
        ? actionDown && now >= this.nextFireAt
        : actionPressed && now >= this.nextFireAt;

    this.actionHeld = actionDown;
    return { jump, action, throwWeapon, move };
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    const p = this.parts;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = this.alive ? this.color : shade(this.color, 0.45);
    ctx.fillStyle = this.alive ? this.color : shade(this.color, 0.45);

    const width = this.alive ? 6.2 : 5.4;
    ctx.lineWidth = width;
    line(ctx, p.upperLegL.position, p.lowerLegL.position);
    line(ctx, p.lowerLegL.position, footOf(p.lowerLegL));
    line(ctx, p.upperLegR.position, p.lowerLegR.position);
    line(ctx, p.lowerLegR.position, footOf(p.lowerLegR));
    line(ctx, hip(p), p.torso.position);
    line(ctx, p.torso.position, p.head.position);
    line(ctx, p.upperArmL.position, p.lowerArmL.position);
    line(ctx, p.lowerArmL.position, handOf(p.lowerArmL, -1));
    line(ctx, p.upperArmR.position, p.lowerArmR.position);
    line(ctx, p.lowerArmR.position, handOf(p.lowerArmR, 1));

    ctx.beginPath();
    ctx.arc(p.head.position.x, p.head.position.y, 10.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0b1020";
    const eye = this.facing >= 0 ? 3.2 : -3.2;
    ctx.beginPath();
    ctx.arc(p.head.position.x + eye, p.head.position.y - 1.5, 1.8, 0, Math.PI * 2);
    ctx.arc(p.head.position.x + eye + this.facing * 4.2, p.head.position.y - 1.2, 1.8, 0, Math.PI * 2);
    ctx.fill();

    if (this.alive && now < this.punchUntil) {
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.handPos().x, this.handPos().y, 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.alive && this.weapon !== "fists") {
      const hand = this.handPos();
      drawWeaponIcon(ctx, this.weapon, hand.x, hand.y, this.facing >= 0 ? 0 : Math.PI, 1);
    }

    if (this.alive) {
      const hx = p.head.position.x;
      const hy = p.head.position.y - 22;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(hx - 16, hy - 5, 32, 5);
      ctx.fillStyle = this.color;
      ctx.fillRect(hx - 16, hy - 5, 32 * (this.health / FIGHTER.maxHealth), 5);
    }
    ctx.restore();
  }
}

function buildRagdoll(x: number, y: number, id: number): {
  composite: Matter.Composite;
  parts: FighterParts;
  constraints: Matter.Constraint[];
} {
  const group = Matter.Body.nextGroup(true);
  const opts = (part: PartName, extra?: Matter.IChamferableBodyDefinition): Matter.IChamferableBodyDefinition => ({
    collisionFilter: { group },
    friction: 0.75,
    frictionAir: 0.04,
    restitution: 0.12,
    density: 0.0022,
    label: `p${id}-${part}`,
    ...extra,
  });

  const head = Matter.Bodies.circle(x, y - 36, 9, opts("head", { density: 0.0018, frictionAir: 0.05 }));
  const torso = Matter.Bodies.rectangle(x, y - 12, 10, 26, opts("torso", { density: 0.0032, chamfer: { radius: 4 } }));
  const upperArmL = Matter.Bodies.rectangle(x - 12, y - 18, 6, 16, opts("upperArmL", { density: 0.0014 }));
  const lowerArmL = Matter.Bodies.rectangle(x - 12, y - 2, 5.5, 16, opts("lowerArmL", { density: 0.0012 }));
  const upperArmR = Matter.Bodies.rectangle(x + 12, y - 18, 6, 16, opts("upperArmR", { density: 0.0014 }));
  const lowerArmR = Matter.Bodies.rectangle(x + 12, y - 2, 5.5, 16, opts("lowerArmR", { density: 0.0012 }));
  const upperLegL = Matter.Bodies.rectangle(x - 6, y + 12, 7, 18, opts("upperLegL", { density: 0.002 }));
  const lowerLegL = Matter.Bodies.rectangle(x - 6, y + 30, 6, 18, opts("lowerLegL", { density: 0.0018 }));
  const upperLegR = Matter.Bodies.rectangle(x + 6, y + 12, 7, 18, opts("upperLegR", { density: 0.002 }));
  const lowerLegR = Matter.Bodies.rectangle(x + 6, y + 30, 6, 18, opts("lowerLegR", { density: 0.0018 }));

  const parts: FighterParts = {
    head,
    torso,
    upperArmL,
    lowerArmL,
    upperArmR,
    lowerArmR,
    upperLegL,
    lowerLegL,
    upperLegR,
    lowerLegR,
  };

  const map: [Matter.Body, PartName][] = [
    [head, "head"],
    [torso, "torso"],
    [upperArmL, "upperArmL"],
    [lowerArmL, "lowerArmL"],
    [upperArmR, "upperArmR"],
    [lowerArmR, "lowerArmR"],
    [upperLegL, "upperLegL"],
    [lowerLegL, "lowerLegL"],
    [upperLegR, "upperLegR"],
    [lowerLegR, "lowerLegR"],
  ];
  for (const [body, part] of map) setUserData(body, { kind: "part", fighterId: id, part });

  const joint = (
    a: Matter.Body,
    b: Matter.Body,
    pa: Matter.Vector,
    pb: Matter.Vector,
    stiffness = 0.86,
  ): Matter.Constraint =>
    Matter.Constraint.create({
      bodyA: a,
      bodyB: b,
      pointA: pa,
      pointB: pb,
      stiffness,
      damping: 0.08,
      length: 1.5,
      render: { visible: false },
    });

  const constraints = [
    joint(head, torso, { x: 0, y: 9 }, { x: 0, y: -14 }, 0.92),
    joint(torso, upperArmL, { x: -6, y: -10 }, { x: 0, y: -7 }, 0.7),
    joint(upperArmL, lowerArmL, { x: 0, y: 8 }, { x: 0, y: -8 }, 0.72),
    joint(torso, upperArmR, { x: 6, y: -10 }, { x: 0, y: -7 }, 0.7),
    joint(upperArmR, lowerArmR, { x: 0, y: 8 }, { x: 0, y: -8 }, 0.72),
    joint(torso, upperLegL, { x: -4, y: 13 }, { x: 0, y: -8 }, 0.84),
    joint(upperLegL, lowerLegL, { x: 0, y: 9 }, { x: 0, y: -8 }, 0.82),
    joint(torso, upperLegR, { x: 4, y: 13 }, { x: 0, y: -8 }, 0.84),
    joint(upperLegR, lowerLegR, { x: 0, y: 9 }, { x: 0, y: -8 }, 0.82),
  ];

  const composite = Matter.Composite.create({ label: `fighter-${id}` });
  Matter.Composite.add(composite, [...map.map(([b]) => b), ...constraints]);
  return { composite, parts, constraints };
}

function keepUpright(torso: Matter.Body): void {
  const err = torso.angle;
  const av = torso.angularVelocity;
  Matter.Body.setAngularVelocity(torso, av - err * FIGHTER.uprightGain - av * FIGHTER.uprightDamp);
  if (Math.abs(torso.angle) > 0.9) {
    Matter.Body.setAngle(torso, Math.sign(torso.angle) * 0.9);
  }
}

function poseLegs(f: Fighter, now: number, move: number): void {
  if (!f.grounded) return;
  const t = now / 90;
  const swing = move === 0 ? 0.04 : 0.22;
  Matter.Body.setAngularVelocity(f.parts.upperLegL, Math.sin(t) * swing);
  Matter.Body.setAngularVelocity(f.parts.upperLegR, Math.sin(t + Math.PI) * swing);
}

function poseArms(f: Fighter, now: number): void {
  if (now < f.punchUntil) {
    const punchArm = f.facing >= 0 ? f.parts.upperArmR : f.parts.upperArmL;
    Matter.Body.setAngularVelocity(punchArm, f.facing * 0.55);
    return;
  }
  const idle = Math.sin(now / 220) * 0.03;
  Matter.Body.setAngularVelocity(f.parts.upperArmL, idle);
  Matter.Body.setAngularVelocity(f.parts.upperArmR, -idle);
}

function line(ctx: CanvasRenderingContext2D, a: Matter.Vector, b: Matter.Vector): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function hip(p: FighterParts): Matter.Vector {
  return { x: p.torso.position.x, y: p.torso.position.y + 12 };
}

function footOf(leg: Matter.Body): Matter.Vector {
  return {
    x: leg.position.x + Math.sin(leg.angle) * 10,
    y: leg.position.y + Math.cos(leg.angle) * 10,
  };
}

function handOf(arm: Matter.Body, side: number): Matter.Vector {
  return {
    x: arm.position.x + Math.sin(arm.angle) * 9 * side,
    y: arm.position.y + Math.cos(arm.angle) * 9,
  };
}

function shade(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * t);
  const g = Math.round(((n >> 8) & 255) * t);
  const b = Math.round((n & 255) * t);
  return `rgb(${r},${g},${b})`;
}
