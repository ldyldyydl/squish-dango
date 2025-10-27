"use client";

import { useEffect, useRef } from "react";
import { GameManager } from "../core/GameManager";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gmRef = useRef<GameManager | null>(null);

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

  return (
    <div className="relative w-full h-[calc(100vh-0px)]">
     <canvas ref={canvasRef} className="w-full h-full touch-none" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/70 px-3 py-1 text-sm text-zinc-700 shadow">
        揉团子 · 试试拖拽/揉捏
      </div>
    </div>
  );
}
