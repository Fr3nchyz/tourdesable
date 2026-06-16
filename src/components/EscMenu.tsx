"use client";

interface EscMenuProps {
  onClose: () => void;
  onResetMap: () => void;
  onLobby: () => void;
  muted: boolean;
  onToggleMute: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
}

export default function EscMenu({
  onClose,
  onResetMap,
  onLobby,
  muted,
  onToggleMute,
  volume,
  onVolumeChange,
}: EscMenuProps) {
  const pct = Math.round(volume * 100);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-80 rounded-2xl border border-slate-600 bg-slate-900/95 p-7 shadow-2xl">
        <h2 className="mb-6 font-mono text-lg font-bold tracking-wide text-amber-300">
          Paused
        </h2>

        {/* Sound toggle */}
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-sm text-amber-100">Sound effects</span>
          <button
            onClick={onToggleMute}
            className={`rounded-lg px-3 py-1 font-mono text-sm transition-colors ${
              muted
                ? "bg-slate-700 text-slate-400 hover:bg-slate-600"
                : "bg-amber-600/80 text-amber-50 hover:bg-amber-500"
            }`}
          >
            {muted ? "Off" : "On"}
          </button>
        </div>

        {/* Volume slider */}
        <div className="mb-7">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-sm text-amber-100">Volume</span>
            <span className="font-mono text-xs text-amber-400/70">{pct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            disabled={muted}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full outline-none disabled:opacity-40"
            style={{
              background: `linear-gradient(to right, #f4a261 ${pct}%, #334155 ${pct}%)`,
            }}
          />
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onResetMap}
            className="rounded-lg bg-amber-700/70 py-2 font-mono text-sm text-amber-50 hover:bg-amber-600 active:scale-95 transition-all"
          >
            Reset Map
          </button>
          <button
            onClick={onLobby}
            className="rounded-lg bg-slate-700 py-2 font-mono text-sm text-amber-100 hover:bg-slate-600 active:scale-95 transition-all"
          >
            Return to Lobby
          </button>
          <button
            onClick={onClose}
            className="mt-1 rounded-lg border border-slate-600 py-2 font-mono text-sm text-slate-400 hover:text-amber-100 hover:border-slate-500 active:scale-95 transition-all"
          >
            Continue  <span className="text-xs opacity-50">Esc</span>
          </button>
        </div>
      </div>
    </div>
  );
}
