import type { Body } from "matter-js";
import { Body as MatterBody } from "matter-js";
import { Howl } from "howler";

export type PointerInfo = {
  id: number; // pointerId or touch identifier
  lastX: number;
  lastY: number;
  target?: Body;
};

export class InputController {
  private pointers = new Map<number, PointerInfo>();
  private pressSound?: Howl;
  private releaseSound?: Howl;

  constructor(private canvas: HTMLCanvasElement, private bodies: Body[]) {
    // Try to load sounds from public assets; if missing, fail silently
    try {
      const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");
      const prefix = base ? `/${base}` : "";
      this.pressSound = new Howl({ src: [`${prefix}/sounds/press.mp3`], volume: 0.6 });
      this.releaseSound = new Howl({ src: [`${prefix}/sounds/release.mp3`], volume: 0.6 });
    } catch (_) {}
  }

  attach() {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove, { passive: true });
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
  }

  detach() {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.pointers.clear();
  }

  private pickNearest(x: number, y: number, threshold = 40) {
    let nearest: Body | undefined;
    let minDist = Number.POSITIVE_INFINITY;
    for (const b of this.bodies) {
      const d = Math.hypot(b.position.x - x, b.position.y - y);
      if (d < minDist && d <= threshold) {
        minDist = d;
        nearest = b;
      }
    }
    return nearest;
  }

  private onPointerDown = (ev: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    const target = this.pickNearest(x, y, 120);
    const info: PointerInfo = { id: ev.pointerId, lastX: x, lastY: y, target };
    this.pointers.set(ev.pointerId, info);

    this.canvas.setPointerCapture?.(ev.pointerId);

    if (target && this.pressSound) this.pressSound.play();
    if (navigator.vibrate) navigator.vibrate(10);
  };

  private onPointerMove = (ev: PointerEvent) => {
    const info = this.pointers.get(ev.pointerId);
    if (!info) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    const dx = x - info.lastX;
    const dy = y - info.lastY;

    info.lastX = x;
    info.lastY = y;

    if (info.target) {
      // Apply force proportional to pointer movement
      MatterBody.applyForce(info.target, info.target.position, {
        x: dx * 0.002,
        y: dy * 0.002,
      });
    }
  };

  private onPointerUp = (ev: PointerEvent) => {
    const info = this.pointers.get(ev.pointerId);
    if (!info) return;

    if (info.target && this.releaseSound) this.releaseSound.play();
    if (navigator.vibrate) navigator.vibrate(8);

    this.pointers.delete(ev.pointerId);
  };
}
