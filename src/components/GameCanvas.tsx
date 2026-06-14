"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, Vector2D } from "@/game/types";
import {
  createInitialState,
  selectTrack,
  isHumanInput,
  isBotInput,
  activeRacer,
} from "@/game/stateMachine";
import { applyLaunch, takeBotTurn, update } from "@/game/engine";
import { drawScene, type AimOverlay } from "@/render/renderer";
import { TrailLayer } from "@/render/trails";
import { ParticleSystem } from "@/render/particles";
import { ScreenShake } from "@/render/effects";
import { audio } from "@/audio/audio";
import { MAX_DRAG_DISTANCE, MARBLE_RADIUS } from "@/game/constants";
import LobbyVote from "./LobbyVote";
import HUD from "./HUD";
import VictoryScreen from "./VictoryScreen";

const BOT_THINK_MS = 650;
const WAVE_WARNING_MS = 1100;
const WAVE_IMPACT_MS = 1100;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // React state to drive overlays (HUD / lobby / victory). The rAF loop mutates
  // `stateRef` for performance; we publish shallow snapshots into `view` at turn
  // boundaries so the UI re-renders without reading refs during render.
  const [view, setView] = useState<GameState>(createInitialState);
  const [phase, setPhase] = useState<GameState["phase"]>("LOBBY_VOTE");
  const [waveWarning, setWaveWarning] = useState(false);
  const [muted, setMuted] = useState(false);

  // Mutable game world (kept out of React state for per-frame performance).
  // Seeded from the same object `view` was initialised with.
  const stateRef = useRef<GameState>(view);
  const trailRef = useRef<TrailLayer | null>(null);
  const particlesRef = useRef(new ParticleSystem());
  const shakeRef = useRef(new ScreenShake());
  const aimRef = useRef<AimOverlay | null>(null);
  const draggingRef = useRef(false);
  const botTimerRef = useRef<number | null>(null);
  const waveAnimRef = useRef<{ start: number } | null>(null);

  /** Republish the current world into React state (new ref => re-render). */
  const publish = useCallback(() => setView({ ...stateRef.current }), []);

  // --- coordinate mapping: client px -> board px ---
  const toBoard = useCallback((clientX: number, clientY: number): Vector2D => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * c.width,
      y: ((clientY - rect.top) / rect.height) * c.height,
    };
  }, []);

  // --- start a game on a chosen track ---
  const handleSelect = useCallback((index: number) => {
    audio.resume();
    const s = selectTrack(stateRef.current, index);
    stateRef.current = s;
    trailRef.current = new TrailLayer(s.track!.width, s.track!.height);
    setPhase("TURN_CYCLE");
    publish();
  }, [publish]);

  const handleReplay = useCallback(() => {
    stateRef.current = createInitialState();
    aimRef.current = null;
    waveAnimRef.current = null;
    setWaveWarning(false);
    setPhase("LOBBY_VOTE");
    publish();
  }, [publish]);

  // --- pointer input (human flick) ---
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const onDown = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!isHumanInput(s)) return;
      const p = toBoard(e.clientX, e.clientY);
      const r = activeRacer(s);
      if (Math.hypot(p.x - r.pos.x, p.y - r.pos.y) > MARBLE_RADIUS * 3) return;
      draggingRef.current = true;
      audio.resume();
      aimRef.current = { origin: { ...r.pos }, dir: { x: 0, y: -1 }, power: 0 };
      c.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const s = stateRef.current;
      const r = activeRacer(s);
      const p = toBoard(e.clientX, e.clientY);
      // Drag backward from the marble; launch goes the opposite way (slingshot).
      const back = { x: r.pos.x - p.x, y: r.pos.y - p.y };
      const dist = Math.hypot(back.x, back.y);
      if (dist < 1) {
        aimRef.current = { origin: { ...r.pos }, dir: { x: 0, y: -1 }, power: 0 };
        return;
      }
      aimRef.current = {
        origin: { ...r.pos },
        dir: { x: back.x / dist, y: back.y / dist },
        power: Math.min(1, dist / MAX_DRAG_DISTANCE),
      };
    };

    const onUp = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      const aim = aimRef.current;
      aimRef.current = null;
      try {
        c.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (aim && aim.power > 0.05) {
        applyLaunch(stateRef.current, { dir: aim.dir, power: aim.power });
      }
    };

    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    return () => {
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
    };
  }, [toBoard, phase]);

  // --- main render / simulation loop ---
  useEffect(() => {
    let raf = 0;
    let frameCount = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const c = canvasRef.current;
      const s = stateRef.current;
      if (!c || !s.track) return;
      const ctx = c.getContext("2d")!;

      // 1) Simulate the physics phase.
      if (s.phase === "TURN_CYCLE" && s.turnSubPhase === "PHYSICS") {
        const ev = update(s);
        for (const col of ev.collisions) {
          particlesRef.current.burst(col.point);
          audio.clink(col.hard ? 1 : 0.5);
          if (col.hard) shakeRef.current.trigger(1);
        }
        for (const b of ev.bounces) particlesRef.current.burst(b.point);
        if (ev.waveTriggered) {
          waveAnimRef.current = { start: performance.now() };
          audio.startOcean();
          shakeRef.current.trigger(1);
          setWaveWarning(true);
        }
        if (ev.settled) publish();
        if (s.winnerId) setPhase("VICTORY");
      }

      // 2) Schedule a bot's turn (after a short "thinking" beat).
      if (
        isBotInput(s) &&
        botTimerRef.current == null &&
        waveAnimRef.current == null
      ) {
        botTimerRef.current = window.setTimeout(() => {
          botTimerRef.current = null;
          if (isBotInput(stateRef.current)) takeBotTurn(stateRef.current);
        }, BOT_THINK_MS);
      }

      // 3) Wave animation timeline (warning -> impact sweep).
      let waveSweep = 0;
      let warning = 0;
      if (waveAnimRef.current) {
        const el = performance.now() - waveAnimRef.current.start;
        if (el < WAVE_WARNING_MS) {
          warning = Math.sin((el / WAVE_WARNING_MS) * Math.PI);
          if (frameCount % 8 === 0) shakeRef.current.trigger(0.5);
        } else if (el < WAVE_WARNING_MS + WAVE_IMPACT_MS) {
          const t = (el - WAVE_WARNING_MS) / WAVE_IMPACT_MS;
          waveSweep = t < 0.6 ? t / 0.6 : 1 - (t - 0.6) / 0.4;
        } else {
          waveAnimRef.current = null;
          audio.stopOcean();
          setWaveWarning(false);
        }
      }

      // 4) Trails + particles.
      const trail = trailRef.current;
      if (trail) trail.record(s.racers);
      particlesRef.current.update();

      // 5) Draw.
      const shake = shakeRef.current.step();
      ctx.save();
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.translate(shake.x, shake.y);
      if (trail) ctx.drawImage(trail.canvas, 0, 0);
      drawScene(ctx, s, { aim: aimRef.current ?? undefined, waveSweep, warning });
      particlesRef.current.draw(ctx);
      ctx.restore();

      frameCount++;
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (botTimerRef.current != null) clearTimeout(botTimerRef.current);
    };
  }, [publish]);

  // Keep audio mute in sync.
  useEffect(() => {
    audio.setMuted(muted);
  }, [muted]);

  const track = view.track;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-slate-800 via-sky-900 to-amber-950">
      {phase === "LOBBY_VOTE" ? (
        <LobbyVote tracks={view.lobbyTracks} onSelect={handleSelect} />
      ) : (
        <div className="diorama relative">
          <div className="diorama-board relative">
            <canvas
              ref={canvasRef}
              width={track?.width ?? 900}
              height={track?.height ?? 1400}
              className="block h-[80vh] max-h-[1400px] w-auto touch-none"
            />
            <div className="dof-top" />
            <div className="dof-bottom" />
          </div>
          <HUD
            state={view}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            waveWarning={waveWarning}
          />
          {phase === "VICTORY" && (
            <VictoryScreen state={view} onReplay={handleReplay} />
          )}
        </div>
      )}
    </div>
  );
}
