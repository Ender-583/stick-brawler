import Matter from "matter-js";
import { PHYSICS } from "./config";

export function createEngine(): Matter.Engine {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: PHYSICS.gravity },
  });
  engine.positionIterations = PHYSICS.positionIterations;
  engine.velocityIterations = PHYSICS.velocityIterations;
  engine.constraintIterations = PHYSICS.constraintIterations;
  return engine;
}

export function stepEngine(engine: Matter.Engine, accumulator: number, dt: number): number {
  let acc = accumulator + dt;
  const step = PHYSICS.timeStepMs / 1000;
  let guard = 0;
  while (acc >= step && guard++ < 5) {
    Matter.Engine.update(engine, PHYSICS.timeStepMs);
    acc -= step;
  }
  return acc;
}
