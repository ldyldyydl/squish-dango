import type { Body } from "matter-js";

export class RenderManager {
  private ctx: CanvasRenderingContext2D;
  private dpr: number;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context not available");
    this.ctx = ctx;
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
  }

  resize(width: number, height: number) {
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clear() {
    // Use CSS pixel space to clear consistent with current transform
    const { width, height } = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, width, height);
  }

  drawSoftBody(center: Body, outer: Body[]) {
    const ctx = this.ctx;
    this.clear();

    // Subtle background for comfort
    const { width, height } = this.canvas.getBoundingClientRect();
    const gradientBg = ctx.createLinearGradient(0, 0, 0, height);
    gradientBg.addColorStop(0, "#f9fafb");
    gradientBg.addColorStop(1, "#eef2ff");
    ctx.fillStyle = gradientBg;
    ctx.fillRect(0, 0, width, height);

    const points = outer.map((b) => ({ x: b.position.x, y: b.position.y }));
    if (points.length < 3) return;

    // Fallback: if blob collapsed to a tiny radius, show a placeholder
    const firstDist = Math.hypot(points[0].x - center.position.x, points[0].y - center.position.y);
    if (firstDist < 5) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(center.position.x, center.position.y, 40, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 182, 193, 0.85)"; // lightpink
      ctx.fill();
      ctx.restore();
      return;
    }

    // Soft blob path using quadratic curves
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const next = points[(i + 1) % points.length];
      const midX = (p.x + next.x) / 2;
      const midY = (p.y + next.y) / 2;
      if (i === 0) ctx.moveTo(midX, midY);
      ctx.quadraticCurveTo(p.x, p.y, midX, midY);
    }
    ctx.closePath();

    // Jelly gradient fill
    const gradient = ctx.createRadialGradient(
      center.position.x,
      center.position.y,
      10,
      center.position.x,
      center.position.y,
      Math.max(60, firstDist)
    );
    gradient.addColorStop(0, "rgba(255, 192, 203, 0.9)"); // inner pink
    gradient.addColorStop(1, "rgba(255, 105, 180, 0.75)"); // outer deeper

    ctx.fillStyle = gradient;
    ctx.fill();

    // Outline for visibility
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.stroke();

    // Highlight
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(center.position.x - 20, center.position.y - 20, 30, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.restore();
  }
}