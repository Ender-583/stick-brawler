import { Game } from "./game";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("Missing #game canvas");

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D is not available");

const game = new Game();
game.attach(canvas);
canvas.focus();

let last = performance.now();

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas!.width = Math.max(1, Math.floor(window.innerWidth * dpr));
  canvas!.height = Math.max(1, Math.floor(window.innerHeight * dpr));
  canvas!.style.width = `${window.innerWidth}px`;
  canvas!.style.height = `${window.innerHeight}px`;
  ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resize);
resize();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.draw(ctx!, window.innerWidth, window.innerHeight);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
