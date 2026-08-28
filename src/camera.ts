import { WORLD } from "./config";

export class Camera {
  x = WORLD.width / 2;
  y = WORLD.height / 2;
  zoom = 1;
  shakeX = 0;
  shakeY = 0;
  private trauma = 0;
  private tx = WORLD.width / 2;
  private ty = WORLD.height / 2;
  private tz = 1;

  follow(points: { x: number; y: number }[], viewW: number, viewH: number): void {
    if (points.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    this.tx = (minX + maxX) / 2;
    this.ty = (minY + maxY) / 2 - 20;
    const padX = 280;
    const padY = 220;
    const spanX = Math.max(420, maxX - minX + padX);
    const spanY = Math.max(300, maxY - minY + padY);
    const z = Math.min(viewW / spanX, viewH / spanY, 1.35);
    this.tz = Math.max(0.72, z);
  }

  update(dt: number): void {
    const k = 1 - Math.pow(0.0008, dt);
    this.x += (this.tx - this.x) * k;
    this.y += (this.ty - this.y) * k;
    this.zoom += (this.tz - this.zoom) * k;
    this.trauma = Math.max(0, this.trauma - dt * 2.4);
    const mag = this.trauma * this.trauma * 22;
    this.shakeX = (Math.random() * 2 - 1) * mag;
    this.shakeY = (Math.random() * 2 - 1) * mag;
  }

  addShake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  apply(ctx: CanvasRenderingContext2D, viewW: number, viewH: number): void {
    ctx.translate(viewW / 2 + this.shakeX, viewH / 2 + this.shakeY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  screenToWorld(sx: number, sy: number, viewW: number, viewH: number): { x: number; y: number } {
    return {
      x: (sx - viewW / 2) / this.zoom + this.x,
      y: (sy - viewH / 2) / this.zoom + this.y,
    };
  }
}
