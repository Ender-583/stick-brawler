import Matter from "matter-js";
import { Arena } from "./arena";
import { AudioBus } from "./audio";
import { Camera } from "./camera";
import { COLORS, FIGHTER, WORLD } from "./config";
import { createEngine, stepEngine } from "./physics";
import { Effects } from "./effects";
import { Fighter } from "./fighter";
import { Input, P1_BINDS, P2_BINDS } from "./input";
import {
  getUserData,
  setUserData,
  type GameMode,
  type WeaponKind,
} from "./types";
import {
  createLoot,
  drawPeel,
  drawWeaponIcon,
  randomWeapon,
  recoilFor,
  spawnProjectiles,
  WEAPON_DEFS,
} from "./weapons";

interface LootItem {
  id: number;
  body: Matter.Body;
  weapon: WeaponKind;
}

interface PeelItem {
  body: Matter.Body;
  until: number;
}

export class Game {
  readonly input = new Input();
  readonly audio = new AudioBus();
  readonly camera = new Camera();
  readonly effects = new Effects();
  readonly arena = new Arena();
  engine: Matter.Engine;
  world: Matter.World;
  fighters: Fighter[] = [];
  loot: LootItem[] = [];
  peels: PeelItem[] = [];
  projectiles: Matter.Body[] = [];
  scores = [0, 0];
  mode: GameMode = "countdown";
  paused = false;
  muted = false;
  countdown = 3;
  countdownAcc = 0;
  winner: number | null = null;
  nextWeaponAt = 0;
  now = 0;
  private accumulator = 0;

  constructor() {
    this.engine = createEngine();
    this.world = this.engine.world;
    this.arena.addToWorld(this.world);
    this.bindCollisions();
    this.resetRound(true);
  }

  attach(canvas: HTMLCanvasElement): void {
    this.input.attach(window);
    canvas.addEventListener("pointerdown", () => {
      this.audio.unlock();
      canvas.focus();
    });
  }

  update(dt: number): void {
    this.now += dt * 1000;
    if (this.input.justPressed("KeyM")) {
      this.muted = this.audio.toggleMute();
    }
    if (this.input.anyPressed("Escape", "KeyP")) {
      if (this.mode === "fight" || this.paused) this.paused = !this.paused;
    }
    if (this.paused) {
      this.input.endFrame();
      return;
    }

    if (this.mode === "countdown") {
      this.countdownAcc += dt;
      if (this.countdownAcc >= 1) {
        this.countdownAcc = 0;
        this.countdown -= 1;
        if (this.countdown > 0) this.audio.tick();
        else if (this.countdown === 0) this.audio.fight();
        else {
          this.mode = "fight";
          this.nextWeaponAt = this.now + 900;
        }
      }
      this.controlFighters(false);
      this.stepPhysics(dt);
      this.updateGrounded();
      this.checkFalls();
      this.cameraFollow();
      this.effects.update(dt);
      this.input.endFrame();
      return;
    }

    if (this.mode === "roundOver") {
      if (this.input.anyPressed("KeyR", "Space", "Enter", "KeyF", "KeyL")) {
        this.resetRound(false);
      }
      this.stepPhysics(dt);
      this.cameraFollow();
      this.effects.update(dt);
      this.input.endFrame();
      return;
    }

    if (this.effects.hitstop > 0) {
      this.effects.update(dt);
      this.camera.update(dt);
      this.input.endFrame();
      return;
    }

    this.controlFighters(true);
    this.spawnWeapons();
    this.stepPhysics(dt);
    this.updateGrounded();
    this.tickProjectiles();
    this.tickPeels();
    this.checkFalls();
    this.cameraFollow();
    this.effects.update(dt);
    this.checkWinner();
    this.input.endFrame();
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    this.camera.apply(ctx, w, h);
    this.arena.draw(ctx);
    for (const peel of this.peels) drawPeel(ctx, peel.body.position.x, peel.body.position.y);
    for (const item of this.loot) {
      const d = getUserData(item.body);
      if (d?.kind === "loot") {
        drawWeaponIcon(ctx, d.weapon, item.body.position.x, item.body.position.y, item.body.angle, 1.15);
      }
    }
    for (const p of this.projectiles) this.drawProjectile(ctx, p);
    for (const f of this.fighters) f.draw(ctx, this.now);
    this.effects.draw(ctx);
    ctx.restore();
    this.drawHud(ctx, w, h);
  }

  private stepPhysics(dt: number): void {
    this.accumulator = stepEngine(this.engine, this.accumulator, dt);
  }

