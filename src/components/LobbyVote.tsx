"use client";

import { useEffect, useRef } from "react";
import type { Track } from "@/game/types";
import { drawTrackThumbnail } from "@/render/renderer";

const THUMB_W = 220;
const THUMB_H = 340;

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
    if (!c) return;
    drawTrackThumbnail(c.getContext("2d")!, track, THUMB_W, THUMB_H);
  }, [track]);

  return (
    <button
      onClick={() => onSelect(index)}
      className="group flex flex-col items-center gap-2 rounded-xl border-2 border-amber-900/30 bg-amber-50 p-3 shadow-lg transition hover:-translate-y-1 hover:border-amber-600 hover:shadow-xl"
    >
      <canvas
        ref={ref}
        width={THUMB_W}
        height={THUMB_H}
        className="rounded-md"
      />
      <span className="font-mono text-sm font-semibold text-amber-900">
        Beach #{track.seed}
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
        <h1 className="text-3xl font-black tracking-tight text-amber-100">
          Tour de Sable
        </h1>
        <p className="mt-1 text-amber-200/80">
          Pick your stretch of the Blancs-Sablons flatlands.
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
