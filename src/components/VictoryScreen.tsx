"use client";

import type { GameState } from "@/game/types";

export default function VictoryScreen({
  state,
  onReplay,
}: {
  state: GameState;
  onReplay: () => void;
}) {
  const winner = state.racers.find((r) => r.id === state.winnerId);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/70 backdrop-blur">
      <div className="text-center">
        <div className="text-sm uppercase tracking-[0.3em] text-amber-300">
          Finish line
        </div>
        <h2 className="mt-2 text-5xl font-black text-amber-50">
          {winner?.isHuman ? "You win!" : `${winner?.name} wins`}
        </h2>
        <div className="mt-3 flex items-center justify-center gap-2 text-amber-200">
          <span
            className="inline-block h-5 w-5 rounded-full"
            style={{ background: winner?.color }}
          />
          first marble across the sand.
        </div>
      </div>
      <button
        onClick={onReplay}
        className="rounded-xl bg-amber-500 px-6 py-3 font-bold text-amber-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-400"
      >
        Race again
      </button>
    </div>
  );
}
