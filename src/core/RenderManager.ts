import type { Body } from "matter-js";

export type BlobColors = {
  inner: string;
  outer: string;
};

export class RenderManager {
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  private colors: BlobColors = {
    inner: "rgba(255, 192, 203, 0.9)",
    outer: "rgba(255, 105, 180, 0.75)",
  };

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context not available");
    this.ctx = ctx;
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
  }

  setColors(colors: Partial<BlobColors>) {
    this.colors = { ...this.colors, ...colors };
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

  private setAlpha(rgba: string, alpha: number): string {
    const m = rgba.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i);
    if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
    return `rgba(255, 255, 255, ${alpha})`;
  }

  private drawRoundedPolygon(points: { x: number; y: number }[], cornerSmooth: number) {
    // cornerSmooth is a ratio (0..0.5) of edge length to trim per corner
    const n = points.length;
    if (n < 3) return;
    const clampSmooth = Math.max(0, Math.min(0.5, cornerSmooth));
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];
      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;
      const len1 = Math.hypot(v1x, v1y) || 1;
      const len2 = Math.hypot(v2x, v2y) || 1;
      const cut1 = len1 * clampSmooth;
      const cut2 = len2 * clampSmooth;
      const pA = { x: curr.x - (v1x / len1) * cut1, y: curr.y - (v1y / len1) * cut1 };
      const pB = { x: curr.x + (v2x / len2) * cut2, y: curr.y + (v2y / len2) * cut2 };
      if (i === 0) this.ctx.moveTo(pA.x, pA.y);
      this.ctx.quadraticCurveTo(curr.x, curr.y, pB.x, pB.y);
    }
    this.ctx.closePath();
  }

  drawSoftBody(center: Body, outer: Body[], highlightBlend: number = 1, strictPolygon: boolean = false, cornerSmooth: number = 0) {
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
      ctx.fillStyle = this.colors.inner;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.restore();
      return;
    }

    // Path: strict polygon (sharp corners), rounded polygon, or soft jelly
    ctx.beginPath();
    if (strictPolygon && cornerSmooth > 0) {
      this.drawRoundedPolygon(points, cornerSmooth);
    } else if (strictPolygon) {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
    } else {
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const next = points[(i + 1) % points.length];
        const midX = (p.x + next.x) / 2;
        const midY = (p.y + next.y) / 2;
        if (i === 0) ctx.moveTo(midX, midY);
        ctx.quadraticCurveTo(p.x, p.y, midX, midY);
      }
      ctx.closePath();
    }

    // Jelly gradient fill with subtle shadow
    const gradient = ctx.createRadialGradient(
      center.position.x,
      center.position.y,
      10,
      center.position.x,
      center.position.y,
      Math.max(60, firstDist)
    );
    gradient.addColorStop(0, this.colors.inner);
    gradient.addColorStop(1, this.colors.outer);

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.07)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();

    // Outline for visibility (use miter joins for sharp corners in polygon mode)
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineJoin = strictPolygon && cornerSmooth === 0 ? "miter" : "round";
    ctx.stroke();

    // Highlight (tinted and subtler, fades with blend)
    const hiRadius = Math.max(14, Math.min(22, firstDist * 0.22));
    const offset = Math.min(18, firstDist * 0.18);
    const hx = center.position.x - offset;
    const hy = center.position.y - offset;
    const alpha = 0.22 * Math.max(0, Math.min(1, highlightBlend));
    if (alpha > 0.001) {
      const hiGrad = ctx.createRadialGradient(hx, hy, 0, hx, hy, hiRadius);
      hiGrad.addColorStop(0, this.setAlpha(this.colors.inner, alpha));
      hiGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.save();
      ctx.beginPath();
      ctx.arc(hx, hy, hiRadius, 0, Math.PI * 2);
      ctx.fillStyle = hiGrad;
      ctx.fill();
      ctx.restore();
    }
  }
}