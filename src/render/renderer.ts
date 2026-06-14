// ============================================================================
// tour-de-sable — main canvas renderer
// Draws the whole scene in board coordinates (the canvas is sized to the board
// and scaled via CSS). Pure drawing: reads state, writes pixels.
// ============================================================================

import type { GameState, Track, Vector2D, Racer } from "@/game/types";
import * as V from "@/game/vector";
import { centerlineXForList } from "@/game/track";
import { waveZoneTopY } from "@/game/wave";
import { MAX_DRAG_DISTANCE } from "@/game/constants";

export interface AimOverlay {
  origin: Vector2D;
  dir: Vector2D; // unit
  power: number; // 0..1
}

export interface RenderOpts {
  aim?: AimOverlay;
  /** Wave impact sweep progress 0..1 (lower-zone blue wave rising). */
  waveSweep?: number;
  /** Warning darkening 0..1. */
  warning?: number;
}

function tracePath(
  ctx: CanvasRenderingContext2D,
  track: Track,
  half: number,
): void {
  const line = track.centerline;
  ctx.beginPath();
  // up the left wall...
  line.forEach((wp, i) => {
    const x = wp.x - half;
    if (i === 0) ctx.moveTo(x, wp.y);
    else ctx.lineTo(x, wp.y);
  });
  // ...down the right wall
  for (let i = line.length - 1; i >= 0; i--) {
    ctx.lineTo(line[i].x + half, line[i].y);
  }
  ctx.closePath();
}

