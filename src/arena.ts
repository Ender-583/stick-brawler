import Matter from "matter-js";
import { COLORS, WORLD } from "./config";
import { setUserData } from "./types";

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Arena {
  platforms: Platform[] = [];
  bodies: Matter.Body[] = [];

  constructor() {
    this.platforms = [
      { x: 800, y: 720, w: 980, h: 44 },
      { x: 360, y: 540, w: 280, h: 28 },
      { x: 1240, y: 540, w: 280, h: 28 },
      { x: 800, y: 390, w: 240, h: 24 },
      { x: 220, y: 310, w: 160, h: 22 },
      { x: 1380, y: 310, w: 160, h: 22 },
    ];
  }

  addToWorld(world: Matter.World): void {
    this.bodies = this.platforms.map((p) => {
      const body = Matter.Bodies.rectangle(p.x, p.y, p.w, p.h, {
        isStatic: true,
        friction: 0.92,
        frictionStatic: 1,
        restitution: 0.02,
        chamfer: { radius: 6 },
        label: "platform",
      });
      setUserData(body, { kind: "platform" });
      return body;
    });
    Matter.Composite.add(world, this.bodies);
  }

  spawnPoints(): { x: number; y: number }[] {
    return [
      { x: 560, y: 620 },
      { x: 1040, y: 620 },
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(-400, -400, WORLD.width + 800, WORLD.height + 800);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#9ad0ff";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const x = 120 + i * 180;
      ctx.beginPath();
      ctx.moveTo(x, -200);
      ctx.lineTo(x + 80, WORLD.height + 200);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = i % 2 ? "#ffffff" : "#7eeae0";
      const x = (i * 197) % WORLD.width;
      const y = (i * 137) % 520;
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const p of this.platforms) {
      const x = p.x - p.w / 2;
      const y = p.y - p.h / 2;
      ctx.fillStyle = COLORS.platformShadow;
      roundRect(ctx, x + 6, y + 10, p.w, p.h, 8);
      ctx.fill();
      ctx.fillStyle = COLORS.platform;
      roundRect(ctx, x, y, p.w, p.h, 8);
      ctx.fill();
      ctx.fillStyle = COLORS.platformEdge;
      roundRect(ctx, x, y + p.h * 0.55, p.w, p.h * 0.45, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 6);
      ctx.lineTo(x + p.w - 10, y + 6);
      ctx.stroke();
    }

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#1b2438";
    ctx.fillRect(80, 760, 1440, 14);
    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
