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
  private width = 0;
  private height = 0;
  private isInteracting = false;
  private interactBlend = 0;
  private baseStiffness = new Map<Constraint, number>();
  private ringConstraints: Constraint[] = [];
  private spokeConstraints: Constraint[] = [];
  private baseRadius = 80;

  constructor() {
    this.engine = Engine.create();
    this.world = this.engine.world;
    this.world.gravity.y = 0;
  }

  setInteracting(active: boolean) {
    this.isInteracting = active;
  }

  createSoftDonut(x: number, y: number, radius = 80, circleCount = 16) {
    this.baseRadius = radius;
    const center = Bodies.circle(x, y, 12, {
      restitution: 0.2,
      frictionAir: 0.05,
    });

    const outer: Body[] = Array.from({ length: circleCount }, (_, i) => {
      const angle = (Math.PI * 2 / circleCount) * i;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      return Bodies.circle(px, py, 12, {
        restitution: 0.4,
        frictionAir: 0.06,
      });
    });

    const constraints: Constraint[] = [];

    // Neighbor ring constraints
    outer.forEach((o, i) => {
      const next = outer[(i + 1) % circleCount];
      const c = Constraint.create({ bodyA: o, bodyB: next, stiffness: 0.30 });
      constraints.push(c);
      this.ringConstraints.push(c);
    });

    // Second neighbor ring constraints to prevent collapse
    outer.forEach((o, i) => {
      const second = outer[(i + 2) % circleCount];
      const c = Constraint.create({ bodyA: o, bodyB: second, stiffness: 0.20 });
      constraints.push(c);
      this.ringConstraints.push(c);
    });

    // Third neighbor ring constraints to resist necking
    outer.forEach((o, i) => {
      const third = outer[(i + 3) % circleCount];
      const c = Constraint.create({ bodyA: o, bodyB: third, stiffness: 0.08 });
      constraints.push(c);
      this.ringConstraints.push(c);
    });

    // Diameter constraints (opposites) to resist necking across the blob
    if (circleCount % 2 === 0) {
      outer.forEach((o, i) => {
        const opp = outer[(i + circleCount / 2) % circleCount];
        const c = Constraint.create({ bodyA: o, bodyB: opp, stiffness: 0.12 });
        constraints.push(c);
        this.ringConstraints.push(c);
      });
    }

    // Spokes to center (keep stronger to hold radius)
    outer.forEach((o) => {
      const c = Constraint.create({ bodyA: o, bodyB: center, stiffness: 0.25, length: radius });
      constraints.push(c);
      this.spokeConstraints.push(c);
    });

    // Add bodies and constraints to world
    World.add(this.world, [center, ...outer, ...constraints]);

    // Record base stiffness for dynamic softening during interaction
    constraints.forEach((c) => this.baseStiffness.set(c, c.stiffness ?? 1));

    this.softBody = { center, outer, constraints };
  }

  setBounds(width: number, height: number) {
    const thickness = 100;
    this.width = width;
    this.height = height;

    this.walls.forEach((w) => World.remove(this.world, w));

    const half = thickness / 2;
    const top = Bodies.rectangle(width / 2, -half, width + thickness, thickness, {
      isStatic: true,
      restitution: 0.0,
      friction: 0.2,
    });
    const bottom = Bodies.rectangle(width / 2, height + half, width + thickness, thickness, {
      isStatic: true,
      restitution: 0.0,
      friction: 0.2,
    });
    const left = Bodies.rectangle(-half, height / 2, thickness, height + thickness, {
      isStatic: true,
      restitution: 0.0,
      friction: 0.2,
    });
    const right = Bodies.rectangle(width + half, height / 2, thickness, height + thickness, {
      isStatic: true,
      restitution: 0.0,
      friction: 0.2,
    });

    this.walls = [top, bottom, left, right];
    World.add(this.world, this.walls);
  }

  update(deltaMs: number) {
    // Smoothly blend interaction state for gentle, slow recovery after release
    const target = this.isInteracting ? 1 : 0;
    const tau = this.isInteracting ? 120 : 900; // ms time constants for in/out
    this.interactBlend += (target - this.interactBlend) * Math.min(1, deltaMs / tau);
    // Soften constraints while interacting to reduce rebound
    this.applyConstraintSoftening();
    // Apply gentle radial pressure to preserve volume/radius
    this.applyRadialPressure();
    Engine.update(this.engine, deltaMs);
    this.applyBoundarySqueeze();
  }

  private applyConstraintSoftening() {
    if (!this.softBody) return;
    const ringScale = 1.0 + (0.20 - 1.0) * this.interactBlend;
    const spokeScale = 1.0 + (0.4 - 1.0) * this.interactBlend;
    for (const c of this.ringConstraints) {
      const base = this.baseStiffness.get(c) ?? c.stiffness ?? 1;
      c.stiffness = base * ringScale;
    }
    for (const c of this.spokeConstraints) {
      const base = this.baseStiffness.get(c) ?? c.stiffness ?? 1;
      c.stiffness = base * spokeScale;
    }
  }

  // Radial pressure towards base radius to avoid extreme skinny/segmented shapes
  private applyRadialPressure() {
    if (!this.softBody) return;
    const cx = this.softBody.center.position.x;
    const cy = this.softBody.center.position.y;
    const baseK = 0.00035;
    const interactK = 0.0010;
    const k = baseK + (interactK - baseK) * this.interactBlend;
    const clampMax = this.baseRadius * 1.25;
    for (const body of this.softBody.outer) {
      const dx = body.position.x - cx;
      const dy = body.position.y - cy;
      const r = Math.hypot(dx, dy) || 1;
      const nx = dx / r;
      const ny = dy / r;
      const dr = this.baseRadius - r; // >0 push outward; <0 pull inward
      Body.applyForce(body, body.position, { x: nx * dr * k, y: ny * dr * k });
      if (r > clampMax) {
        const over = r - clampMax;
        const kClamp = 0.003;
        Body.applyForce(body, body.position, { x: -nx * over * kClamp, y: -ny * over * kClamp });
      }
    }
  }
  // Soft inward force near edges; smaller horizontal margins, and reduce squeeze while interacting
  private applyBoundarySqueeze() {
    if (!this.softBody) return;
    const marginX = 16;
    const marginY = 60;
    const kBase = 0.0016;
    const kInteract = 0.0004;
    const kx = this.isInteracting ? kInteract : kBase;
    const ky = this.isInteracting ? kInteract : kBase;
    const damp = this.isInteracting ? 0.5 : 0.8;

     const actors: Body[] = [this.softBody.center, ...this.softBody.outer];
     for (const body of actors) {
       const x = body.position.x;
       const y = body.position.y;
       let fx = 0;
       let fy = 0;

       if (x < marginX) fx += (marginX - x) * kx;
       if (x > this.width - marginX) fx -= (x - (this.width - marginX)) * kx;
       if (y < marginY) fy += (marginY - y) * ky;
       if (y > this.height - marginY) fy -= (y - (this.height - marginY)) * ky;

       const isOuter = this.softBody.outer.includes(body);
       const scale = isOuter ? 2.2 : 0.6;
       fx *= scale;
       fy *= scale;

       if (fx !== 0 || fy !== 0) {
         Body.applyForce(body, body.position, { x: fx, y: fy });
         Body.setVelocity(body, { x: body.velocity.x * damp, y: body.velocity.y * damp });
       }
     }
   }
}