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
  private recoveryGain = 0;
  private anchors: { x: number; y: number }[] | null = null;
  private anchorKBase = 0.0012;
  private anchorKInteract = 0.0006;
  private anchorSnapDist = 0.8;
  private anchorDampInteract = 0.75;
  private anchorDampIdle = 0.92;

  constructor() {
    this.engine = Engine.create();
    this.world = this.engine.world;
    this.world.gravity.y = 0;
    // 开启睡眠以降低微小抖动的能量积累
    (this.engine as unknown as { enableSleeping: boolean }).enableSleeping = true;
  }

  setInteracting(active: boolean) {
    this.isInteracting = active;
  }

  createSoftDonut(x: number, y: number, radius = 80, circleCount = 16) {
    this.baseRadius = radius;
    const center = Bodies.circle(x, y, 12, {
      restitution: 0.05,
      frictionAir: 0.12,
    });

    const outer: Body[] = Array.from({ length: circleCount }, (_, i) => {
      const angle = (Math.PI * 2 / circleCount) * i;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      return Bodies.circle(px, py, 12, {
        restitution: 0.1,
        frictionAir: 0.14,
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

    // 进入世界后清零初始速度，避免启动时抖动
    Body.setVelocity(center, { x: 0, y: 0 });
    Body.setAngularVelocity(center, 0);
    for (const b of outer) {
      Body.setVelocity(b, { x: 0, y: 0 });
      Body.setAngularVelocity(b, 0);
    }

    // Record base stiffness for dynamic softening during interaction
    constraints.forEach((c) => this.baseStiffness.set(c, c.stiffness ?? 1));

    this.softBody = { center, outer, constraints };
    this.anchors = null; // circle shape uses radial pressure, no anchors
  }

  resetSoftDonut(x: number, y: number, radius = 80, circleCount = 16) {
    // Remove existing soft body from world and clear caches
    if (this.softBody) {
      const { center, outer, constraints } = this.softBody;
      World.remove(this.world, [center, ...outer, ...constraints]);
      this.softBody = null;
    }
    this.ringConstraints = [];
    this.spokeConstraints = [];
    this.baseStiffness.clear();
    this.recoveryGain = 0;
    this.interactBlend = 0;

    // Recreate with new parameters
    this.createSoftDonut(x, y, radius, circleCount);
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

  createSoftAnchored(anchors: { x: number; y: number }[]) {
    const n = anchors.length;
    if (n < 3) return;
    // compute centroid
    const cx = anchors.reduce((s, p) => s + p.x, 0) / n;
    const cy = anchors.reduce((s, p) => s + p.y, 0) / n;

    const center = Bodies.circle(cx, cy, 12, { restitution: 0.05, frictionAir: 0.12 });
    const outer: Body[] = anchors.map((p) => Bodies.circle(p.x, p.y, 12, { restitution: 0.1, frictionAir: 0.14 }));
    const constraints: Constraint[] = [];

    // Neighbor ring
    for (let i = 0; i < n; i++) {
      const a = outer[i];
      const b = outer[(i + 1) % n];
      const c = Constraint.create({ bodyA: a, bodyB: b, stiffness: 0.30 });
      constraints.push(c);
      this.ringConstraints.push(c);
    }
    // Second/third neighbors (optional smoothing)
    for (let i = 0; i < n; i++) {
      const a = outer[i];
      const b2 = outer[(i + 2) % n];
      const c2 = Constraint.create({ bodyA: a, bodyB: b2, stiffness: 0.20 });
      constraints.push(c2);
      this.ringConstraints.push(c2);
      const b3 = outer[(i + 3) % n];
      const c3 = Constraint.create({ bodyA: a, bodyB: b3, stiffness: 0.08 });
      constraints.push(c3);
      this.ringConstraints.push(c3);
    }
    // Spokes to center
    for (let i = 0; i < n; i++) {
      const o = outer[i];
      const len = Math.hypot(o.position.x - cx, o.position.y - cy);
      const c = Constraint.create({ bodyA: o, bodyB: center, stiffness: 0.25, length: len });
      constraints.push(c);
      this.spokeConstraints.push(c);
    }

    World.add(this.world, [center, ...outer, ...constraints]);
    // 清零初始速度，防止创建后自发抖动
    Body.setVelocity(center, { x: 0, y: 0 });
    Body.setAngularVelocity(center, 0);
    for (const b of outer) {
      Body.setVelocity(b, { x: 0, y: 0 });
      Body.setAngularVelocity(b, 0);
    }
    constraints.forEach((c) => this.baseStiffness.set(c, c.stiffness ?? 1));
    this.softBody = { center, outer, constraints };
    this.anchors = anchors.slice();
  }

  // 调整软体的空气阻尼（可在创建后调用以减轻抖动）
  setFrictionAir(outer?: number, center?: number) {
    if (!this.softBody) return;
    if (typeof center === "number") {
      this.softBody.center.frictionAir = Math.max(0, Math.min(1, center));
    }
    if (typeof outer === "number") {
      for (const b of this.softBody.outer) {
        b.frictionAir = Math.max(0, Math.min(1, outer));
      }
    }
  }

  resetSoftAnchored(anchors: { x: number; y: number }[]) {
    if (this.softBody) {
      const { center, outer, constraints } = this.softBody;
      World.remove(this.world, [center, ...outer, ...constraints]);
      this.softBody = null;
    }
    this.ringConstraints = [];
    this.spokeConstraints = [];
    this.baseStiffness.clear();
    this.recoveryGain = 0;
    this.interactBlend = 0;
    this.createSoftAnchored(anchors);
  }

  update(deltaMs: number) {
    // Smoothly blend interaction state for gentle, slow recovery after release
    const target = this.isInteracting ? 1 : 0;
    const tau = this.isInteracting ? 120 : 900; // ms time constants for in/out
    this.interactBlend += (target - this.interactBlend) * Math.min(1, deltaMs / tau);
    // Linear ramp-up of recovery after release (speed linearly increases)
    if (this.isInteracting) {
      this.recoveryGain = 0;
    } else {
      const recoveryT = 24000; // ms to fully recover (slower recovery)
      this.recoveryGain = Math.min(1, this.recoveryGain + deltaMs / recoveryT);
    }
    // Soften constraints while interacting to reduce rebound
    this.applyConstraintSoftening();
    if (this.anchors) {
      this.applyAnchorAttraction();
    } else {
      this.applyRadialPressure();
    }
    Engine.update(this.engine, deltaMs);
    this.applyBoundarySqueeze();
  }

  private applyConstraintSoftening() {
    if (!this.softBody) return;
    const outBlend = this.isInteracting
      ? this.interactBlend
      : (1 - Math.pow(this.recoveryGain, 1.5));
    const ringScale = 1.0 + (0.20 - 1.0) * outBlend;
    const spokeScale = 1.0 + (0.4 - 1.0) * outBlend;
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
    const baseK = 0.00025;
    const interactKMax = 0.0010;
    const recoverKMax = 0.0006; // cap recovery pressure lower than interact for slower return
    const k = this.isInteracting
      ? baseK + (interactKMax - baseK) * this.interactBlend
      : baseK + (recoverKMax - baseK) * this.recoveryGain;
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
  private applyAnchorAttraction() {
    if (!this.softBody || !this.anchors) return;
    // 锚点吸引：非交互时更强，同时近距离时吸附并清零速度以避免持续抖动
    const k = this.isInteracting ? this.anchorKInteract : this.anchorKBase;
    const damp = this.isInteracting ? this.anchorDampInteract : this.anchorDampIdle;
    const snapDist = this.anchorSnapDist;
    for (let i = 0; i < this.softBody.outer.length && i < this.anchors.length; i++) {
      const body = this.softBody.outer[i];
      const target = this.anchors[i];
      const dx = target.x - body.position.x;
      const dy = target.y - body.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist < snapDist && !this.isInteracting) {
        Body.setPosition(body, { x: target.x, y: target.y });
        Body.setVelocity(body, { x: 0, y: 0 });
        Body.setAngularVelocity(body, 0);
        continue;
      }
      Body.applyForce(body, body.position, { x: dx * k, y: dy * k });
      if (!this.isInteracting) {
        Body.setVelocity(body, { x: body.velocity.x * damp, y: body.velocity.y * damp });
      }
    }
  }
  setAnchorStrength(base: number, interact?: number) {
    this.anchorKBase = Math.max(0, base);
    if (typeof interact === "number") this.anchorKInteract = Math.max(0, interact);
  }
  hasAnchors(): boolean {
    return !!this.anchors && this.anchors.length > 0;
  }
}