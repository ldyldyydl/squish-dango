import { Engine, World, Bodies, Body, Constraint } from "matter-js";

export type SoftBody = {
  center: Body;
  outer: Body[];
  constraints: Constraint[];
};

export class PhysicsEngine {
  public engine: Engine;
  public world: World;
  public softBody: SoftBody | null = null;
  private walls: Body[] = [];

  constructor() {
    this.engine = Engine.create();
    this.world = this.engine.world;
    // No gravity for a floating soft body experience
    this.world.gravity.y = 0;
  }

  createSoftDonut(x: number, y: number, radius = 80, circleCount = 16) {
    const center = Bodies.circle(x, y, 12, {
      restitution: 0.9,
      frictionAir: 0.02,
    });

    const outer: Body[] = Array.from({ length: circleCount }, (_, i) => {
      const angle = (Math.PI * 2 / circleCount) * i;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      return Bodies.circle(px, py, 12, {
        restitution: 0.7,
        frictionAir: 0.02,
      });
    });

    const constraints: Constraint[] = [];

    // Ring constraints
    outer.forEach((o, i) => {
      const next = outer[(i + 1) % circleCount];
      constraints.push(
        Constraint.create({
          bodyA: o,
          bodyB: next,
          stiffness: 0.6,
          length: 24,
        })
      );
    });

    // Spokes to center
    outer.forEach((o) => {
      constraints.push(
        Constraint.create({
          bodyA: o,
          bodyB: center,
          stiffness: 0.85,
          length: radius,
        })
      );
    });

    // Add bodies and constraints to world
    World.add(this.world, [center, ...outer, ...constraints]);

    this.softBody = { center, outer, constraints };
  }

  // 添加不可见边界，防止粒子移出视口，同时在边缘产生挤压
  setBounds(width: number, height: number) {
    const thickness = 100;
    // 移除旧边界
    this.walls.forEach((w) => World.remove(this.world, w));

    const half = thickness / 2;
    const top = Bodies.rectangle(width / 2, -half, width + thickness, thickness, {
      isStatic: true,
      restitution: 0.2,
      friction: 0.1,
    });
    const bottom = Bodies.rectangle(width / 2, height + half, width + thickness, thickness, {
      isStatic: true,
      restitution: 0.2,
      friction: 0.1,
    });
    const left = Bodies.rectangle(-half, height / 2, thickness, height + thickness, {
      isStatic: true,
      restitution: 0.2,
      friction: 0.1,
    });
    const right = Bodies.rectangle(width + half, height / 2, thickness, height + thickness, {
      isStatic: true,
      restitution: 0.2,
      friction: 0.1,
    });

    this.walls = [top, bottom, left, right];
    World.add(this.world, this.walls);
  }

  update(deltaMs: number) {
    Engine.update(this.engine, deltaMs);
  }
}