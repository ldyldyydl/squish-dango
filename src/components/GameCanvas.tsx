"use client";

import { useEffect, useRef, useState } from "react";
import { GameManager } from "../core/GameManager";

const palettes = {
  粉色: { inner: "rgba(255, 192, 203, 0.9)", outer: "rgba(255, 105, 180, 0.75)" },
  天空: { inner: "rgba(125, 211, 252, 0.9)", outer: "rgba(14, 165, 233, 0.75)" },
  薄荷: { inner: "rgba(134, 239, 172, 0.9)", outer: "rgba(34, 197, 94, 0.75)" },
  琥珀: { inner: "rgba(252, 211, 77, 0.9)", outer: "rgba(245, 158, 11, 0.75)" },
  紫罗兰: { inner: "rgba(196, 181, 253, 0.9)", outer: "rgba(124, 58, 237, 0.75)" },
};

const shapes = {
  圆形: { type: "circle" as const, circleCount: 18, scale: 1.0 },
  四边形: { type: "polygon" as const, sides: 4, perEdge: 4, scale: 1.0 },
  五边形: { type: "polygon" as const, sides: 5, perEdge: 3, scale: 1.0 },
  星形: { type: "star" as const, points: 5, innerRatio: 0.5, perEdge: 2, scale: 1.0 },
  玫瑰花: { type: "rose" as const, k: 5, samples: 72, scale: 1.0 },
  心形: { type: "heart" as const, samples: 128, scale: 1.0 },
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gmRef = useRef<GameManager | null>(null);
  const [colorKey, setColorKey] = useState<keyof typeof palettes>("粉色");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gm = new GameManager(canvas);
    gmRef.current = gm;
    gm.start();

    const onResize = () => gm.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      gm.stop();
      gmRef.current = null;
    };
  }, []);

  const onColorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value as keyof typeof palettes;
    setColorKey(key);
    const palette = palettes[key];
    const gm = gmRef.current;
    if (!palette || !gm) return;

    // 兼容开发期 Fast Refresh 导致旧实例上不存在 setColor 的情况
    if (typeof (gm as any).setColor === "function") {
      gm.setColor(palette);
    } else {
      const renderer = (gm as any).renderer;
      if (renderer && typeof renderer.setColors === "function") {
        renderer.setColors(palette);
      }
    }
  };

  const makeCircleAnchors = (cx: number, cy: number, r: number, count: number) => {
    return Array.from({ length: count }, (_, i) => {
      const t = (i / count) * Math.PI * 2;
      return { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r };
    });
  };

  const makeRegularPolygonAnchors = (cx: number, cy: number, r: number, sides: number, perEdge = 3) => {
    const anchors: { x: number; y: number }[] = [];
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2 - Math.PI / 2;
      const v0 = { x: cx + Math.cos(a0) * r, y: cy + Math.sin(a0) * r };
      const v1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r };
      for (let k = 0; k < perEdge; k++) {
        const t = k / perEdge;
        anchors.push({ x: v0.x * (1 - t) + v1.x * t, y: v0.y * (1 - t) + v1.y * t });
      }
    }
    return anchors;
  };

  // 星形：外半径与内半径交替顶点，并按边细分采样
  const makeStarAnchors = (
    cx: number,
    cy: number,
    rOuter: number,
    points: number,
    innerRatio = 0.5,
    perEdge = 2
  ) => {
    const verts: { x: number; y: number }[] = [];
    const rInner = Math.max(0.05, Math.min(0.95, innerRatio)) * rOuter;
    const total = points * 2;
    for (let i = 0; i < total; i++) {
      const isOuter = i % 2 === 0;
      const r = isOuter ? rOuter : rInner;
      const a = (i / total) * Math.PI * 2 - Math.PI / 2;
      verts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    const anchors: { x: number; y: number }[] = [];
    for (let i = 0; i < verts.length; i++) {
      const v0 = verts[i];
      const v1 = verts[(i + 1) % verts.length];
      for (let k = 0; k < perEdge; k++) {
        const t = k / perEdge;
        anchors.push({ x: v0.x * (1 - t) + v1.x * t, y: v0.y * (1 - t) + v1.y * t });
      }
    }
    return anchors;
  };

  // 玫瑰曲线：r(t) = radius * (0.5 + 0.5 * cos(k t)) 保持正半径避免退化
  const makeRoseAnchors = (cx: number, cy: number, radius: number, k: number, samples = 72) => {
    const anchors: { x: number; y: number }[] = [];
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const r = radius * (0.5 + 0.5 * Math.cos(k * t));
      anchors.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
    }
    return anchors;
  };

  // 心形曲线：x = 16 sin^3(t), y = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)
  const makeHeartAnchors = (cx: number, cy: number, radius: number, samples = 96) => {
    const raw: { x: number; y: number }[] = [];
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      raw.push({ x, y: -y }); // 反转y使心尖朝下
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of raw) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    const s = (radius * 2) / Math.max(w, h);
    const anchors: { x: number; y: number }[] = raw.map(p => ({
      x: cx + (p.x - (minX + w / 2)) * s,
      y: cy + (p.y - (minY + h / 2)) * s,
    }));
    // 平滑曲线（环形移动平均），去除心尖的尖角感
    const alpha = 0.35; // 平滑强度 0..1
    const iterations = 3; // 迭代次数
    for (let it = 0; it < iterations; it++) {
      const prev = anchors.map(p => ({ x: p.x, y: p.y }));
      for (let i = 0; i < anchors.length; i++) {
        const i0 = (i - 1 + anchors.length) % anchors.length;
        const i1 = (i + 1) % anchors.length;
        anchors[i] = {
          x: prev[i].x * (1 - alpha) + ((prev[i0].x + prev[i1].x) / 2) * alpha,
          y: prev[i].y * (1 - alpha) + ((prev[i0].y + prev[i1].y) / 2) * alpha,
        };
      }
    }
    return anchors;
  };

  // 依据SVG路径d字符串等距采样anchors，并缩放/居中到(cx, cy)附近
  const sampleAnchorsFromPathD = (d: string, samples: number, cx: number, cy: number, targetRadius: number) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    const total = path.getTotalLength();
    const raw: { x: number; y: number }[] = [];
    for (let i = 0; i < samples; i++) {
      const p = path.getPointAtLength((i / samples) * total);
      raw.push({ x: p.x, y: p.y });
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of raw) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    const scale = (targetRadius * 2) / Math.max(w, h);
    const anchors = raw.map(p => ({
      x: cx + (p.x - (minX + w / 2)) * scale,
      y: cy + (p.y - (minY + h / 2)) * scale,
    }));
    return anchors;
  };

  const loadFirstPathDFromSvg = async (url: string): Promise<string | null> => {
    const txt = await fetch(url).then(r => r.text());
    const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
    const pathEl = doc.querySelector("path");
    return pathEl?.getAttribute("d") ?? null;
  };

  // 从PNG/JPG图片提取轮廓并采样为anchors
  const sampleAnchorsFromImageUrl = async (url: string, samples: number, cx: number, cy: number, targetRadius: number) => {
    const blob = await fetch(url).then(r => r.blob());
    const bmp = await createImageBitmap(blob);
    const maxDim = 200; // 降采样以提升性能
    const scaleImg = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.max(8, Math.floor(bmp.width * scaleImg));
    const h = Math.max(8, Math.floor(bmp.height * scaleImg));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const mask: Uint8Array = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const fg = a > 32 || lum < 128; // 透明或深色视为前景
        mask[y * w + x] = fg ? 1 : 0;
      }
    }
    const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
    const isFg = (x: number, y: number) => inBounds(x, y) && mask[y * w + x] === 1;
    const isBoundary = (x: number, y: number) => {
      if (!isFg(x, y)) return false;
      return !(isFg(x - 1, y) && isFg(x + 1, y) && isFg(x, y - 1) && isFg(x, y + 1));
    };
    let sx = -1, sy = -1;
    outer: for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (isBoundary(x, y)) { sx = x; sy = y; break outer; }
      }
    }
    if (sx === -1) return [] as { x: number; y: number }[];
    const neighbors = [
      { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 },
      { dx: 1, dy: 1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }
    ];
    let px = sx, py = sy, bi = 0;
    const contour: { x: number; y: number }[] = [];
    contour.push({ x: px + 0.5, y: py + 0.5 });
    let guard = w * h * 4;
    do {
      let found = false;
      for (let k = 0; k < 8; k++) {
        const ni = (bi + k) % 8;
        const nx = px + neighbors[ni].dx;
        const ny = py + neighbors[ni].dy;
        if (isBoundary(nx, ny)) {
          contour.push({ x: nx + 0.5, y: ny + 0.5 });
          bi = (ni + 7) % 8;
          px = nx; py = ny;
          found = true;
          break;
        }
      }
      if (!found) break;
      if (--guard <= 0) break;
    } while (!(px === sx && py === sy && contour.length > 5));
    if (contour.length < 6) return [] as { x: number; y: number }[];
    const segLens: number[] = [];
    let total = 0;
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i], bpt = contour[(i + 1) % contour.length];
      const d = Math.hypot(bpt.x - a.x, bpt.y - a.y);
      segLens.push(d); total += d;
    }
    const anchors: { x: number; y: number }[] = [];
    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * total;
      let acc = 0;
      let idx = 0;
      while (idx < segLens.length && acc + segLens[idx] < t) { acc += segLens[idx]; idx++; }
      const a = contour[idx % contour.length];
      const bpt = contour[(idx + 1) % contour.length];
      const remain = t - acc;
      const u = Math.min(1, Math.max(0, segLens[idx] ? remain / segLens[idx] : 0));
      anchors.push({ x: a.x * (1 - u) + bpt.x * u, y: a.y * (1 - u) + bpt.y * u });
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of anchors) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y; }
    const bw = maxX - minX, bh = maxY - minY;
    const s = (targetRadius * 2) / Math.max(bw, bh);
    return anchors.map(p => ({ x: cx + (p.x - (minX + bw / 2)) * s, y: cy + (p.y - (minY + bh / 2)) * s }));
  };

  const onShapeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value as keyof typeof shapes;
    const cfg = shapes[key];
    const gm = gmRef.current;
    const canvas = canvasRef.current;
    if (!cfg || !gm || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const base = Math.min(rect.width, rect.height) / 4;
    const radius = base * cfg.scale;

    if (cfg.type === "circle") {
      const circleCount = cfg.circleCount ?? 18;
      if (typeof (gm as any).resetShape === "function") {
        gm.resetShape({ radius, circleCount });
      } else {
        gm.stop();
        const newGm = new GameManager(canvas);
        gmRef.current = newGm;
        newGm.start({ radius, circleCount });
      }
      if (typeof (gmRef.current as any).setCornerSmooth === "function") {
        gmRef.current!.setCornerSmooth(0);
      }
    } else if (cfg.type === "star") {
      const anchors = makeStarAnchors(rect.width / 2, rect.height / 2, radius, cfg.points!, cfg.innerRatio!, cfg.perEdge!);
      if (typeof (gm as any).resetAnchoredShape === "function") {
        gm.resetAnchoredShape(anchors);
      } else {
        gm.stop();
        const newGm = new GameManager(canvas);
        gmRef.current = newGm;
        newGm.start();
        newGm.resetAnchoredShape(anchors);
      }
      if (typeof (gmRef.current as any).setCornerSmooth === "function") {
        gmRef.current!.setCornerSmooth(0.18);
      }
    } else if (cfg.type === "rose") {
      const anchors = makeRoseAnchors(rect.width / 2, rect.height / 2, radius, cfg.k!, cfg.samples!);
      if (typeof (gm as any).resetAnchoredShape === "function") {
        gm.resetAnchoredShape(anchors);
      } else {
        gm.stop();
        const newGm = new GameManager(canvas);
        gmRef.current = newGm;
        newGm.start();
        newGm.resetAnchoredShape(anchors);
      }
      if (typeof (gmRef.current as any).setCornerSmooth === "function") {
        gmRef.current!.setCornerSmooth(0.22);
      }
      // Removed rose-specific damping and anchor strength calls to revert behavior
    } else if (cfg.type === "heart") {
      const anchors = makeHeartAnchors(rect.width / 2, rect.height / 2, radius, cfg.samples!);
      if (typeof (gm as any).resetAnchoredShape === "function") {
        gm.resetAnchoredShape(anchors);
      } else {
        gm.stop();
        const newGm = new GameManager(canvas);
        gmRef.current = newGm;
        newGm.start();
        newGm.resetAnchoredShape(anchors);
      }
      if (typeof (gmRef.current as any).setCornerSmooth === "function") {
        gmRef.current!.setCornerSmooth(0.35);
      }
    } else {
      const anchors = makeRegularPolygonAnchors(rect.width / 2, rect.height / 2, radius, cfg.sides!, cfg.perEdge!);
      if (typeof (gm as any).resetAnchoredShape === "function") {
        gm.resetAnchoredShape(anchors);
      } else {
        gm.stop();
        const newGm = new GameManager(canvas);
        gmRef.current = newGm;
        newGm.start();
        newGm.resetAnchoredShape(anchors);
      }
      const smooth = [3, 4, 5].includes(cfg.sides!) ? 0.28 : 0;
      if (typeof (gmRef.current as any).setCornerSmooth === "function") {
        gmRef.current!.setCornerSmooth(smooth);
      }
    }

    const palette = palettes[colorKey];
    const currentGm = gmRef.current;
    if (palette && currentGm) currentGm.setColor(palette);
  };

  return (
    <div className="relative w-full h-[calc(100vh-0px)]">
      <canvas ref={canvasRef} className="w-full h-full touch-none" />
      {/* 左侧控制面板：颜色与形状 */}
      <div className="pointer-events-auto absolute left-4 top-4 flex flex-col gap-2 rounded-2xl bg-white/80 px-3 py-2 text-sm text-zinc-700 shadow">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">颜色</span>
          <select onChange={onColorChange} className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs">
            {Object.keys(palettes).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">形状</span>
          <select onChange={onShapeChange} className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs">
            {Object.keys(shapes).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}