  private controlFighters(allowAction: boolean): void {
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const { jump, action, throwWeapon } = f.applyControls(this.input, this.now);
      if (jump) this.audio.jump();
      if (!allowAction) continue;
      if (throwWeapon) this.throwWeapon(f);
      else if (action) this.useAction(f);
    }
  }

  private useAction(f: Fighter): void {
    const nearby = this.findNearbyLoot(f);
    if (nearby && (f.weapon === "fists" || WEAPON_DEFS[f.weapon].melee || f.ammo <= 0)) {
      this.pickup(f, nearby);
      return;
    }
    if (nearby && f.weapon !== "fists" && this.input.isDown(f.binds.down)) {
      this.pickup(f, nearby);
      return;
    }
    const def = WEAPON_DEFS[f.weapon];
    f.nextFireAt = this.now + def.cooldownMs;
    if (def.melee) {
      this.melee(f);
      return;
    }
    this.fire(f);
  }

  private pickup(f: Fighter, item: LootItem): void {
    const dropped = f.dropWeapon();
    if (dropped) this.dropLootAt(f, dropped);
    f.equip(item.weapon);
    Matter.Composite.remove(this.world, item.body);
    this.loot = this.loot.filter((l) => l !== item);
    this.audio.pickup();
    this.effects.sparkles(f.torso.position.x, f.torso.position.y - 20, 10);
  }

  private throwWeapon(f: Fighter): void {
    const kind = f.dropWeapon();
    if (!kind) return;
    const hand = f.handPos();
    const body = createLoot(hand.x, hand.y, kind);
    Matter.Body.setVelocity(body, { x: f.facing * 14, y: -4 });
    Matter.Body.setAngularVelocity(body, f.facing * 0.35);
    Matter.Composite.add(this.world, body);
    this.loot.push({ id: (getUserData(body) as { lootId: number }).lootId, body, weapon: kind });
    f.nextFireAt = this.now + 200;
    this.audio.swing();
  }

  private dropLootAt(f: Fighter, kind: WeaponKind): void {
    const body = createLoot(f.torso.position.x, f.torso.position.y - 8, kind);
    Matter.Body.setVelocity(body, { x: -f.facing * 3, y: -2 });
    Matter.Composite.add(this.world, body);
    this.loot.push({ id: (getUserData(body) as { lootId: number }).lootId, body, weapon: kind });
  }

  private findNearbyLoot(f: Fighter): LootItem | null {
    let best: LootItem | null = null;
    let bestD = 46;
    for (const item of this.loot) {
      const dx = item.body.position.x - f.torso.position.x;
      const dy = item.body.position.y - f.torso.position.y;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  }

  private melee(f: Fighter): void {
    f.punchUntil = this.now + 140;
    const isBat = f.weapon === "bat";
    if (isBat) this.audio.swing();
    else this.audio.punch();
    const origin = f.torso.position;
    const reach = isBat ? 86 : FIGHTER.punchRange;
    const damage = isBat ? 16 : FIGHTER.punchDamage;
    const knock = isBat ? 0.07 : FIGHTER.punchKnockback;
    let hit = false;
    for (const other of this.fighters) {
      if (other.id === f.id || !other.alive) continue;
      const dx = other.torso.position.x - origin.x;
      const dy = other.torso.position.y - origin.y;
      if (Math.hypot(dx, dy) > reach + 20) continue;
      if (Math.sign(dx || f.facing) !== f.facing && Math.abs(dx) > 12) continue;
      hit = true;
      this.hitFighter(other, f.id, damage, { x: f.facing * knock, y: -knock * 0.45 }, other.torso.position);
    }
    if (hit) {
      this.effects.addHitstop(isBat ? 0.07 : 0.05);
      this.camera.addShake(isBat ? 0.35 : 0.22);
    }
  }

  private fire(f: Fighter): void {
    const weapon = f.weapon;
    if (!f.consumeAmmo()) return;
    const hand = f.handPos();
    const angle = f.facing >= 0 ? 0 : Math.PI;
    const bodies = spawnProjectiles({
      x: hand.x,
      y: hand.y,
      angle,
      ownerId: f.id,
      weapon,
    });
    for (const b of bodies) {
      (b as Matter.Body & { born: number }).born = this.now;
      Matter.Composite.add(this.world, b);
      this.projectiles.push(b);
    }
    const recoil = recoilFor(weapon);
    Matter.Body.applyForce(f.torso, f.torso.position, { x: -f.facing * recoil * f.torso.mass * 12, y: -recoil * f.torso.mass * 2 });
    this.effects.muzzle(hand.x, hand.y, angle);
    this.camera.addShake(weapon === "shotgun" ? 0.4 : weapon === "rocket" ? 0.28 : 0.12);
    if (weapon === "rocket") this.audio.rocket();
    else if (weapon === "banana") this.audio.banana();
    else this.audio.gun(weapon === "shotgun" || weapon === "glove");
    if (weapon === "shotgun" && !f.grounded) f.stun(this.now, 120);
  }

  private hitFighter(
    target: Fighter,
    _ownerId: number,
    damage: number,
    force: { x: number; y: number },
    at: { x: number; y: number },
  ): void {
    if (!target.alive) return;
    target.damage(damage, this.now);
    target.stun(this.now, damage > 14 ? 360 : FIGHTER.stunMs);
    for (const b of target.allBodies()) {
      Matter.Body.applyForce(b, b.position, {
        x: force.x * b.mass * 8,
        y: force.y * b.mass * 8,
      });
    }
    this.effects.ink(at.x, at.y, target.ink, 10);
    this.effects.burst(at.x, at.y, "#fff", 6, 200);
    this.audio.hit();
    if (!target.alive) {
      this.audio.death();
      this.camera.addShake(0.5);
      const dropped = target.dropWeapon();
      if (dropped) this.dropLootAt(target, dropped);
    }
  }

  private explode(x: number, y: number, radius: number, ownerId: number): void {
    this.effects.explode(x, y);
    this.audio.explode();
    this.camera.addShake(0.7);
    for (const f of this.fighters) {
      for (const b of f.allBodies()) {
        const dx = b.position.x - x;
        const dy = b.position.y - y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > radius) continue;
        const mag = (1 - d / radius) * 0.09;
        Matter.Body.applyForce(b, b.position, { x: (dx / d) * mag * b.mass * 14, y: (dy / d) * mag * b.mass * 14 - 0.02 * b.mass });
      }
      const dTorso = Math.hypot(f.torso.position.x - x, f.torso.position.y - y);
      if (dTorso < radius && f.alive) {
        const dmg = 18 + (1 - dTorso / radius) * 28;
        f.damage(dmg, this.now);
        f.stun(this.now, 420);
        this.effects.ink(f.torso.position.x, f.torso.position.y, f.ink, 12);
        if (!f.alive) {
          this.audio.death();
          const dropped = f.dropWeapon();
          if (dropped) this.dropLootAt(f, dropped);
        }
      }
    }
    void ownerId;
  }

  private bindCollisions(): void {
    Matter.Events.on(this.engine, "collisionStart", (ev) => {
      for (const pair of ev.pairs) {
        this.handlePair(pair.bodyA, pair.bodyB);
        this.handlePair(pair.bodyB, pair.bodyA);
      }
    });
  }

  private handlePair(a: Matter.Body, b: Matter.Body): void {
    const da = getUserData(a);
    const db = getUserData(b);
    if (!da) return;

    if (da.kind === "projectile") {
      if (db?.kind === "part" && db.fighterId !== da.ownerId) {
        const target = this.fighters[db.fighterId];
        if (target) {
          const dirx = a.velocity.x;
          const diry = a.velocity.y;
          const sp = Math.hypot(dirx, diry) || 1;
          this.hitFighter(
            target,
            da.ownerId,
            da.damage,
            { x: (dirx / sp) * da.knockback, y: (diry / sp) * da.knockback - 0.01 },
            a.position,
          );
        }
        if (da.explosive) this.explode(a.position.x, a.position.y, da.radius ?? 140, da.ownerId);
        if (da.peel) this.spawnPeel(a.position.x, a.position.y);
        this.removeProjectile(a);
        return;
      }
      if (db?.kind === "platform") {
        if (da.explosive) this.explode(a.position.x, a.position.y, da.radius ?? 140, da.ownerId);
        if (da.peel) this.spawnPeel(a.position.x, a.position.y);
        this.removeProjectile(a);
      }
    }

    if (da.kind === "peel" && db?.kind === "part") {
      const f = this.fighters[db.fighterId];
      if (f && f.alive) {
        Matter.Body.setAngularVelocity(f.torso, (Math.random() - 0.5) * 1.2);
        Matter.Body.applyForce(f.torso, f.torso.position, { x: (Math.random() - 0.5) * 0.04 * f.torso.mass, y: -0.01 * f.torso.mass });
        f.stun(this.now, 220);
      }
    }
  }

  private removeProjectile(body: Matter.Body): void {
    if (!this.projectiles.includes(body)) return;
    this.projectiles = this.projectiles.filter((p) => p !== body);
    Matter.Composite.remove(this.world, body);
  }

  private spawnPeel(x: number, y: number): void {
    const body = Matter.Bodies.circle(x, y + 8, 10, {
      isStatic: true,
      isSensor: true,
      label: "peel",
    });
    setUserData(body, { kind: "peel", until: this.now + 4000 });
    Matter.Composite.add(this.world, body);
    this.peels.push({ body, until: this.now + 4000 });
  }

  private tickProjectiles(): void {
    for (const p of [...this.projectiles]) {
      const born = (p as Matter.Body & { born?: number }).born ?? this.now;
      if (
        this.now - born > 1600 ||
        p.position.y > WORLD.height + WORLD.killMargin ||
        p.position.x < -WORLD.killMargin ||
        p.position.x > WORLD.width + WORLD.killMargin
      ) {
        this.removeProjectile(p);
      }
    }
    if (this.projectiles.length > 80) {
      const extra = this.projectiles.slice(0, this.projectiles.length - 80);
      for (const p of extra) this.removeProjectile(p);
    }
  }

  private tickPeels(): void {
    this.peels = this.peels.filter((p) => {
      if (this.now > p.until) {
        Matter.Composite.remove(this.world, p.body);
        return false;
      }
      return true;
    });
  }

  private spawnWeapons(): void {
    if (this.now < this.nextWeaponAt) return;
    if (this.loot.length >= 6) {
      this.nextWeaponAt = this.now + 1400;
      return;
    }
    const x = 240 + Math.random() * (WORLD.width - 480);
    const kind = randomWeapon();
    const body = createLoot(x, 80, kind);
    Matter.Composite.add(this.world, body);
    this.loot.push({ id: (getUserData(body) as { lootId: number }).lootId, body, weapon: kind });
    this.effects.sparkles(x, 80, 16);
    this.audio.spawn();
    this.nextWeaponAt = this.now + 2800 + Math.random() * 2200;
  }

  private updateGrounded(): void {
    for (const f of this.fighters) {
      const feet = [f.parts.lowerLegL, f.parts.lowerLegR];
      let grounded = false;
      for (const foot of feet) {
        const cols = Matter.Query.collides(foot, this.arena.bodies);
        if (cols.length > 0) {
          grounded = true;
          break;
        }
      }
      f.setGrounded(this.now, grounded);
    }
  }

  private checkFalls(): void {
    for (const f of this.fighters) {
      if (!f.alive) continue;
      const p = f.torso.position;
      if (p.y > WORLD.height + 40 || p.x < -WORLD.killMargin || p.x > WORLD.width + WORLD.killMargin) {
        f.kill(this.now);
        this.audio.death();
        this.effects.ink(p.x, Math.min(p.y, WORLD.height), f.ink, 16);
        this.camera.addShake(0.4);
        const dropped = f.dropWeapon();
        if (dropped) this.dropLootAt(f, dropped);
      }
    }
  }

  private checkWinner(): void {
    const living = this.fighters.filter((f) => f.alive);
    if (living.length <= 1) {
      this.mode = "roundOver";
      this.winner = living[0]?.id ?? null;
      if (this.winner !== null) {
        this.scores[this.winner] += 1;
        this.audio.win();
      }
    }
  }

  private cameraFollow(): void {
    const pts = this.fighters.filter((f) => f.alive).map((f) => f.torso.position);
    if (pts.length === 0) {
      this.camera.follow(this.fighters.map((f) => f.torso.position), innerWidth, innerHeight);
    } else {
      this.camera.follow(pts, innerWidth, innerHeight);
    }
    this.camera.update(1 / 60);
  }

  private resetRound(initial: boolean): void {
    for (const f of this.fighters) Matter.Composite.remove(this.world, f.composite);
    for (const l of this.loot) Matter.Composite.remove(this.world, l.body);
    for (const p of this.projectiles) Matter.Composite.remove(this.world, p);
    for (const p of this.peels) Matter.Composite.remove(this.world, p.body);
    this.loot = [];
    this.projectiles = [];
    this.peels = [];
    this.effects.particles = [];
    const spawns = this.arena.spawnPoints();
    this.fighters = [
      new Fighter(0, spawns[0]!.x, spawns[0]!.y, P1_BINDS),
      new Fighter(1, spawns[1]!.x, spawns[1]!.y, P2_BINDS),
    ];
    this.fighters[1]!.facing = -1;
    for (const f of this.fighters) Matter.Composite.add(this.world, f.composite);
    this.mode = "countdown";
    this.countdown = 3;
    this.countdownAcc = 0;
    this.winner = null;
    this.paused = false;
    this.nextWeaponAt = this.now + 1200;
    this.camera.x = WORLD.width / 2;
    this.camera.y = WORLD.height / 2;
    if (!initial) this.audio.tick();
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
    const d = getUserData(body);
    if (!d || d.kind !== "projectile") return;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    if (d.weapon === "glove") {
      ctx.fillStyle = "#e63946";
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(-8, -5, 10, 10);
    } else if (d.weapon === "rocket") {
      ctx.fillStyle = "#c44536";
      ctx.fillRect(-10, -5, 22, 10);
      ctx.fillStyle = "#f4d35e";
      ctx.fillRect(8, -3, 6, 6);
    } else if (d.weapon === "banana") {
      drawWeaponIcon(ctx, "banana", 0, 0, 0, 1);
    } else {
      ctx.fillStyle = "#f4f1ea";
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.font = "700 18px Trebuchet MS, Segoe UI, sans-serif";
    ctx.fillStyle = COLORS.ui;

    this.panel(ctx, 18, 16, 240, 86, this.fighters[0]!.color);
    ctx.fillStyle = this.fighters[0]!.color;
    ctx.fillText("P1  Ember", 34, 42);
    ctx.fillStyle = COLORS.ui;
    ctx.fillText(`Wins ${this.scores[0]}`, 34, 64);
    ctx.fillText(this.weaponLabel(this.fighters[0]!), 34, 86);

    this.panel(ctx, w - 258, 16, 240, 86, this.fighters[1]!.color);
    ctx.textAlign = "right";
    ctx.fillStyle = this.fighters[1]!.color;
    ctx.fillText("Tide  P2", w - 34, 42);
    ctx.fillStyle = COLORS.ui;
    ctx.fillText(`Wins ${this.scores[1]}`, w - 34, 64);
    ctx.fillText(this.weaponLabel(this.fighters[1]!), w - 34, 86);
    ctx.textAlign = "left";

    ctx.font = "600 14px Trebuchet MS, Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(244,241,234,0.8)";
    ctx.fillText("P1  WASD move/jump   F punch / pick up / fire   S+F throw", 24, h - 28);
    ctx.textAlign = "right";
    ctx.fillText("P2  Arrows move/jump   L or Enter action   Down+action throw", w - 24, h - 28);
    ctx.textAlign = "left";
    ctx.fillText("Esc/P pause    M mute", 24, h - 10);

    if (this.mode === "countdown") {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(7,11,22,0.35)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLORS.ui;
      ctx.font = "800 96px Trebuchet MS, Segoe UI, sans-serif";
      const label = this.countdown > 0 ? String(this.countdown) : "FIGHT!";
      ctx.fillText(label, w / 2, h / 2);
      ctx.font = "600 22px Trebuchet MS, Segoe UI, sans-serif";
      ctx.fillText("Last one standing", w / 2, h / 2 + 48);
    }

    if (this.mode === "roundOver") {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(7,11,22,0.5)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLORS.ui;
      ctx.font = "800 56px Trebuchet MS, Segoe UI, sans-serif";
      const text =
        this.winner === null ? "Draw" : `${this.fighters[this.winner]!.name} wins!`;
      ctx.fillText(text, w / 2, h / 2 - 10);
      ctx.font = "600 22px Trebuchet MS, Segoe UI, sans-serif";
      ctx.fillText("Press R or Space for rematch", w / 2, h / 2 + 36);
    }

    if (this.paused) {
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(7,11,22,0.62)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLORS.ui;
      ctx.font = "800 64px Trebuchet MS, Segoe UI, sans-serif";
      ctx.fillText("Paused", w / 2, h / 2);
      ctx.font = "600 20px Trebuchet MS, Segoe UI, sans-serif";
      ctx.fillText("Esc or P to resume", w / 2, h / 2 + 40);
    }

    if (this.muted) {
      ctx.textAlign = "right";
      ctx.font = "700 14px Trebuchet MS, Segoe UI, sans-serif";
      ctx.fillStyle = "#f4d35e";
      ctx.fillText("MUTED", w - 24, 122);
    }
    ctx.restore();
  }

  private weaponLabel(f: Fighter): string {
    const def = WEAPON_DEFS[f.weapon];
    if (!Number.isFinite(f.ammo)) return def.name;
    return `${def.name}  ${f.ammo}`;
  }

  private panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, accent: string): void {
    ctx.fillStyle = COLORS.dim;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 6, h);
  }
}
