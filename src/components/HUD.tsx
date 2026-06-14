"use client";

import type { GameState } from "@/game/types";

export default function HUD({
  state,
  muted,
  onToggleMute,
  waveWarning,
}: {
  state: GameState;
  muted: boolean;
  onToggleMute: () => void;
  waveWarning: boolean;
}) {
  const standings = [...state.racers].sort((a, b) => b.progress - a.progress);
  const active = state.racers.find(
    (r) => r.id === state.turnOrder[state.activeTurn],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
      {/* Top bar */}
      <div className="flex items-start justify-between">
        <div className="rounded-lg bg-black/55 px-3 py-2 font-mono text-sm text-amber-50 backdrop-blur">
          <div>Round {state.round}</div>
          <div className="mt-1 text-amber-300">
            {active?.isHuman ? "Your shot — drag & flick" : `${active?.name}…`}
          </div>
          {state.wave.phase === "aftermath" && (
            <div className="mt-1 text-sky-300">
              Waterlogged ({state.wave.aftermathRoundsLeft} rounds)
            </div>
          )}
        </div>

        <div className="rounded-lg bg-black/55 px-3 py-2 font-mono text-xs text-amber-50 backdrop-blur">
          <div className="mb-1 font-bold text-amber-300">Standings</div>
          {standings.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2">
              <span className="w-4 text-right">{i + 1}.</span>
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: r.color }}
              />
              <span className={r.isHuman ? "font-bold text-white" : ""}>
                {r.name}
              </span>
              {r.state === "tipped" && (
                <span className="text-red-400">tipped</span>
              )}
              {r.state === "finished" && (
                <span className="text-green-400">✓</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Wave warning banner */}
      {waveWarning && (
        <div className="self-center rounded-lg bg-sky-900/80 px-6 py-3 text-center font-mono text-lg font-bold text-sky-100 shadow-xl backdrop-blur">
          🌊 Rogue wave incoming — the Blancs-Sablons Surge!
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex justify-end">
        <button
          onClick={onToggleMute}
          className="pointer-events-auto rounded-lg bg-black/55 px-3 py-2 font-mono text-sm text-amber-50 backdrop-blur hover:bg-black/70"
        >
          {muted ? "🔇 Muted" : "🔊 Sound"}
        </button>
      </div>
    </div>
  );
}
