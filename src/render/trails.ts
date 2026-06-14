// ============================================================================
// tour-de-sable — persistent sand-trail layer
// Marble ruts are drawn onto a separate offscreen canvas that fades over time,
// leaving alpha-decayed line segments behind moving marbles. The Coast-Glider
// AI conceptually exploits these ruts (we approximate that via the centerline).
// ============================================================================

import type { Racer } from "@/game/types";

export class TrailLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private last = new Map<string, { x: number; y: number }>();
  private fadeTick = 0;

  constructor(width: number, height: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d")!;
  }

  /** Record a segment for each moving marble since the previous frame. */
  record(racers: Racer[]): void {
    for (const r of racers) {
      const prev = this.last.get(r.id);
      if (r.state === "moving" && prev) {
        this.ctx.strokeStyle = hexToRgba(r.color, 0.18);
        this.ctx.lineWidth = r.radius * 0.9;
        this.ctx.lineCap = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(prev.x, prev.y);
        this.ctx.lineTo(r.pos.x, r.pos.y);
        this.ctx.stroke();
      }
      this.last.set(r.id, { x: r.pos.x, y: r.pos.y });
    }

    // Periodically fade the whole layer so old ruts dissolve.
    if (++this.fadeTick % 6 === 0) this.fade();
  }

  private fade(): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = "destination-out";
    this.ctx.fillStyle = "rgba(0,0,0,0.035)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.last.clear();
  }
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
