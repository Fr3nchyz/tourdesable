"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { GameState, Vector2D } from "@/game/types";
import {
  createInitialState,
  selectTrack,
  restartCurrentTrack,
  isHumanInput,
  isBotInput,
  activeRacer,
} from "@/game/stateMachine";
import {
  applyLaunch,
  takeBotTurn,
  updateRacerPos,
  onSettled,
  recordTrail,
} from "@/game/engine";
import type { Impulse3D } from "@/render3d/Racers3D";
import { audio } from "@/audio/audio";
import { MAX_DRAG_WORLD, MARBLE_RADIUS } from "@/game/constants";
import Scene, { type AimState } from "@/render3d/Scene";
import CanvasErrorBoundary from "./CanvasErrorBoundary";
import LobbyVote from "./LobbyVote";
import HUD from "./HUD";
import EscMenu from "./EscMenu";
import VictoryScreen from "./VictoryScreen";

const BOT_THINK_MS = 750;

export default function GameCanvas() {
  const [view, setView] = useState<GameState>(createInitialState);
  const stateRef = useRef<GameState>(view);
  // Aim lives only in aimRef during a drag (read imperatively in the scene's
  // useFrame). isAiming is the single show/hide toggle that triggers a render.
  const [isAiming, setIsAiming] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [menuOpen, setMenuOpen] = useState(false);
  const [glLost, setGlLost] = useState(false);

  const draggingRef = useRef(false);
  const aimRef = useRef<AimState | null>(null);
  const impulseRef = useRef<Impulse3D | null>(null);
  const recenterRef = useRef(false);
  const botTimerRef = useRef<number | null>(null);

  const publish = useCallback(() => setView({ ...stateRef.current }), []);

  // --- lobby ---
  const handleSelect = useCallback(
    (index: number) => {
      audio.resume();
      stateRef.current = selectTrack(stateRef.current, index);
      recenterRef.current = true;
      publish();
    },
    [publish],
  );

  const handleReplay = useCallback(() => {
    stateRef.current = createInitialState();
    impulseRef.current = null;
    aimRef.current = null;
    setIsAiming(false);
    publish();
  }, [publish]);

  const handleResetMap = useCallback(() => {
    stateRef.current = restartCurrentTrack(stateRef.current);
    impulseRef.current = null;
    aimRef.current = null;
    setIsAiming(false);
    recenterRef.current = true;
    setMenuOpen(false);
    publish();
  }, [publish]);

  const handleLobby = useCallback(() => {
    stateRef.current = createInitialState();
    impulseRef.current = null;
    aimRef.current = null;
    setIsAiming(false);
    setMenuOpen(false);
    publish();
  }, [publish]);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    audio.setVolume(v);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- settle callback (called from inside the R3F Canvas) ---
  const handleSettle = useCallback(
    (carvedPath: Vector2D[]) => {
      recordTrail(stateRef.current, carvedPath);
      onSettled(stateRef.current);
      publish();
      recenterRef.current = true;
    },
    [publish],
  );

  // --- position update (called per-frame from inside R3F, no re-render) ---
  const handleRacerPos = useCallback(
    (id: string, wx: number, wy: number, wz: number) =>
      updateRacerPos(stateRef.current, id, wx, wy, wz),
    [],
  );

  // --- flick input ---
  const onAimDown = useCallback((ground: Vector2D) => {
    const s = stateRef.current;
    if (!isHumanInput(s)) return;
    const r = activeRacer(s);
    if (Math.hypot(ground.x - r.pos.x, ground.y - r.pos.y) > MARBLE_RADIUS * 6) return;
    draggingRef.current = true;
    audio.resume();
    aimRef.current = { dir: { x: 0, y: 1 }, power: 0 };
    setIsAiming(true);
  }, []);

  const onAimMove = useCallback((ground: Vector2D) => {
    if (!draggingRef.current) return;
    const r = activeRacer(stateRef.current);
    const back = { x: r.pos.x - ground.x, y: r.pos.y - ground.y };
    const dist = Math.hypot(back.x, back.y);
    // Mutate the ref only — the scene reads it in useFrame, so no re-render.
    aimRef.current =
      dist < 0.5
        ? { dir: { x: 0, y: 1 }, power: 0 }
        : {
            dir: { x: back.x / dist, y: back.y / dist },
            power: Math.min(1, dist / MAX_DRAG_WORLD),
          };
  }, []);

  const onAimUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsAiming(false);
    const a = aimRef.current;
    aimRef.current = null;
    if (a && a.power > 0.05) {
      const impulse = applyLaunch(stateRef.current, { dir: a.dir, power: a.power });
      impulseRef.current = impulse;
      publish();
    }
  }, [publish]);

  // --- bot turn scheduling (RAF loop just for the timer check) ---
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = stateRef.current;
      if (isBotInput(s) && botTimerRef.current == null) {
        botTimerRef.current = window.setTimeout(() => {
          botTimerRef.current = null;
          if (isBotInput(stateRef.current)) {
            const impulse = takeBotTurn(stateRef.current);
            impulseRef.current = impulse;
            setView({ ...stateRef.current });
          }
        }, BOT_THINK_MS);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (botTimerRef.current != null) clearTimeout(botTimerRef.current);
    };
  }, []);

  useEffect(() => { audio.setMuted(muted); }, [muted]);
  useEffect(() => { audio.setVolume(volume); }, [volume]);

  const phase = view.phase;

  if (phase === "LOBBY_VOTE") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-slate-800 via-sky-900 to-amber-950">
        <LobbyVote tracks={view.lobbyTracks} onSelect={handleSelect} />
      </div>
    );
  }

  const track = view.track!;
  const activeId = view.turnOrder[view.activeTurn];
  const inPhysics = view.turnSubPhase === "PHYSICS";
  // Unique key per turn — forces ActiveMarble to remount fresh each shot,
  // clearing stale Rapier body position and internal refs.
  const marbleKey = `${activeId}-${view.round}-${view.activeTurn}`;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-sky-200">
      <CanvasErrorBoundary onReset={handleReplay}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 40, -18], fov: 52 }}
          // touch-action:none → touch-drag flicks aim instead of scrolling/zooming the page.
          className="touch-none"
          onCreated={({ gl }) => {
            // Context loss is a DOM event, not a thrown error — preventDefault
            // keeps the canvas restorable and we surface a restart prompt.
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              setGlLost(true);
            });
          }}
        >
          <Scene
            track={track}
            racers={view.racers}
            activeId={activeId}
            marbleKey={marbleKey}
            trails={view.trails}
            inPhysics={inPhysics}
            aimRef={aimRef}
            isAiming={isAiming}
            impulseRef={impulseRef}
            recenterRef={recenterRef}
            onRacerPos={handleRacerPos}
            onSettle={handleSettle}
            onAimDown={onAimDown}
            onAimMove={onAimMove}
            onAimUp={onAimUp}
          />
        </Canvas>
      </CanvasErrorBoundary>

      {glLost && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-950/80 text-center text-amber-50">
          <p className="text-lg font-semibold">Graphics context was lost.</p>
          <button
            onClick={() => {
              setGlLost(false);
              handleReplay();
            }}
            className="rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-slate-900 shadow-lg transition hover:bg-amber-400"
          >
            Tap to restart
          </button>
        </div>
      )}

      <HUD
        state={view}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onRecenter={() => { recenterRef.current = true; }}
        onMenu={() => setMenuOpen(true)}
      />
      {menuOpen && (
        <EscMenu
          onClose={() => setMenuOpen(false)}
          onResetMap={handleResetMap}
          onLobby={handleLobby}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          volume={volume}
          onVolumeChange={handleVolumeChange}
        />
      )}
      {phase === "VICTORY" && (
        <VictoryScreen state={view} onReplay={handleReplay} />
      )}
    </div>
  );
}
