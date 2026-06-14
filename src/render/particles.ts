// ============================================================================
// tour-de-sable — sand-burst particle system
// Short-lived pixels sprayed on collisions/bounces.
// ============================================================================

import type { Vector2D } from "@/game/types";
import { SAND_BURST_MIN, SAND_BURST_MAX } from "@/game/constants";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // frames remaining
  max: number;
  color: string;
}

const SAND_COLORS = ["#e9d8a6", "#d9c27e", "#c9b067", "#f0e6c0"];

export class ParticleSystem {
  private parts: Particle[] = [];

  /** Spawn 8-12 sand pixels spraying outward from a collision point. */
  burst(at: Vector2D): void {
    const n = SAND_BURST_MIN + Math.floor(Math.random() * (SAND_BURST_MAX - SAND_BURST_MIN + 1));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3.5;
      const life = 14 + Math.floor(Math.random() * 14);
      this.parts.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life,
        max: life,
        color: SAND_COLORS[Math.floor(Math.random() * SAND_COLORS.length)],
      });
    }
  }

  update(): void {
    for (const p of this.parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.life--;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  get count(): number {
    return this.parts.length;
  }
}
