import { useEffect, useRef, useState } from "react";
import { FIELD_H, MOTION_END, createSortPainter, phaseAt, type SortPhase } from "./sort-dither";

function phaseLabel(phase: SortPhase): string {
  switch (phase) {
    case "gather":
      return "Gathering";
    case "sort":
      return "Sorting";
    case "ranked":
      return "Ranked";
    default: {
      const never: never = phase;
      return never;
    }
  }
}

export function SortMotion({ total, fits }: { total: number; fits: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<SortPhase>("gather");
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const buffer = document.createElement("canvas");
    let painter: ReturnType<typeof createSortPainter> | null = null;
    let painterWidth = 0;
    let frame = 0;
    let start = 0;
    let lastPhase: SortPhase = "gather";

    const draw = (time: number) => {
      const cssWidth = canvas.clientWidth;
      const width = Math.max(1, Math.round(cssWidth / 2));
      if (width !== painterWidth) {
        painterWidth = width;
        buffer.width = width;
        buffer.height = FIELD_H;
        painter = createSortPainter(width, FIELD_H);
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(cssWidth * ratio);
        canvas.height = Math.round(FIELD_H * 2 * ratio);
      }
      const bufferCtx = buffer.getContext("2d");
      const image = bufferCtx?.createImageData(width, FIELD_H);
      if (!bufferCtx || !image || !painter) return;
      painter.paint(new Uint32Array(image.data.buffer, image.data.byteOffset, width * FIELD_H), time, total, fits);
      bufferCtx.putImageData(image, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
      const next = phaseAt(time);
      if (next !== lastPhase) {
        lastPhase = next;
        setPhase(next);
      }
    };

    if (reduce) {
      draw(MOTION_END);
      setPhase("ranked");
      setGone(true);
      return;
    }

    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = (now - start) / 1000;
      draw(Math.min(elapsed, MOTION_END));
      if (elapsed < MOTION_END + 0.7) frame = requestAnimationFrame(tick);
      else setGone(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [fits, total]);

  return (
    <div className={gone ? "sort-field is-gone" : "sort-field"}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <p className="sort-phase" role="status">{phaseLabel(phase)}</p>
    </div>
  );
}
