import { PhysicsEngine } from "./PhysicsEngine";
import { RenderManager } from "./RenderManager";
import { InputController } from "./InputController";

export class GameManager {
  private physics: PhysicsEngine;
  private renderer: RenderManager;
  private input?: InputController;
  private rafId = 0;
  private lastTs = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.physics = new PhysicsEngine();
    this.renderer = new RenderManager(canvas);
  }

  start() {
    const rect = this.canvas.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
+   this.physics.setBounds(rect.width, rect.height);

    // Center soft body
    this.physics.createSoftDonut(rect.width / 2, rect.height / 2, Math.min(rect.width, rect.height) / 4, 18);

    // Input on outer particles
    const bodies = this.physics.softBody ? this.physics.softBody.outer : [];
    this.input = new InputController(this.canvas, bodies);
    this.input.attach();

    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
    if (this.input) this.input.detach();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height);
+   this.physics.setBounds(rect.width, rect.height);
  }

  private loop = (ts: number) => {
    const dt = Math.min(32, ts - this.lastTs || 16); // clamp delta for stability
    this.lastTs = ts;

    this.physics.update(dt);

    const sb = this.physics.softBody;
    if (sb) this.renderer.drawSoftBody(sb.center, sb.outer);

    this.rafId = requestAnimationFrame(this.loop);
  };
}
