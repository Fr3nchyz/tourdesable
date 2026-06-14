"use client";

import type { Track } from "@/game/types";
import type { Theme } from "@/game/constants";

const THEME_META: Record<Theme, { desc: string; diff: string; color: string; emoji: string }> = {
  "trez-hir": {
    desc: "Calm wide sands of the Crozon peninsula. Gentle rolls, forgiving dunes.",
    diff: "Easy",
    color: "#e9d8a6",
    emoji: "🏖️",
  },
  "le-minou": {
    desc: "Mild dunes with scattered boulders. A classic coastal challenge.",
    diff: "Medium",
    color: "#c4a97a",
    emoji: "🌊",
  },
  bertheaume: {
    desc: "Dramatic rocky cliffs, real elevation, treacherous sea on one flank.",
    diff: "Hard",
    color: "#8a7060",
    emoji: "⛰️",
  },
};

const DIFF_PIPS: Record<string, string> = {
  Easy:   "●○○",
  Medium: "●●○",
  Hard:   "●●●",
};

function TrackCard({
  track,
  index,
  onSelect,
}: {
  track: Track;
  index: number;
  onSelect: (i: number) => void;
}) {
  const meta = THEME_META[track.theme];
  return (
    <button
      onClick={() => onSelect(index)}
      className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-amber-900/25 bg-amber-50/10 p-5 text-left shadow-lg backdrop-blur transition hover:-translate-y-1 hover:border-amber-400 hover:bg-amber-50/20 hover:shadow-xl"
      style={{ minWidth: 220, maxWidth: 260 }}
    >
      {/* Terrain preview: a small gradient strip representing elevation */}
      <div
        className="h-28 w-full rounded-lg"
        style={{
          background: `linear-gradient(135deg, ${meta.color}cc 0%, ${meta.color}55 50%, #4a90d9aa 100%)`,
          boxShadow: "inset 0 2px 8px #0003",
        }}
        aria-hidden
      >
        <span className="flex h-full items-center justify-center text-5xl select-none">
          {meta.emoji}
        </span>
      </div>

      <div>
        <div className="text-lg font-black text-amber-50">{track.name}</div>
        <div className="mt-0.5 font-mono text-xs text-amber-300">
          {DIFF_PIPS[meta.diff]} {meta.diff}
        </div>
        <p className="mt-2 text-sm leading-snug text-amber-100/80">{meta.desc}</p>
      </div>
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
    <div className="flex flex-col items-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-black tracking-tight text-amber-100">
          Tour de Sable
        </h1>
        <p className="mt-2 text-lg text-amber-200/75">
          Choose your coastal course
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-5">
        {tracks.map((t, i) => (
          <TrackCard key={t.theme} track={t} index={i} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
