"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { GameState, Vector2D } from "@/game/types";
import {
  createInitialState,
  selectTrack,
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
import LobbyVote from "./LobbyVote";
import HUD from "./HUD";
import VictoryScreen from "./VictoryScreen";

const BOT_THINK_MS = 750;

export default function GameCanvas() {
  const [view, setView] = useState<GameState>(createInitialState);
  const stateRef = useRef<GameState>(view);
  const [aim, setAim] = useState<AimState | null>(null);
  const [muted, setMuted] = useState(false);

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
    setAim(null);
    aimRef.current = null;
    publish();
  }, [publish]);

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
    const a: AimState = { dir: { x: 0, y: 1 }, power: 0 };
    aimRef.current = a;
    setAim(a);
  }, []);

  const onAimMove = useCallback((ground: Vector2D) => {
    if (!draggingRef.current) return;
    const r = activeRacer(stateRef.current);
    const back = { x: r.pos.x - ground.x, y: r.pos.y - ground.y };
    const dist = Math.hypot(back.x, back.y);
    const a: AimState =
      dist < 0.5
        ? { dir: { x: 0, y: 1 }, power: 0 }
        : {
            dir: { x: back.x / dist, y: back.y / dist },
            power: Math.min(1, dist / MAX_DRAG_WORLD),
          };
    aimRef.current = a;
    setAim(a);
  }, []);

  const onAimUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const a = aimRef.current;
    aimRef.current = null;
    setAim(null);
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

  return (
    <div className="relative h-screen w-full overflow-hidden bg-sky-200">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 40, -18], fov: 52 }}
      >
        <Scene
          track={track}
          racers={view.racers}
          activeId={activeId}
          trails={view.trails}
          inPhysics={inPhysics}
          aim={aim}
          impulseRef={impulseRef}
          recenterRef={recenterRef}
          onRacerPos={handleRacerPos}
          onSettle={handleSettle}
          onAimDown={onAimDown}
          onAimMove={onAimMove}
          onAimUp={onAimUp}
        />
      </Canvas>

      <HUD
        state={view}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onRecenter={() => { recenterRef.current = true; }}
      />
      {phase === "VICTORY" && (
        <VictoryScreen state={view} onReplay={handleReplay} />
      )}
    </div>
  );
}
