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
import { applyLaunch, takeBotTurn, update } from "@/game/engine";
import { audio } from "@/audio/audio";
import { MAX_DRAG_DISTANCE, MARBLE_RADIUS } from "@/game/constants";
import Scene, { type AimState } from "@/render3d/Scene";
import LobbyVote from "./LobbyVote";
import HUD from "./HUD";
import VictoryScreen from "./VictoryScreen";

const BOT_THINK_MS = 700;
const WAVE_MS = 2200;

export default function GameCanvas() {
  const [view, setView] = useState<GameState>(createInitialState);
  const stateRef = useRef<GameState>(view);
  const [aim, setAim] = useState<AimState | null>(null);
  const [muted, setMuted] = useState(false);
  const [waveWarning, setWaveWarning] = useState(false);

  const draggingRef = useRef(false);
  const aimRef = useRef<AimState | null>(null);
  const botTimerRef = useRef<number | null>(null);
  const waveUntilRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);

  const publish = useCallback(() => setView({ ...stateRef.current }), []);

  // --- lobby selection ---
  const handleSelect = useCallback(
    (index: number) => {
      audio.resume();
      stateRef.current = selectTrack(stateRef.current, index);
      publish();
    },
    [publish],
  );

  const handleReplay = useCallback(() => {
    stateRef.current = createInitialState();
    setAim(null);
    aimRef.current = null;
    waveUntilRef.current = 0;
    publish();
  }, [publish]);

  // --- flick input (board coords from the scene's ground raycast) ---
  const onAimDown = useCallback((board: Vector2D) => {
    const s = stateRef.current;
    if (!isHumanInput(s)) return;
    const r = activeRacer(s);
    if (Math.hypot(board.x - r.pos.x, board.y - r.pos.y) > MARBLE_RADIUS * 5) return;
    draggingRef.current = true;
    audio.resume();
    const a = { dir: { x: 0, y: -1 }, power: 0 };
    aimRef.current = a;
    setAim(a);
  }, []);

  const onAimMove = useCallback((board: Vector2D) => {
    if (!draggingRef.current) return;
    const r = activeRacer(stateRef.current);
    const back = { x: r.pos.x - board.x, y: r.pos.y - board.y };
    const dist = Math.hypot(back.x, back.y);
    const a: AimState =
      dist < 1
        ? { dir: { x: 0, y: -1 }, power: 0 }
        : {
            dir: { x: back.x / dist, y: back.y / dist },
            power: Math.min(1, dist / MAX_DRAG_DISTANCE),
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
      applyLaunch(stateRef.current, { dir: a.dir, power: a.power });
      publish();
    }
  }, [publish]);

  // --- simulation loop ---
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = stateRef.current;

      if (s.phase === "TURN_CYCLE" && s.turnSubPhase === "PHYSICS") {
        const ev = update(s);
        for (const c of ev.collisions) {
          audio.clink(c.hard ? 1 : 0.5);
          if (c.hard) shakeRef.current = Math.max(shakeRef.current, 1.4);
        }
        if (ev.bounces.length > 0) {
          audio.thud();
          shakeRef.current = Math.max(shakeRef.current, 0.6);
        }
        if (ev.waveTriggered) {
          waveUntilRef.current = performance.now() + WAVE_MS;
          audio.startOcean();
          shakeRef.current = 1.6;
          setWaveWarning(true);
        }
        // Publish every physics frame so the camera + marbles follow live.
        setView({ ...s });
      }

      // Bot turn (after a short think), unless a wave is animating.
      if (
        isBotInput(s) &&
        botTimerRef.current == null &&
        performance.now() > waveUntilRef.current
      ) {
        botTimerRef.current = window.setTimeout(() => {
          botTimerRef.current = null;
          if (isBotInput(stateRef.current)) {
            takeBotTurn(stateRef.current);
            setView({ ...stateRef.current });
          }
        }, BOT_THINK_MS);
      }

      // Wave audio cleanup.
      if (waveUntilRef.current && performance.now() > waveUntilRef.current) {
        waveUntilRef.current = 0;
        audio.stopOcean();
        setWaveWarning(false);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (botTimerRef.current != null) clearTimeout(botTimerRef.current);
    };
  }, []);

  useEffect(() => {
    audio.setMuted(muted);
  }, [muted]);

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

  return (
    <div className="relative h-screen w-full overflow-hidden bg-sky-200">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [20, 28, 24], fov: 42 }}>
        <Scene
          track={track}
          racers={view.racers}
          activeId={activeId}
          tight={isHumanInput(view)}
          aim={aim}
          shakeRef={shakeRef}
          onAimDown={onAimDown}
          onAimMove={onAimMove}
          onAimUp={onAimUp}
        />
      </Canvas>

      <HUD
        state={view}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        waveWarning={waveWarning}
      />
      {phase === "VICTORY" && <VictoryScreen state={view} onReplay={handleReplay} />}
    </div>
  );
}
