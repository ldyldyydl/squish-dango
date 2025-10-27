import { PhysicsEngine } from "./PhysicsEngine";
import { RenderManager, BlobColors } from "./RenderManager";
import { InputController } from "./InputController";

export class GameManager {
  private physics: PhysicsEngine;
  private renderer: RenderManager;
  private input?: InputController;
  private rafId = 0;
  private lastTs = 0;
  private interacting = false;
  private highlightBlend = 0; // 0=hidden, 1=fully visible
  private cornerSmooth = 0; // polygon corner smoothing ratio

  constructor(private canvas: HTMLCanvasElement) {
    this.physics = new PhysicsEngine();
    this.renderer = new RenderManager(canvas);
  }

  setColor(colors: Partial<BlobColors>) {
    this.renderer.setColors(colors);
  }

  setCornerSmooth(ratio: number) {
    this.cornerSmooth = Math.max(0, Math.min(0.5, ratio || 0));
  }

  // 调整锚点吸引强度（针对玫瑰花等图案降低抖动）
  setAnchorHoldStrength(base: number, interact?: number) {
    this.physics.setAnchorStrength(base, interact);
  }

  // 调整空气阻尼（提高阻尼可降低抖动）
  setDamping(options: { outer?: number; center?: number }) {
    this.physics.setFrictionAir(options.outer, options.center);
  }

  start(options?: { radius?: number; circleCount?: number; x?: number; y?: number }) {
    const rect = this.canvas.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
    this.physics.setBounds(rect.width, rect.height);

    const radius = options?.radius ?? Math.min(rect.width, rect.height) / 4;
    const circleCount = options?.circleCount ?? 18;
    const x = options?.x ?? rect.width / 2;
    const y = options?.y ?? rect.height / 2;

    // Center soft body
    this.physics.createSoftDonut(x, y, radius, circleCount);

    // Input on outer particles
    const bodies = this.physics.softBody ? [this.physics.softBody.center, ...this.physics.softBody.outer] : [];
    this.input = new InputController(this.canvas, bodies, (active) => {
      this.physics.setInteracting(active);
      this.interacting = active;
    });
    this.input.attach();

    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
    if (this.input) this.input.detach();
  }

  resetShape(options?: { radius?: number; circleCount?: number; x?: number; y?: number }) {
    const rect = this.canvas.getBoundingClientRect();
    const radius = options?.radius ?? Math.min(rect.width, rect.height) / 4;
    const circleCount = options?.circleCount ?? 18;
    const x = options?.x ?? rect.width / 2;
    const y = options?.y ?? rect.height / 2;

    // Detach old input
    if (this.input) this.input.detach();

    // Recreate soft body
    this.physics.resetSoftDonut(x, y, radius, circleCount);

    // Rebind input to new bodies
    const bodies = this.physics.softBody ? [this.physics.softBody.center, ...this.physics.softBody.outer] : [];
    this.input = new InputController(this.canvas, bodies, (active) => {
      this.physics.setInteracting(active);
      this.interacting = active;
    });
    this.input.attach();
  }

  resetAnchoredShape(anchors: { x: number; y: number }[]) {
    const rect = this.canvas.getBoundingClientRect();

    // Detach old input
    if (this.input) this.input.detach();

    // Recreate soft body from anchors
    this.physics.resetSoftAnchored(anchors);

    // Rebind input to new bodies
    const bodies = this.physics.softBody ? [this.physics.softBody.center, ...this.physics.softBody.outer] : [];
    this.input = new InputController(this.canvas, bodies, (active) => {
      this.physics.setInteracting(active);
      this.interacting = active;
    });
    this.input.attach();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
    this.physics.setBounds(rect.width, rect.height);
  }

  private loop = (ts: number) => {
    const dt = Math.min(32, ts - this.lastTs || 16); // clamp delta for stability
    this.lastTs = ts;

    this.physics.update(dt);

    // Smoothly blend highlight visibility in/out based on interaction
    const target = this.interacting ? 1 : 0;
    const tau = this.interacting ? 120 : 500; // ms time constants
    const alpha = 1 - Math.exp(-dt / tau);
    this.highlightBlend += (target - this.highlightBlend) * alpha;

    const sb = this.physics.softBody;
    if (sb) this.renderer.drawSoftBody(sb.center, sb.outer, this.highlightBlend, this.physics.hasAnchors(), this.cornerSmooth);

    this.rafId = requestAnimationFrame(this.loop);
  };
}