function drawSand(ctx: CanvasRenderingContext2D, track: Track): void {
  const g = ctx.createLinearGradient(0, 0, 0, track.height);
  g.addColorStop(0, "#e9d8a6");
  g.addColorStop(1, "#d9c27e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, track.width, track.height);
}

function drawRipples(ctx: CanvasRenderingContext2D, track: Track): void {
  const { angle, spacing } = track.ripple;
  const diag = Math.hypot(track.width, track.height);
  const dir = V.fromAngle(angle);
  const normal = V.fromAngle(angle + Math.PI / 2);
  ctx.save();
  ctx.strokeStyle = "rgba(180,150,90,0.35)";
  ctx.lineWidth = 2;
  const center = { x: track.width / 2, y: track.height / 2 };
  for (let d = -diag; d <= diag; d += spacing) {
    const p = V.add(center, V.scale(normal, d));
    const a = V.add(p, V.scale(dir, -diag));
    const b = V.add(p, V.scale(dir, diag));
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCorridor(ctx: CanvasRenderingContext2D, track: Track): void {
  // Shoulder band (full corridor) — slightly darker dry sand.
  tracePath(ctx, track, track.corridorHalfWidth);
  ctx.fillStyle = "#d7bd72";
  ctx.fill();

  // Racing lane — smoother, lighter.
  tracePath(ctx, track, track.laneHalfWidth);
  ctx.fillStyle = "#efe2b4";
  ctx.fill();

  // Corridor walls (out-of-bounds ledge).
  tracePath(ctx, track, track.corridorHalfWidth);
  ctx.strokeStyle = "rgba(120,90,40,0.9)";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Lane edge hint.
  tracePath(ctx, track, track.laneHalfWidth);
  ctx.strokeStyle = "rgba(150,120,60,0.4)";
  ctx.setLineDash([10, 12]);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawFinish(ctx: CanvasRenderingContext2D, track: Track): void {
  const y = track.finishY;
  const cx = centerlineXForList(track.centerline, y);
  const half = track.corridorHalfWidth;
  const squares = 10;
  const sq = (half * 2) / squares;
  ctx.save();
  for (let i = 0; i < squares; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#222" : "#fff";
    ctx.fillRect(cx - half + i * sq, y - 10, sq, 20);
  }
  ctx.restore();
}

function drawObstacles(ctx: CanvasRenderingContext2D, track: Track): void {
  for (const o of track.obstacles) {
    if (o.kind === "driftwood") {
      ctx.save();
      ctx.translate(o.pos.x, o.pos.y);
      ctx.rotate(o.angle);
      const g = ctx.createLinearGradient(0, -o.halfH, 0, o.halfH);
      g.addColorStop(0, "#a87c4f");
      g.addColorStop(1, "#7a5733");
      ctx.fillStyle = g;
      ctx.fillRect(-o.halfW, -o.halfH, o.halfW * 2, o.halfH * 2);
      ctx.strokeStyle = "rgba(60,40,20,0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-o.halfW, -o.halfH, o.halfW * 2, o.halfH * 2);
      ctx.restore();
    } else {
      const temp = "temporary" in o && o.temporary;
      ctx.beginPath();
      ctx.arc(o.pos.x, o.pos.y, o.radius, 0, Math.PI * 2);
      ctx.fillStyle =
        o.kind === "clamshell"
          ? "rgba(220,200,180,0.85)"
          : temp
            ? "rgba(40,120,70,0.7)"
            : "rgba(46,139,87,0.75)";
      ctx.fill();
      ctx.strokeStyle = "rgba(20,70,40,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function drawWaterlogged(
  ctx: CanvasRenderingContext2D,
  track: Track,
  topY: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(70,130,180,0.22)";
  ctx.fillRect(0, topY, track.width, track.height - topY);
  ctx.restore();
}

function drawMarble(ctx: CanvasRenderingContext2D, r: Racer, active: boolean): void {
  const { x, y } = r.pos;
  if (r.state === "tipped") ctx.globalAlpha = 0.4;

  // Shadow.
  ctx.beginPath();
  ctx.ellipse(x, y + r.radius * 0.5, r.radius * 0.9, r.radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fill();

  // Body with a soft highlight.
  const g = ctx.createRadialGradient(
    x - r.radius * 0.35,
    y - r.radius * 0.35,
    r.radius * 0.2,
    x,
    y,
    r.radius,
  );
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.25, r.color);
  g.addColorStop(1, "#00000055");
  ctx.beginPath();
  ctx.arc(x, y, r.radius, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  if (active) {
    ctx.beginPath();
    ctx.arc(x, y, r.radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawAim(ctx: CanvasRenderingContext2D, aim: AimOverlay): void {
  const { origin, dir, power } = aim;
  const len = power * MAX_DRAG_DISTANCE;
  const tip = V.add(origin, V.scale(dir, len));

  // Direction line.
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrow head.
  const back = V.scale(dir, -14);
  const left = V.add(tip, V.add(back, V.scale(V.perp(dir), 8)));
  const right = V.add(tip, V.add(back, V.scale(V.perp(dir), -8)));
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();

  // Power bar near the marble.
  const barW = 80;
  const barH = 8;
  const bx = origin.x - barW / 2;
  const by = origin.y + 30;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = power > 0.8 ? "#e63946" : power > 0.5 ? "#f4a261" : "#2a9d8f";
  ctx.fillRect(bx, by, barW * power, barH);
  ctx.restore();
}

/**
 * Draw a small track preview into a thumbnail canvas of size (w, h). Scales the
 * board down to fit and renders sand + corridor + obstacles + finish.
 */
export function drawTrackThumbnail(
  ctx: CanvasRenderingContext2D,
  track: Track,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.scale(w / track.width, h / track.height);
  drawSand(ctx, track);
  drawRipples(ctx, track);
  drawCorridor(ctx, track);
  drawFinish(ctx, track);
  drawObstacles(ctx, track);
  // Start grid markers.
  for (const p of track.startGrid) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fill();
  }
  ctx.restore();
}

/** Render the full scene. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  opts: RenderOpts = {},
): void {
  const track = state.track;
  if (!track) return;

  ctx.clearRect(0, 0, track.width, track.height);
  drawSand(ctx, track);
  drawRipples(ctx, track);
  drawCorridor(ctx, track);

  if (state.wave.phase === "aftermath" || state.wave.phase === "impact") {
    drawWaterlogged(ctx, track, waveZoneTopY(track));
  }

  drawFinish(ctx, track);
  drawObstacles(ctx, track);

  const activeId = state.turnOrder[state.activeTurn];
  for (const r of state.racers) {
    drawMarble(ctx, r, r.id === activeId);
  }

  if (opts.aim) drawAim(ctx, opts.aim);

  // Rogue wave impact sweep (translucent blue rising from the bottom).
  if (opts.waveSweep != null && opts.waveSweep > 0) {
    const topY = waveZoneTopY(track);
    const sweepH = (track.height - topY) * opts.waveSweep;
    const g = ctx.createLinearGradient(0, track.height - sweepH, 0, track.height);
    g.addColorStop(0, "rgba(70,130,180,0.15)");
    g.addColorStop(1, "rgba(40,90,150,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, track.height - sweepH, track.width, sweepH);
  }

  // Warning cloud darkening.
  if (opts.warning != null && opts.warning > 0) {
    ctx.fillStyle = `rgba(20,30,50,${0.35 * opts.warning})`;
    ctx.fillRect(0, 0, track.width, track.height);
  }
}
