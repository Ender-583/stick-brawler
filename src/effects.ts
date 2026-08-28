import type { Particle } from "./types";

export class Effects {
  particles: Particle[] = [];
  hitstop = 0;
  flashes: { x: number; y: number; angle: number; life: number }[] = [];

  update(dt: number): void {
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "ink" || p.kind === "smoke") {
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.vy += 40 * dt;
      } else if (p.kind === "spark") {
        p.vy += 380 * dt;
      } else if (p.kind === "sparkle") {
        p.vy -= 20 * dt;
        p.rot = (p.rot ?? 0) + dt * 8;
      }
      return p.life > 0;
    });
    this.flashes = this.flashes.filter((f) => {
      f.life -= dt;
      return f.life > 0;
    });
  }

  addHitstop(seconds: number): void {
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  burst(x: number, y: number, color: string, n = 10, speed = 220): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random());
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.35,
        maxLife: 0.5,
        size: 2 + Math.random() * 4,
        color,
        kind: "spark",
      });
    }
  }

  ink(x: number, y: number, color: string, n = 8): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.8,
        size: 3 + Math.random() * 7,
        color,
        kind: "ink",
      });
    }
  }

  sparkles(x: number, y: number, n = 14): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 90;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.8,
        size: 2 + Math.random() * 3,
        color: i % 2 ? "#fff3a0" : "#ffffff",
        kind: "sparkle",
        rot: Math.random() * Math.PI,
      });
    }
  }

  muzzle(x: number, y: number, angle: number): void {
    this.flashes.push({ x, y, angle, life: 0.06 });
    this.burst(x, y, "#ffe27a", 7, 280);
  }

  explode(x: number, y: number): void {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.28,
      maxLife: 0.28,
      size: 90,
      color: "#ffb347",
      kind: "ring",
    });
    this.burst(x, y, "#ff6b3d", 22, 420);
    this.burst(x, y, "#ffe27a", 14, 300);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * 50,
        vy: Math.sin(a) * 50 - 30,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 10 + Math.random() * 16,
        color: "rgba(40,40,40,0.5)",
        kind: "smoke",
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const f of this.flashes) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.globalAlpha = Math.max(0, f.life / 0.06);
      ctx.fillStyle = "#fff6c2";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(28, -8);
      ctx.lineTo(36, 0);
      ctx.lineTo(28, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, t));
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * t;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.4 - t), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "sparkle") {
        ctx.rotate(p.rot ?? 0);
        ctx.fillRect(-p.size, -1, p.size * 2, 2);
        ctx.fillRect(-1, -p.size, 2, p.size * 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (0.5 + 0.5 * t), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
