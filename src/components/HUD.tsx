"use client";

import type { GameState } from "@/game/types";

export default function HUD({
  state,
  muted,
  onToggleMute,
  onRecenter,
}: {
  state: GameState;
  muted: boolean;
  onToggleMute: () => void;
  onRecenter: () => void;
}) {
  const standings = [...state.racers].sort((a, b) => b.progress - a.progress);
  const active = state.racers.find(
    (r) => r.id === state.turnOrder[state.activeTurn],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
      {/* Top bar */}
      <div className="flex items-start justify-between gap-3">
        {/* Turn info */}
        <div className="rounded-lg bg-black/55 px-3 py-2 font-mono text-sm text-amber-50 backdrop-blur">
          <div className="font-bold text-amber-300">{state.track?.name}</div>
          <div className="mt-0.5 text-xs text-amber-200/70">Round {state.round}</div>
          <div className="mt-1.5">
            {active?.isHuman
              ? "Your shot — drag & flick"
              : `${active?.name}…`}
          </div>
        </div>

        {/* Standings */}
        <div className="rounded-lg bg-black/55 px-3 py-2 font-mono text-xs text-amber-50 backdrop-blur">
          <div className="mb-1.5 font-bold text-amber-300">Standings</div>
          {standings.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 leading-5">
              <span className="w-3 text-right text-amber-400/70">{i + 1}</span>
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: r.color }}
              />
              <span className={r.isHuman ? "font-bold text-white" : "text-amber-100"}>
                {r.name}
              </span>
              <span className="ml-auto text-amber-200/50 tabular-nums">
                {Math.round(r.progress * 100)}%
              </span>
              {r.state === "tipped" && (
                <span className="text-red-400" title="tipped">!</span>
              )}
              {r.state === "finished" && (
                <span className="text-green-400">✓</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onRecenter}
          className="pointer-events-auto rounded-lg bg-black/55 px-3 py-2 font-mono text-sm text-amber-50 backdrop-blur hover:bg-black/70"
          title="Snap camera to active marble"
        >
          ⊙ Recenter
        </button>
        <button
          onClick={onToggleMute}
          className="pointer-events-auto rounded-lg bg-black/55 px-3 py-2 font-mono text-sm text-amber-50 backdrop-blur hover:bg-black/70"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
    </div>
  );
}
