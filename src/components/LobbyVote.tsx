"use client";

import { useEffect, useRef } from "react";
import type { Track } from "@/game/types";

const THUMB = 240;

/** Draw a top-down preview of the loop circuit into a thumbnail canvas. */
function drawThumb(ctx: CanvasRenderingContext2D, track: Track, size: number) {
  ctx.clearRect(0, 0, size, size);
  // Sand backdrop.
  ctx.fillStyle = "#e4d29a";
  ctx.fillRect(0, 0, size, size);

  const sx = size / track.width;
  const sy = size / track.height;
  const pt = (p: { x: number; y: number }) => ({ x: p.x * sx, y: p.y * sy });

  // Outer channel band (berm to berm).
  const drawRing = (width: number, stroke: string) => {
    ctx.beginPath();
    track.loop.forEach((p, i) => {
      const q = pt(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  drawRing(track.trackHalfWidth * 2 * sx, "#cdaf6e"); // berm band
  drawRing(track.laneHalfWidth * 2 * sx, "#efe2b4"); // racing channel

  // Finish line marker at loop[0].
  const f = pt(track.loop[0]);
  ctx.fillStyle = "#222";
  ctx.fillRect(f.x - 5, f.y - 5, 10, 10);

  // Obstacles.
  for (const o of track.obstacles) {
    const q = pt(o.pos);
    ctx.fillStyle = o.kind === "driftwood" ? "#8a6a43" : "#2f7d4f";
    ctx.beginPath();
    ctx.arc(q.x, q.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function Thumb({
  track,
  index,
  onSelect,
}: {
  track: Track;
  index: number;
  onSelect: (i: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (c) drawThumb(c.getContext("2d")!, track, THUMB);
  }, [track]);

  return (
    <button
      onClick={() => onSelect(index)}
      className="group flex flex-col items-center gap-2 rounded-xl border-2 border-amber-900/30 bg-amber-50 p-3 shadow-lg transition hover:-translate-y-1 hover:border-amber-600 hover:shadow-xl"
    >
      <canvas ref={ref} width={THUMB} height={THUMB} className="rounded-md" />
      <span className="font-mono text-sm font-semibold text-amber-900">
        Circuit #{track.seed}
      </span>
    </button>
  );
}

export default function LobbyVote({
  tracks,
  onSelect,
}: {
  tracks: Track[];
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight text-amber-100">
          Tour de Sable
        </h1>
        <p className="mt-1 text-amber-200/80">
          Choose your circuit on the Blancs-Sablons flatlands.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-5">
        {tracks.map((t, i) => (
          <Thumb key={t.seed} track={t} index={i} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
