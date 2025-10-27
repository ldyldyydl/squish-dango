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
  private lastPinchDist?: number;
  constructor(private canvas: HTMLCanvasElement, private bodies: Body[], private onInteractChange?: (active: boolean) => void) {
    // Try to load sounds from public assets; if missing, fail silently
    try {
      const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");
      const prefix = base ? `/${base}` : "";
      this.pressSound = undefined;
      this.releaseSound = undefined;
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
    /* audio/vibrate disabled temporarily */
    if (this.onInteractChange) this.onInteractChange(true);
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
        x: dx * 0.006,
        y: dy * 0.006,
      });
    }

    // Apply pinch forces when two or more pointers are active
    if (this.pointers.size >= 2) {
      this.applyPinchForces();
    }
  };

  private onPointerUp = (ev: PointerEvent) => {
    const info = this.pointers.get(ev.pointerId);
    if (!info) return;
    /* audio/vibrate disabled temporarily */
    this.pointers.delete(ev.pointerId);
    if (this.pointers.size < 2) {
      this.lastPinchDist = undefined;
    }
    if (this.pointers.size === 0 && this.onInteractChange) this.onInteractChange(false);
  };

  private applyPinchForces() {
    const arr = Array.from(this.pointers.values());
    if (arr.length < 2) return;
    let a = arr.find((p) => p.target) || arr[0];
    let b = arr.find((p) => p !== a && p.target) || arr.find((p) => p !== a) || a;
    if (!a || !b || a.id === b.id) return;

    // Ensure targets exist for both pointers
    if (!a.target) a.target = this.pickNearest(a.lastX, a.lastY, 120);
    if (!b.target) b.target = this.pickNearest(b.lastX, b.lastY, 120);
    if (!a.target || !b.target) return;

    const dx = a.lastX - b.lastX;
    const dy = a.lastY - b.lastY;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0) return;

    if (this.lastPinchDist === undefined) {
      this.lastPinchDist = dist;
      return;
    }

    const pinchDelta = this.lastPinchDist - dist; // >0 closing, <0 spreading
    this.lastPinchDist = dist;

    const midX = (a.lastX + b.lastX) / 2;
    const midY = (a.lastY + b.lastY) / 2;

    const applyTowardsMid = (body: Body, closing: boolean) => {
      const vx = midX - body.position.x;
      const vy = midY - body.position.y;
      const len = Math.hypot(vx, vy) || 1;
      const nx = vx / len;
      const ny = vy / len;
      const sign = closing ? 1 : -1;
      const magnitude = Math.min(60, Math.abs(pinchDelta)) * 0.006;
      MatterBody.applyForce(body, body.position, {
        x: nx * sign * magnitude,
        y: ny * sign * magnitude,
      });
    };

    const closing = pinchDelta > 0;
    applyTowardsMid(a.target, closing);
    applyTowardsMid(b.target, closing);
  }
}
